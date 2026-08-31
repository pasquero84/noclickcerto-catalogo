# Worklog — NoClickCerto Catálogo

## 2026-08-31 — Claude
- Nova fórmula de precificação, fechada com o Stefano por voz (venda de iPhone,
  fornecedor da 25 de março): substitui a margem percentual (28%) por margem
  fixa em R$ — R$650 pra custo até R$4.000, R$850 acima disso. Pix é a base
  (custo + margem); Cartão presencial = base × 1,11; Link de pagamento (10x)
  = base × 1,17. Cada canal de pagamento mostra seu próprio "De/Por" contra o
  Pix, em vez de um desconto único.
- `admin/index.html`: `calcPrecos()` reescrita, novos campos `preco_cartao` e
  `preco_link` persistidos em `confirmarPublicacao()`, diff do preview
  corrigido pra usar a fórmula nova.
- `index.html` (catálogo público): card de produto agora mostra os 3 valores
  (De: link riscado, Pix em destaque, Cartão + 10x na linha de baixo).
  Removida a afirmação "10× sem juros", que ficou falsa com o link tendo
  17% embutido.
- Testado via servidor local (`ncc-admin`, porta 4210): `calcPrecos(1000)` →
  Pix R$1.650 / Cartão R$1.831,50 / Link R$1.930,50 / 10x R$193,05, e virada
  de margem em R$4.000/R$4.001 confirmada (R$650→R$850). HTML do card
  conferido via DOM, bate com o esperado.

## 2026-08-31 (cont.) — Claude
- Novo motor de ingestão de fornecedor em `scripts/`:
  - `parse-fornecedor.mjs` — lê o texto cru do WhatsApp. Parser stateful,
    lida com os 2 formatos vistos em produção (preço na linha do nome +
    cores soltas embaixo; nome sem preço + uma linha por cor com preço).
    Bugs achados e corrigidos no teste com dados reais: "8/256" lido como
    preço 256; produto ("MACBOOK NEO 8/256") confundido com cabeçalho de
    seção; MacBook herdando categoria iPhone da seção anterior.
  - `consolidar.mjs` — aplica a regra nova: um cadastro por produto, preço
    do fornecedor MAIS CARO, união das cores. Bug grave achado no teste:
    a chave removia 4G/5G, fazendo "Note15 4G" (R$1.230) colidir com
    "Note15 5G" (R$1.540) — o 4G seria vendido pelo preço do 5G.
- Amostras reais de 31/08 em `scripts/amostras/` (EasyStore e Trend Shop).
- Testado: EasyStore 14/14 produtos, Trend 3/3, consolidação identificou
  corretamente 3 produtos presentes nos dois fornecedores.
- `ingerir.mjs` + `criativo.mjs`: pipeline até a publicação e gerador de arte
  1080x1080 (Chrome headless, sem dependência nova). Aplicada a tabela de
  31/08: 184 produtos no ar. Selo de garantia é condicional — a regra de
  3/6 meses vale só pra seminovo; lacrado mostra "lacrado de fábrica".
- ⚠️ `GITHUB_TOKEN` do Vercel está com "Bad credentials": o `/api/save` do
  admin não publica mais. Contornado com `vercel --prod`. Precisa gerar
  token novo pro botão Publicar do admin voltar a funcionar.
