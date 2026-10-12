# Contrato da API — EducaEnem

Seu servidor só precisa devolver **JSON**. Todas as rotas podem receber um
cabeçalho `Authorization: Bearer <apiKey>` (opcional; use se quiser proteger).

Base: `js/config.js` → `backend.baseUrl` (ex.: `https://api.suaescola.com`)

| Recurso | Método | Rota | Corpo (envio) | Retorno esperado |
| --- | --- | --- | --- | --- |
| Usuários | GET | `/usuarios?papel=aluno` | — | `[ { id, nome, login, papel, email, turma, criadoEm } ]` |
| Usuário | POST | `/usuarios` | `{ id?, nome, login, senha, papel, email, turma }` | `{ ok: true, usuario: {...} }` ou `{ ok:false, erro:"..." }` |
| Usuário | PUT | `/usuarios?id=u-1` | `{ nome, login, senha?, email, turma }` | `{ ok: true, usuario: {...} }` |
| Usuário | DELETE | `/usuarios?id=u-1` | — | `{ ok: true }` |
| Login | POST | `/login` | `{ login, senha }` | `{ ok: true, usuario: {...}, token? }` ou `{ ok:false, erro:"..." }` |
| Notas | GET | `/notas?alunoId=u-1` | — | `[ { id, alunoId, disciplina, trimestre, tipo, valor, descricao, dataISO } ]` |
| Nota | POST | `/notas` | `{ id?, alunoId, disciplina, trimestre, tipo, valor, descricao }` | `{ id, ... }` |
| Nota | PUT | `/notas?id=nota-1` | `{ ...nota }` | `{ ...nota }` |
| Nota | DELETE | `/notas?id=nota-1` | — | `{ ok: true }` |
| Submissões | GET | `/submissoes?alunoId=u-1` | — | `[ { id, alunoId, tipo, refId, titulo, nota, acertos, total, dataISO } ]` |
| Submissão | POST | `/submissoes` | `{ id?, alunoId, tipo, refId, titulo, respostas, acertos, total, nota }` | `{ id, ... }` |
| Submissão | PUT | `/submissoes?id=sub-1` | `{ ...sub }` | `{ ...sub }` |
| Submissão | DELETE | `/submissoes?id=sub-1` | — | `{ ok: true }` |
| Pedidos | GET | `/pedidos` | — | `[ { id, itens, total, status, cliente, dataISO } ]` |
| Pedido | POST | `/pedidos` | `{ itens, subtotal, desconto, total, cliente, status, metodo }` | `{ id, ... }` |
| Pedido | PUT | `/pedidos?id=ENEM-...` | `{ ...pedido }` | `{ ...pedido }` |
| Textos | GET | `/textos` | — | `[ { id, disciplina, titulo, corpo, questoes } ]` |
| Texto | POST | `/textos` | `{ id?, disciplina, titulo, corpo, questoes }` | `{ id, ... }` |
| Texto | DELETE | `/textos?id=txt-1` | — | `{ ok: true }` |
| Aulas | GET | `/aulas` | — | `[ { id, disciplina, titulo, dataISO, link, plataforma } ]` |
| Aula | POST | `/aulas` | `{ id?, disciplina, titulo, dataISO, link, plataforma }` | `{ id, ... }` |
| Aula | DELETE | `/aulas?id=aula-1` | — | `{ ok: true }` |
| Provas | GET | `/provas` | — | `[ { id, disciplina, titulo, questoes } ]` |
| Prova | POST | `/provas` | `{ id?, disciplina, titulo, questoes }` | `{ id, ... }` |
| Prova | DELETE | `/provas?id=prova-1` | — | `{ ok: true }` |

## Upsert: o POST cria **ou** atualiza

O site sempre envia o `id` que gerou no navegador. Se um `POST` receber um
`id` que já existe no banco, ele deve **atualizar** esse registro em vez de
criar outro. Assim editar uma nota não duplica a nota.

Quando um `id` **não** existe e o `PUT` devolver `404`, o site tenta o `POST`
sozinho — então você pode fazer `PUT` devolvendo `404` sem se preocupar.

## Formato de erro

Quando algo der errado, responda com status HTTP `4xx`/`5xx` e:

```json
{ "erro": "Mensagem legível para o usuário." }
```

O site já entende esse formato e mostra a mensagem para o usuário.

Para **login/senha**, responda `401` quando o usuário ou a senha não forem
aceitos — assim o site sabe que a recusa veio do servidor (e não de um
problema de rede) e não libera a conta pelo cadastro local.

## Observações

- **Senhas**: no modo local usamos um *hash* simples (não é segurança real).
  No seu servidor, use `bcrypt`/`argon2` e nunca devolva a senha na resposta.
- **Login/sessão**: se usar token, devolva `{ ok:true, usuario, token }` no
  `/login` e valide o header `Authorization` nas demais rotas.
- **Valores monetários**: envie em número decimal (ex.: `597.00`).
- **Datas**: use ISO 8601 (ex.: `2026-02-05T19:00:00.000Z`).
- **Pedidos da loja PIX**: guarde `id`, `itens[]`, `total`, `cliente`
  (`nome`, `email`, `cpf`, `whatsapp`), `status` e `dataISO`. Guarde o
  comprovante/referência do PIX quando confirmar o pagamento.
- **Rota de teste**: `GET /health` devolvendo `{ ok: true }` é a que o botão
  "Testar conexão" (área do professor → Banco de dados) chama para conferir
  se o servidor está respondendo.
