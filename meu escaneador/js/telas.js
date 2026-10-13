/* ============================================================
   telas.js — navegação entre telas, estado da UI, transições

   Telas: inicio, camera, revisao, documento, lista
   ============================================================ */
(function (global) {
  'use strict';

  var T = {};
  var telaAtual = 'inicio';
  var historico = [];
  var pilhaModais = [];

  var elementos = {};

  function $(id) { return document.getElementById(id); }

  T.inicializar = function () {
    elementos = {
      telaInicio: $('tela-inicio'),
      telaCamera: $('tela-camera'),
      telaRevisao: $('tela-revisao'),
      telaDocumento: $('tela-documento'),
      telaLista: $('tela-lista'),
      modal: $('modal'),
      toasts: $('toasts')
    };
  };

  T.mostrar = function (nome, dados) {
    var antiga = telaAtual;
    var telas = ['inicio', 'camera', 'revisao', 'documento', 'lista'];

    telas.forEach(function (t) {
      var el = $('tela-' + t);
      if (el) el.classList.remove('ativa');
    });

    var nova = $('tela-' + nome);
    if (nova) nova.classList.add('ativa');

    if (antiga !== nome) {
      historico.push({ tela: antiga, dados: T.dadosTela(antiga) });
      if (historico.length > 10) historico.shift();
    }

    telaAtual = nome;
    T._aoEntrar(nome, dados);
    return Promise.resolve();
  };

  T.voltar = function () {
    if (historico.length) {
      var ant = historico.pop();
      return T.mostrar(ant.tela, ant.dados);
    }
    return T.mostrar('inicio');
  };

  T.dadosTela = function (nome) {
    switch (nome) {
      case 'camera': return { filtro: estadoAtual.filtroPrevia };
      case 'revisao': return { paginaAtual: estadoAtual.paginaEditando };
      default: return {};
    }
  };

  T._aoEntrar = function (nome, dados) {
    switch (nome) {
      case 'inicio': App.atualizarRecentes(); break;
      case 'camera': App.aoEntrarCamera(dados); break;
      case 'revisao': App.aoEntrarRevisao(dados); break;
      case 'documento': App.aoEntrarDocumento(dados); break;
      case 'lista': App.atualizarLista(); break;
    }
  };

  /* -------------- modais -------------- */
  T.modal = function (titulo, texto, botoes) {
    return new Promise(function (resolve) {
      var elTitulo = $('modalTitulo');
      var elTexto = $('modalTexto');
      var elBotoes = $('modalBotoes');
      var elModal = $('modal');

      elTitulo.textContent = titulo || '';
      elTexto.textContent = texto || '';
      elBotoes.innerHTML = '';

      function fechar(valor) {
        elModal.hidden = true;
        pilhaModais.pop();
        resolve(valor);
      }

      var lista = botoes || [{ texto: 'OK', valor: true, destaque: true }];
      var padrao = null;
      lista.forEach(function (b) {
        var btn = document.createElement('button');
        btn.textContent = b.texto;
        btn.className = b.destaque ? 'destaque' : (b.perigo ? 'perigo' : '');
        btn.addEventListener('click', function () { fechar(b.valor); });
        elBotoes.appendChild(btn);
        if (b.destaque) padrao = b.valor;
      });

      pilhaModais.push({ fechar: fechar });
      elModal.hidden = false;

      var primeiro = elBotoes.querySelector('button');
      if (primeiro) setTimeout(function () { primeiro.focus(); }, 30);

      function aoTeclado(e) {
        if (e.key === 'Escape') fechar(null);
        if (e.key === 'Enter' && padrao !== null) fechar(padrao);
      }
      document.addEventListener('keydown', aoTeclado, { once: true });
    });
  };

  T.fecharModal = function () {
    if (pilhaModais.length) pilhaModais[pilhaModais.length - 1].fechar(null);
  };

  /* -------------- toast -------------- */
  T.toast = function (msg, tipo, tempo) {
    if (!elementos.toasts) elementos.toasts = $('toasts');
    if (!elementos.toasts) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (tipo || 'info');
    el.textContent = msg;
    elementos.toasts.appendChild(el);
    var t = tempo || 2500;
    setTimeout(function () {
      el.classList.add('saindo');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, t);
  };

  T.telaAtual = function () { return telaAtual; };

  global.Telas = T;
})(window);

/* Estado global simples compartilhado entre módulos */
var estadoAtual = {
  paginas: [],           /* array de { imagem: ImageData, filtro, rotacao, quadOriginal } */
  paginaEditando: 0,     /* índice da página em revisão */
  filtroPrevia: 'auto',
  docTitulo: 'Documento',
  exportOptions: { tamanho: 'a4', qualidade: 0.88, pbpb: 0 }
};