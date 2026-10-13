/* ============================================================
   detect.js — motor de detecção de bordas do documento

   Pipeline:
     1. escala de cinza + borrão suavizador
     2. magnitude do gradiente (Sobel)
     3. limiar adaptativo (Otsu + percentil alto)
     4. morfologia (fechar) para unir bordas quebradas
     5. componentes conexos + rastreamento do contorno
     6. casco convexo + simplificação (Douglas-Peucker)
     7. busca do melhor quadrilátero (área, ângulos, proporção)
     8. ordenação dos cantos no sentido horário a partir do topo

   Tudo roda em Uint8/arrays simples, sem dependências.
   ============================================================ */
(function (global) {
  'use strict';

  var D = {};

  /* ---------------------------------------------------------- cinza */
  D.paraCinza = function (img) {
    var d = img.data;
    var n = img.width * img.height;
    var out = new Uint8ClampedArray(n);
    var p = 0;
    for (var i = 0; i < d.length; i += 4, p++) {
      out[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    }
    return out;
  };

  /* ---------------------------------------------------------- borrão
     Borrão box separável por somas acumuladas (suaviza ruído). */
  D.borrar = function (src, w, h, r) {
    if (r < 1) return src;
    var temp = new Uint8ClampedArray(w * h);
    if (r < 1) return src;
    var temp = new Uint8ClampedArray(w * h);
    var out = new Uint8ClampedArray(w * h);
    var jan = 2 * r + 1;
    var x, y, k, soma;

    for (y = 0; y < h; y++) {
      var baseY = y * w;
      soma = 0;
      for (k = -r; k <= r; k++) {
        x = k < 0 ? 0 : (k >= w ? w - 1 : k);
        soma += src[baseY + x];
      }
      for (x = 0; x < w; x++) {
        temp[baseY + x] = (soma / jan) | 0;
        var sair = x - r < 0 ? 0 : (x - r >= w ? w - 1 : x - r);
        var entr = x + r + 1 < 0 ? 0 : (x + r + 1 >= w ? w - 1 : x + r + 1);
        soma += src[baseY + entr] - src[baseY + sair];
      }
    }

    for (x = 0; x < w; x++) {
      soma = 0;
      for (k = -r; k <= r; k++) {
        y = k < 0 ? 0 : (k >= h ? h - 1 : k);
        soma += temp[y * w + x];
      }
      for (y = 0; y < h; y++) {
        out[y * w + x] = (soma / jan) | 0;
        var sair2 = y - r < 0 ? 0 : (y - r >= h ? h - 1 : y - r);
        var entr2 = y + r + 1 < 0 ? 0 : (y + r + 1 >= h ? h - 1 : y + r + 1);
        soma += temp[entr2 * w + x] - temp[sair2 * w + x];
      }
    }
    return out;
  };

  /* ---------------------------------------------------------- Sobel */
  D.sobel = function (cinza, w, h) {
    var n = w * h;
    var mag = new Uint8ClampedArray(n);
    var x, y, i, a00, a01, a02, a10, a12, a20, a21, a22;
    var l1, l2, l3;

    for (y = 1; y < h - 1; y++) {
      l1 = (y - 1) * w;
      l2 = y * w;
      l3 = (y + 1) * w;
      for (x = 1; x < w - 1; x++) {
        a01 = cinza[l1 + x];     a11 = cinza[l2 + x];
        a21 = cinza[l3 + x];
        a00 = cinza[l1 + x - 1]; a02 = cinza[l1 + x + 1];
        a20 = cinza[l3 + x - 1]; a22 = cinza[l3 + x + 1];
        var gx = (a02 + 2 * cinza[l2 + x + 1] + a22) - (a00 + 2 * cinza[l2 + x - 1] + a20);
        var gy = (a22 + 2 * a21 + a20) - (a02 + 2 * a01 + a00);
        var m = (gx < 0 ? -gx : gx) + (gy < 0 ? -gy : gy);
        mag[l2 + x] = m > 255 ? 255 : m;
      }
    }
    return mag;
  };

  /* ---------------------------------------------------------- Otsu */
  D.otsu = function (hist, total) {
    var soma = 0, i;
    for (i = 0; i < 256; i++) soma += i * hist[i];
    var somaB = 0, wB = 0, melhor = 0, melhorVar = -1;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      somaB += i * hist[i];
      var mB = somaB / wB;
      var mF = (soma - somaB) / wF;
      var entre = wB * wF * (mB - mF) * (mB - mF);
      if (entre > melhorVar) { melhorVar = entre; melhor = i; }
    }
    return melhor;
  };

  D.limiarAutomatico = function (mag, w, h) {
    var hist = new Uint32Array(256);
    var i, n = w * h;
    for (i = 0; i < n; i++) hist[mag[i]]++;
    var otsu = D.otsu(hist, n);

    /* percentil 90: garante que só bordas reais entrem */
    var acumulado = 0, alvo = Math.floor(n * 0.90), p90 = 120;
    for (i = 0; i < 256; i++) {
      acumulado += hist[i];
      if (acumulado >= alvo) { p90 = i; break; }
    }
    return Math.max(otsu, Math.min(p90, 110), 28);
  };

  /* ---------------------------------------------------------- morfologia */
  D.binarizar = function (mag, w, h, limiar) {
    var n = w * h;
    var out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = mag[i] >= limiar ? 1 : 0;
    return out;
  };

  D.dilatar = function (b, w, h) {
    var out = new Uint8Array(w * h);
    var x, y, dx, dy;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var achou = 0;
        for (dy = -1; dy <= 1 && !achou; dy++) {
          var yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (dx = -1; dx <= 1; dx++) {
            var xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (b[yy * w + xx]) { achou = 1; break; }
          }
        }
        out[y * w + x] = achou;
      }
    }
    return out;
  };

  D.erodir = function (b, w, h) {
    var out = new Uint8Array(w * h);
    var x, y, dx, dy;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var falta = 0;
        for (dy = -1; dy <= 1 && !falta; dy++) {
          var yy = y + dy;
          for (dx = -1; dx <= 1; dx++) {
            var xx = x + dx;
            if (yy < 0 || yy >= h || xx < 0 || xx >= w || !b[yy * w + xx]) { falta = 1; break; }
          }
        }
        out[y * w + x] = falta ? 0 : 1;
      }
    }
    return out;
  };

  D.fechar = function (b, w, h, raio) {
    var r = raio < 1 ? 1 : raio;
    var dil = b;
    var ero;
    var i;
    for (i = 0; i < r; i++) { dil = D.dilatar(dil, w, h); }
    for (i = 0; i < r; i++) { ero = D.erodir(dil, w, h); dil = ero; }
    return dil;
  };

  /* ---------------------------------------------------------- componentes */
  D.componentes = function (b, w, h, minimo) {
    var rotulado = new Int32Array(w * h).fill(-1);
    var comps = [];
    var fila = new Int32Array(w * h);
    var x, y;
    var BFS = Math.min(w * h, 1 << 22);

    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var i0 = y * w + x;
        if (!b[i0] || rotulado[i0] !== -1) continue;
        var id = comps.length;
        var inicio = 0, fim = 0, contados = 0;
        fila[fim++] = i0;
        rotulado[i0] = id;
        var minx = x, miny = y, maxx = x, maxy = y;
        while (inicio < fim && inicio < BFS) {
          var p = fila[inicio++];
          contados++;
          var px = p % w;
          var py = (p - px) / w;
          if (px < minx) minx = px;
          if (px > maxx) maxx = px;
          if (py < miny) miny = py;
          if (py > maxy) maxy = py;
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              var nx = px + dx, ny = py + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              var np = ny * w + nx;
              if (b[np] && rotulado[np] === -1) {
                rotulado[np] = id;
                if (fim < BFS) fila[fim++] = np;
              }
            }
          }
        }
        if (contados >= (minimo || 1)) {
          comps.push({ id: id, pixels: contados, caixa: [minx, miny, maxx, maxy] });
        }
      }
    }
    comps.sort(function (a, b2) { return b2.pixels - a.pixels; });
    return { componentes: comps, rotulado: rotulado };
  };

  /* --------------------------------------------------- Douglas-Peucker */
  D.rdp = function (pontos, eps) {
    if (pontos.length < 3) return pontos.slice();
    var ini = 0, fim = pontos.length - 1;
    var marcados = new Uint8Array(pontos.length);
    marcados[ini] = marcados[fim] = 1;
    var pilha = [[ini, fim]];
    var x0 = pontos[ini].x, y0 = pontos[ini].y;
    var x1 = pontos[fim].x, y1 = pontos[fim].y;

    while (pilha.length) {
      var par = pilha.pop();
      var a = par[0], b = par[1];
      var ax = pontos[a].x, ay = pontos[a].y;
      var bx = pontos[b].x, by = pontos[b].y;
      var dx = bx - ax, dy = by - ay;
      var len = Math.sqrt(dx * dx + dy * dy);
      var pior = -1, piorDist = -1;
      if (len < 1e-6) {
        for (var k = a + 1; k < b; k++) {
          var d = Math.hypot(pontos[k].x - ax, pontos[k].y - ay);
          if (d > piorDist) { piorDist = d; pior = k; }
        }
      } else {
        for (var k2 = a + 1; k2 < b; k2++) {
          var px = pontos[k2].x - ax, py = pontos[k2].y - ay;
          var d2 = Math.abs(px * dy - py * dx) / len;
          if (d2 > piorDist) { piorDist = d2; pior = k2; }
        }
      }
      if (pior > 0 && piorDist > eps) {
        marcados[pior] = 1;
        pilha.push([a, pior]);
        pilha.push([pior, b]);
      }
    }
    var res = [];
    for (var i = 0; i < pontos.length; i++) if (marcados[i]) res.push(pontos[i]);
    return res;
  };

  /* --------------------------------------------------- casco convexo */
  D.casco = function (pontos) {
    if (pontos.length < 3) return pontos.slice();
    var pts = pontos.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    var cruz = function (o, a, b) {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };
    var inf = [], sup = [], i;
    for (i = 0; i < pts.length; i++) {
      while (inf.length >= 2 && cruz(inf[inf.length - 2], inf[inf.length - 1], pts[i]) <= 0) inf.pop();
      inf.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (sup.length >= 2 && cruz(sup[sup.length - 2], sup[sup.length - 1], pts[i]) <= 0) sup.pop();
      sup.push(pts[i]);
    }
    inf.pop(); sup.pop();
    return inf.concat(sup);
  };

  D.areaPoligono = function (p) {
    var s = 0;
    for (var i = 0, j = p.length - 1; i < p.length; j = i, i++) {
      s += (p[j].x + p[i].x) * (p[i].y - p[j].y);
    }
    return Math.abs(s) / 2;
  };

  /* -------------------------------------------- melhor quadrilátero */
  D.melhorQuadrado = function (pontos, largura, altura) {
    var hull = D.casco(pontos);
    if (hull.length < 4) return null;

    /* reduz os candidatos do casco, mantendo a forma */
    var cand = hull;
    var epsBase = Math.max(largura, altura) * 0.004;
    while (cand.length > 14 && epsBase < Math.max(largura, altura) * 0.2) {
      epsBase *= 1.35;
      cand = D.rdp(hull, epsBase);
      if (cand.length < 4) break;
    }
    if (cand.length < 4) return null;
    if (cand.length > 14) cand = cand.slice(0, 14);

    var n = cand.length;
    var areaFrame = largura * altura;
    var melhor = null, melhorNota = -Infinity;
    var i, j, k, l;

    for (i = 0; i < n - 3; i++) {
      for (j = i + 1; j < n - 2; j++) {
        for (k = j + 1; k < n - 1; k++) {
          for (l = k + 1; l < n; l++) {
            var quad = [cand[i], cand[j], cand[k], cand[l]];
            var area = D.areaPoligono(quad);
            if (area < areaFrame * 0.07) continue;
            if (area > areaFrame * 1.02) continue;

            /* penalidades */
            var penal = 0;
            var centro = { x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
                           y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4 };
            for (var m = 0; m < 4; m++) {
              var a = quad[m], b = quad[(m + 1) % 4];
              var c = quad[(m + 3) % 4];
              var v1 = { x: a.x - b.x, y: a.y - b.y };
              var v2 = { x: c.x - b.x, y: c.y - b.y };
              var n1 = Math.hypot(v1.x, v1.y), n2 = Math.hypot(v2.x, v2.y);
              if (n1 < 1 || n2 < 1) { penal = 999; break; }
              var cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
              cos = Math.max(-1, Math.min(1, cos));
              var ang = Math.acos(cos) * 180 / Math.PI;
              penal += Math.abs(90 - ang) / 90;
            }
            if (penal > 1.15) continue;

            var arestas = [];
            for (var m2 = 0; m2 < 4; m2++) {
              arestas.push(Math.hypot(
                quad[m2].x - quad[(m2 + 1) % 4].x,
                quad[m2].y - quad[(m2 + 1) % 4].y
              ));
            }
            var ladoMaior = Math.max.apply(null, arestas);
            var ladoMenor = Math.min.apply(null, arestas);
            if (ladoMaior < 18) continue;
            var proporcao = ladoMaior / Math.max(1, ladoMenor);
            if (proporcao > 7) continue;

            var nota = (area / areaFrame) - penal * 0.42 - Math.abs(Math.log(proporcao)) * 0.16;
            if (nota > melhorNota) {
              melhorNota = nota;
              melhor = { pontos: quad, area: area, nota: nota };
            }
          }
        }
      }
    }
    if (!melhor) return null;

    /* área do retângulo externo, para descartar detecções degeneradas */
    var xs = melhor.pontos.map(function (p) { return p.x; });
    var ys = melhor.pontos.map(function (p) { return p.y; });
    var caixaArea = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) *
                    (Math.max.apply(null, ys) - Math.min.apply(null, ys));
    var indiceRetangular = melhor.area / Math.max(1, caixaArea);
    if (indiceRetangular < 0.30) return null;

    return D.ordenarCantos(melhor.pontos);
  };

  /* -------------------------------------------- ordenar cantos */
  D.ordenarCantos = function (pontos) {
    var p = pontos.slice();
    while (p.length < 4) p.push(p[p.length - 1]);
    if (p.length > 4) p = p.slice(0, 4);

    var cx = 0, cy = 0, i;
    for (i = 0; i < 4; i++) { cx += p[i].x; cy += p[i].y; }
    cx /= 4; cy /= 4;

    for (i = 0; i < 4; i++) p[i].ang = Math.atan2(p[i].y - cy, p[i].x - cx);
    p.sort(function (a, b) { return a.ang - b.ang; });

    var assinada = 0;
    for (i = 0, j = 3; i < 4; j = i, i++) {
      assinada += (p[j].x - p[i].x) * (p[j].y - p[i].y) - (p[i].x * p[j].y - p[i].y * p[j].x);
    }
    if (assinada > 0) p.reverse();

    var topo = 0, menorSoma = Infinity;
    for (i = 0; i < 4; i++) {
      var s = p[i].x + p[i].y;
      if (s < menorSoma) { menorSoma = s; topo = i; }
    }
    var ordem = [];
    for (i = 0; i < 4; i++) ordem.push(p[(topo + i) % 4]);
    return ordem; /* [tl, tr, br, bl] */
  };

  /* -------------------------------------------- função principal */
  D.detectar = function (imageData, opcoes) {
    var o = opcoes || {};
    var w = imageData.width, h = imageData.height;
    var areaFrame = w * h;
    if (areaFrame < 900) return null;

    var cinza = D.paraCinza(imageData);
    var suave = D.borrarBox(cinza, w, h, 1);
    var mag = D.sobel(suave, w, h);
    var limiar = D.limiarAutomatico(mag, w, h);
    var bin = D.binarizar(mag, w, h, limiar);
    var fechada = D.fechar(bin, w, h, 3);

    var info = D.componentes(fechada, w, h, Math.max(40, Math.floor(areaFrame * 0.0006)));
    var componentes = info.componentes.slice(0, 6);
    if (!componentes.length) return null;

    var rotulado = info.rotulado;
    var melhor = null;

    for (var ci = 0; ci < componentes.length; ci++) {
      var comp = componentes[ci];
      var cx0 = comp.caixa[0], cy0 = comp.caixa[1];
      var cx1 = comp.caixa[2], cy1 = comp.caixa[3];
      var bw = cx1 - cx0 + 1, bh = cy1 - cy0 + 1;
      if (bw < 20 || bh < 20) continue;

      /* pontos da fronteira do componente dentro da caixa */
      var pontos = [];
      var x, y;
      for (y = cy0; y <= cy1; y++) {
        for (x = cx0; x <= cx1; x++) {
          var idx = y * w + x;
          if (rotulado[idx] !== comp.id) continue;
          /* borda = pixel rotulado com vizinho não rotulado */
          var borda = false;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) borda = true;
          else if (rotulado[idx - 1] !== comp.id || rotulado[idx + 1] !== comp.id ||
                   rotulado[idx - w] !== comp.id || rotulado[idx + w] !== comp.id) borda = true;
          if (borda) pontos.push({ x: x, y: y });
        }
      }
      if (pontos.length < 12) continue;

      /* amostra para deixar o casco rápido */
      var amostra = pontos;
      if (pontos.length > 900) {
        amostra = [];
        var passo = Math.ceil(pontos.length / 900);
        for (var q = 0; q < pontos.length; q += passo) amostra.push(pontos[q]);
      }

      var candidato = D.melhorQuadrado(amostra, w, h);
      if (!candidato) continue;
      var razao = candidato.area / areaFrame;
      if (!melhor || razao > melhor.area) {
        melhor = {
          cantos: candidato,
          area: razao,
          confianca: Math.min(1, razao * 1.4),
          largura: w,
          altura: h
        };
      }
      if (razao > 0.55) break;
    }

    /* ----------------------------------------------------------------
       Fallback: se nada foi detectado, devolve o quadro da imagem com
       leve recuo — garante que o usuário sempre tenha um corte inicial.
       ---------------------------------------------------------------- */
    if (!melhor) {
      var ins = 0.055;
      var frame = [
        { x: w * ins, y: h * ins },
        { x: w * (1 - ins), y: h * ins },
        { x: w * (1 - ins), y: h * (1 - ins) },
        { x: w * ins, y: h * (1 - ins) }
      ];
      return {
        cantos: frame,
        area: (1 - 2 * ins) * (1 - 2 * ins),
        confianca: 0,
        automatico: false,
        largura: w,
        altura: h
      };
    }

    if (o.minConfianca && melhor.confianca < o.minConfianca) return null;
    melhor.automatico = true;
    return melhor;
  };

  /* -------------------------------------------- ajuda de interface */
  D.descrever = function (resultado) {
    if (!resultado) return { texto: 'Nada detectado', nivel: 'erro' };
    var r = resultado.confianca || 0;
    if (r <= 0) return { texto: 'Ajuste o enquadramento', nivel: 'erro' };
    if (r < 0.32) return { texto: 'Documento detectado — aproxime', nivel: 'alerta' };
    if (r < 0.55) return { texto: 'Documento detectado', nivel: 'ok' };
    return { texto: 'Documento detectado', nivel: 'ok' };
  };

  D.cantoParaImg = function (canto, escalaW, escalaH) {
    return { x: canto.x * escalaW, y: canto.y * escalaH };
  };

  global.Detectar = D;
})(window);
