# Conectar o seu banco de dados (a "porta pronta")

O EducaEnem é um site **estático** (HTML + CSS + JavaScript). Hoje ele guarda
tudo no próprio navegador do usuário (`localStorage`), o que é ótimo para
demonstração e uso individual — mas quando você quiser guardar os dados de
verdade (alunos, notas, pedidos), basta **ligar a porta** que já está pronta.

Toda a comunicação de dados passa por **um único lugar**:

- `js/config.js` → onde você configura **qual** backend usar.
- `js/store.js` → a camada local (navegador); é o adaptador `local` da porta.
- `js/backend.js` → a camada que fala com o backend (já com dois adaptadores:
  `local` e `api`).
- `js/db.js` → a ponte usada pelas telas: grava no navegador na hora e, no
  modo `api`, espelha no servidor (e baixa os dados na abertura do site).
- `backend/api.md` → o **contrato** (quais rotas o seu servidor precisa ter).
- `backend/exemplo-servidor.js` → um servidor **de exemplo** pronto para rodar.
- `backend/schema.sql` → um banco de dados de exemplo (PostgreSQL/MySQL).

---

## Passo a passo (5 minutos)

### 1. Escolha onde guardar os dados
Qualquer uma destas opções funciona:

| Opção | Bom para | Observação |
| --- | --- | --- |
| **Node + Express + SQLite/Postgres/MySQL** | controle total | use `backend/exemplo-servidor.js` |
| **PHP + MySQL** | hospedagem tradicional | implemente as rotas de `api.md` |
| **Supabase** | rapidez, sem servidor próprio | tabelas do `schema.sql` + API REST do Supabase |
| **Firebase** | tempo real | use Cloud Firestore + Functions |
| **PocketBase** | tudo em 1 arquivo | rotas praticamente prontas |

### 2. Suba um servidor que responda às rotas do contrato
Veja `backend/api.md`. O servidor precisa apenas devolver **JSON**.
Um servidor de exemplo (Node) está em `backend/exemplo-servidor.js`.

```bash
cd backend
npm install express cors
node exemplo-servidor.js      # sobe em http://localhost:3000
```

### 3. Aponte o site para o seu servidor
Abra `js/config.js` e altere a seção `backend`:

```js
backend: {
  modo: "api",                              // liga a porta
  baseUrl: "https://api.suaescola.com",     // ou http://localhost:3000 nos testes
  apiKey: "coloque-um-token-se-quiser",     // opcional (enviado no header Authorization)
  timeout: 15000,
  recursos: { /* pode deixar como está */ },
}
```

Pronto. **Nenhuma tela precisa ser alterada.**

### 4. Teste a conexão
Entre como **professor** e abra o menu **🗄️ Banco de dados**: ele mostra o modo
atual, se há alterações pendentes de envio e traz o botão **"Testar conexão"**.

Pelo console do navegador (F12) também dá para checar:

```js
await DB.info()       // modo, pendências, último envio e erros
await DB.testar()     // tenta falar com o servidor
```

`Backend` continua disponível para trocar de modo em tempo de execução
(a escolha fica salva no navegador):

```js
Backend.definirModo("api")   // liga o modo servidor sem editar arquivo
Backend.definirModo("local") // volta para o modo navegador
```

---

## Como o código usa a camada

As telas do site (arquivo `js/app.js`) falam com o **`DB`** (ponte em
`js/db.js`), que decide onde gravar:

```js
DB.salvarNota({ alunoId: u.id, disciplina: "biologia", valor: 8.5 });
DB.criarUsuario({ nome, login, senha, papel: "aluno" });
await DB.entrar(login, senha);        // o login é a única chamada assíncrona
```

No modo `api`, cada gravação também é enviada ao servidor em segundo plano
(a tela não espera). Se algo não sincronizar, o motivo fica registrado e aparece
na tela **🗄️ Banco de dados** (professor).

Se você for escrever uma tela nova direto no transporte, use `Backend`
(e não o `Store`): todos os métodos existem nas duas versões e **sempre
devolvem Promise**.

---

## Migrar os dados que já estão no navegador

Se já existirem dados no `localStorage` do usuário que você quer levar para o
banco, exporte com:

```js
copy(JSON.stringify(Store.carregar(), null, 2))   // cola num arquivo e importa no banco
```

(e os pedidos da loja com `copy(JSON.stringify(Loja.pedidos(), null, 2))`)

---

## O que já está ligado à porta

- `js/config.js` é carregado **antes** de tudo em `index.html` e `curso.html`.
- `js/store.js`, `js/backend.js` e `js/db.js` são carregados logo depois, nas
  duas páginas.
- **`js/app.js` (tudo do aluno e do professor) fala com o `DB`**: entrar/sair,
  cadastrar e remover alunos, lançar e corrigir notas, atividades, textos, aulas
  e provas. No modo `api` nada disso fica preso no navegador.
- A página inicial (`index.html`) lê **nome da escola, professor, ano e preços**
  de `js/config.js`.
- A loja PIX (`js/loja.js`) lê PIX/preços/cupons de `js/config.js` e, quando o
  modo é `api`, **espelha cada pedido no servidor** em segundo plano
  (fire-and-forget: a loja continua funcionando mesmo se o servidor cair).
- As rotas `POST /notas`, `POST /submissoes`, `POST /pedidos` do servidor de
  exemplo fazem **upsert** (criam ou atualizam pelo `id`), então o mesmo pedido
  pode ser salvo várias vezes sem duplicar.

> Guia rápido e não técnico: veja **`CONECTAR-BANCO.md`** na raiz do projeto.
