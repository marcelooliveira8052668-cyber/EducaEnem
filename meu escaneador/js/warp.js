/* ============================================================
   warp.js — correção de perspectiva (achatar o documento)

   Recebe os 4 cantos do papel na imagem original e gera a imagem
   retificada, como se a página fosse fotografada de cima. Usa
   amostragem bilinear e resolve a transformação projetiva por
   sistema linear 8x8 (sem bibliotecas externas).
   ============================================================ */
(function (global) {
  'use strict';

  var W = {};

  /* ---------------------------------------- resolve sistema linear */
  W.resolverSistema = function (A, b) {
    var n = b.length;
    var i, j, k;

    for (i = 0; i < n; i++) {
      if ((i * n + i) >= A.length) return null;
    }

    for (k = 0; k < n; k++) {
      /* pivoteamento parcial */
      var pivo = k;
      var maior = Math.abs(A[k * n + k]);
      for (i = k + 1; i < n; i++) {
        var v = Math.abs(A[i * n + k]);
        if (v > maior) { maior = v; pivo = i; }
      }
      if (maior < 1e-12) return null;
      if (pivo !== k) {
        for (j = 0; j < n; j++) {
          var t = A[k * n + j]; A[k * n + j] = A[pivo * n + j]; A[pivo * n + j] = t;
        }
        var tb = b[k]; b[k] = b[pivo]; b[pivo] = tb;
      }
      var dk = A[k * n + k];
      for (j = k + 1; j < n; j++) {
        var fator = A[j * n + k] / dk;
        if (fator === 0) continue;
        A[j * n + k] = 0;
        for (var l = k + 1; l < n; l++) A[j * n + l] -= fator * A[k * n + l];
        b[j] -= fator * b[k];
      }
    }

    var x = new Float64Array(n);
    for (i = n - 1; i >= 0; i--) {
      var soma = b[i];
      for (j = i + 1; j < n; j++) soma -= A[i * n + j] * x[j];
      x[i] = soma / A[i * n + i];
    }
    return x;
  };

  /* ------------------------------------- calcula a transformação
     Devolve os 8 coeficientes que mapeiam (u,v) da saída retangular
     para (x,y) da imagem de origem. */
  W.coeficientes = function (quad, outW, outH) {
    var dst = [
      { u: 0,     v: 0 },
      { u: outW,  v: 0 },
      { u: outW,  v: outH },
      { u: 0,     v: outH }
    ];
    var A = new Float64Array(64);
    var b = new Float64Array(8);
    var i;

    for (i = 0; i < 4; i++) {
      var u = dst[i].u, v = dst[i].v;
      var x = quad[i].x, y = quad[i].y;
      var li = i * 2;

      A[li * 8 + 0] = u;  A[li * 8 + 1] = v;  A[li * 8 + 2] = 1;
      A[li * 8 + 3] = 0;  A[li * 8 + 4] = 0;  A[li * 8 + 5] = 0;
      A[li * 8 + 6] = -x * u; A[li * 8 + 7] = -x * v;
      b[li] = x;

      var lj = (i * 2 + 1);
      A[lj * 8 + 0] = 0;  A[lj * 8 + 1] = 0;  A[lj * 8 + 2] = 0;
      A[lj * 8 + 3] = u;  A[lj * 8 + 4] = v;  A[lj * 8 + 5] = 1;
      A[lj * 8 + 6] = -y * u; A[lj * 8 + 7] = -y * v;
      b[lj] = y;
    }

    var r = W.resolverSistema(A, b);
    return r;
  };

  /* ------------------------------------------- dimensões de saída */
  W.dimensoesSaida = function (quad, maxLado) {
    var larg = (function (q) {
      var topo = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
      var base = Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y);
      return (topo + base) / 2;
    })(quad);
    var alt = (function (q) {
      var esq = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y);
      var dir = Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y);
      return (esq + dir) / 2;
    })(quad);

    larg = Math.max(8, Math.round(larg));
    alt = Math.max(8, Math.round(alt));

    if (maxLado && Math.max(larg, alt) > maxLado) {
      var e = maxLado / Math.max(larg, alt);
      larg = Math.max(8, Math.round(larg * e));
      alt = Math.max(8, Math.round(alt * e));
    }
    return { largura: larg, altura: alt };
  };

  /* ------------------------------- transformação projetiva aplicada */
  W.aplicar = function (imgOrigem, quad, outW, outH) {
    var sw = imgOrigem.width, sh = imgOrigem.height;
    var dados = imgOrigem.data;
    var total = outW * outH;
    if (total < 4) return imgOrigem;

    var saida = new Uint8ClampedArray(total * 4);
    var coef = W.coeficientes(quad, outW, outH);
    if (!coef) return imgOrigem;

    var a = coef[0], b1 = coef[1], c1 = coef[2];
    var d = coef[3], e = coef[4], f = coef[5];
    var g = coef[6], h = coef[7];

    var p = 0;
    var x, y;

    for (y = 0; y < outH; y++) {
      /* numeradores crescem linearmente em v */
      var nA = a * 0 + b1 * y + c1;
      var nD = d * 0 + e * y + f;
      var den = g * 0 + h * y + 1;

      for (x = 0; x < outW; x++) {
        var sy = nD / den;
        var sx = nA / den;
        nA += a; nD += d; den += g;

        /* restringe à área válida da origem */
        if (sx < 0) sx = 0; else if (sx > sw - 1) sx = sw - 1;
        if (sy < 0) sy = 0; else if (sy > sh - 1) sy = sh - 1;

        var ix = sx | 0;
        var iy = sy | 0;
        var fx = sx - ix;
        var fy = sy - iy;
        var ix1 = ix + 1 < sw ? ix + 1 : ix;
        var iy1 = iy + 1 < sh ? iy + 1 : iy;

        var i00 = (iy * sw + ix) << 2;
        var i10 = (iy * sw + ix1) << 2;
        var i01 = (iy1 * sw + ix) << 2;
        var i11 = (iy1 * sw + ix1) << 2;

        var w00 = (1 - fx) * (1 - fy);
        var w10 = fx * (1 - fy);
        var w01 = (1 - fx) * fy;
        var w11 = fx * fy;

        saida[p++] = dados[i00] * w00 + dados[i10] * w10 + dados[i01] * w01 + dados[i11] * w11;
        saida[p++] = dados[i00 + 1] * w00 + dados[i10 + 1] * w10 + dados[i01 + 1] * w01 + dados[i11 + 1] * w11;
        saida[p++] = dados[i00 + 2] * w00 + dados[i10 + 2] * w10 + dados[i01 + 2] * w01 + dados[i11 + 2] * w11;
        saida[p++] = 255;
      }
    }

    try {
      return new ImageData(saida, outW, outH);
    } catch (e) {
      return { data: saida, width: outW, height: outH, colorSpace: 'srgb' };
    }
  };

  /* ------------------------------------------- cantos rotacionados
     Rotaciona a imagem (e os cantos) em 90 graus. */
  W.rotacionarQuad = function (quad, larg, alt, sentido) {
    var rot = quad.map(function (pt) {
      if (sentido === 90) return { x: alt - pt.y, y: pt.x };
      if (sentido === -90) return { x: pt.y, y: larg - pt.x };
      if (sentido === 180) return { x: larg - pt.x, y: alt - pt.y };
      return { x: pt.x, y: pt.y };
    });
    return rot;
  };

  W.rotacionarImageData = function (img, sentido) {
    if (!sentido || sentido % 360 === 0) return img;
    var w = img.width, h = img.height;
    var rotacao = ((sentido % 360) + 360) % 360;
    var nw = (rotacao === 90 || rotacao === 270) ? h : w;
    var nh = (rotacao === 90 || rotacao === 270) ? w : h;
    var out = new Uint8ClampedArray(img.data.length);
    var x, y;

    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var origem = (y * w + x) << 2;
        var alvo;
        if (rotacao === 90) {
          alvo = (x * nw + (h - 1 - y)) << 2;
        } else if (rotacao === 180) {
          alvo = ((h - 1 - y) * nw + (w - 1 - x)) << 2;
        } else {
          alvo = ((w - 1 - x) * nw + y) << 2;
        }
        out[alvo] = img.data[origem];
        out[alvo + 1] = img.data[origem + 1];
        out[alvo + 2] = img.data[origem + 2];
        out[alvo + 3] = 255;
      }
    }
    try {
      return new ImageData(out, nw, nh);
    } catch (e) {
      return { data: out, width: nw, height: nh, colorSpace: 'srgb' };
    }
  };

  /* ------------------------------------------- cantos normais */
  W.quadPadrao = function (larg, alt, recuo) {
    var r = (typeof recuo === 'number') ? recuo : 0;
    r = Math.max(0, Math.min(0.45, r));
    var ix = larg * r, iy = alt * r;
    return [
      { x: ix, y: iy },
      { x: larg - ix, y: iy },
      { x: larg - ix, y: alt - iy },
      { x: ix, y: alt - iy }
    ];
  };

  W.deslocarCanto = function (quad, indice, dx, dy, larg, alt) {
    var q = quad.map(function (p) { return { x: p.x, y: p.y }; });
    var p = q[indice];
    p.x = Math.max(0, Math.min(larg, p.x + dx));
    p.y = Math.max(0, Math.min(alt, p.y + dy));
    return q;
  };

  global.Warp = W;
})(window);
