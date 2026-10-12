/* =============================================================================
   EducaEnem — SERVIDOR DE EXEMPLO (ZERO dependências)
   -----------------------------------------------------------------------------
   Implementa o contrato de backend/api.md usando apenas Node.js puro — não é
   preciso `npm install`. Os dados ficam num arquivo local (dados.json) para
   você ver o site inteiro funcionando com um "banco de verdade".

   COMO USAR
     1. Tenha o Node.js instalado.
     2. Nesta pasta (backend), no terminal:     node exemplo-servidor.js
     3. Em js/config.js ajuste:
            backend: { modo: "api", baseUrl: "http://localhost:3000" }
     4. Recarregue o site. Pronto: usuários, notas, atividades, textos, aulas,
        provas e pedidos passam a sair e voltar do servidor.

   COMO LIGAR O SEU BANCO DE VERDADE
     Troque as funções "lerBanco"/"gravarBanco" por consultas ao seu banco
     (Postgres, MySQL, SQLite, Mongo...). O roteamento abaixo continua igual.
     Modelo de tabelas: backend/schema.sql
   ============================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORTA = process.env.PORT || 3000;
const ARQUIVO = path.join(__dirname, "dados.json");
const API_KEY = process.env.API_KEY || ""; // defina para exigir token (opcional)

/* ---------------------------------------------------------------------------
   TABELAS expostas pela API. (esta lista é a "porta" do seu banco)
   --------------------------------------------------------------------------- */
const TABELAS = {
  usuarios: "usuarios",
  notas: "notas",
  submissoes: "submissoes",
  pedidos: "pedidos",
  textos: "textos",
  aulas: "aulas",
  provas: "provas",
};

/* ---------------------------------------------------------------------------
   "Banco de dados" — arquivo JSON.  TROQUE por consultas SQL/Mongo depois.
   --------------------------------------------------------------------------- */
function bancoVazio() {
  return {
    usuarios: [],
    notas: [],
    submissoes: [],
    pedidos: [],
    textos: [],
    aulas: [],
    provas: [],
  };
}

function gravarBanco(db) {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Não foi possível gravar dados.json:", e.message);
  }
}

function lerBanco() {
  try {
    const db = JSON.parse(fs.readFileSync(ARQUIVO, "utf8") || "{}");
    Object.keys(bancoVazio()).forEach((k) => {
      if (!Array.isArray(db[k])) db[k] = [];
    });
    return db;
  } catch (e) {
    const db = bancoVazio();
    gravarBanco(db);
    return db;
  }
}

/* Senhas: aqui guardamos hash simples só para o exemplo.
   NO SERVIDOR DE VERDADE use bcrypt/argon2 e nunca devolva a senha. */
function hash(senha) {
  return "s" + crypto.createHash("sha256").update(String(senha)).digest("hex");
}

function semear(db) {
  if (db.usuarios.length) return db;
  const agora = new Date().toISOString();
  db.usuarios.push(
    {
      id: "u-prof",
      nome: "Prof. Marcelo Oliveira",
      login: "marcelo",
      senha: hash("1234"),
      papel: "professor",
      email: "marcelo.oliveira@educaenem.com",
      turma: null,
      criadoEm: agora,
    },
    {
      id: "u-aluno-1",
      nome: "Ana Beatriz Souza",
      login: "ana",
      senha: hash("1234"),
      papel: "aluno",
      email: "ana.souza@aluno.educaenem.com",
      turma: "EM3-A",
      criadoEm: agora,
    }
  );
  gravarBanco(db);
  return db;
}

/* ---------------------------------------------------------------------------
   Auxiliares
   --------------------------------------------------------------------------- */
function responder(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  res.end(dados === undefined ? "" : JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    let txt = "";
    req.on("data", (c) => (txt += c));
    req.on("end", () => {
      try {
        resolve(txt ? JSON.parse(txt) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function novoId(prefixo) {
  return prefixo + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Nunca devolve a senha ao front-end. */
function semSenha(u) {
  const copia = Object.assign({}, u);
  delete copia.senha;
  delete copia.senhaHash;
  return copia;
}

/* ---------------------------------------------------------------------------
   Servidor
   --------------------------------------------------------------------------- */
const servidor = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return responder(res, 204);

  const url = new URL(req.url, "http://localhost");
  const rota = url.pathname.replace(/\/+$/, "") || "/";
  const q = url.searchParams;
  const metodo = req.method;

  if (API_KEY) {
    const auth = req.headers["authorization"] || "";
    if (auth !== "Bearer " + API_KEY) return responder(res, 401, { erro: "Não autorizado." });
  }

  try {
    /* ---------------- saúde ---------------- */
    if (rota === "/health")
      return responder(res, 200, { ok: true, servico: "EducaEnem API", tabelas: Object.keys(TABELAS) });

    /* ---------------- login ---------------- */
    if (rota === "/login" && metodo === "POST") {
      const dados = await lerCorpo(req);
      const db = semear(lerBanco());
      const login = String(dados.login || "").trim();
      const u = db.usuarios.find((x) => x.login && x.login.toLowerCase() === login.toLowerCase());
      if (!u) return responder(res, 401, { ok: false, erro: "Usuário não encontrado." });
      if (u.senha && u.senha !== hash(dados.senha))
        return responder(res, 401, { ok: false, erro: "Senha incorreta." });
      if (u.ativo === false) return responder(res, 403, { ok: false, erro: "Matrícula inativa." });
      return responder(res, 200, { ok: true, usuario: semSenha(u), token: novoId("tok") });
    }

    /* ---------------- coleções genéricas ---------------- */
    const nome = rota.slice(1);
    if (!TABELAS[nome]) return responder(res, 404, { erro: "Rota não encontrada: " + rota });

    const db = semear(lerBanco());
    const colecao = db[TABELAS[nome]];
    const idCampo = "id";

    /* ---- LEITURA ---- */
    if (metodo === "GET") {
      let lista = colecao.slice();
      const papel = q.get("papel");
      const alunoId = q.get("alunoId");
      const disciplina = q.get("disciplina");
      if (papel) lista = lista.filter((x) => x.papel === papel);
      if (alunoId) lista = lista.filter((x) => x.alunoId === alunoId);
      if (disciplina) lista = lista.filter((x) => x.disciplina === disciplina);
      if (nome === "usuarios") lista = lista.map(semSenha);
      return responder(res, 200, lista);
    }

    /* ---- GRAVAÇÃO (cria ou atualiza pelo id: "upsert") ---- */
    if (metodo === "POST" || metodo === "PUT") {
      const dados = await lerCorpo(req);
      const id = q.get("id") || dados[idCampo] || null;
      const indice = id ? colecao.findIndex((x) => String(x[idCampo]) === String(id)) : -1;

      if (nome === "usuarios" && metodo === "POST") {
        const login = String(dados.login || "").trim();
        if (!login && indice < 0) return responder(res, 400, { erro: "Informe um nome de usuário." });
        const repetido = colecao.findIndex(
          (x) => x.login && login && x.login.toLowerCase() === login.toLowerCase() && String(x.id) !== String(id)
        );
        if (repetido >= 0) return responder(res, 409, { erro: "Este nome de usuário já está em uso." });
      }

      let registro;
      if (indice >= 0) {
        registro = Object.assign({}, colecao[indice], dados);
        if (indice >= 0 && dados.id !== undefined) registro.id = colecao[indice].id;
        if (nome === "usuarios") {
          // A senha só entra se for nova — e SEMPRE armazenada como hash,
          // senão a comparação do login deixa de funcionar.
          if (!dados.senha) registro.senha = colecao[indice].senha;
          else registro.senha = hash(dados.senha);
        }
        colecao[indice] = registro;
      } else {
        registro = Object.assign({}, dados);
        if (!registro[idCampo]) registro[idCampo] = novoId(nome.replace(/s$/, "") || "reg");
        if (nome === "usuarios" && (dados.senha || dados.senha === "")) registro.senha = hash(dados.senha);
        if (nome === "usuarios" && !registro.papel) registro.papel = "aluno";
        if (!registro.dataISO) registro.dataISO = new Date().toISOString();
        colecao.push(registro);
      }

      gravarBanco(db);
      return responder(res, indice >= 0 ? 200 : 201, nome === "usuarios" ? semSenha(registro) : registro);
    }

    /* ---- REMOÇÃO ---- */
    if (metodo === "DELETE") {
      const id = q.get("id");
      if (!id) return responder(res, 400, { erro: "Informe o id do registro." });
      const antes = colecao.length;
      const novaLista = colecao.filter((x) => String(x[idCampo]) !== String(id));
      db[TABELAS[nome]] = novaLista;
      gravarBanco(db);
      if (novaLista.length === antes)
        return responder(res, 404, { erro: "Registro não encontrado (" + id + ")." });
      return responder(res, 200, { ok: true, id: id });
    }

    return responder(res, 405, { erro: "Método não permitido." });
  } catch (e) {
    console.error(e);
    return responder(res, 500, { erro: "Erro interno do servidor." });
  }
});

/* ---------------------------------------------------------------------------
   Erros do próprio servidor: sem estes tratadores, uma conexão interrompida
   pelo navegador (por exemplo, quando ele cancela uma requisição) derrubaria
   o processo inteiro.
   --------------------------------------------------------------------------- */
servidor.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error("A porta " + PORTA + " já está em uso. Pare o outro processo ou rode com PORT=3001 node exemplo-servidor.js");
    process.exit(1);
  }
  console.error("Erro no servidor:", e.message);
});

servidor.on("clientError", (err, socket) => {
  if (socket && socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

servidor.listen(PORTA, () => {
  console.log("========================================================");
  console.log(" EducaEnem — servidor de exemplo no ar!");
  console.log(" Endereço : http://localhost:" + PORTA);
  console.log(" Health   : http://localhost:" + PORTA + "/health");
  console.log(" Tabelas  : " + Object.keys(TABELAS).join(", "));
  console.log(" Dados    : " + ARQUIVO);
  console.log("--------------------------------------------------------");
  console.log(' Agora em js/config.js use: backend: { modo: "api", baseUrl: "http://localhost:' + PORTA + '" }');
  console.log("========================================================");
});
