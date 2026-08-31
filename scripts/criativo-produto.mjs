#!/usr/bin/env bun
// ============================================================
// CRIATIVO DE PRODUTO — arte 1080x1350 (feed do Instagram/WhatsApp)
//
// Diferente do criativo-tabela: aqui é UM produto, com ilustração gerada por
// IA (gpt-image-2) + os dados REAIS do catálogo. Nasceu do feedback do
// Stefano em 31/08/2026 — a arte só de tabela "ficou nota 4", faltava a
// imagem do aparelho e as cores como bolinhas.
//
// ⚠️ CUSTO: usa a chave OpenAI que é COMPARTILHADA com o WaveFlow (em
// ~/waveflow-ai/.env.local). Cada imagem nova consome crédito, então a
// ilustração é cacheada por modelo em _criativos/arte/ e reaproveitada —
// gerar de novo só apagando o arquivo.
//
// uso: bun scripts/criativo-produto.mjs IPH-0019
// ============================================================

const codigo = (process.argv[2] || '').toUpperCase();
if (!codigo) {
  console.error('uso: bun scripts/criativo-produto.mjs <CODIGO>');
  process.exit(1);
}

const BASE = `${process.env.HOME}/Documents/Projetos/_criativos`;
const ARTE = `${BASE}/arte`;

// Cor de exibição das bolinhas. O fornecedor escreve o nome, o cliente quer
// ver a cor — sem isso "Desert" e "Citrus" não dizem nada pra ninguém.
const HEX = {
  Preto: '#1c1c1e', Branco: '#f2f2f0', Azul: '#3f5f8a', Verde: '#4a6b52',
  Vermelho: '#a83232', Rosa: '#e0a7b8', Roxo: '#6b5b95', Amarelo: '#e8c44a',
  Laranja: '#d4763a', Dourado: '#d4b483', Prata: '#d8d8da', Silver: '#d8d8da',
  Gold: '#d4b483', Grafite: '#4a4a4c', Cinza: '#8e8e93', Desert: '#c2a184',
  Natural: '#c8c3bb', Citrus: '#d9c15a', Titanium: '#9a958d',
  Midnight: '#1f2430', Starlight: '#efe7db',
};

const CORES_RE = new RegExp(`\\b(${Object.keys(HEX).join('|')})\\b`, 'i');
const catalogo = JSON.parse(await Bun.file('catalogo.json').text());
const alvo = catalogo.produtos.find((p) => p.codigo === codigo);
if (!alvo) {
  console.error(`produto ${codigo} não existe no catálogo`);
  process.exit(1);
}

const base = alvo.nome.replace(CORES_RE, '').replace(/\s+/g, ' ').trim();
const familia = catalogo.produtos.filter(
  (p) => p.nome.replace(CORES_RE, '').replace(/\s+/g, ' ').trim() === base && p.condicao === alvo.condicao
);
const cores = [
  ...new Set(
    familia
      .map((p) => (p.nome.match(CORES_RE) || [])[0])
      .filter(Boolean)
      .map((c) => c[0].toUpperCase() + c.slice(1).toLowerCase())
  ),
];
const barato = familia.reduce((a, b) => (a.preco_pix <= b.preco_pix ? a : b));

// ---- ilustração (cacheada por modelo) ----
const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const imgPath = `${ARTE}/${slug}.png`;
await Bun.$`mkdir -p ${ARTE}`.quiet();

if (!(await Bun.file(imgPath).exists())) {
  const envText = await Bun.file(`${process.env.HOME}/waveflow-ai/.env.local`).text();
  const KEY = (envText.match(/^OPENAI_API_KEY=(.+)$/m)?.[1] || '').replace(/["']/g, '').trim();
  if (!KEY) {
    console.error('!! sem OPENAI_API_KEY');
    process.exit(1);
  }

  console.log(`gerando ilustração de "${base}"…`);
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-2',
      // Sem nome de marca no prompt: o modelo recusa/deforma logotipo real, e
      // um aparelho genérico premium serve melhor como ilustração.
      prompt:
        'Ilustração premium de um smartphone moderno flutuando levemente inclinado, ' +
        'visto de frente, tela escura desligada com reflexo suave, bordas metálicas finas. ' +
        'Fundo azul-petróleo profundo com gradiente para turquesa, evocando água do oceano. ' +
        'Luz dourada quente vindo do canto superior direito, como sol de fim de tarde no litoral. ' +
        'Reflexos de ondulação de água na parte inferior. Estilo limpo e sofisticado, ' +
        'sem nenhum texto, sem marcas, sem logotipos. Composição centralizada. ' +
        'Paleta: azul profundo #04263f, turquesa #0d8ca3, dourado #ffc759.',
      size: '1024x1024',
      quality: 'medium',
      n: 1,
    }),
  }).then((x) => x.json());

  if (r.error) {
    console.error('!! OpenAI:', r.error.message);
    process.exit(1);
  }
  await Bun.write(imgPath, Buffer.from(r.data[0].b64_json, 'base64'));
  console.log(`  ilustração salva em ${imgPath}`);
} else {
  console.log(`(reusando ilustração ${slug}.png — apague o arquivo pra gerar outra)`);
}

const imgB64 = Buffer.from(await Bun.file(imgPath).arrayBuffer()).toString('base64');

// ---- composição ----
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const brlC = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const geracao = parseInt((alvo.nome.match(/\b(\d{1,2})\b/) || [])[1] || '0', 10);
const garantia =
  alvo.condicao !== 'Seminovo'
    ? 'Lacrado com nota fiscal'
    : geracao > 14
      ? '6 meses de garantia'
      : '3 meses de garantia';

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;
    background:#04263f;color:#fff;position:relative}
  .foto{position:absolute;top:0;left:0;right:0;height:880px;
    background:url(data:image/png;base64,${imgB64}) center/cover}
  .fade{position:absolute;top:520px;left:0;right:0;height:420px;
    background:linear-gradient(180deg,rgba(4,38,63,0) 0%,rgba(4,38,63,.86) 62%,#04263f 100%)}
  .topo{position:absolute;top:46px;left:52px;right:52px;display:flex;
    justify-content:space-between;align-items:flex-start;z-index:3}
  .brand{font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:700;line-height:1;
    text-shadow:0 2px 14px rgba(0,0,0,.5)}
  .brand span{color:#ffc759}
  .brand small{display:block;font-family:'Inter',sans-serif;font-size:12px;font-weight:500;
    letter-spacing:2.4px;text-transform:uppercase;color:rgba(255,255,255,.72);margin-top:4px}
  .tag{background:rgba(255,255,255,.16);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,.26);border-radius:20px;padding:8px 16px;
    font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}
  .conteudo{position:absolute;top:806px;left:52px;right:52px;bottom:46px;z-index:3;
    display:flex;flex-direction:column}
  h1{font-family:'Barlow Condensed',sans-serif;font-size:78px;font-weight:700;
    line-height:.95;letter-spacing:-1px;text-transform:uppercase}
  .bat{font-size:17px;color:#ffc759;font-weight:600;margin-top:8px}
  .cores{display:flex;align-items:center;gap:13px;margin-top:24px}
  .bola{width:42px;height:42px;border-radius:50%;border:2.5px solid rgba(255,255,255,.42);
    box-shadow:0 3px 12px rgba(0,0,0,.42)}
  .cores-lbl{font-size:14px;color:rgba(255,255,255,.62);font-weight:600;
    letter-spacing:1.4px;text-transform:uppercase;margin-right:4px}
  .preco{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
  .pix b{display:block;font-family:'Barlow Condensed',sans-serif;font-size:96px;
    font-weight:700;color:#5ce6a8;line-height:.86;letter-spacing:-2px}
  .pix span{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
    color:rgba(255,255,255,.6)}
  .parc{text-align:right;font-size:16px;color:rgba(255,255,255,.78);line-height:1.6}
  .parc b{color:#ffc759;font-size:23px;font-weight:700}
  .selos{display:flex;gap:9px;margin-top:26px}
  .selo{flex:1;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);
    border-radius:12px;padding:13px 12px;text-align:center;font-size:13px;font-weight:600;
    line-height:1.4}
  .selo em{display:block;font-style:normal;color:rgba(255,255,255,.6);font-weight:500;
    font-size:12px;margin-top:2px}
  .rodape{margin-top:22px;display:flex;justify-content:space-between;align-items:center}
  .confia{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:600;line-height:1.1}
  .confia small{display:block;font-family:'Inter',sans-serif;font-size:12px;font-weight:500;
    color:rgba(255,255,255,.55);margin-top:3px}
  .cta{background:#25d366;color:#06301c;border-radius:12px;padding:14px 26px;
    font-size:17px;font-weight:700;text-align:center;white-space:nowrap}
</style></head><body>
<div class="foto"></div><div class="fade"></div>
<div class="topo">
  <div class="brand">NoClick<span>Certo</span><small>Ubatuba · Litoral Norte</small></div>
  <div class="tag">${alvo.condicao}</div>
</div>
<div class="conteudo">
  <h1>${base}</h1>
  ${alvo.bateria && !/^[—-]+$/.test(String(alvo.bateria).trim())
    ? `<div class="bat">Bateria ${alvo.bateria} · testada antes de entregar</div>`
    : ''}

  ${cores.length
    ? `<div class="cores"><span class="cores-lbl">Cores</span>${cores
        .map((c) => `<div class="bola" style="background:${HEX[c] || '#8e8e93'}" title="${c}"></div>`)
        .join('')}</div>`
    : ''}

  <div class="preco">
    <div class="pix"><b>${brl(barato.preco_pix)}</b><span>à vista no Pix</span></div>
    <div class="parc">no cartão ${brlC(barato.preco_cartao)}<br>ou <b>10× ${brlC(barato.preco_10x)}</b> no link</div>
  </div>

  <div class="selos">
    <div class="selo">${garantia}<em>de verdade</em></div>
    <div class="selo">Entrega grátis<em>em Ubatuba</em></div>
    <div class="selo">Pagou até 15h<em>recebe em 48h úteis</em></div>
  </div>

  <div class="rodape">
    <div class="confia">Compre com quem você conhece.<small>Evite cair em golpes.</small></div>
    <div class="cta">Chama no WhatsApp</div>
  </div>
</div>
</body></html>`;

const htmlPath = `${BASE}/produto-${codigo}.html`;
const pngPath = `${BASE}/produto-${codigo}-${new Date().toISOString().slice(0, 10)}.png`;
await Bun.write(htmlPath, html);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await Bun.$`${CHROME} --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1350 --virtual-time-budget=8000 --screenshot=${pngPath} file://${htmlPath}`.quiet();

console.log(`✓ ${base} · ${cores.length} cores · ${brl(barato.preco_pix)}`);
console.log(`  ${pngPath}`);
