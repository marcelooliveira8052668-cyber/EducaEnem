/* ============================================================
   util.js — funções utilitárias do escaneador
   ============================================================ */
(function (global) {
  'use strict';

  var U = {};

  /* -------------------------------------------------- controle */
  U.porId = function (id) { return document.getElementById(id); };

  U.limitar = function (valor, min, max) {
    return valor < min ? min : (valor > max ? max : valor);
  };

  U.preencherZero = function (n, total) {
    var s = String(n);
    while (s.length < total) s = '0' + s;
    return s;
  };

  /* -------------------------------------------------- tempo */
  U.formatarData = function (ts) {
    var d = new Date(ts);
    var hoje = new Date();
    var mesmoDia = d.toDateString() === hoje.toDateString();
    var hh = U.preencherZero(d.getHours(), 2);
    var mm = U.preencherZero(d.getMinutes(), 2);
    if (mesmoDia) return 'hoje às ' + hh + ':' + mm;
    var ontem = new Date(hoje.getTime() - 86400000);
    if (d.toDateString() === ontem.toDateString()) return 'ontem às ' + hh + ':' + mm;
    var dia = U.preencherZero(d.getDate(), 2);
    var mes = U.preencherZero(d.getMonth() + 1, 2);
    var ano = String(d.getFullYear()).slice(0, 2) === String(hoje.getFullYear()).slice(0, 2) ? '' : '/' + d.getFullYear();
    return dia + '/' + mes + ano + ' às ' + hh + ':' + mm;
  };

  /* -------------------------------------------------- toasts */
  var caixaToasts = null;
  U.toast = function (mensagem, tipo, tempo) {
    if (!caixaToasts) caixaToasts = U.porId('toasts');
    if (!caixaToasts) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (tipo || 'info');
    el.textContent = mensagem;
    caixaToasts.appendChild(el);
    var t = tempo || 2600;
    setTimeout(function () {
      el.classList.add('saindo');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, t);
    return el;
  };

  /* -------------------------------------------------- modal */
  U.modal = function (titulo, texto, botoes) {
    return new Promise(function (resolver) {
      var raiz = U.porId('modal');
      var tEl = U.porId('modalTitulo');
      var pEl = U.porId('modalTexto');
      var bEl = U.porId('modalBotoes');
      tEl.textContent = titulo || '';
      pEl.textContent = texto || '';
      bEl.innerHTML = '';

      function fechar(valor) {
        raiz.hidden = true;
        document.removeEventListener('keydown', aoTeclar);
        resolver(valor);
      }
      function aoTeclar(e) {
        if (e.key === 'Escape') fechar(null);
        if (e.key === 'Enter') fechar(valorPadrao);
      }

      var valorPadrao = null;
      var lista = botoes || [{ texto: 'OK', valor: true, destaque: true }];
      lista.forEach(function (b) {
        var botao = document.createElement('button');
        botao.textContent = b.texto;
        botao.className = b.destaque ? 'destaque' : (b.perigo ? 'perigo' : '');
        botao.addEventListener('click', function () { fechar(b.valor); });
        bEl.appendChild(botao);
        if (b.destaque) valorPadrao = b.valor;
      });

      raiz.hidden = false;
      document.addEventListener('keydown', aoTeclar);
      var primeiro = bEl.querySelector('button');
      if (primeiro) setTimeout(function () { primeiro.focus(); }, 40);
    });
  };

  /* -------------------------------------------------- canvas */
  U.novoCanvas = function (largura, altura) {
    var c = document.createElement('canvas');
    c.width = largura;
    c.height = altura;
    return c;
  };

  U.contexto2d = function (canvas) {
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return ctx;
  };

  U.imagemDeDesenho = function (desenho, larguraMax, alturaMax, forcaCaber) {
    var lw = desenho.width || desenho.videoWidth || 0;
    var lh = desenho.height || desenho.videoHeight || 0;
    var escalaX = larguraMax / lw;
    var escalaY = alturaMax / lh;
    var escala = forcaCaber ? Math.max(escalaX, escalaY) : Math.min(escalaX, escalaY);
    if (!isFinite(escala) || escala <= 0) escala = 1;
    var lar = Math.max(1, Math.round(lw * escala));
    var alt = Math.max(1, Math.round(lh * escala));
    var canvas = U.novoCanvas(lar, alt);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(desenho, 0, 0, lar, alt);
    return canvas;
  };

  /* Reduz uma imagem (canvas ou video) para no máximo `maxLado` pixels,
     mantendo a proporção. Retorna um canvas já com ImageData pronto. */
  U.redimensionarPara = function (fonte, maxLado) {
    var lw = fonte.videoWidth || fonte.width || 0;
    var lh = fonte.videoHeight || fonte.height || 0;
    if (!lw || !lh) return null;
    var escala = Math.min(1, maxLado / Math.max(lw, lh));
    var lar = Math.max(2, Math.round(lw * escala));
    var alt = Math.max(2, Math.round(lh * escala));
    var canvas = U.novoCanvas(lar, alt);
    var ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    ctx.drawImage(fonte, 0, 0, lar, alt);
    return canvas;
  };

  /* -------------------------------------------------- arquivos */
  U.nomeSeguro = function (texto) {
    var t = (texto || 'documento').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (t || 'documento').toLowerCase();
  };

  U.carimbo = function () {
    var d = new Date();
    return d.getFullYear() + '-' +
           U.preencherZero(d.getMonth() + 1, 2) + '-' +
           U.preencherZero(d.getDate(), 2) + '-' +
           U.preencherZero(d.getHours(), 2) +
           U.preencherZero(d.getMinutes(), 2) +
           U.preencherZero(d.getSeconds(), 2);
  };

  U.baixar = function (blob, nomeArquivo) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
    }, 400);
  };

  /* -------------------------------------------------- imagem para processamento */
  U.canvasParaImagem = function (canvas) {
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };

  U.bytesParaPNG = function (canvas) {
    return new Promise(function (resolver) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) { resolver(blob); }, 'image/png');
      } else {
        var data = canvas.toDataURL('image/png');
        var partes = data.split(',');
        var bin = atob(partes[1]);
        var buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        resolver(new Blob([buf], { type: 'image/png' }));
      }
    });
  };

  U.bytesParaJPEG = function (canvas, qualidade) {
    return new Promise(function (resolver) {
      var q = (typeof qualidade === 'number') ? qualidade : 0.9;
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) { resolver(blob); }, 'image/jpeg', q);
      } else {
        var data = canvas.toDataURL('image/jpeg', q);
        var partes = data.split(',');
        var bin = atob(partes[1]);
        var buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        resolver(new Blob([buf], { type: 'image/jpeg' }));
      }
    });
  };

  /* Carrega um Blob num <img> */
  U.blobParaImagem = function (blob) {
    return new Promise(function (resolver, rejeitar) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolver(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        rejeitar(new Error('Não foi possível abrir a imagem.'));
      };
      img.src = url;
    });
  };

  U.arquivoParaImagem = function (arquivo) {
    return U.blobParaImagem(arquivo);
  };

  /* -------------------------------------------------- eventos */
  U.ao = function (alvo, tipo, tratador, opcoes) {
    alvo.addEventListener(tipo, tratador, opcoes || { passive: false });
    return { alvo: alvo, tipo: tipo, tratador: tratador, opcoes: opcoes || {} };
  };
  U.limparToques = function (registros) {
    (registros || []).forEach(function (r) {
      if (r && r.alvo) r.alvo.removeEventListener(r.tipo, r.tratador, r.opcoes);
    });
  };

  /* -------------------------------------------------- haptica */
  U.vibrar = function (padrao) {
    try {
      if (navigator.vibrate) navigator.vibrate(padrao || 18);
    } catch (e) { /* ignorado */ }
  };

  /* -------------------------------------------------- separar gestos */
  U.gesto = function (alvo, opcoes) {
    var o = opcoes || {};
    var ultimo = null;
    var ativo = false;
    function registrar(e) {
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }
    function inicio(e) {
      ativo = true;
      ultimo = registrar(e);
      if (o.aoIniciar) o.aoIniciar(ultimo, e);
    }
    function mover(e) {
      if (!ativo || !ultimo) return;
      var p = registrar(e);
      var dx = p.x - ultimo.x;
      var dy = p.y - ultimo.y;
      ultimo = p;
      if (o.aoMover) o.aoMover(dx, dy, p, e);
    }
    function fim(e) {
      if (!ativo) return;
      ativo = false;
      ultimo = null;
      if (o.aoTerminar) o.aoTerminar(e);
    }
    alvo.addEventListener('pointerdown', inicio);
    global.addEventListener('pointermove', mover);
    global.addEventListener('pointerup', fim);
    global.addEventListener('pointercancel', fim);
  };

  global.U = U;
})(window);
