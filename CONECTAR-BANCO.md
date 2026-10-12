# 📘 Como conectar o seu banco de dados (guia rápido)

O site está **pronto**. Hoje ele funciona sozinho: guarda os dados no próprio
navegador do usuário (não precisa de servidor). Quando você tiver um servidor /
banco de dados, é só **ligar a porta que já está pronta** — sem reescrever o site.

> Resumo em uma frase: você troca **1 configuração** (`js/config.js`) e sobe
> **1 servidor** que fala o "contrato" descrito em `backend/api.md`.

---

## O que já está pronto

| Arquivo | Para que serve |
| --- | --- |
| `js/config.js` | **O arquivo que você edita.** Nome da escola, WhatsApp, preços, PIX e o **backend**. |
| `js/store.js` | Camada local (navegador). É o "modo local" da porta. |
| `js/backend.js` | A camada que fala com os dados. Já tem 2 modos: `local` (navegador) e `api` (seu servidor). |
| `js/db.js` | A ponte usada pelas telas. Grava no navegador na hora e, no modo `api`, espelha no servidor. |
| `backend/exemplo-servidor.js` | Um servidor de exemplo **pronto** (Node, sem instalar nada) para você testar hoje mesmo. |
| `backend/api.md` | A lista de rotas (endereços) que o seu servidor precisa ter. |
| `backend/schema.sql` | O desenho das tabelas (alunos, notas, pedidos...) para o seu banco. |
| `backend/README.md` | Explicação técnica da conexão. |

---

## Passo a passo

### 1) Edite os dados da escola e do PIX
Abra `js/config.js` e ajuste:
- `escola` → nome, professor, e-mail e **WhatsApp** (só números, ex.: `5511987654321`).
- `pix` → **sua chave PIX**, nome do recebedor e cidade.
- `precos` / `cupons` → valores do curso, áreas e disciplinas.

Pronto: a página inicial, a área do aluno e a loja (`curso.html`) já passam a
usar esses valores — não precisa mexer em HTML.

### 2) Teste hoje com o servidor de exemplo (opcional)
Tenha o Node.js instalado e rode, na pasta `backend`:

```bash
node exemplo-servidor.js
```

Abra `js/config.js` e ajuste a seção `backend`:

```js
backend: {
  modo: "api",                          // liga a porta
  baseUrl: "http://localhost:3000",     // endereço do servidor
  apiKey: "",                           // opcional
}
```

Recarregue o site: os dados agora saem do servidor.

### 3) Quando o cliente escolher o banco dele
1. Suba um servidor que responda às rotas de `backend/api.md`
   (Node, PHP, Supabase, Firebase, PocketBase... use `backend/schema.sql` como base).
2. Em `js/config.js`, ajuste:
   ```js
   backend: {
     modo: "api",
     baseUrl: "https://api.da-escola.com",   // endereço real
     apiKey: "um-token-se-precisar",         // opcional (vai no cabeçalho Authorization)
   }
   ```
3. Recarregue o site. **Fim** — nada mais precisa ser alterado.

---

## Verificando se conectou

**Sem precisar de console**: entre como professor e abra o menu
**🗄️ Banco de dados**. Ele mostra o modo atual (navegador ou servidor),
se a internet está de pé, quantas alterações estão aguardando envio e tem o
botão **"Testar conexão"**.

No console do navegador (F12 → aba "Console"), também dá para digitar:

```js
await DB.info()      // modo, pendências e erros de sincronização
await DB.testar()    // tenta falar com o servidor
```

- `Backend.definirModo("local")` → volta a guardar no navegador.
- `Backend.definirModo("api")` → usa o servidor (sem editar arquivo).

---

## O que já usa a porta pronta

No **navegador (padrão)** e também no **modo api**:

- **Entrar / sair** — a senha é conferida no servidor (quando o modo é `api`).
- **Cadastrar, editar e remover alunos** (área do professor).
- **Lançar e corrigir notas**, boletim e médias.
- **Atividades e simulados** — respostas, correção automática e gabarito.
- **Textos de apoio, aulas e provas** criados pelo professor.
- **Loja PIX (`curso.html`)** — cada pedido é gravado no navegador e, no modo
  `api`, é **espelhado automaticamente** no seu servidor.
- **Plano grátis e liberação do que foi comprado** (`js/acessos.js`) — a cota
  mensal fica no navegador; os **pedidos** (que destravam o conteúdo) são
  espelhados no servidor pelo mesmo caminho da loja. Ou seja: o aluno compra
  no celular e, se a conta for a mesma, o acesso vale em qualquer aparelho.

### Cache ao atualizar

Se o site estiver publicado e você mexer num `.js`, o navegador pode segurar a
versão antiga. Acrescente uma versão no `index.html` (ex.: `js/app.js?v=2`)
ou peça `Ctrl+F5`. Mais detalhes: `PUBLICAR.md`, seção 4.

## Como funciona por baixo dos panos

1. A tela chama `DB.salvarNota(...)`, `DB.entrar(...)`, etc. (arquivo `js/db.js`).
2. O dado é gravado **na hora** no navegador: a tela não trava e continua
   funcionando sem internet.
3. Se o modo for `api`, o mesmo dado é **enviado ao servidor** em segundo plano.
4. Ao abrir o site, os dados do servidor são baixados e colocados no cache local
   (isso se chama **hidratação**).

Para criar uma tela nova que use o banco, use `DB.*` (ex.: `DB.salvarSubmissao({...})`).

---

## Segurança (importante)

No modo local a senha é apenas "embaralhada" no navegador — **não é segurança
real**. No seu servidor, use `bcrypt`/`argon2` para as senhas e um token de
sessão para as rotas. Veja as observações em `backend/api.md`.
