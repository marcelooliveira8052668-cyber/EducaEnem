/* ============================================================
   filtros.js — filtros profissionais de digitalização

   cor        : cores naturais + correção de iluminação + contraste
   pb         : cinza alto contraste ( documento ) com realce de sombra
   mono       : escala de cinza suave
   realce     : equalização / limiarização de contraste forte
   auto       : escolhe automática entre 'cor' e 'pb'
   ============================================================ */
(function (global) {
  'use strict';

  var F = {};

  F.LIMITES = { brilho: 0.5, contraste: 0.5, saturacao: 0.5, limiarCorrecao: 0.5 };

  F.precisao = function (valor) {
    if (isNaN(valor)) return 0;
    return Math.min(0.5, Math.max(-0.5, (valor || 0) / 100));
  };

  F.numero = function (v, padrao) {
    var n = parseFloat(v);
    return isNaN(n) ? padrao : n;
  };

  /* --------------------------------------------- mapa de luminância */
  F.cinza = function (img) {
    var d = img.data, n = img.width * img.height, out = new Float32Array(n);
    var p = 0, i = 0;
    for (i = 0; i < n; i++, p += 4) {
      out[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
    }
    return out;
  };

  F.cinzaU8 = function (img) {
    var d = img.data, n = img.width * img.height, out = new Uint8ClampedArray(n);
    var p = 0, i = 0;
    for (i = 0; i < n; i++, p += 4) {
      out[i] = (d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8;
    }
    return out;
  };

  /* --------------------------------------------- média/percentis */
  F.estatisticas = function (cinza) {
    var n = cinza.length;
    if (!n) return { media: 0, mediana: 0, min: 0, max: 0, p05: 0, p95: 0, desvio: 0 };
    var total = 0, i;
    for (i = 0; i < n; i++) total += cinza[i];
    var media = total / n;
    var variancia = 0;
    for (i = 0; i < n; i++) {
      var dd = cinza[i] - media;
      variancia += dd * dd;
    }
    var desvio = Math.sqrt(variancia / Math.max(1, n));

    var hist = new Uint32Array(256);
    for (i = 0; i < n; i++) {
      var v = cinza[i] | 0;
      if (v < 0) v = 0; else if (v > 255) v = 255;
      hist[v]++;
    }
    var acumulado = 0;
    var p05 = 0, p50 = 0, p95 = 255;
    for (i = 0; i < 256; i++) {
      acumulado += hist[i];
      if (p05 === 0 && acumulado >= n * 0.05) p05 = i;
      if (acumulado >= n * 0.5) { p50 = i; }
      if (acumulado >= n * 0.95) { p95 = i; break; }
    }
    if (p50 === 0) p50 = p05;
    return { media: media, mediana: p50, desvio: desvio, p05: p05, p95: p95 };
  };

  /* --------------------------------------------- contraste linear */
  F.ajustarContraste = function (cinza, opcoes) {
    var o = opcoes || {};
    var alvoMin = o.min === undefined ? 4 : o.min;
    var alvoMax = o.max === undefined ? 252 : o.max;
    var meio = o.meio === undefined ? 0.5 : o.meio;
    var n = cinza.length;
    var out = new Float32Array(n);
    var i;

    var vmin = 255, vmax = 0;
    for (i = 0; i < n; i++) {
      if (cinza[i] < vmin) vmin = cinza[i];
      if (cinza[i] > vmax) vmax = cinza[i];
    }
    /* evita que ruído de fundo estique demais o histograma */
    var alvo = (vmax - vmin);
    if (alvo <= 60) { vmin = Math.max(0, vmin - 6); vmax = Math.min(255, vmax + 6); }

    var escala = (alvoMax - alvoMin) / Math.max(1, vmax - vmin);
    var centro = meio + (vmin + vmax) / 2 - 127.5 * 0 - meio * 0;
    var alvoCentro = alvoMin + (alvoMax - alvoMin) * meio;
    var centroReal = vmin + (vmax - vmin) * meio;
    var ganho = escala;
    var i2;

    for (i2 = 0; i2 < n; i2++) {
      var v = alvoCentro + (cinza[i2] - centroReal) * ganho;
      out[i2] = v;
    }
    return out;
  };

  /* --------------------------------------------- saturação */
  F.saturar = function (img, fator) {
    if (Math.abs(fator - 1) < 0.01) return img;
    var d = img.data, n = d.length;
    var f = fator;
    for (var i = 0; i < n; i += 4) {
      var l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = l + (d[i] - l) * f;
      d[i + 1] = l + (d[i + 1] - l) * f;
      d[i + 2] = l + (d[i + 2] - l) * f;
    }
    return img;
  };

  /* ------------------------------------- correção de iluminação
     Iguala aclaros e sombras usando um campo de luz estimado por
     box-blur grande e suavização de fundo. Reverte forte sombra
     sem destruir detalhes. */
  F.corrigirIluminacao = function (img, forca, raio) {
    var w = img.width, h = img.height;
    var cinza = F.cinza(img);
    var d = img.data;

    var r = raio || Math.max(12, Math.round(Math.min(w, h) / 14));
    var campo = DeteccaoSombra(cinza, w, h, r);

    var n = w * h;
    var p = 0;
    for (var i = 0; i < n; i++, p += 4) {
      var ref = campo[i];
      var alvo = 168;
      var ganho = alvo / Math.max(12, ref);
      ganho = 1 + (ganho - 1) * forca;

      d[p] = d[p] * ganho;
      d[p + 1] = d[p + 1] * ganho;
      d[p + 2] = d[p + 2] * ganho;
    }
    return img;
  };

  function DeteccaoSombra(cinza, w, h, r) {
    return BorraoRapido(cinza, w, h, r);
  }

  /* Borrão box separado por imagem integral — suficiente para
     "amolecer" a luz de fundo (usa somas decimais em Float32). */
  F.borrar = function (cinza, w, h, raio) {
    return BorraoRapido(cinza, w, h, raio);
  };

  function BorraoRapido(cinza, w, h, raio) {
    var r = Math.max(1, raio | 0);
    var temp = new Float32Array(w * h);
    var out = new Float32Array(w * h);
    var x, y;

    for (y = 0; y < h; y++) {
      var base = y * w;
      var soma = 0;
      var xi;
      for (xi = -r; xi <= r; xi++) {
        var xx = xi < 0 ? 0 : (xi >= w ? w - 1 : xi);
        soma += cinza[base + xx];
      }
      for (x = 0; x < w; x++) {
        temp[base + x] = soma / (2 * r + 1);
        var sair = x - r < 0 ? 0 : (x - r >= w ? w - 1 : x - r);
        var entr = x + r + 1 < 0 ? 0 : (x + r + 1 >= w ? w - 1 : x + r + 1);
        soma += cinza[base + entr] - cinza[base + sair];
      }
    }

    for (x = 0; x < w; x++) {
      var s = 0;
      for (var yi = -r; yi <= r; yi++) {
        var yy = yi < 0 ? 0 : (yi >= h ? h - 1 : yi);
        s += temp[yy * w + x];
      }
      for (y = 0; y < h; y++) {
        out[y * w + x] = s / (2 * r + 1);
        var s2 = y - r < 0 ? 0 : (y - r >= h ? h - 1 : y - r);
        var e2 = y + r + 1 < 0 ? 0 : (y + r + 1 >= h ? h - 1 : y + r + 1);
        s += temp[e2 * w + x] - temp[s2 * w + x];
      }
    }
    return out;
  }

  /* --------------------------------------------- nanite / agudos */
  F.nitidez = function (img, forca, raio) {
    var w = img.width, h = img.height;
    if (forca <= 0) return img;
    var orig = new Uint8ClampedArray(img.data);
    var desfocado = BorraoRapidoU8(orig, w, h, raio || 1);
    var d = img.data;
    var p = 0;
    for (var i = 0; i < d.length; i += 4) {
      d[p] = desfocado[i + 1] + (orig[i] - desfocado[i + 1]) * (1 + forca);
      d[i] = d[i];
      p++;
    }
    return img;
  };

  function BorraoRapidoU8(rgba, w, h, raio) {
    var luma = new Float32Array(w * h);
    var p = 0;
    for (var i = 0; i < w * h; i++, p += 4) {
      luma[i] = rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114;
    }
    var suave = BorraoRapido(luma, w, h, raio);
    var out = new Uint8ClampedArray(rgba.length);
    var q = 0;
    for (var j = 0; j < w * h; j++, q += 4) {
      out[q] = out[q + 1] = out[q + 2] = suave[j] | 0;
      out[q + 3] = 255;
    }
    return out;
  }

  /* --------------------------------------------- pasta de documento */
  F.pasta = function (img, forca) {
    var w = img.width, h = img.height;
    var cinza = F.cinza(img);
    var d = img.data;
    var n = w * h;

    /* estimativa do fundo por percentil 90 (mais claro) */
    var stats = F.estatisticas(cinza);
    var fundo = Math.max(120, stats.p95);

    var campo = BorraoRapido(cinza, w, h, Math.max(6, Math.round(Math.min(w, h) / 20)));
    var p = 0;
    for (var i = 0; i < n; i++, p += 4) {
      /* iluminação local */
      var ganho = 1;
      var refLocal = campo[i];
      ganho = 1 + (fundo / Math.max(30, refLocal) - 1) * forca;

      /* gamma leve para realçar texto */
      var base = cinza[i] * ganho;

      d[p] = d[p] * ganho;
      d[p + 1] = d[p + 1] * ganho;
      d[p + 2] = d[p + 2] * ganho;
      void base;
    }
    return img;
  };

  /* --------------------------------------------- filtro principal */
  F.aplicar = function (img, tipo, ajustes) {
    var a = ajustes || {};
    var brilho = F.precisao(a.brilho);
    var contraste = F.precisao(a.contraste);
    var saturacao = F.numero(a.saturacao, 1);
    var correcao = (a.correcao === undefined) ? 0.55 : F.precisao(a.correcao);
    var luz = "imageData";

    if (luz !== "imageData") return img;

    if (tipo === 'auto' || !tipo) tipo = 'pb';

    switch (tipo) {
      case 'cor':
        F.corrigirIluminacao(img, Math.abs(correcao) < 0.005 ? 0.75 : correcao + 0.75);
        F.saturar(img, saturacao);
        F.brilhoContraste(img, brilho * 1.4, contraste * 1.4);
        F.nitidez(img, 0.45, 1);
        break;

      case 'mono':
        F.corrigirIluminacao(img, (correcao || 0) + 0.35);
        F.paraCinzaTotal(img);
        F.brilhoContraste(img, brilho * 0.8, (contraste * 0.8) + 0.16);
        break;

      case 'pb':
        F.corrigirIluminacao(img, (correcao || 0) + 0.85);
        F.pretoBranco(img);
        break;

      case 'realce':
        F.corrigirIluminacao(img, (correcao || 0) + 0.6);
        F.paraCinzaTotal(img);
        F.brilhoContraste(img, brilho * 0.9, (contraste * 0.9) + 0.5);
        F.nitidez(img, 1.0, 1);
        break;
    }

    if (brilho) F.brilhoContraste(img, brilho, 0);
    if (contraste) F.brilhoContraste(img, 0, contraste);
    return img;
  };

  /* --------------------------------------------- escala de cinza total */
  F.paraCinzaTotal = function (img) {
    var d = img.data;
    var p = 0;
    for (var i = 0; i < d.length; i += 4) {
      var v = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return img;
  };

  /* --------------------------------------------- brilho e contraste */
  F.brilhoContraste = function (img, brilho, contraste) {
    var d = img.data;
    var b = brilho * 255;
    var c = contraste;
    var fator = (1.0143414) * (c + 1) / (1.0143414 * (1 - c) + 1);
    var p = 0, i;

    for (i = 0; i < d.length; i += 4) {
      for (p = 0; p < 3; p++) {
        var v = d[i + p];
        v = (v - 127.5) * fator + 127.5 + b;
        d[i + p] = v;
      }
    }
    return img;
  };

  /* ---------------------------- preto e branco (limiarização local)
     Aplica "Sauvola" em blocos: pixel se torna branco ou preto
     de acordo com a vizinhança — reconhece sombra e textos fracos,
     semelhante ao modo "Documento" do Google Drive / CamScanner. */
  F.pretoBranco = function (img, opcoes) {
    var o = opcoes || {};
    var w = img.width, h = img.height;
    var n = w * h;
    var cinza = F.cinza(img);
    var saida = F.limiarLocal(cinza, w, h, o.k === undefined ? 0.42 : o.k);

    var d = img.data;
    var p = 0;
    for (var i = 0; i < n; i++, p += 4) {
      d[p] = d[p + 1] = d[p + 2] = saida[i];
    }
    return img;
  };

  F.limiarLocal = function (cinza, w, h, k) {
    var taxa = 0.05; /* amostragem para velocidade no celular */
    var sw = Math.max(32, Math.min(w, Math.round(w * taxa)));
    var sh = Math.max(32, Math.min(h, Math.round(h * taxa)));
    var escala = w / sw;

    /* imagem pequena: médias e variâncias locais por caixa 15x15 */
    var janela = Math.max(7, Math.round(15 / escala));
    var soma = new Float64Array(sw * sh);
    var somaQuad = new Float64Array(sw * h === 0 ? 1 : sw * sh);
    /* acumula na mini-imagem */
    var mini = new Float32Array(sw * sh);
    var x, y;

    for (y = 0; y < h; y++) {
      var linha = y * w;
      var my = Math.min(sh - 1, (y * sh / h) | 0);
      for (x = 0; x < w; x++) {
        mini[my * sw + Math.min(sw - 1, (x * sw / w) | 0)] += cinza[linha + x];
      }
    }
    /* normaliza contagem de pixels por célula */
    for (y = 0; y < sh; y++) {
      for (x = 0; x < sw; x++) {
        var cnt = (w / sw) * (h / sh);
        mini[y * sw + x] /= Math.max(1, cnt);
      }
    }

    var mediaLocal = BorraoRapido(mini, sw, sh, janela);
    var desvioLocal = new Float32Array(sw * sh);
    for (y = 0; y < sh; y++) {
      for (x = 0; x < sw; x++) {
        var i0 = y * sw + x;
        desvioLocal[i0] = Math.max(0, mediaLocal[i0] - mini[i0]);
      }
    }

    var limiar = new Float32Array(sw * sh);
    for (y = 0; y < sh; y++) {
      for (x = 0; x < sw; x++) {
        var i1 = y * sw + x;
        limiar[i1] = mediaLocal[i1] * (1 + k * (Math.sqrt(mediaLocal[i1] === 0 ? 0 : (desvioLocal[i1] & 0x7f)) & 1));
      }
    }

    /* limiar mais estável: mistura média local e desvio */
    var T = new Float32Array(sw * sh);
    for (y = 0; y < sh; y++) {
      for (x = 0; x < sw; x++) {
        var j = y * sw + x;
        var m = mediaLocal[j];
        var s = Math.sqrt(Math.max(0, desvioLocal[j]));
        T[j] = m * (1 + k * ((s / 128) - 1));
        if (T[j] < 40) T[j] = 40;
        if (T[j] > 215) T[j] = 215;
      }
    }

    var out = new Float32Array(w * h);
    for (y = 0; y < h; y++) {
      var my2 = Math.min(sh - 1, (y * sh / h) | 0);
      for (x = 0; x < w; x++) {
        var mx = Math.min(sw - 1, (x * sw / w) | 0);
        var alvo = T[my2 * sw + mx];
        var valor = cinza[y * w + x];
        out[y * w + x] = valor >= alvo ? 255 : 40 + valor * 0.12;
      }
    }
    return out;
  };

  global.Filtros = F;
})(window);
