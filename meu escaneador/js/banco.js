/* ============================================================
   banco.js — persistência no IndexedDB (documentos + páginas)

   Estrutura:
   - docs: { id, titulo, criado, atualizado, capa (blob), paginas: [ { id, imagem, filtro, rotacao } ] }
   ============================================================ */
(function (global) {
  'use strict';

  var B = {};
  var db = null;
  var pronto = null;
  var resolvers = [];

  var NOME_BD = 'EscaneadorProfissional';
  var VERSAO = 1;
  var STORE_DOCS = 'documentos';
  var STORE_PAGS = 'paginas';

  B.abrir = function () {
    if (pronto) return pronto;
    pronto = new Promise(function (resolve, reject) {
      var req = indexedDB.open(NOME_BD, VERSAO);
      req.onupgradeneeded = function (e) {
        var database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_DOCS)) {
          var store = database.createObjectStore(STORE_DOCS, { keyPath: 'id', autoIncrement: true });
          store.createIndex('por_criado', 'criado', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_PAGS)) {
          var pstore = database.createObjectStore(STORE_PAGS, { keyPath: 'id', autoIncrement: true });
          pstore.createIndex('por_doc', 'docId', { unique: false });
        }
      };
      req.onsuccess = function (e) {
        db = e.target.result;
        db.onerror = function (ev) { console.error('IndexedDB error', ev); };
        resolve(db);
        resolvers.forEach(function (r) { r(db); });
        resolvers = [];
      };
      req.onerror = function (e) {
        reject(e.target.error);
        resolvers.forEach(function (r) { r(null); });
        resolvers = [];
      };
    });
    return pronto;
  };

  B._tx = function (storeNome, modo) {
    return B.abrir().then(function (database) {
      if (!database) throw new Error('Banco indisponível');
      var tx = database.transaction(storeNome, modo);
      return tx.objectStore(storeNome);
    });
  };

  /* ------------ documentos ------------ */
  B.salvarDoc = function (doc) {
    return B._tx(STORE_DOCS, 'readwrite').then(function (store) {
      var d = Object.assign({}, doc);
      if (!d.criado) d.criado = Date.now();
      d.atualizado = Date.now();
      return new Promise(function (resolve, reject) {
        var req = d.id ? store.put(d) : store.add(d);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  B.listarDocs = function () {
    return B._tx(STORE_DOCS, 'readonly').then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.index('por_criado').openCursor(null, 'prev');
        var lista = [];
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            var v = cursor.value;
            lista.push({
              id: v.id,
              titulo: v.titulo,
              criado: v.criado,
              atualizado: v.atualizado,
              capa: v.capa,
              totalPaginas: (v.paginas || []).length
            });
            cursor.continue();
          } else resolve(lista);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  B.obterDoc = function (id) {
    return B._tx(STORE_DOCS, 'readonly').then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.get(Number(id));
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  B.excluirDoc = function (id) {
    return B._tx(STORE_DOCS, 'readwrite').then(function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(Number(id));
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
      });
    }).then(function () {
      return B._tx(STORE_PAGS, 'readwrite').then(function (store) {
        var idx = store.index('por_doc');
        return new Promise(function (resolve, reject) {
          var req = idx.openCursor(Number(id));
          req.onsuccess = function (e) {
            var cursor = e.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else resolve();
          };
          req.onerror = function () { reject(req.error); };
        });
      });
    });
  };

  /* ------------ páginas ------------ */
  B.salvarPaginas = function (docId, paginas) {
    return B._tx(STORE_PAGS, 'readwrite').then(function (store) {
      var ops = [];
      paginas.forEach(function (p) {
        var item = Object.assign({}, p, { docId: Number(docId) });
        ops.push(new Promise(function (resolve, reject) {
          var req = item.id ? store.put(item) : store.add(item);
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { reject(req.error); };
        }));
      });
      return Promise.all(ops);
    });
  };

  B.obterPaginas = function (docId) {
    return B._tx(STORE_PAGS, 'readonly').then(function (store) {
      return new Promise(function (resolve, reject) {
        var idx = store.index('por_doc');
        var req = idx.openCursor(Number(docId));
        var lista = [];
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            lista.push(cursor.value);
            cursor.continue();
          } else resolve(lista);
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  };

  /* ------------ utilidades de capa ------------ */
  B.gerarCapa = function (imgData, maxLado) {
    var canvas = document.createElement('canvas');
    var w = imgData.width, h = imgData.height;
    var escala = Math.min(1, maxLado / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * escala));
    canvas.height = Math.max(1, Math.round(h * escala));
    var ctx = canvas.getContext('2d');
    ctx.drawImage(imgData, 0, 0, canvas.width, canvas.height);
    return U.bytesParaJPEG(canvas, 0.7).then(function (blob) {
      return blob;
    });
  };

  global.Banco = B;
})(window);