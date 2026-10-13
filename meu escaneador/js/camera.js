/* ============================================================
   camera.js — gerenciamento da câmera, captura e detecção

   Funções:
   - iniciar/finalizar stream
   - troca de câmera (traseira/frontal)
   - flash (tocha)
   - loop de detecção automática
   - captura de frame em alta resolução
   ============================================================ */
(function (global) {
  'use strict';

  var Cam = {};
  var stream = null;
  var video = null;
  var canvasOverlay = null;
  var ctxOverlay = null;
  var maskOverlay = null;

  var estado = {
    ligado: false,
    cameraTraseira: true,
    flashLigado: false,
    capturaAuto: true,
    gradeVisivel: false,
    filtroPrevia: 'auto',
    ultimaDeteccao: null,
    framesSemPapel: 0,
    framesComPapel: 0,
    cooldownAuto: 0,
    resolucaoAlvo: { largura: 1920, altura: 1080 },
    fpsDeteccao: 6
  };

  var callbacks = {
    aoFrame: null,
    aoDeteccao: null,
    aoCaptura: null,
    aoErro: null,
    aoStatus: null
  };

  /* --------------------------------------------- lista câmeras */
  Cam.listar = function () {
    return navigator.mediaDevices.enumerateDevices()
      .then(function (disps) {
        return disps.filter(function (d) { return d.kind === 'videoinput'; });
      });
  };

  /* --------------------------------------------- escolher dispositivo */
  function escolherTraseira(disps) {
    for (var i = 0; i < disps.length; i++) {
      var label = (disps[i].label || '').toLowerCase();
      if (label.indexOf('back') >= 0 || label.indexOf('rear') >= 0 || label.indexOf('environment') >= 0 || label.indexOf('traseira') >= 0) {
        return disps[i].deviceId;
      }
    }
    return disps[disps.length - 1] ? disps[disps.length - 1].deviceId : null;
  }

  function escolherFrontal(disps) {
    for (var i = 0; i < disps.length; i++) {
      var label = (disps[i].label || '').toLowerCase();
      if (label.indexOf('front') >= 0 || label.indexOf('user') >= 0 || label.indexOf('frontal') >= 0 || label.indexOf('selfie') >= 0) {
        return disps[i].deviceId;
      }
    }
    return disps[0] ? disps[0].deviceId : null;
  }

  /* --------------------------------------------- iniciar */
  Cam.iniciar = function (elVideo, elOverlay, elMascara, cbs) {
    video = elVideo;
    canvasOverlay = elOverlay;
    ctxOverlay = canvasOverlay.getContext('2d');
    maskOverlay = elMascara;
    callbacks = Object.assign({}, callbacks, cbs || {});

    if (estado.ligado) return Promise.resolve();

    return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(function (str) {
        stream = str;
        video.srcObject = stream;
        return video.play();
      })
      .then(function () {
        estado.ligado = true;
        Cam._ajustarCanvas();
        Cam._trocarParaTraseira();
        Cam._loopDeteccao();
        if (callbacks.aoStatus) callbacks.aoStatus('iniciado');
        return true;
      })
      .catch(function (err) {
        estado.ligado = false;
        if (callbacks.aoErro) callbacks.aoErro(err);
        throw err;
      });
  };

  Cam._ajustarCanvas = function () {
    if (!video || !canvasOverlay) return;
    var w = video.videoWidth || video.clientWidth || 640;
    var h = video.videoHeight || video.clientHeight || 480;
    canvasOverlay.width = w;
    canvasOverlay.height = h;
    canvasOverlay.style.width = w + 'px';
    canvasOverlay.style.height = h + 'px';
    if (maskOverlay) {
      maskOverlay.style.width = w + 'px';
      maskOverlay.style.height = h + 'px';
    }
  };

  Cam._trocarParaTraseira = function () {
    return Cam.listar().then(function (disps) {
      var id = estado.cameraTraseira ? escolherTraseira(disps) : escolherFrontal(disps);
      if (!id) return;
      var constraints = {
        video: {
          deviceId: { exact: id },
          width: { ideal: estado.resolucaoAlvo.largura },
          height: { ideal: estado.resolucaoAlvo.altura },
          facingMode: estado.cameraTraseira ? 'environment' : 'user'
        }
      };
      return navigator.mediaDevices.getUserMedia(constraints)
        .then(function (novo) {
          if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
          stream = novo;
          video.srcObject = stream;
          return video.play();
        })
        .then(function () { Cam._ajustarCanvas(); });
    });
  };

  Cam.trocar = function () {
    estado.cameraTraseira = !estado.cameraTraseira;
    return Cam._trocarParaTraseira().then(function () {
      if (callbacks.aoStatus) callbacks.aoStatus('camera_trocada');
    });
  };

  Cam.flash = function (ligar) {
    if (!stream) return Promise.resolve(false);
    var track = stream.getVideoTracks()[0];
    if (!track) return Promise.resolve(false);
    var caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) return Promise.resolve(false);
    return track.applyConstraints({ advanced: [{ torch: !!ligar }] })
      .then(function () {
        estado.flashLigado = !!ligar;
        if (callbacks.aoStatus) callbacks.aoStatus(estado.flashLigado ? 'flash_on' : 'flash_off');
        return true;
      })
      .catch(function () { return false; });
  };

  /* --------------------------------------------- loop de detecção */
  var rafId = null;
  var ultimoTempoDet = 0;

  Cam._loopDeteccao = function () {
    if (!estado.ligado) return;
    var agora = performance.now();
    var intervalo = 1000 / Math.max(1, estado.fpsDeteccao);

    if (agora - ultimoTempoDet >= intervalo) {
      ultimoTempoDet = agora;
      Cam._detectarFrame();
    }
    rafId = requestAnimationFrame(Cam._loopDeteccao);
  };

  Cam._detectarFrame = function () {
    if (!video || video.readyState < 2) return;
    var w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;

    /* canvas temporário pequeno para detecção rápida */
    var detW = 320, detH = Math.round(h * detW / w);
    var temp = U.novoCanvas(detW, detH);
    var tctx = temp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(video, 0, 0, detW, detH);
    var imgData = tctx.getImageData(0, 0, detW, detH);

    var resultado = Detectar.detectar(imgData, { minConfianca: 0.18 });

    estado.ultimaDeteccao = resultado;
    if (callbacks.aoDeteccao) callbacks.aoDeteccao(resultado, { w: w, h: h });

    Cam._desenharOverlay(resultado, w, h);

    /* captura automática */
    if (estado.capturaAuto && estado.cooldownAuto === 0) {
      var desc = Detectar.descrever(resultado);
      if (desc.nivel === 'ok' && resultado.confianca >= 0.52) {
        estado.framesComPapel++;
        if (estado.framesComPapel >= 2) {
          estado.cooldownAuto = 90; /* ~1.5s a 60fps */
          estado.framesComPapel = 0;
          Cam.capturar();
        }
      } else {
        estado.framesComPapel = 0;
        estado.framesSemPapel++;
      }
    }
    if (estado.cooldownAuto > 0) estado.cooldownAuto--;
  };

  Cam._desenharOverlay = function (det, vW, vH) {
    if (!ctxOverlay) return;
    ctxOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    ctxOverlay.lineWidth = 3;
    ctxOverlay.lineJoin = 'round';
    ctxOverlay.lineCap = 'round';

    if (det && det.cantos && det.cantos.length === 4) {
      var escalaX = canvasOverlay.width / vW;
      var escalaY = canvasOverlay.height / vH;
      var c = det.cantos;

      ctxOverlay.beginPath();
      ctxOverlay.moveTo(c[0].x * escalaX, c[0].y * escalaY);
      for (var i = 1; i < 4; i++) ctxOverlay.lineTo(c[i].x * escalaX, c[i].y * escalaY);
      ctxOverlay.closePath();

      var nivel = Detectar.descrever(det).nivel;
      if (nivel === 'ok') {
        ctxOverlay.strokeStyle = '#2ee6a8';
        ctxOverlay.fillStyle = 'rgba(46,230,168,0.08)';
      } else if (nivel === 'alerta') {
        ctxOverlay.strokeStyle = '#ffb02e';
        ctxOverlay.fillStyle = 'rgba(255,176,46,0.08)';
      } else {
        ctxOverlay.strokeStyle = '#ff5f6d';
        ctxOverlay.fillStyle = 'rgba(255,95,109,0.08)';
      }
      ctxOverlay.fill();
      ctxOverlay.stroke();

      /* cantos */
      ctxOverlay.fillStyle = '#2ee6a8';
      for (i = 0; i < 4; i++) {
        var cx = c[i].x * escalaX, cy = c[i].y * escalaY;
        ctxOverlay.beginPath();
        ctxOverlay.arc(cx, cy, 7, 0, Math.PI * 2);
        ctxOverlay.fill();
      }

      /* máscara (quad complementar) */
      if (maskOverlay) {
        var path = 'polygon(';
        for (i = 0; i < 4; i++) {
          var px = (c[i].x / vW) * 100;
          var py = (c[i].y / vH) * 100;
          path += px + '% ' + py + '%';
          if (i < 3) path += ', ';
        }
        path += ')';
        maskOverlay.style.clipPath = path;
        maskOverlay.style.webkitClipPath = path;
      }
    } else {
      if (maskOverlay) {
        maskOverlay.style.clipPath = 'none';
        maskOverlay.style.webkitClipPath = 'none';
      }
      /* grade opcional */
      if (estado.gradeVisivel) {
        ctxOverlay.strokeStyle = 'rgba(255,255,255,0.18)';
        ctxOverlay.lineWidth = 1;
        var thirdW = canvasOverlay.width / 3;
        var thirdH = canvasOverlay.height / 3;
        for (i = 1; i < 3; i++) {
          ctxOverlay.beginPath();
          ctxOverlay.moveTo(thirdW * i, 0);
          ctxOverlay.lineTo(thirdW * i, canvasOverlay.height);
          ctxOverlay.stroke();
          ctxOverlay.beginPath();
          ctxOverlay.moveTo(0, thirdH * i);
          ctxOverlay.lineTo(canvasOverlay.width, thirdH * i);
          ctxOverlay.stroke();
        }
      }
    }
  };

  /* --------------------------------------------- captura em alta res */
  Cam.capturar = function () {
    return new Promise(function (resolve, reject) {
      var tentativas = 0;
      var maxTentativas = 10;

      function tentar() {
        if (!video) return reject(new Error('Vídeo não inicializado'));
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          var w = video.videoWidth, h = video.videoHeight;
          var canvas = U.novoCanvas(w, h);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          var imgData = ctx.getImageData(0, 0, w, h);
          /* ... resto do código */
          var det = estado.ultimaDeteccao;
          if (!det || !det.cantos || det.confianca < 0.5) {
            var imgDet = U.redimensionarPara(video, 640);
            if (imgDet) {
              var detFull = Detectar.detectar(U.canvasParaImagem(imgDet), { minConfianca: 0.15 });
              if (detFull && detFull.cantos) {
                var ex = w / imgDet.width, ey = h / imgDet.height;
                detFull.cantos = detFull.cantos.map(function (pt) {
                  return { x: pt.x * ex, y: pt.y * ey };
                });
                det = detFull;
              }
            }
          }
          if (callbacks.aoCaptura) callbacks.aoCaptura(imgData, det);
          U.vibrar([12, 8, 12]);
          return resolve({ imagem: imgData, deteccao: det });
        }
        if (tentativas >= maxTentativas) {
          return reject(new Error('Vídeo não ficou pronto a tempo'));
        }
        tentativas++;
        setTimeout(tentar, 100);
      }
      tentar();
    });
  };

    /* detecta no frame full-res se não detectou no preview */
    var det = estado.ultimaDeteccao;
    if (!det || !det.cantos || det.confianca < 0.5) {
      var imgDet = U.redimensionarPara(video, 640);
      if (imgDet) {
        var detFull = Detectar.detectar(U.canvasParaImagem(imgDet), { minConfianca: 0.15 });
        if (detFull && detFull.cantos) {
          var ex = w / imgDet.width, ey = h / imgDet.height;
          detFull.cantos = detFull.cantos.map(function (pt) {
            return { x: pt.x * ex, y: pt.y * ey };
          });
          det = detFull;
        }
      }
    }

    if (callbacks.aoCaptura) callbacks.aoCaptura(imgData, det);
    U.vibrar([12, 8, 12]);
    return Promise.resolve({ imagem: imgData, deteccao: det });
  };

  /* --------------------------------------------- captura manual (galeria) */
  Cam.importarArquivo = function (arquivo) {
    return U.arquivoParaImagem(arquivo).then(function (img) {
      var canvas = U.novoCanvas(img.width, img.height);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var imgData = ctx.getImageData(0, 0, img.width, img.height);
      var det = Detectar.detectar(imgData, { minConfianca: 0.1 });
      if (callbacks.aoCaptura) callbacks.aoCaptura(imgData, det);
      return { imagem: imgData, deteccao: det };
    });
  };

  /* --------------------------------------------- finalização */
  Cam.parar = function () {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (video) { video.srcObject = null; }
    estado.ligado = false;
    estado.flashLigado = false;
    if (ctxOverlay) ctxOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
    if (maskOverlay) {
      maskOverlay.style.clipPath = 'none';
      maskOverlay.style.webkitClipPath = 'none';
    }
  };

  Cam.estado = function () { return estado; };

  global.Camera = Cam;
})(window);