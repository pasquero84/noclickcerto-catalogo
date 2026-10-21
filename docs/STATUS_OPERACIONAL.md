# Status operacional — Catálogo NoClickCerto

Atualizado: **21/10/2026** (sessão-dona "Catálogo e fornecedores", Claude)

## No ar
- `catalogo.noclickcerto.com.br` — **219 produtos, 185 visíveis** (34 ocultos são
  lixo antigo de leitura de tabela; código nunca some, só sai da vitrine).
- Conferido por diff byte a byte: `catalogo.json` em produção = commit `dfa8329`.

## Como a tabela entra (automático)
1. Fornecedor posta no grupo do WhatsApp (EasyStore = FOR001, Trend Shop = FOR002).
2. Leitor `~/wa-fornecedores` (launchd `com.stefano.wa-fornecedores`, porta 8083,
   só leitura no número pessoal) salva o texto em `listas/AAAA-MM-DD_FORxxx.txt`
   (+ cópia de cada mensagem em `listas/historico/`) e roda
   `bun scripts/ingerir.mjs <listas de hoje> --aplicar --publicar`.
3. `ingerir.mjs`: alinha com `origin/main` → parse → consolida (MAIOR preço entre
   fornecedores, cotações dos últimos 3 dias) → QA de preço → **commit + git push**
   → Vercel republica em ~30 s.
4. Aviso pelo wa-gateway (número dedicado) com novos/alterados/travados.

## Testes
`bun test tests/parse-fornecedor.test.mjs tests/auditor.test.mjs` — 15 testes com o
texto real dos fornecedores (`tests/fixtures/`). Formato novo de fornecedor? Salve o
texto cru em `tests/fixtures/` e escreva o teste ANTES de mexer no parser.

## Pendências
- 🟡 **Token GitHub da Vercel vencido** (`GITHUB_TOKEN`, `Bad credentials`): só afeta o
  botão **Salvar do /admin**. A ingestão automática não usa mais esse token.
  Troca é do Stefano (nunca copiar segredo): ver WORKLOG 21/10.
- 🟡 Conferir com a EasyStore se o **iPhone 16 Pro Max 256GB (IPH-0099, R$7.030 Pix)**
  da tabela de 21/10 é lacrado ou CPO — a mensagem põe "CPO com 1 ano de garantia"
  logo depois dele, de forma ambígua. Entrou como lacrado sem "CPO" no nome.
- ⚪ Nomes feios mas corretos de 01/09: IPH-0072 "16 PLUS 256Gb IND",
  IPH-0074/0075 "… CPO *Garntia 1 ano*". Renomear muda a chave de casamento — só
  com cuidado.
- ⚪ `scripts/validar-catalogo.mjs` + teste (30/09, nunca commitados) — portão
  estrutural útil, mas o limite de 12 caracteres barra nome legítimo ("Buds 5 Pro",
  "AirPods Max"). Calibrar antes de ligar.
- ⚪ Senha do admin escrita como valor padrão no `~/wa-fornecedores/server.mjs` —
  hoje não é mais usada pela publicação; tirar do código.
