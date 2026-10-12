/* =============================================================================
   EducaEnem — TESTE DE CONEXÃO (roda no terminal, sem navegador)
   -----------------------------------------------------------------------------
   Confere se a "porta" de dados do site está funcionando: primeiro no modo
   local (navegador) e depois ligada a um servidor (modo api).

   COMO RODAR
     1. Abra o terminal na pasta `backend` do projeto.
     2. Sobe o servidor de exemplo:       node exemplo-servidor.js
     3. Em outro terminal, na mesma pasta: node teste-conexao.js
     4. Deve terminar com "TODOS OS TESTES PASSARAM".

   O que ele cobre: entrar/sair, cadastrar aluno, trocar senha, remover aluno,
   lançar e editar nota (sem duplicar), corrigir atividade, textos e aulas.
   ============================================================================= */

const path = require("path");
const BASE_API = process.env.BASE_API || "http://localhost:3000";
const RAIZ = path.join(__dirname, ".."); // pasta do projeto
const ARQUIVOS = ["js/config.js", "js/store.js", "js/backend.js", "js/db.js"];

/* ---------------- harness mínimo (simula o navegador) ---------------- */
function novoAmbiente(modo) {
  const vm = require("vm");
  const fs = require("fs");
  const disco = new Map();
  const c = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    fetch: global.fetch,
    AbortController: global.AbortController,
    navigator: { onLine: true },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => (disco.has(k) ? disco.get(k) : null),
      setItem: (k, v) => disco.set(k, String(v)),
      removeItem: (k) => disco.delete(k),
    },
  });
  c.window = c;
  ARQUIVOS.forEach((arq) => {
    let cod = fs.readFileSync(path.join(RAIZ, arq), "utf8");
    if (arq === "js/config.js" && modo === "api") {
      cod = cod
        .replace('modo: "local"', 'modo: "api"')
        .replace('baseUrl: ""', 'baseUrl: "' + BASE_API + '"');
    }
    vm.runInContext(cod, c, { filename: arq });
  });
  vm.runInContext("window.Store = Store;", c); // Store é global léxico
  return c;
}

let falhas = 0;
function ok(rotulo, cond, extra) {
  if (cond) console.log("  [ok] " + rotulo);
  else {
    falhas++;
    console.log("  [FALHA] " + rotulo + (extra ? " -> " + JSON.stringify(extra) : ""));
  }
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- modo local ---------------- */
async function testarLocal() {
  console.log("\n== MODO LOCAL (padrão do site) ==");
  const c = novoAmbiente("local");

  ok("modo local ativo", c.DB.modo === "local", { modo: c.DB.modo });

  const r1 = await c.DB.entrar("marcelo", "1234");
  ok("login do professor", r1.ok === true && r1.usuario.login === "marcelo", r1);
  ok("sessão aberta", c.Store.usuarioAtual() && c.Store.usuarioAtual().login === "marcelo");
  ok("senha errada recusada", (await c.DB.entrar("marcelo", "errada")).ok === false);
  ok("usuário inexistente recusado", (await c.DB.entrar("naoexiste", "1234")).ok === false);

  const nota = c.DB.salvarNota({ alunoId: "u-aluno-1", disciplina: "biologia", trimestre: 1, tipo: "prova", valor: 8.5, descricao: "Teste" });
  ok("salvar nota", nota && !!nota.id, nota);
  const editada = c.DB.salvarNota(Object.assign({}, nota, { valor: 9.5 }));
  ok("editar nota mantém o id e o valor", editada.id === nota.id && editada.valor === 9.5);
  ok("não duplicou a nota", c.Store.notas().filter((n) => n.id === nota.id).length === 1);

  const criado = c.DB.criarUsuario({ nome: "Aluno Teste", login: "alunoteste", senha: "123", papel: "aluno", turma: "EM9" });
  ok("cadastrar aluno", criado.ok === true, criado);
  c.DB.atualizarUsuario(criado.usuario.id, { senha: "456" });
  ok("trocar senha dá acesso com a nova", (await c.DB.entrar("alunoteste", "456")).ok === true);

  const sub = c.DB.salvarSubmissao({ alunoId: "u-aluno-1", tipo: "atividade", titulo: "Atividade X", respostas: [], acertos: 1, total: 2, nota: 5 });
  ok("enviar atividade", sub && !!sub.id);
  ok("corrigir atividade", c.DB.atualizarSubmissao(sub.id, { nota: 7.5 }).nota === 7.5);

  c.DB.removerUsuario(criado.usuario.id);
  ok("remover aluno", !c.Store.usuarioPorId(criado.usuario.id));
  c.DB.sair();
  ok("sair encerra a sessão", c.Store.usuarioAtual() === null);
  ok("sem avisos de sincronização", c.DB.info().erros.length === 0, c.DB.info().erros);
}

/* ---------------- modo api ---------------- */
async function testarApi() {
  console.log("\n== MODO API (ligado ao servidor de exemplo) ==");
  const c = novoAmbiente("api");
  const get = (rota) => fetch(BASE_API + rota).then((r) => r.json());

  ok("modo api ativo", c.DB.modo === "api", { modo: c.DB.modo });
  ok("endereço lido do config.js", c.DB.info().servidor && c.DB.info().servidor.baseUrl === BASE_API);

  ok("hidratação trouxe os dados", (await c.DB.hidratar()) === true);
  ok("alunos do servidor chegaram ao navegador", c.Store.usuarios().length >= 2);

  const r1 = await c.DB.entrar("marcelo", "1234");
  ok("login conferido no servidor", r1.ok === true && r1.usuario.login === "marcelo", r1);
  ok("sessão aberta localmente", c.Store.usuarioAtual() && c.Store.usuarioAtual().login === "marcelo");
  ok("senha errada recusada pelo servidor", (await c.DB.entrar("marcelo", "errada")).ok === false);
  ok("usuário inexistente recusado", (await c.DB.entrar("naoexiste", "1234")).ok === false);

  const aluno = c.Store.usuarios("aluno")[0];
  const nota = c.DB.salvarNota({ alunoId: aluno.id, disciplina: "quimica", trimestre: 2, tipo: "prova", valor: 7.5, descricao: "Teste api" });
  ok("nota salva na hora no navegador", c.Store.notas().some((n) => n.id === nota.id));
  await esperar(400);
  ok("nota chegou ao servidor", (await get("/notas")).some((n) => n.id === nota.id));

  c.DB.salvarNota(Object.assign({}, nota, { valor: 9 }));
  await esperar(400);
  const repetidas = (await get("/notas")).filter((n) => n.id === nota.id);
  ok("editar nota não duplicou no servidor", repetidas.length === 1 && repetidas[0].valor === 9, repetidas);

  const criado = c.DB.criarUsuario({ nome: "Aluno Api", login: "alunoapi", senha: "abc", papel: "aluno", turma: "EM9" });
  await esperar(400);
  const usuarios = await get("/usuarios");
  ok("aluno no servidor com o mesmo id", usuarios.some((u) => u.id === criado.usuario.id));
  ok("servidor não devolve a senha", usuarios.every((u) => !u.senha));
  ok("o aluno novo entra pelo servidor", (await c.DB.entrar("alunoapi", "abc")).ok === true);

  c.DB.atualizarUsuario(criado.usuario.id, { senha: "novo123" });
  await esperar(400);
  ok("senha trocada funciona no servidor", (await c.DB.entrar("alunoapi", "novo123")).ok === true);

  c.DB.removerUsuario(criado.usuario.id);
  await esperar(400);
  ok("aluno removido do servidor", !(await get("/usuarios")).some((u) => u.id === criado.usuario.id));

  const sub = c.DB.salvarSubmissao({ alunoId: aluno.id, tipo: "atividade", titulo: "Api X", respostas: [], acertos: 2, total: 2, nota: 10 });
  await esperar(400);
  ok("atividade chegou ao servidor", (await get("/submissoes")).some((s) => s.id === sub.id));
  c.DB.atualizarSubmissao(sub.id, { nota: 6 });
  await esperar(400);
  ok("correção atualizou no servidor", (await get("/submissoes")).find((s) => s.id === sub.id).nota === 6);

  const texto = c.DB.salvarTextoExtra({ disciplina: "matematica", titulo: "Texto api", corpo: "corpo", questoes: [] });
  const aula = c.DB.salvarAula({ disciplina: "matematica", titulo: "Aula api", dataISO: "2026-05-01T10:00:00.000Z", link: "#" });
  await esperar(400);
  ok("texto do professor no servidor", (await get("/textos")).some((t) => t.id === texto.id));
  ok("aula do professor no servidor", (await get("/aulas")).some((a) => a.id === aula.id));
  c.DB.removerTextoExtra(texto.id);
  c.DB.removerAula(aula.id);
  await esperar(400);
  ok("texto removido do servidor", !(await get("/textos")).some((t) => t.id === texto.id));
  ok("aula removida do servidor", !(await get("/aulas")).some((a) => a.id === aula.id));

  const info = c.DB.info();
  ok("nada ficou pendente de envio", info.pendentes === 0, { pendentes: info.pendentes });
  ok("nenhum erro de sincronização", info.erros.length === 0, info.erros);
  ok("DB.testar responde", (await c.DB.testar()).modo === "api");
}

(async () => {
  try {
    await testarLocal();
    await testarApi();
  } catch (e) {
    falhas++;
    console.log("\n[EXCEÇÃO] " + (e && e.stack ? e.stack : e));
    console.log("(O servidor de exemplo está rodando?  node exemplo-servidor.js)");
  }
  console.log("\n========================================");
  console.log(falhas ? "FALHAS: " + falhas : "TODOS OS TESTES PASSARAM");
  console.log("========================================");
  process.exit(falhas ? 1 : 0);
})();
