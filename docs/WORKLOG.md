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
- Página de produto compartilhável: `/p/<CODIGO>` (`api/p.js` + rewrite no
  `vercel.json`). Renderizada no servidor de propósito — o preview do
  WhatsApp (Open Graph) não funciona em página feita só por JS. Agrupa as
  cores do mesmo aparelho (o catálogo tem uma linha por cor) e mostra os 3
  preços, garantia calculada pela geração do iPhone, e CTA de WhatsApp já
  com o código do produto na mensagem. Botão ↗ adicionado em cada card.
- `criativo-produto.mjs`: arte 1080x1350 de UM produto, com ilustração gerada
  por `gpt-image-2` (chave OpenAI compartilhada do WaveFlow) + dados reais do
  catálogo, bolinhas de cor e os 3 preços. Feedback do Stefano: a arte só de
  tabela "ficou nota 4", faltava imagem do aparelho e as cores.
  A ilustração é cacheada por modelo em `_criativos/arte/` — regerar só
  apagando o PNG (cada imagem consome crédito da chave compartilhada).
- Redesign do catálogo (brief do Stefano, 31/08): tema claro, mobile-first,
  card com hierarquia de e-commerce (tag → imagem → nome → variante → PREÇO →
  parcela → confiança → CTA). Toda a lógica preservada (fetch do JSON,
  filtros, busca, WhatsApp, /p/). Sem foto do fornecedor (183 de 184 produtos),
  o card usa uma SILHUETA do aparelho desenhada na COR REAL do produto — é
  informação verdadeira, diferente de foto genérica que não é daquele aparelho.
- 🔴 `fetch('/catalogo.json')` agora usa `cache:'no-cache'`. Sem isso o
  navegador servia o catálogo do cache e o CLIENTE VIA PREÇO ANTIGO — flagrado
  ao vivo (página com 181 produtos e preço velho, servidor já em 184).
- `auditor.mjs`: trava de preço antes de publicar (ideia do Stefano). Três
  referências internas, não preço de mercado externo: histórico do próprio
  produto (queda >40%), mediana dos pares (categoria+geração; categorias
  heterogêneas comparam por faixa de preço) e piso absoluto por categoria.
  Item reprovado vira "Consultar Disponibilidade"; o resto publica.

## 2026-08-31 (correção pós-feedback) — Claude
- 🔴 Corrigido o corte de imagem que o Stefano flagrou: `.c-media` estava
  `object-fit:cover` (recortava o aparelho verticalmente) — agora `contain`
  com padding, aspect-ratio 1:1.
- 🔴 Grid mobile estava em 1 coluna (`minmax(288px,1fr)` não cabia 2 em
  375px) — o Stefano queria "2 a 4 itens por rolada". Agora 2 colunas fixas
  até 640px, com tipografia/padding compactados pra caber sem espremer.
- 🔴 `api/p.js` (página de produto) ainda estava no tema ESCURO antigo
  enquanto o catálogo virou claro — "muda o padrão pra cor azul", flagrado
  pelo Stefano. Reescrita no mesmo tema claro, com a foto do produto e a
  mesma âncora de preço do card.
- Adicionada âncora de preço "De R$[link] / Economize R$X pagando no Pix" no
  card e na página de produto — persuasão real, calculada da própria fórmula
  de pagamento, não número inventado.
- Imagens de iPhone passam a ser por FAMÍLIA + COR (antes era só família — o
  card dizia "Azul" mostrando foto laranja). 113 imagens geradas no total,
  58 distintas cobrindo os 71 iPhones visíveis.

## 2026-08-31 (2ª correção pós-feedback) — Claude
- 🔴 **Removida a alegação falsa de "nota fiscal" em 7 lugares** (index.html,
  api/p.js, 3 scripts de criativo, descricoes.mjs). Essa venda é complemento
  de renda informal do Stefano, sem nota por padrão — só sob pedido, +8%,
  emitida pelo fornecedor. Prometer nota fiscal incluída seria promessa que
  não se cumpre. Registrado em memória (feedback_sem_nota_fiscal_padrao).
- Imagens de iPhone SIMPLIFICADAS por pedido do Stefano: parou de tentar
  acertar o desenho por geração (isso causou um bug real — iPhone 17
  aparecendo com foto de iPhone 11). Agora todo iPhone da mesma cor
  compartilha UMA imagem genérica premium (mesmo estilo do 17 Pro Max, que
  ele aprovou). 15 cores cobrindo 71 produtos.
- Acessórios: detecção do tipo real pelo nome (cabo vs fonte vs fone vs
  AirTag) — antes usava uma descrição só pra "Acessório" e um cabo saía
  ilustrado junto com uma fonte, como se fosse kit (nenhum item do catálogo
  é kit de verdade).
- Corrigido "AS IS" → "Nunca Ativo" (bateria 100%) nos 3 iPhone 17 Pro Max —
  são aparelhos de troca de garantia, nunca ativados, só sem caixa.
- `gerar-imagens.mjs` agora pula produtos `oculto:true` — antes gastava
  geração de imagem em lixo de leitura de tabela.
- Página de produto: cartão presencial agora mostra parcela em 10x (igual
  ao link), com o total em letra pequena embaixo — pedido do Stefano pra
  ficar no mesmo padrão.

## 2026-08-31 (foto real) — Claude
- Primeira foto REAL aplicada: `imagens/fornecedor/iphone-lacrado-easystore.jpg`,
  confirmada pelo Stefano como vinda da biblioteca do EasyStore (nome do
  arquivo original batia: "iphone Easy.jpeg"). Mostra 3 caixas seladas
  (azul, laranja, silver) numa foto real de mão.
  Resolução baixa (387x516) e as 3 caixas sobrepostas impedem recorte limpo
  por cor — usada como foto genérica de "iPhone Lacrado" nos 26 produtos
  dessa condição, substituindo o ícone gerado por IA só nesse grupo.
  Fica fora de `imagens/produtos/` de propósito — é o critério que
  `aplicar-imagens.mjs` usa pra NUNCA sobrescrever foto real com a gerada.
- Vários outros prints que o Stefano mandou foram identificados como
  material de terceiro (nomes de arquivo confirmaram): foto oficial de
  divulgação da Apple, foto de anúncio de capinha na Amazon, downloads
  genéricos do Google Images ("images.jpeg", "images (1).jpeg"). Recusados.
