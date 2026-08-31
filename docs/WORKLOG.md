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
