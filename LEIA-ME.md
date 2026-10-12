# EducaEnem — como rodar, configurar e publicar

Site de curso online (ENEM) com plano **grátis + compras avulsas no PIX**.
Funciona sem instalar nada, direto na máquina do professor ou do cliente.

---

## 1. Como abrir o site (2 cliques)

**Dê dois cliques em `INICIAR.bat`** (está nesta pasta).

- Abre um terminal escuro dizendo `EducaEnem rodando em http://127.0.0.1:8787/index.html`
- O navegador abre sozinho no site
- **Para parar:** feche o terminal (ou aperte `Ctrl+C` lá dentro)

> O `INICIAR.bat` usa o PowerShell que já vem no Windows 10 e 11.
> Não precisa instalar Python, Node nem nada parecido.

### Alternativa: abrir direto o arquivo

Também funciona dar dois cliques em **`index.html`**. Só que, dependendo do
navegador, o armazenamento local pode ficar bloqueado e as compras/notas não
ficam salvas. **O `INICIAR.bat` é o caminho certo.**

---

## 2. Quem entra (contas que já vêm prontas)

O site vem **limpo**, sem dados de demonstração: existe **uma única conta**,
a do professor (dono). Os alunos são cadastrados por ele, na área do professor.

| Quem | Login | Senha |
| --- | --- | --- |
| Professor (dono) | `marcelo` | `1234` |

> ⚠️ **Troque a senha do professor antes de mostrar ao público.**
> As contas estão em `js/store.js` (procure por `senha: hash("1234")`).

### Como o professor cadastra os alunos

1. Entre com `marcelo` / `1234`.
2. No menu lateral: **Alunos → + Novo aluno**.
3. Preencha nome, e-mail, login, senha e turma → **Cadastrar aluno**.
4. O aluno passa a entrar com o **login e a senha que você definiu**.

> Os alunos **não** existem antes disso: cada um só vê o próprio painel, as
> próprias notas e o próprio progresso. Ninguém acessa a área do professor.

### Conta grátis (qualquer visitante)

Quem chega no site pode se cadastrar sozinho: botão **“✨ Criar conta grátis”**
na primeira tela → preenche nome, usuário e senha → entra direto no painel.

---

## 3. O que cada um faz

### O aluno

- Estuda **de graça** com uma cota mensal: **20 aulas e 60 questões por mês**
  (a cota volta todo dia 1).
- Vê textos, atividades, projetos, simulado, boletim e gravações.
- Estuda para **Fuvest e Unicamp** na área **Vestibulares**: o que muda em
  relação ao ENEM, redação no formato de cada banca, trilhas de estudo,
  leituras longas e questões escritas no estilo da banca.
- Quando a cota acaba (ou quando quer mais), aparece a tela de compra com
  **3 saídas**: comprar **só aquela aula** (R$ 1,90), **a disciplina**
  (R$ 9,90) ou **o curso inteiro** (R$ 97).
- Paga no PIX pelo celular e o conteúdo destrava na hora.

### O professor (`marcelo`)

- Cadastra e edita alunos
- Lança e edita notas, corrige redações, cria provas
- Publica textos, aulas, atividades, projetos e gravações
- Usa o **Professor Virtual** (tira-dúvidas automático) e o **Estúdio** de aula ao vivo

---

## 4. Como deixar com a sua cara

Tudo em **um arquivo só**: `js/config.js`. Ele já vem comentado em português.

| O que trocar | Onde no `js/config.js` |
| --- | --- |
| Nome da escola, professor, WhatsApp | `escola` |
| **Chave PIX** e nome do beneficiário | `pix` |
| **Preços** (curso, área, disciplina, aula) | `precos` |
| **Cupons de desconto** | `cupons` |
| **Cota grátis** (quantas aulas/questões por mês) | `plano.gratis.cotas` |
| Ligar/desligar loja, gravações, simulado | `recursosSite` |

Depois de editar, aperte `F5` no navegador. Se não atualizar, use `Ctrl+F5`.

---

## 5. Como funciona o dinheiro

- **Conta grátis** é obrigatória para ver o conteúdo (não precisa de cartão).
- Cota mensal grátis → sem limite de cadastro, só de consumo no mês.
- Compra avulsa no PIX:
  - **Aula isolada — R$ 1,90**
  - **Disciplina — R$ 9,90**
  - **Área do conhecimento — R$ 39,00**
  - **Curso completo — R$ 97,00**
- O QR Code é **BR Code oficial do Banco Central** — funciona em qualquer banco
  (Nubank, Itaú, Bradesco, BB, Inter, Mercado Pago…).
- O site registra o pedido e marca como **“pagamento informado”**. Confirme o
  recebimento no seu banco e, quando quiser, troque o status para `pago`.

---

## 6. Onde ficam os dados hoje

Hoje os dados ficam **no navegador de cada usuário** (`localStorage`). Isso é
ótimo para demonstrar, testar e usar sozinho.

Quando o cliente quiser que **todos vejam as mesmas notas e o mesmo cadastro**,
é só ligar um banco: veja **`CONECTAR-BANCO.md`** (tem um servidor de exemplo
pronto em `backend/exemplo-servidor.js`).

---

## 7. Colocar no ar (para todo mundo acessar)

Veja o guia **`PUBLICAR.md`** — publicação grátis no Netlify ou GitHub Pages,
com domínio próprio.

---

## 8. Mapa da pasta

| Arquivo / pasta | Para que serve |
| --- | --- |
| `INICIAR.bat` | **2 cliques para rodar o site** |
| `iniciar-servidor.ps1` | o servidor local que o `.bat` abre |
| `index.html` | o site (landing + área do aluno + área do professor) |
| `curso.html` | a **loja** (planos, carrinho, checkout, PIX) |
| `simulado.html` | simulado completo no estilo da prova |
| `js/config.js` | **único arquivo para customizar** |
| `js/acessos.js` | plano grátis, cotas e liberação do que foi comprado |
| `js/vestibulares.js` | **Fuvest e Unicamp**: formato da prova, redação, trilhas, textos e questões |
| `js/textos-*.js` | os textos longos de leitura, por disciplina |
| `js/loja.js` | carrinho, PIX e pedidos |
| `js/store.js` | alunos, notas, sessão (camada local) |
| `js/db.js` + `js/backend.js` | porta pronta para o banco de dados |
| `backend/` | servidor de exemplo + contrato da API |
| `*.pdf` | materiais de apoio usados nas aulas |

---

## 9. Problemas comuns

**“Abriu o site mas não salva nada”**
→ Você abriu o `index.html` direto. Use o `INICIAR.bat`.

**“Apertei F5 e não atualizou”**
→ Use `Ctrl+F5` (o navegador guarda o site em cache).

**“Apareceu que a porta está em uso”**
→ Feche o terminal antigo do site e abra o `INICIAR.bat` de novo.
O script também procura a próxima porta livre sozinho.

**“O PIX não gera QR Code”**
→ Confira a chave em `js/config.js`, seção `pix`.

**“Quero liberar tudo de graça para testar”**
→ Em `js/config.js`, ponha `plano.gratis.ativo: false`.
