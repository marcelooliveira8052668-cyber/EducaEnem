/* ============================================================
   pdf.js — geração de PDF no cliente (sem bibliotecas externas)

   Usa a estrutura mínima do PDF 1.4:
   - cabeçalho
   - objetos: catálogo, páginas, fontes, páginas individuais, xobject (imagens JPEG)
   - xref + trailer
   ============================================================ */
(function (global) {
  'use strict';

  var P = {};

  P.TAMANHOS = {
    a4: { w: 595.28, h: 841.89 },
    carta: { w: 612, h: 792 },
    foto: { w: 640, h: 480 }
  };

  /* --------------------------------------------- utilidades */
  function novaId() { return ++P.ultimaId; }
  P.ultimaId = 0;

  function fmt(n) {
    if (typeof n === 'number') {
      if (Math.abs(n - Math.round(n)) < 0.0005) return n.toFixed(3).replace(/\.?0+$/, '');
      return n.toFixed(3);
    }
    return n;
  }

  function escapePDF(s) {
    return String(s).replace(/[\\()]/g, '\\$&');
  }

  P.buffer = function () {
    var partes = [];
    var offset = 0;
    return {
      write: function (s) { partes.push(s); offset += s.length; },
      writeLn: function (s) { this.write(s + '\n'); },
      toBlob: function () {
        return new Blob(partes, { type: 'application/pdf' });
      },
      toUint8: function () {
        var str = partes.join('');
        var buf = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
        return buf;
      }
    };
  };

  /* --------------------------------------------- montar PDF */
  P.criar = function (paginas, opcoes) {
    var o = opcoes || {};
    var tamanho = P.TAMANHOS[o.tamanho] || P.TAMANHOS.a4;
    var qualidade = typeof o.qualidade === 'number' ? o.qualidade : 0.88;
    var pbpb = o.pbpb === 1; /* 1 = forçar PB no PDF */
    var titulo = escapePDF(o.titulo || 'Documento');
    var autor = escapePDF(o.autor || '');
    var criador = escapePDF(o.criador || 'Escaneador Profissional');

    var buf = P.buffer();
    var ids = [];
    var offsets = [];

    function objInicio(id) {
      offsets[id] = buf.toUint8().length + partesJoinLength(partes);
      buf.write(id + ' 0 obj\n');
    }
    function objFim() {
      buf.write('\nendobj\n');
    }

    var partes = [];

    /* ------------ 1: catálogo ------------ */
    var idCatalogo = novaId();
    offsets[idCatalogo] = 0;
    partes.push(idCatalogo + ' 0 obj\n<< /Type /Catalog /Pages ' + novaId() + ' 0 R >>\nendobj\n');

    /* ------------ 2: páginas (kids) ------------ */
    var idPaginas = offsets[idCatalogo + 1] || novaId();
    var kids = [];
    for (var i = 0; i < paginas.length; i++) kids.push(novaId() + ' 0 R');

    offsets[idPaginas] = 0;
    partes.push(idPaginas + ' 0 obj\n<< /Type /Pages /Count ' + paginas.length + ' /Kids [' + kids.join(' ') + '] >>\nendobj\n');

    /* ------------ 3: fontes ------------ */
    var idFonte = novaId();
    offsets[idFonte] = 0;
    partes.push(idFonte + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');

    var idFonteBold = novaId();
    offsets[idFonteBold] = 0;
    partes.push(idFonteBold + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

    /* ------------ cada página ------------ */
    var idPrimeiraPagina = 0;
    var imagens = [];

    for (var p = 0; p < paginas.length; p++) {
      var pg = paginas[p];
      var imgData = pg.imagem;
      var rotate = pg.rotacao || 0;

      /* JPEG */
      var canvas = document.createElement('canvas');
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      var ctx = canvas.getContext('2d');
      ctx.putImageData(imgData, 0, 0);
      var jpegBlob;
      var base64;
      var len = 0;

      try {
        /* JPEG sincrono via toDataURL (rápido) */
        var dataUrl = canvas.toDataURL('image/jpeg', qualidade);
        base64 = dataUrl.split(',')[1];
        var bin = atob(base64);
        len = bin.length;
      } catch (e) {
        /* fallback: sem compressão (raro) */
        base64 = '';
        len = 0;
      }

      var idImagem = novaId();
      imagens.push({ id: idImagem, base64: base64, len: len, w: imgData.width, h: imgData.height });

      /* objeto da página */
      var idPag = novaId();
      if (!idPrimeiraPagina) idPrimeiraPagina = idPag;

      /* matrix para rotação */
      var pageW = tamanho.w, pageH = tamanho.h;
      var scale = Math.min(pageW / imgData.width, pageH / imgData.height) * 0.96;
      var drawW = imgData.width * scale;
      var drawH = imgData.height * scale;
      var x = (pageW - drawW) / 2;
      var y = (pageH - drawH) / 2;

      /* conteúdo stream */
      var conteudo = '';
      conteudo += 'q\n';
      conteudo += fmt(drawW) + ' 0 0 ' + fmt(drawH) + ' ' + fmt(x) + ' ' + fmt(y) + ' cm\n';
      conteudo += '/Im' + idImagem + ' Do\n';
      conteudo += 'Q\n';

      var idConteudo = novaId();
      offsets[idConteudo] = 0;
      partes.push(idConteudo + ' 0 obj\n<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream\nendobj\n');

      var idPagObj = novaId();
      offsets[idPagObj] = 0;
      partes.push(idPagObj + ' 0 obj\n<< /Type /Page /Parent ' + idPaginas + ' 0 R /MediaBox [0 0 ' + fmt(pageW) + ' ' + fmt(pageH) + '] /Contents ' + idConteudo + ' 0 R /Resources << /XObject << /Im' + idImagem + ' ' + idImagem + ' 0 R >> /Font << /F1 ' + idFonte + ' 0 R /F2 ' + idFonteBold + ' 0 R >> >> >>\nendobj\n');

      /* objeto da imagem */
      offsets[idImagem] = 0;
      partes.push(idImagem + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + imgData.width + ' /Height ' + imgData.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + len + ' >>\nstream\n');
      if (base64) {
        partes.push(base64);
      }
      partes.push('\nendstream\nendobj\n');
    }

    /* ------------ metadados ------------ */
    var idInfo = novaId();
    offsets[idInfo] = 0;
    var meta = '<< /Title (' + titulo + ') /Author (' + autor + ') /Creator (' + criador + ') /Producer (' + criador + ') /CreationDate (D:' + P.carimboISO() + ') >>';
    partes.push(idInfo + ' 0 obj\n' + meta + '\nendobj\n');

    /* ------------ xref ------------ */
    var xrefOffset = partesJoinLength(partes);
    partes.push('xref\n0 ' + (P.ultimaId + 1) + '\n0000000000 65535 f \n');
    for (var k = 1; k <= P.ultimaId; k++) {
      var off = offsets[k] || 0;
      partes.push(P.pad(off, 10) + ' 00000 n \n');
    }

    /* ------------ trailer ------------ */
    partes.push('trailer\n<< /Size ' + (P.ultimaId + 1) + ' /Root ' + idCatalogo + ' 0 R /Info ' + idInfo + ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF');

    return new Blob(partes, { type: 'application/pdf' });
  };

  function partesJoinLength(arr) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += arr[i].length;
    return t;
  }

  P.pad = function (n, l) {
    var s = String(n);
    while (s.length < l) s = '0' + s;
    return s;
  };

  P.carimboISO = function () {
    var d = new Date();
    return d.getFullYear() +
      P.pad(d.getMonth() + 1, 2) +
      P.pad(d.getDate(), 2) +
      P.pad(d.getHours(), 2) +
      P.pad(d.getMinutes(), 2) +
      P.pad(d.getSeconds(), 2) + 'Z';
  };

  global.PDF = P;
})(window);