# Worklog — NoClickCerto Catálogo

## 2026-10-21 — Claude Opus 5.5 · parsers EasyStore/Trend, publicação sem token

Sessão-dona do catálogo aberta pela revisão geral (DEC-2026-029).

- **Causa do lixo** ("• 16 Pro Max 256GB — R$ 4.", custo R$650): o regex de preço
  lia `R$ 4.650` como `650` (pegava o pedaço depois do ponto de milhar). Vinha
  desde a tabela de 28/09 — **IPH-0078 estava à venda**: 14 Pro Max a R$1.640 no
  Pix com custo real R$2.990.
- **Parser reescrito** com testes sobre o texto real (`tests/fixtures/`): EasyStore
  formato novo (•, —, cores depois de `🔋 90%+ |`, variante do cabeçalho
  "🔥 IPHONE 12 pro"), EasyStore "novidades" (cor em emoji, `💙 256GB — R$ 6.640`),
  Trend (`*R$7450*`, `Laranja | Silver`), "Dorudo.5140". Prova: o texto CRU de
  19/10 (Trend) e 20/10 (EasyStore) reproduz exatamente o que tinha sido
  normalizado à mão — 0 novos, 0 alterados.
- **Bugs de preço achados no caminho:** margem por categoria não era aplicada na
  ingestão (Apple Pencil R$499 sairia a R$1.149 → agora R$998); o mesmo fornecedor
  com o aparelho em 2 seções ficava com o último preço, não o maior; e como o
  leitor roda uma ingestão por mensagem, o último fornecedor a falar ditava o
  preço. Agora cada produto guarda `cotacoes` por fornecedor (3 dias) e vale a maior.
- **Auditor:** AirPods Pro 3 era comparado com AirPods Max e Watch SE com Ultra 3
  (travaria 2 produtos com preço certo). Pares refinados, com teste.
- **Publicação por git push** (SSH funciona sem interação, inclusive sem agent).
  A API do admin dependia do `GITHUB_TOKEN` da Vercel, vencido; e o erro saía
  com código 0, então o WhatsApp avisava "catálogo atualizado" sem nada no ar.
  Agora `ingerir --publicar` recusa rodar sobre `catalogo.json` sujo e alinha com
  `origin/main` antes.
- **Limpeza:** 16 lixos ocultos (IPH-0073, 0076, 0077–0090). O `catalogo.json`
  local sujo com o lixo das rodadas automáticas de 21/10 foi descartado.
- **Publicado:** `4418787` (Trend 19/10 + EasyStore 20/10, grava cotações) e
  `dfa8329` (EasyStore 21/10: 9 novos — iPhone 18 Pro Max, 16 Pro Max, 15 Pro Max
  CPO, Watch Ultra 3, AirPods Max/Max 2, 2 Apple Pencil, MacBook Air M5 — e 10
  preços). Produção = commit, byte a byte; `/p/IPH-0078` → 404.
- **Leitor (`~/wa-fornecedores`, commit local `742c47b`):** contador de preço vem do
  parser (o Trend era "ignorado, 0 linhas com preço"); cada mensagem guardada em
  `listas/historico/` (a tabela de seminovos de 21/10 se perdeu por sobrescrita).
  Reiniciado 21/10 17:34, conectado aos 2 grupos.
- **Token (pendência do Stefano):** GitHub → token fine-grained só pro repo
  `pasquero84/noclickcerto-catalogo`, permissão Contents: leitura e escrita →
  Vercel, projeto `noclickcerto-catalogo` → Settings → Environment Variables →
  `GITHUB_TOKEN` → colar → Redeploy. Só o /admin depende disso agora.

## 2026-09-14 — Claude Sonnet 5 · produção presa num deploy de 3 meses atrás

- **Achado (pedido do Stefano — "cadê o design novo que eu fiz"):** o site em
  `catalogo.noclickcerto.com.br` estava servindo, byte a byte, o commit
  `e647a5b` de **05/06/2026** — 3 meses e 15+ commits atrás, incluindo todo o
  "redesign comercial" de 31/08. Ninguém tinha notado porque o site respondia
  normal (200 OK), só que com o design antigo.
- Não achei automação nenhuma causando isso (sem cron, sem script de deploy,
  `~/catalogo-backups/` não é referenciado em lugar nenhum do projeto) —
  parece ter sido um `vercel --prod` rodado de algum jeito errado há tempos,
  e como ninguém olhou o site comparando com o código, ficou assim.
- **Corrigido:** `vercel --prod --yes` a partir do commit atual (`95ff6e1`).
  Confirmado por diff byte a byte contra produção: `0`.
- **Prevenção:** `scripts/verificar-deploy.sh` — baixa a produção e compara
  com o `index.html` do commit atual. Rodar antes de confiar que "já está no
  ar" (e principalmente antes de dizer isso pro Stefano).

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

## 2026-08-31 (checkout geral) — Claude
- Selo "Imagem ilustrativa" adicionado nos produtos sem foto real (card e
  página de produto) — pedido do Stefano, transparência sobre o que é
  ilustração gerada vs foto de fornecedor.
- `auditor.mjs` corrigido: estava usando itens `oculto:true` (lixo já
  escondido) na mediana de referência, gerando falso alarme. Agora ignora
  ocultos nos dois lados (auditados e referência).
- Checkout geral de preço rodado antes de "ligar os motores":
  - 🔴 2 erros REAIS bloqueados (`--aplicar`, viraram "Consultar
    Disponibilidade"): iPad 11 com custo cadastrado R$16 (deveria ser bem
    maior), MacBook Air M4 Midnight com custo R$2.025 vs R$5.850 dos irmãos
    de mesma cor/spec (provável erro de digitação, falta um dígito).
  - Checagem estrutural: 0 sem imagem, 0 sem descrição, 0 sem preço, 0 com
    margem negativa/zero, 0 com cartão<Pix ou link<cartão (ordem de preço
    sempre correta), 0 resíduo de "nota fiscal" indevida.
  - Códigos duplicados (ACS-0010/11/12) confirmados — são todos os itens
    lixo já ocultos, sem risco pro que está no ar.

## 2026-08-31 (QA permanente) — Claude
- 🔴 Corrigidos os 2 valores que o Stefano confirmou: iPad 11 128GB Branco
  custo R$16→R$1.650 (Pix R$2.300), MacBook Air M4 Midnight custo
  R$2.025→R$5.025 (Pix R$5.875). Ambos voltaram a vender.
- **QA de preço virou parte permanente do pipeline**, não script avulso.
  Pedido do Stefano: "toda vez que se atualizar ele tem que rodar e procurar
  esse tipo de erro". `auditor.mjs` foi refatorado — a lógica virou função
  exportável (`auditarCatalogo`, `bloquear`, `relatorio`) — e `ingerir.mjs`
  chama isso automaticamente a cada ingestão, ANTES de gravar/publicar,
  comparando contra o preço do produto de ANTES desta mesma rodada (não
  depende de fetch externo). Testado com um erro simulado idêntico ao
  exemplo do Stefano (17 Pro Max por R$700 de custo) — travou os 3 produtos
  certos, com o motivo certo, sem publicar.
- `wa-fornecedores/server.mjs`: o aviso automático de WhatsApp agora inclui
  quando o QA trava algo, não só "X novos, Y atualizados" — senão o
  bloqueio passaria silencioso até alguém abrir o catálogo.

## 2026-08-31 (reversão seminovo + margens de acessório) — Claude
- 🔴 **Revertida a imagem genérica nos iPhones SEMINOVO** — o Stefano flagrou:
  "estava ótimo anteriormente... o que você fez pode desfazer". Seminovo
  cobre gerações 11 a 17; a imagem genérica (sempre visual de flagship
  2025) ficava incoerente num aparelho antigo. Voltou a ser imagem POR
  GERAÇÃO + cor (`desenhoDoModelo`), como era antes da simplificação.
  Lacrado continua genérico (é quase todo geração 17, e já tem foto real
  por cima mesmo). `slugImagem()` agora recebe `condicao` e bifurca.
  91 das 94 imagens necessárias já existiam (nunca foram apagadas); só
  3 (iPhone 17 Pro Max "Nunca Ativo") precisaram de arquivo novo — sem
  crédito na chave OpenAI, reaproveitadas as imagens já existentes do
  17 Pro Max normal (mesmo aparelho, resultado idêntico).
- **Margens especiais por categoria**, ditadas pelo Stefano: Acessório
  (cabo/fonte/EarPods/AirTag) = 100% do custo (era R$650 fixo, deixava
  cabo de R$15 vendendo por R$665); Fone sem fio (AirPods, Buds) = R$500
  fixo (é caro feito celular, mas não no patamar de R$650/850).
  iPhone/Xiaomi/etc. continuam na fórmula antiga, intocada.
  Corrigido em `ingerir.mjs` (categoria) e replicado em `admin/index.html`
  — achado e corrigido um bug ali: a categoria só era calculada DEPOIS de
  chamar calcPrecos (ordem errada, ia quebrar a publicação pelo admin).
  Nome "🎧 AirPods Pro 3:" limpo pra "AirPods Pro 3".

## 2026-10-28 — Claude (Opus 5.5) — margem nova + fila de stories (branch margem-30-40-2026-10-28, NÃO publicado)
- `scripts/precos.mjs`: não-celular (acessório, fone, MacBook, Watch, iPad, tablet, robô, console; Redmi Pad/Buds pelo nome) = Pix custo×1,30 e 10x custo×1,40 (total). Celular segue R$650/R$850. Pedido do Stefano via Gerente, 28/10.
- `scripts/reprecificar.mjs`: aplica a regra ao catálogo inteiro (ensaio por padrão; 53 visíveis mudam). Esperando o ok do Stefano na amostra antes de `--aplicar`.
- `scripts/fila-stories.mjs`: 3 stories/dia (iPhone + outro celular + acessório/eletrônico), pasta `Stories Catalogo/Fila-<data>/` com revisao.html. Nada postado.
- Atenção: a ingestão automática roda na main; esta regra só vale quando o branch for mesclado.
- (tarde) Regra FINAL aprovada pelo Stefano (via Gerente): não-celular até R$4.000 de custo = 30%/40%; acima (MacBook, Watch Ultra) = R$850 fixos como celular; TODO preço termina em ,90 (pra cima — celular sobe R$0,90). Site e story mostram os centavos do Pix (antes arredondavam).
- `scripts/ajustes-tabela.mjs` (roda dentro do reprecificar): esconde 8 duplicados com `duplicado_de` (o código antigo fica, com foto e o maior custo recente), XMI-0077..0081 -> Realme, XMI-0057 -> Tablet (vira duplicado do TAB-0002), IPH-0028 ganha "Seminovo" no nome, ACS-0010/11/12 seguem ocultos.
- Pra não desfazer na próxima tabela: `ingerir.mjs` manda a cotação do duplicado escondido pro que ficou; o parser põe Realme e Redmi Pad antes da regra do Xiaomi; `chaveProduto` ignora "Seminovo/Lacrado" no nome.
- Ensaio no catálogo da main (dcdcac8): 231 visíveis mudam (185 celulares só +R$0,90). Aplicar: mesclar na main, `bun scripts/reprecificar.mjs --aplicar`, commit e push — só com o ok digitado do Stefano.
- (fim do dia) Stefano, direto nesta sessão: margem do não-celular sobe pra 35% no Pix e 46% no crédito 10x (era 30%/40%). Resto da regra igual.
