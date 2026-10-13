/* ============================================================
   app.js — lógica principal do Escaneador Profissional

   Conecta: câmera, detecção, warp, filtros, PDF, banco, UI
   ============================================================ */
(function (global) {
  'use strict';

  var App = {};

  /* referências de UI */
  var els = {};

  /* estado da sessão de escaneamento */
  var sessao = {
    paginas: [],
    filtroAtual: 'auto',
    modoCamera: 'auto',
    gradeLigada: false,
    flashLigado: false
  };

  /* -------------------------------------------------- iniciar */
  App.iniciar = function () {
    App._cacheElementos();
    App._ligarEventos();
    App._verificarInstalavel();
    App._restaurarEstado();
    App._verificarPermissoes();

    /* Service Worker para offline */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* ignora */ });
    }

    Telas.mostrar('inicio');
  };

  App._cacheElementos = function () {
    /* início */
    els.btnEscanear = U.porId('btnEscanear');
    els.btnImportarGaleria = U.porId('btnImportarGaleria');
    els.btnDocumentos = U.porId('btnDocumentos');
    els.btnVerTodos = U.porId('btnVerTodos');
    els.btnInstalar = U.porId('btnInstalar');
    els.gradeRecentes = U.porId('gradeRecentes');
    els.vazioRecentes = U.porId('vazioRecentes');
    els.alertaHttp = U.porId('alertaHttp');
    els.textoHttp = U.porId('textoHttp');

    /* câmera */
    els.video = U.porId('video');
    els.overlay = U.porId('overlay');
    els.mascaraOverlay = U.porId('mascaraOverlay');
    els.statusCamera = U.porId('statusCamera');
    els.textoStatus = U.porId('textoStatus');
    els.tiraCamera = U.porId('tiraCamera');
    els.miniaturasVivas = U.porId('miniaturasVivas');
    els.contadorPaginas = U.porId('contadorPaginas');
    els.btnDisparar = U.porId('btnDisparar');
    els.btnFecharCamera = U.porId('btnFecharCamera');
    els.btnImportRapido = U.porId('btnImportRapido');
    els.btnFlash = U.porId('btnFlash');
    els.btnTrocarCamera = U.porId('btnTrocarCamera');
    els.btnGrade = U.porId('btnGrade');
    els.controlesCamera = U.porId('controlesCamera');
    els.chkAuto = U.porId('chkAuto');
    els.chkGrade = U.porId('chkGrade');
    els.linhaModo = U.porId('linhaModo');
    els.avisoSemCamera = U.porId('avisoSemCamera');
    els.motivoSemCamera = U.porId('motivoSemCamera');
    els.btnUsarCameraSistema = U.porId('btnUsarCameraSistema');
    els.btnImportarDoAviso = U.porId('btnImportarDoAviso');
    els.inputCameraSistema = U.porId('inputCameraSistema');
    els.inputGaleria = U.porId('inputGaleria');

    /* revisão */
    els.canvasPagina = U.porId('canvasPagina');
    els.canvasHandles = U.porId('canvasHandles');
    els.palcoRevisao = U.porId('palcoRevisao');
    els.zoomInfo = U.porId('zoomInfo');
    els.valorZoom = U.porId('valorZoom');
    els.btnMenosZoom = U.porId('btnMenosZoom');
    els.btnMaisZoom = U.porId('btnMaisZoom');
    els.faixaFiltros = U.porId('faixaFiltros');
    els.btnGirarEsq = U.porId('btnGirarEsq');
    els.btnDescartar = U.porId('btnDescartar');
    els.btnPaginas = U.porId('btnPaginas');
    els.rotuloPaginas = U.porId('rotuloPaginas');
    els.btnConcluirPagina = U.porId('btnConcluirPagina');
    els.btnVoltarCamera = U.porId('btnVoltarCamera');
    els.btnAutoCorte = U.porId('btnAutoCorte');

    /* documento */
    els.campoTitulo = U.porId('campoTitulo');
    els.listaPaginas = U.porId('listaPaginas');
    els.vazioPaginas = U.porId('vazioPaginas');
    els.campoTitulo = U.porId('campoTitulo');
    els.btnExportarPDF = U.porId('btnExportarPDF');
    els.btnVoltarDocumento = U.porId('btnVoltarDocumento');
    els.segTamanho = U.porId('segTamanho');
    els.segQualidade = U.porId('segQualidade');
    els.segCor = U.porId('segCor');
    els.btnCompartilharPDF = U.porId('btnCompartilharPDF');
    els.btnBaixarPDF = U.porId('btnBaixarPDF');
    els.caixaExportacao = U.porId('caixaExportacao');

    /* lista */
    els.conteudoLista = U.porId('conteudoLista');
    els.vazioLista = U.porId('vazioLista');
    els.btnVoltarLista = U.porId('btnVoltarLista');
  };

  App._ligarEventos = function () {
    /* --- tela início --- */
    U.ao(els.btnEscanear, 'click', function () { App.abrirCamera(); });
    U.ao(els.btnImportarGaleria, 'click', function () { els.inputGaleria.click(); });
    U.ao(els.inputGaleria, 'change', function (e) { App.importarMultiplos(e.target.files); });
    U.ao(els.btnDocumentos, 'click', function () { Telas.mostrar('lista'); });
    U.ao(els.btnVerTodos, 'click', function () { Telas.mostrar('lista'); });
    U.ao(els.btnInstalar, 'click', App.instalarPWA);

    /* --- câmera --- */
    U.ao(els.btnFecharCamera, 'click', function () { App.fecharCamera(); });
    U.ao(els.btnDisparar, 'click', function () { App.capturarManual(); });
    U.ao(els.btnImportRapido, 'click', function () { els.inputGaleria.click(); });
    U.ao(els.btnFlash, 'click', function () { App.toggleFlash(); });
    U.ao(els.btnTrocarCamera, 'click', function () { App.trocarCamera(); });
    U.ao(els.btnGrade, 'click', function () { App.toggleGrade(); });
    U.ao(els.chkAuto, 'change', function () { sessao.modoCamera = this.checked ? 'auto' : 'manual'; });
    U.ao(els.chkGrade, 'change', function () { sessao.gradeLigada = this.checked; Camera.estado().gradeVisivel = this.checked; });
    U.ao(els.linhaModo, 'click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip) App.mudarFiltroPrevia(chip.dataset.modoFiltro);
    });
    U.ao(els.btnUsarCameraSistema, 'click', function () { els.inputCameraSistema.click(); });
    U.ao(els.inputCameraSistema, 'change', function (e) { if (e.target.files[0]) App.importarArquivo(e.target.files[0]); });
    U.ao(els.btnImportarDoAviso, 'click', function () { els.inputGaleria.click(); });

    /* --- revisão --- */
    U.ao(els.btnVoltarCamera, 'click', function () { App.voltarCamera(); });
    U.ao(els.btnAutoCorte, 'click', function () { App.autoCortar(); });
    U.ao(els.faixaFiltros, 'click', function (e) {
      var btn = e.target.closest('.filtro');
      if (btn) App.aplicarFiltroRevisao(btn.dataset.filtro);
    });
    U.ao(els.btnGirarEsq, 'click', function () { App.girarPagina(-90); });
    U.ao(els.btnDescartar, 'click', function () { App.descartarPagina(); });
    U.ao(els.btnPaginas, 'click', function () { App.irParaDocumento(); });
    U.ao(els.btnConcluirPagina, 'click', function () { App.salvarPaginaRevisao(); });
    U.ao(els.btnMenosZoom, 'click', function () { App.zoom(-1); });
    U.ao(els.btnMaisZoom, 'click', function () { App.zoom(1); });

    /* arrastar cantos */
    App._ligarArrastarCantos();

    /* --- documento --- */
    U.ao(els.campoTitulo, 'input', function () { estadoAtual.docTitulo = this.value || 'Documento'; });
    U.ao(els.btnExportarPDF, 'click', function () { App.exportarPDF(); });
    U.ao(els.btnVoltarDocumento, 'click', function () { Telas.mostrar('inicio'); });
    U.ao(els.segTamanho, 'click', function (e) { var b = e.target.closest('button'); if (b) App.mudarOpcao('tamanho', b.dataset.valor, els.segTamanho); });
    U.ao(els.segQualidade, 'click', function (e) { var b = e.target.closest('button'); if (b) App.mudarOpcao('qualidade', parseFloat(b.dataset.valor), els.segQualidade); });
    U.ao(els.segCor, 'click', function (e) { var b = e.target.closest('button'); if (b) App.mudarOpcao('pbpb', parseInt(b.dataset.valor), els.segCor); });
    U.ao(els.btnCompartilharPDF, 'click', function () { App.gerarECompartilharPDF(); });
    U.ao(els.btnBaixarPDF, 'click', function () { App.gerarEBaixarPDF(); });

    /* --- lista --- */
    U.ao(els.btnVoltarLista, 'click', function () { Telas.mostrar('inicio'); });
    U.ao(els.conteudoLista, 'click', function (e) {
      var item = e.target.closest('.linha-doc');
      if (!item) return;
      var acao = e.target.closest('[data-acao]');
      if (acao) {
        var id = Number(item.dataset.id);
        if (acao.dataset.acao === 'abrir') App.abrirDocumento(id);
        else if (acao.dataset.acao === 'excluir') App.excluirDocumento(id);
        else if (acao.dataset.acao === 'compartilhar') App.compartilharDocumento(id);
      } else {
        App.abrirDocumento(Number(item.dataset.id));
      }
    });

    /* modal global fechar com ESC */
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') Telas.fecharModal(); });
  };

  /* ==================================================== CÂMERA */
  App.abrirCamera = function () {
    sessao.paginas = [];
    sessao.filtroAtual = 'auto';
    Camera.estado().capturaAuto = !!els.chkAuto.checked;
    Camera.estado().gradeVisivel = !!els.chkGrade.checked;
    Camera.estado().filtroPrevia = 'auto';

    Telas.mostrar('camera').then(function () {
      Camera.iniciar(els.video, els.overlay, els.mascaraOverlay, {
        aoDeteccao: App._aoDeteccaoCamera,
        aoCaptura: App._aoCapturaCamera,
        aoErro: App._erroCamera,
        aoStatus: App._statusCamera
      }).catch(function (err) {
        App._mostrarAvisoSemCamera(err);
      });
    });
  };

  App.fecharCamera = function () {
    Camera.parar();
    if (sessao.paginas.length) {
      Telas.modal('Sair do escaneador?', 'Você tem ' + sessao.paginas.length + ' página(s) não salva(s). Deseja descartar?', [
        { texto: 'Voltar', valor: false },
        { texto: 'Descartar e sair', valor: true, perigo: true }
      ]).then(function (ok) {
        if (ok) {
          sessao.paginas = [];
          Telas.mostrar('inicio');
        }
      });
    } else {
      Telas.mostrar('inicio');
    }
  };

  App._aoDeteccaoCamera = function (det, dim) {
    var elStatus = els.statusCamera;
    var elTexto = els.textoStatus;
    if (!det) {
      elStatus.className = 'status-camera erro';
      elTexto.textContent = 'Posicione o documento';
      els.btnDisparar.classList.add('travado');
      return;
    }
    var desc = Detectar.descrever(det);
    elStatus.className = 'status-camera ' + (desc.nivel === 'ok' ? 'ok' : (desc.nivel === 'alerta' ? 'alerta' : 'erro'));
    elTexto.textContent = desc.texto;

    if (desc.nivel === 'ok') {
      els.btnDisparar.classList.remove('travado');
    } else {
      els.btnDisparar.classList.add('travado');
    }

    /* miniaturas vivas */
    if (det && det.cantos && det.cantos.length === 4 && sessao.paginas.length < 20) {
      App._atualizarMiniaturas(det);
    }
  };

  App._atualizarMiniaturas = function (det) {
    var max = 4;
    var container = els.miniaturasVivas;
    container.innerHTML = '';
    var paginas = sessao.paginas;
    for (var i = Math.max(0, paginas.length - max + 1); i < paginas.length; i++) {
      var thumb = document.createElement('canvas');
      thumb.width = 48; thumb.height = 64;
      var tctx = thumb.getContext('2d');
      var img = paginas[i].imagem;
      tctx.drawImage(img, 0, 0, thumb.width, thumb.height);
      container.appendChild(thumb);
    }
    if (paginas.length > max) {
      var mais = document.createElement('span');
      mais.className = 'mais-paginas';
      mais.textContent = '+' + (paginas.length - max);
      container.appendChild(mais);
    }
    els.contadorPaginas.textContent = paginas.length;
    els.tiraCamera.hidden = paginas.length === 0;
  };

  App._aoCapturaCamera = function (imgData, det) {
    var pagina = {
      imagemOriginal: imgData,
      imagem: null,      /* será preenchida ao salvar revisão */
      filtro: sessao.filtroAtual,
      rotacao: 0,
      quadOriginal: det && det.cantos ? det.cantos : null,
      confianca: det && det.confianca ? det.confianca : 0,
      automatico: det && det.automatico
    };
    sessao.paginas.push(pagina);
    estadoAtual.paginas = sessao.paginas;
    App._atualizarMiniaturas(det);
    Telas.toast('Página capturada', 'ok');
  };

  App.capturarManual = function () {
    Camera.capturar().catch(function (err) {
      Telas.toast('Erro ao capturar: ' + err.message, 'erro');
    });
  };

  App._erroCamera = function (err) {
    App._mostrarAvisoSemCamera(err);
  };

  App._statusCamera = function (msg) {
    /* usado para debug */
  };

  App._mostrarAvisoSemCamera = function (err) {
    Camera.parar();
    els.avisoSemCamera.hidden = false;
    var msg = 'Não foi possível acessar a câmera.';
    if (err && err.name) {
      if (err.name === 'NotAllowedError') msg = 'Permissão de câmera negada. Autorize nas configurações do navegador.';
      else if (err.name === 'NotFoundError') msg = 'Nenhuma câmera encontrada neste dispositivo.';
      else if (err.name === 'NotReadableError') msg = 'A câmera está sendo usada por outro app. Feche-o e tente novamente.';
      else if (err.name === 'OverconstrainedError') msg = 'Resolução não suportada. Tentando padrão...';
    }
    els.motivoSemCamera.textContent = msg;
  };

  App.toggleFlash = function () {
    Camera.flash(!Camera.estado().flashLigado).then(function (ok) {
      if (ok) els.btnFlash.classList.toggle('ativo', Camera.estado().flashLigado);
    });
  };

  App.trocarCamera = function () {
    Camera.trocar().then(function () {
      els.btnTrocarCamera.classList.toggle('ativo', !Camera.estado().cameraTraseira);
    });
  };

  App.toggleGrade = function () {
    var ligado = !Camera.estado().gradeVisivel;
    Camera.estado().gradeVisivel = ligado;
    els.chkGrade.checked = ligado;
    els.btnGrade.classList.toggle('ativo', ligado);
  };

  App.mudarFiltroPrevia = function (filtro) {
    sessao.filtroAtual = filtro;
    Camera.estado().filtroPrevia = filtro;
    Array.from(els.linhaModo.querySelectorAll('.chip')).forEach(function (b) {
      b.classList.toggle('ativo', b.dataset.modoFiltro === filtro);
    });
  };

  /* ==================================================== IMPORTAÇÃO */
  App.importarArquivo = function (arquivo) {
    Camera.importarArquivo(arquivo).then(function (res) {
      App._aoCapturaCamera(res.imagem, res.deteccao);
    }).catch(function (err) {
      Telas.toast('Erro ao importar: ' + err.message, 'erro');
    });
  };

  App.importarMultiplos = function (arquivos) {
    Array.from(arquivos).forEach(function (f) { App.importarArquivo(f); });
    els.inputGaleria.value = '';
  };

  /* ==================================================== REVISÃO */
  App.aoEntrarRevisao = function (dados) {
    estadoAtual.paginaEditando = typeof dados === 'object' && dados.paginaAtual !== undefined ? dados.paginaAtual : sessao.paginas.length - 1;
    if (estadoAtual.paginaEditando < 0) estadoAtual.paginaEditando = 0;
    if (estadoAtual.paginaEditando >= sessao.paginas.length) estadoAtual.paginaEditando = sessao.paginas.length - 1;
    App.renderizarRevisao();
  };

  App.renderizarRevisao = function () {
    var idx = estadoAtual.paginaEditando;
    var pagina = sessao.paginas[idx];
    if (!pagina) return;

    els.rotuloPaginas.textContent = (idx + 1) + ' de ' + sessao.paginas.length;

    /* quad para warp: usa detecção ou padrão */
    var quad = pagina.quadOriginal || Warp.quadPadrao(pagina.imagemOriginal.width, pagina.imagemOriginal.height);
    var dims = Warp.dimensoesSaida(quad, 2200);
    var warp = Warp.aplicar(pagina.imagemOriginal, quad, dims.largura, dims.altura);

    pagina.imagem = warp; /* ImageData retificada */
    pagina.quadAtual = quad;

    /* desenha no canvas de revisão com o filtro atual */
    App.desenharRevisao(pagina);

    /* prévias dos filtros */
    App.gerarPreviasFiltros(pagina);
  };

  App.desenharRevisao = function (pagina) {
    var canvas = els.canvasPagina;
    var ctx = canvas.getContext('2d');
    var img = pagina.imagem;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.putImageData(img, 0, 0);

    /* aplica filtro visual no canvas (não altera ImageData) */
    var tipo = pagina.filtro || 'auto';
    if (tipo !== 'cor' && tipo !== 'auto') {
      var temp = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
      Filtros.aplicar(temp, tipo);
      ctx.putImageData(temp, 0, 0);
    }
    App.desenharHandles(pagina.quadAtual || Warp.quadPadrao(img.width, img.height));
  };

  App.desenharHandles = function (quad) {
    var canvas = els.canvasHandles;
    var ctx = canvas.getContext('2d');
    var w = els.canvasPagina.width;
    var h = els.canvasPagina.height;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    /* escala do warp para tela */
    var escala = Math.min(1, Math.min(w / (quad[1].x - quad[0].x), h / (quad[2].y - quad[1].y))) || 1;

    ctx.strokeStyle = '#2ee6a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(quad[0].x, quad[0].y);
    for (var i = 1; i < 4; i++) ctx.lineTo(quad[i].x, quad[i].y);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#2ee6a8';
    for (i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(quad[i].x, quad[i].y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#04140f';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  var arraste = { ativo: false, canto: -1, inicio: { x: 0, y: 0 } };

  App._ligarArrastarCantos = function () {
    var canvas = els.canvasHandles;
    function pos(e) {
      var t = e.touches ? e.touches[0] : e;
      var rect = canvas.getBoundingClientRect();
      return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = pos(e);
      var quad = sessao.paginas[estadoAtual.paginaEditando].quadAtual;
      for (var i = 0; i < 4; i++) {
        if (Math.hypot(p.x - quad[i].x, p.y - quad[i].y) < 20) {
          arraste.ativo = true;
          arraste.canto = i;
          arraste.inicio = { x: p.x, y: p.y };
          canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
          break;
        }
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!arraste.ativo) return;
      var p = pos(e);
      var pagina = sessao.paginas[estadoAtual.paginaEditando];
      var quad = pagina.quadAtual;
      quad[arraste.canto].x = U.limitar(p.x, 0, pagina.imagem.width);
      quad[arraste.canto].y = U.limitar(p.y, 0, pagina.imagem.height);
      App.desenharRevisao(pagina);
    });
    canvas.addEventListener('pointerup', function () { arraste.ativo = false; arraste.canto = -1; });
    canvas.addEventListener('pointercancel', function () { arraste.ativo = false; arraste.canto = -1; });
  };

  App.gerarPreviasFiltros = function (pagina) {
    var tipos = ['auto', 'cor', 'pb', 'mono', 'realce'];
    var img = pagina.imagem;
    var container = els.faixaFiltros;
    tipos.forEach(function (tipo) {
      var btn = container.querySelector('[data-filtro="' + tipo + '"]');
      if (!btn) return;
      var preview = btn.querySelector('.previa');
      if (!preview) return;
      var c = document.createElement('canvas');
      c.width = 68; c.height = 44;
      var ctx = c.getContext('2d');
      var escala = Math.min(c.width / img.width, c.height / img.height);
      var dw = img.width * escala, dh = img.height * escala;
      ctx.drawImage(img, 0, 0, dw, dh);
      var temp = ctx.getImageData(0, 0, c.width, c.height);
      if (tipo !== 'auto' && tipo !== 'cor') {
        Filtros.aplicar(temp, tipo);
      }
      ctx.putImageData(temp, 0, 0);
      preview.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
    });
  };

  App.aplicarFiltroRevisao = function (filtro) {
    var pagina = sessao.paginas[estadoAtual.paginaEditando];
    pagina.filtro = filtro;
    sessao.filtroAtual = filtro;
    Array.from(els.faixaFiltros.querySelectorAll('.filtro')).forEach(function (b) {
      b.classList.toggle('ativo', b.dataset.filtro === filtro);
    });
    App.desenharRevisao(pagina);
  };

  App.girarPagina = function (graus) {
    var pagina = sessao.paginas[estadoAtual.paginaEditando];
    pagina.rotacao = (pagina.rotacao + graus + 360) % 360;
    var rot = pagina.rotacao;
    var w = pagina.imagem.width, h = pagina.imagem.height;
    pagina.imagem = Warp.rotacionarImageData(pagina.imagem, rot);
    pagina.quadAtual = Warp.rotacionarQuad(pagina.quadAtual, w, h, graus);
    App.desenharRevisao(pagina);
  };

  App.descartarPagina = function () {
    if (sessao.paginas.length <= 1) {
      Telas.modal('Descartar tudo?', 'Esta é a única página. Voltar ao início descartará o escaneamento.', [
        { texto: 'Cancelar', valor: false },
        { texto: 'Descartar e voltar', valor: true, perigo: true }
      ]).then(function (ok) {
        if (ok) {
          sessao.paginas = [];
          App.fecharCamera();
        }
      });
      return;
    }
    Telas.modal('Descartar página?', 'Esta página será removida permanentemente.', [
      { texto: 'Cancelar', valor: false },
      { texto: 'Descartar', valor: true, perigo: true }
    ]).then(function (ok) {
      if (ok) {
        var idx = estadoAtual.paginaEditando;
        sessao.paginas.splice(idx, 1);
        if (estadoAtual.paginaEditando >= sessao.paginas.length) estadoAtual.paginaEditando = sessao.paginas.length - 1;
        App._atualizarMiniaturas({ cantos: null });
        if (sessao.paginas.length) {
          App.renderizarRevisao();
        } else {
          App.voltarCamera();
        }
      }
    });
  };

  App.autoCortar = function () {
    var pagina = sessao.paginas[estadoAtual.paginaEditando];
    var det = Detectar.detectar(pagina.imagemOriginal, { minConfianca: 0.12 });
    if (det && det.cantos) {
      pagina.quadAtual = det.cantos;
      App.renderizarRevisao();
      Telas.toast('Corte automático aplicado', 'ok');
    } else {
      Telas.toast('Não foi possível detectar o documento', 'erro');
    }
  };

  App.zoom = function (delta) {
    /* zoom visual no palco de revisão (não altera a imagem) */
    var palco = els.palcoRevisao;
    var atual = palco.dataset.zoom ? parseFloat(palco.dataset.zoom) : 1;
    var novo = U.limitar(atual + delta * 0.15, 0.5, 3);
    palco.dataset.zoom = novo.toFixed(2);
    palco.style.transform = 'scale(' + novo + ')';
    els.valorZoom.textContent = Math.round(novo * 100) + '%';
    els.zoomInfo.hidden = novo === 1;
  };

  App.salvarPaginaRevisao = function () {
    /* a página já está salva em sessao.paginas com imagem processada */
    Telas.toast('Página salva', 'ok');
    App.irParaDocumento();
  };

  App.voltarCamera = function () {
    Telas.mostrar('camera');
  };

  App.irParaDocumento = function () {
    estadoAtual.paginas = sessao.paginas;
    Telas.mostrar('documento');
  };

  /* ==================================================== DOCUMENTO */
  App.aoEntrarDocumento = function () {
    els.campoTitulo.value = estadoAtual.docTitulo || 'Documento';
    App.renderizarListaPaginas();
  };

  App.renderizarListaPaginas = function () {
    var container = els.listaPaginas;
    container.innerHTML = '';
    if (!sessao.paginas.length) {
      els.vazioPaginas.hidden = false;
      els.caixaExportacao.hidden = true;
      return;
    }
    els.vazioPaginas.hidden = true;
    els.caixaExportacao.hidden = false;

    sessao.paginas.forEach(function (pagina, idx) {
      var item = document.createElement('div');
      item.className = 'item-pagina';
      item.dataset.idx = idx;
      item.draggable = true;

      var cabo = document.createElement('div');
      cabo.className = 'cabo-arraste';
      cabo.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4h.01M9 8h.01M9 12h.01M9 16h.01M9 20h.01M15 4h.01M15 8h.01M15 12h.01M15 16h.01M15 20h.01"/></svg>';
      item.appendChild(cabo);

      var capa = document.createElement('div');
      capa.className = 'capa-pagina';
      var thumb = document.createElement('canvas');
      thumb.width = 68; thumb.height = 88;
      var tctx = thumb.getContext('2d');
      tctx.drawImage(pagina.imagem, 0, 0, thumb.width, thumb.height);
      capa.appendChild(thumb);
      item.appendChild(capa);

      var info = document.createElement('div');
      info.className = 'info-pagina';
      info.innerHTML = '<strong>Página ' + (idx + 1) + '</strong><small>' + pagina.imagem.width + ' × ' + pagina.imagem.height + ' px</small>';
      item.appendChild(info);

      var acoes = document.createElement('div');
      acoes.className = 'acoes-pagina';
      var btnDel = document.createElement('button');
      btnDel.className = 'mini-btn perigo';
      btnDel.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
      btnDel.addEventListener('click', function (e) { e.stopPropagation(); App.removerPagina(idx); });
      acoes.appendChild(btnDel);
      item.appendChild(acoes);

      container.appendChild(item);
    });

    App._ligarDragDropPaginas();
  };

  App._ligarDragDropPaginas = function () {
    var container = els.listaPaginas;
    var arrastado = null;

    container.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.item-pagina');
      if (!item) return;
      arrastado = item;
      item.classList.add('arrastando');
      e.dataTransfer.effectAllowed = 'move';
    });
    container.addEventListener('dragend', function (e) {
      if (arrastado) arrastado.classList.remove('arrastando');
      container.querySelectorAll('.alvo').forEach(function (el) { el.classList.remove('alvo'); });
      arrastado = null;
    });
    container.addEventListener('dragover', function (e) {
      e.preventDefault();
      var alvo = e.target.closest('.item-pagina');
      if (alvo && alvo !== arrastado) {
        container.querySelectorAll('.alvo').forEach(function (el) { el.classList.remove('alvo'); });
        alvo.classList.add('alvo');
      }
    });
    container.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!arrastado) return;
      var alvo = e.target.closest('.item-pagina');
      if (!alvo || alvo === arrastado) return;
      var de = parseInt(arrastado.dataset.idx, 10);
      var para = parseInt(alvo.dataset.idx, 10);
      var pagina = sessao.paginas.splice(de, 1)[0];
      sessao.paginas.splice(para, 0, pagina);
      App.renderizarListaPaginas();
    });
  };

  App.removerPagina = function (idx) {
    Telas.modal('Remover página?', 'Esta ação não pode ser desfeita.', [
      { texto: 'Cancelar', valor: false },
      { texto: 'Remover', valor: true, perigo: true }
    ]).then(function (ok) {
      if (ok) {
        sessao.paginas.splice(idx, 1);
        App.renderizarListaPaginas();
        if (!sessao.paginas.length) App.aoEntrarDocumento();
      }
    });
  };

  App.mudarOpcao = function (chave, valor, container) {
    estadoAtual.exportOptions[chave] = valor;
    container.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('ativo', String(b.dataset.valor) === String(valor));
    });
  };

  /* ==================================================== PDF / EXPORT */
  App.exportarPDF = function () {
    App.gerarPDF().then(function (blob) {
      var nome = U.nomeSeguro(estadoAtual.docTitulo) + '-' + U.carimbo() + '.pdf';
      U.baixar(blob, nome);
      Telas.toast('PDF baixado', 'ok');
    }).catch(function (err) {
      Telas.toast('Erro ao gerar PDF: ' + err.message, 'erro');
    });
  };

  App.gerarECompartilharPDF = function () {
    App.gerarPDF().then(function (blob) {
      var arquivo = new File([blob], U.nomeSeguro(estadoAtual.docTitulo) + '.pdf', { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        navigator.share({ files: [arquivo], title: estadoAtual.docTitulo }).catch(function () { /* fallback */ });
      } else {
        App.gerarEBaixarPDF();
      }
    }).catch(function (err) {
      Telas.toast('Erro: ' + err.message, 'erro');
    });
  };

  App.gerarEBaixarPDF = function () {
    App.gerarPDF().then(function (blob) {
      var nome = U.nomeSeguro(estadoAtual.docTitulo) + '-' + U.carimbo() + '.pdf';
      U.baixar(blob, nome);
      Telas.toast('PDF baixado', 'ok');
    }).catch(function (err) {
      Telas.toast('Erro: ' + err.message, 'erro');
    });
  };

  App.gerarPDF = function () {
    var opts = estadoAtual.exportOptions;
    var paginasParaPdf = sessao.paginas.map(function (p) {
      var img = p.imagem;
      /* se forçar PB, aplica no clone */
      if (opts.pbpb === 1 && p.filtro !== 'pb' && p.filtro !== 'realce') {
        var clone = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
        Filtros.aplicar(clone, 'pb');
        return { imagem: clone };
      }
      return { imagem: img };
    });
    return PDF.criar(paginasParaPdf, {
      tamanho: opts.tamanho,
      qualidade: opts.qualidade,
      pbpb: opts.pbpb,
      titulo: estadoAtual.docTitulo,
      autor: 'Escaneador Profissional',
      criador: 'Escaneador Profissional'
    });
  };

  /* ==================================================== LISTA / BANCO */
  App.atualizarRecentes = function () {
    Banco.listarDocs().then(function (docs) {
      var container = els.gradeRecentes;
      container.innerHTML = '';
      if (!docs.length) {
        els.vazioRecentes.hidden = false;
        return;
      }
      els.vazioRecentes.hidden = true;
      docs.slice(0, 6).forEach(function (doc) {
        var card = document.createElement('button');
        card.className = 'cartao-doc';
        card.dataset.id = doc.id;
        if (doc.capa) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(doc.capa);
          img.loading = 'lazy';
          card.appendChild(img);
        }
        var info = document.createElement('div');
        info.className = 'cartao-doc-info';
        info.innerHTML = '<strong>' + U.escapeHTML(doc.titulo) + '</strong><small>' + U.formatarData(doc.atualizado) + '</small>';
        card.appendChild(info);
        if (doc.totalPaginas) {
          var selo = document.createElement('span');
          selo.className = 'selo-paginas';
          selo.textContent = doc.totalPaginas + 'p';
          card.appendChild(selo);
        }
        card.addEventListener('click', function () { App.abrirDocumento(doc.id); });
        container.appendChild(card);
      });
    });
  };

  App.atualizarLista = function () {
    Banco.listarDocs().then(function (docs) {
      var container = els.conteudoLista;
      container.innerHTML = '';
      if (!docs.length) {
        els.vazioLista.hidden = false;
        return;
      }
      els.vazioLista.hidden = true;
      docs.forEach(function (doc) {
        var linha = document.createElement('div');
        linha.className = 'linha-doc';
        linha.dataset.id = doc.id;

        var capa = document.createElement('div');
        capa.className = 'linha-doc-capa';
        if (doc.capa) {
          var img = document.createElement('img');
          img.src = URL.createObjectURL(doc.capa);
          capa.appendChild(img);
        }
        linha.appendChild(capa);

        var info = document.createElement('div');
        info.className = 'linha-doc-info';
        info.innerHTML = '<strong>' + U.escapeHTML(doc.titulo) + '</strong><small>' + doc.totalPaginas + ' página(s) · ' + U.formatarData(doc.atualizado) + '</small>';
        linha.appendChild(info);

        var acoes = document.createElement('div');
        acoes.className = 'linha-doc-acoes';
        acoes.innerHTML =
          '<button class="mini-btn" data-acao="abrir" aria-label="Abrir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12h20"/><path d="m18 6-6 6-6-6"/></svg></button>' +
          '<button class="mini-btn" data-acao="compartilhar" aria-label="Compartilhar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2"/><path d="m8.6 13.4 6.8 4.2"/></svg></button>' +
          '<button class="mini-btn perigo" data-acao="excluir" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>';
        linha.appendChild(acoes);

        container.appendChild(linha);
      });
    });
  };

  App.abrirDocumento = function (id) {
    Banco.obterDoc(id).then(function (doc) {
      if (!doc) { Telas.toast('Documento não encontrado', 'erro'); return; }
      estadoAtual.docTitulo = doc.titulo;
      sessao.paginas = (doc.paginas || []).map(function (p) {
        return {
          imagemOriginal: null,
          imagem: p.imagem, /* ImageData já processada */
          filtro: p.filtro,
          rotacao: p.rotacao || 0,
          quadOriginal: p.quad,
          confianca: 1
        };
      });
      estadoAtual.paginas = sessao.paginas;
      Telas.mostrar('documento');
    });
  };

  App.excluirDocumento = function (id) {
    Telas.modal('Excluir documento?', 'Esta ação não pode ser desfeita.', [
      { texto: 'Cancelar', valor: false },
      { texto: 'Excluir', valor: true, perigo: true }
    ]).then(function (ok) {
      if (ok) {
        Banco.excluirDoc(id).then(function () {
          Telas.toast('Documento excluído', 'ok');
          App.atualizarLista();
          App.atualizarRecentes();
        });
      }
    });
  };

  App.compartilharDocumento = function (id) {
    Banco.obterDoc(id).then(function (doc) {
      if (!doc) return;
      var paginas = (doc.paginas || []).map(function (p) { return { imagem: p.imagem }; });
      PDF.criar(paginas, { tamanho: 'a4', qualidade: 0.88, titulo: doc.titulo }).then(function (blob) {
        var arquivo = new File([blob], U.nomeSeguro(doc.titulo) + '.pdf', { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
          navigator.share({ files: [arquivo], title: doc.titulo });
        } else {
          U.baixar(blob, U.nomeSeguro(doc.titulo) + '.pdf');
          Telas.toast('PDF baixado (compartilhamento indisponível)', 'info');
        }
      });
    });
  };

  /* ==================================================== SALVAR DOCUMENTO */
  App.salvarDocumento = function () {
    if (!sessao.paginas.length) return Promise.resolve();
    var titulo = estadoAtual.docTitulo || 'Documento';
    var primeira = sessao.paginas[0];
    return Banco.gerarCapa(primeira.imagem, 300).then(function (capaBlob) {
      var doc = {
        titulo: titulo,
        criado: Date.now(),
        atualizado: Date.now(),
        capa: capaBlob,
        paginas: sessao.paginas.map(function (p) {
          return {
            imagem: p.imagem,
            filtro: p.filtro,
            rotacao: p.rotacao,
            quad: p.quadAtual || p.quadOriginal
          };
        })
      };
      return Banco.salvarDoc(doc).then(function (id) {
        doc.id = id;
        Telas.toast('Documento salvo', 'ok');
        return doc;
      });
    });
  };

  /* ==================================================== PWA / OFFLINE */
  var deferredPrompt = null;
  App._verificarInstalavel = function () {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      els.btnInstalar.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      els.btnInstalar.hidden = true;
      deferredPrompt = null;
    });
  };

  App.instalarPWA = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice.outcome === 'accepted') Telas.toast('App instalado!', 'ok');
        deferredPrompt = null;
        els.btnInstalar.hidden = true;
      });
    }
  };

  App._restaurarEstado = function () {
    /* tenta restaurar sessão anterior se houver páginas não salvas */
    try {
      var salvo = sessionStorage.getItem('escaneador_sessao');
      if (salvo) {
        var dados = JSON.parse(salvo);
        if (dados.paginas && dados.paginas.length) {
          /* nota: ImageData não serializa bem; apenas avisa */
        }
      }
    } catch (e) { /* ignora */ }
  };

  App._verificarPermissoes = function () {
    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'camera' }).then(function (status) {
      if (status.state === 'denied') {
        els.alertaHttp.hidden = false;
        els.textoHttp.textContent = 'A permissão de câmera foi bloqueada. Use o botão "Usar a câmera do celular" ou importe fotos da galeria.';
      }
      status.onchange = function () {
        if (this.state === 'granted') {
          els.alertaHttp.hidden = true;
        } else if (this.state === 'denied') {
          els.alertaHttp.hidden = false;
        }
      };
    });
  };

  /* expõe App para uso nos event handlers inline do HTML se necessário */
  global.App = App;
})(window);

/* ---------- inicialização ---------- */
document.addEventListener('DOMContentLoaded', function () {
  App.iniciar();
});

/* evita zoom acidental em inputs no iOS */
document.addEventListener('touchstart', function () {}, { passive: true });