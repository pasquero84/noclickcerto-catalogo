# Status operacional — Catálogo NoClickCerto

Atualizado: **24/10/2026** (branch `seguranca-catalogo-2026-10-23`, ainda NÃO em produção) (sessão-dona "Catálogo e fornecedores", Claude)

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
- 🔴 **Publicar a branch `seguranca-catalogo-2026-10-23`** (só com OK do Stefano). Preview testado
  em 24/10: site, /p/ e admin 200; scripts/docs/tabelas cruas 404; catálogo público sem custo,
  margem, fornecedor nem cotações; cabeçalhos de segurança presentes. Antes do merge, apagar da
  pasta principal as cópias soltas `scripts/validar-catalogo.mjs` e `tests/validar-catalogo.test.mjs`
  (agora estão versionadas na branch e o git recusa sobrescrever arquivo não rastreado).
- 🟡 **Duas chaves que só o Stefano cria** (nunca colar em chat nem em arquivo):
  - `ADMIN_TOKEN_SECRET`: no Terminal, `openssl rand -hex 32 | pbcopy` (copia um segredo aleatório sem mostrar).
    Vercel → projeto noclickcerto-catalogo → Settings → Environment Variables → Add → nome `ADMIN_TOKEN_SECRET`,
    valor ⌘V, Production + Preview → Save.
  - `GITHUB_TOKEN` novo: github.com/settings/personal-access-tokens/new → só o repositório
    `pasquero84/noclickcerto-catalogo`, permissão Contents = Read and write, validade 1 ano → Generate → copiar.
    Vercel → noclickcerto-catalogo → Settings → Environment Variables → `GITHUB_TOKEN` → Edit → colar → Save →
    Deployments → Redeploy. Sem ele o /admin abre mas não carrega nem salva.
- 🟡 Depois do deploy: tornar o repositório privado (seguro: nenhuma foto usa raw.githubusercontent).
- ⚪ Garmin: a seção GARMIN do Trend é pulada (não há aba no site). Se for vender, criar categoria/aba.
- ⚪ "Cabo Lightning", "Fonte 35W", "Fonte 20W" de primeira linha do Trend casam com os lixos antigos
  ACS-0010 (ocultos, código repetido) e por isso não aparecem. Resolver junto com a limpeza dos ACS-0010/0011/0012.
- ⚪ Conferir com a EasyStore se o IPH-0099 (16 Pro Max 256GB, 21/10) é lacrado ou CPO.
