# Como publicar o site no ar

O site é 100% estático (HTML, CSS e JS). Isso significa que ele roda em
**qualquer hospedagem gratuita**, sem servidor, sem banco e sem build.

Escolha um dos caminhos abaixo. O mais rápido é o **Netlify** (5 minutos,
dá para fazer pelo celular).

---

## 0. Checklist antes de publicar

- [ ] Trocou a **senha do professor** (`js/store.js`, procura por `hash("1234")`)
- [ ] Colocou a **chave PIX real** (`js/config.js`, seção `pix`)
- [ ] Conferiu **nome, e-mail e WhatsApp** (`js/config.js`, seção `escola`)
- [ ] Conferiu os **preços** (`js/config.js`, seção `precos`)
- [ ] Testou o `INICIAR.bat` no seu computador e comprou um curso de teste

> Guarde a pasta inteira como está. Não renomeie nem apague os arquivos.

---

## 1. Opção A — Netlify (mais fácil, grátis)

1. Abra <https://app.netlify.com> e crie uma conta (dá para entrar com GitHub,
   e-mail ou Google).
2. Na tela inicial, arraste a **pasta inteira do site** para a área
   “**Drag and drop your site folder here**”.
3. Espere uns 30 segundos. O Netlify entrega um endereço temporário
   tipo `https://seu-projeto.netlify.app`.
4. Para o nome bonito: **Site settings → Change site name** → escolha
   `educaenem.netlify.app` (ou o que preferir).

**Como atualizar depois:** repita o passo 2 (arrastar a pasta de novo).
O endereço continua o mesmo.

### Domínio próprio no Netlify

1. Compre o domínio onde quiser (Registro.br, GoDaddy, HostGator…).
2. No Netlify: **Domain settings → Add custom domain** → digite o domínio.
3. O Netlify te mostra um **registro CNAME**. Copie e cole no painel da sua
   registradora apontando para `seu-projeto.netlify.app`.
4. Pronto: o **HTTPS é emitido sozinho e de graça**, em poucos minutos.

---

## 2. Opção B — GitHub Pages (grátis e automático)

1. Crie uma conta em <https://github.com>.
2. Clique em **+ → New repository** → nome `educaenem` → **Public** → Create.
3. Na página do repositório: **uploading an existing file** → arraste tudo →
   **Commit changes**.
4. Vá em **Settings → Pages**:
   - *Source:* **Deploy from a branch**
   - *Branch:* `main` / `/ (root)` → **Save**
5. Em 1–2 minutos o site fica em
   `https://seuusuario.github.io/educaenem/`

**Para atualizar:** substitua os arquivos pelo botão **Upload files**.

### Domínio próprio no GitHub Pages

Crie um arquivo chamado `CNAME` (sem extensão) na raiz, com uma linha só
contendo o seu domínio:

```
www.educaenem.com.br
```

Depois aponte o DNS na sua registradora:

| Tipo | Nome | Valor |
| --- | --- | --- |
| CNAME | `www` | `seuusuario.github.io` |

Ou, se preferir domínio sem `www`, use registro **A** apontando para
`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
O HTTPS é emitido automaticamente.

---

## 3. Opção C — hospedagem tradicional (cPanel / Hostinger)

Se o cliente já paga uma hospedagem:

1. Entre no painel (cPanel) → **Gerenciador de Arquivos**.
2. Apague tudo que estiver dentro de `public_html`.
3. Envie os arquivos do site para `public_html`.
4. Pronto. O HTTPS normalmente já vem junto com a hospedagem.

---

## 4. Cuidado com o cache do navegador

Depois de publicar uma atualização, o navegador pode continuar mostrando a
versão antiga. Duas saídas:

- **Rápida:** peda para o visitante apertar `Ctrl+F5`.
- **Definitiva:** ao editar um arquivo `.js`, acrescente uma versão no
  `index.html`. Por exemplo, mude

  ```html
  <script src="js/app.js?v=1"></script>
  ```

  para

  ```html
  <script src="js/app.js?v=2"></script>
  ```

  Assim todo mundo baixa a versão nova.

---

## 5. Quando ligar o banco de dados (modo `api`)

Se você passar a usar o servidor/banco (`js/config.js` → `backend.modo: "api"`):

- O **servidor** precisa ficar **no ar 24 h** (VPS, Railway, Render, Fly.io…).
  O Netlify/GitHub Pages **não** rodam esse servidor — eles só servem o site.
- O site (no Netlify) e o servidor (noutro endereço) são **origens diferentes**.
  Então o servidor **precisa responder ao cabeçalho `Access-Control-Allow-Origin`**
  com o endereço do site. Sem isso, o navegador bloqueia.
- Prefira **HTTPS dos dois lados**.

Guia completo do servidor: **`CONECTAR-BANCO.md`** e **`backend/README.md`**.

---

## 6. Dados dos alunos no modo grátis

Enquanto o modo for `local` (padrão), **cada aluno guarda os dados no próprio
celular/computador**. Isso é bom para começar a vender, mas o professor **não**
vai ver as notas de todos num lugar só.

Para o professor acompanhar a turma inteira, é preciso ligar o banco
(`CONECTAR-BANCO.md`). É o próximo passo natural depois das primeiras vendas.
