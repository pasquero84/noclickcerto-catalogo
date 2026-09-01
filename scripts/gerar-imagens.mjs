#!/usr/bin/env bun
// ============================================================
// GERADOR DE IMAGEM DE PRODUTO — uma por família, estilo e-commerce
//
// Por que gerado e não baixado do Google: foto de produto tem dono (fabricante
// ou a loja que fotografou). Catálogo comercial usando imagem de terceiro é
// exposição jurídica REAL pro Stefano. Imagem gerada é dele, sem risco.
//
// ⚠️ HONESTIDADE: a imagem NÃO é o aparelho exato. É um aparelho premium na
// cor e no formato certos — serve para o card não ficar vazio e o catálogo
// parecer profissional. Foto fiel de verdade só vem do fornecedor ou do
// fabricante (é o caminho definitivo, e o fornecedor tem interesse em mandar).
//
// Uma imagem por FAMÍLIA (iPhone 17 Pro Max, Redmi 15C…), não por produto:
// 82 famílias em vez de 184 imagens. A cor vem do nome de cada produto e é
// aplicada na hora, então cada card ainda mostra a cor certa.
//
// uso: bun scripts/gerar-imagens.mjs             (só lista o que falta)
//      bun scripts/gerar-imagens.mjs --gerar     (gera as que faltam)
//      bun scripts/gerar-imagens.mjs --gerar --limite 10
// ============================================================

const GERAR = process.argv.includes('--gerar');
const iLim = process.argv.indexOf('--limite');
const LIMITE = iLim > -1 ? parseInt(process.argv[iLim + 1], 10) : Infinity;
const DIR = 'imagens/produtos';

const CORES = /\b(Preto|Branco|Azul|Verde|Vermelho|Rosa|Roxo|Amarelo|Laranja|Dourado|Prata|Silver|Gold|Grafite|Cinza|Desert|Natural|Citrus|Titanium|Midnight|Starlight|Titânio)\b/i;
const CAP = /\b(\d{2,4}\s?GB|\d{1,2}\s?TB|\d{1,2}\/\d{2,4})\b/i;
const RUIDO = /\b(LLA|LL\/A|Japon[êe]s|Anatel|eSIM|AS IS|1ª Linha|Original|Global)\b/gi;

import { slugImagem, corDe } from './lib-familia.mjs';

export function familia(nome) {
  return nome
    .replace(CORES, ' ')
    .replace(CAP, ' ')
    .replace(RUIDO, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-·\s]+|[-·\s]+$/g, '');
}
export function slugFamilia(categoria, nome) {
  const f = familia(nome) || categoria;
  return `${categoria}-${f}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Como cada categoria deve ser desenhada. Sem nome de marca no prompt: o
// modelo recusa ou deforma logotipo real.
// Características VISUAIS reais de cada geração. A imagem é gerada, não
// baixada (foto de produto tem dono), mas descrevendo o formato correto ela
// fica fiel ao aparelho: quantidade e disposição das câmeras, notch ou ilha,
// bordas retas ou curvas, material. Isso é fato técnico, não cópia de arte.
const DESENHO_IPHONE = [
  { re: /17\s*pro\s*max|17\s*pro\b/i, d: 'a 2025-generation premium smartphone with a FULL-WIDTH horizontal camera plateau bar across the top of the back holding three lenses in a row, flat titanium sides, pill-shaped cutout at the top of the screen' },
  { re: /17\s*air/i, d: 'an ultra-thin 2025 premium smartphone, noticeably thinner than usual, with a full-width horizontal camera bar across the top of the back holding a SINGLE lens, flat sides, pill-shaped cutout at the top of the screen' },
  { re: /17e|17\b/i, d: 'a 2025 smartphone with TWO camera lenses arranged vertically in a rounded square module at the top-left of the back, flat aluminium sides, pill-shaped cutout at the top of the screen' },
  { re: /16\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement inside a rounded square module at the top-left of the back, flat titanium sides, pill-shaped cutout at the top of the screen, a thin vertical capture button on the right side' },
  { re: /16\b/i, d: 'a smartphone with TWO camera lenses arranged VERTICALLY in a pill-shaped module at the top-left of the back, flat aluminium sides, pill-shaped cutout at the top of the screen' },
  { re: /15\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement inside a rounded square module at the top-left of the back, flat brushed titanium sides, pill-shaped cutout at the top of the screen' },
  { re: /15\b|15\s*plus/i, d: 'a smartphone with TWO camera lenses arranged DIAGONALLY inside a rounded square module at the top-left of the back, flat sides with a soft matte glass back, pill-shaped cutout at the top of the screen' },
  { re: /14\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement in a large rounded square module at the top-left of the back, flat polished stainless steel sides, pill-shaped cutout at the top of the screen' },
  { re: /14\b/i, d: 'a smartphone with TWO camera lenses arranged DIAGONALLY in a rounded square module at the top-left of the back, flat sides, a WIDE NOTCH at the top of the screen' },
  { re: /13\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement in a rounded square module at the top-left of the back, flat polished stainless steel sides, a WIDE NOTCH at the top of the screen' },
  { re: /13\b/i, d: 'a smartphone with TWO camera lenses arranged DIAGONALLY in a rounded square module at the top-left of the back, flat sides, a NOTCH at the top of the screen' },
  { re: /12\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement in a rounded square module at the top-left of the back, flat glossy stainless steel sides, a WIDE NOTCH at the top of the screen' },
  { re: /11\s*pro/i, d: 'a premium smartphone with THREE camera lenses in a triangular arrangement in a large rounded square module at the top-left of the back, ROUNDED sides, a WIDE NOTCH at the top of the screen' },
];
function desenhoDoModelo(categoria, nome) {
  if (categoria === 'iPhone') {
    const m = DESENHO_IPHONE.find((x) => x.re.test(nome));
    if (m) return m.d;
  }
  return null;
}

const DESCRICAO = {
  iPhone: 'a modern premium smartphone, front view slightly angled, edge-to-edge screen turned off, thin metal frame, triple camera module on the back partially visible',
  iPad: 'a modern premium tablet, front view slightly angled, large edge-to-edge screen turned off, thin aluminum body',
  MacBook: 'a modern premium thin laptop, open at about 100 degrees, seen from a front three-quarter angle, screen turned off',
  'Apple Watch': 'a modern premium smartwatch with a rounded square case and a sport band, screen turned off, three-quarter view',
  Xiaomi: 'a modern smartphone, front view slightly angled, edge-to-edge screen turned off, glossy back partially visible',
  Realme: 'a modern smartphone, front view slightly angled, edge-to-edge screen turned off, glossy back partially visible',
  Tablet: 'a modern tablet, front view slightly angled, large screen turned off',
  Fone: 'a pair of modern wireless earbuds next to their charging case',
  Acessório: 'a modern USB-C charging cable neatly coiled next to a compact power adapter',
  Robô: 'a modern round robot vacuum cleaner, three-quarter view from above',
};

const catalogo = JSON.parse(await Bun.file('catalogo.json').text());

// família -> {categoria, nome, cor mais comum, quantos produtos}
const familias = new Map();
for (const p of catalogo.produtos) {
  const slug = slugImagem(p.categoria, p.nome);
  if (!familias.has(slug)) {
    familias.set(slug, { slug, categoria: p.categoria, nome: familia(p.nome) || p.categoria, qtd: 0, cores: [] });
  }
  const f = familias.get(slug);
  f.qtd++;
  const c = corDe(p.nome);
  if (c) f.cores.push(c);
}

const COR_EN = {
  preto: 'matte black', branco: 'white', azul: 'deep blue', verde: 'sage green',
  vermelho: 'red', rosa: 'soft pink', roxo: 'purple', amarelo: 'yellow',
  laranja: 'copper orange', dourado: 'champagne gold', prata: 'silver',
  silver: 'silver', gold: 'champagne gold', grafite: 'graphite grey',
  cinza: 'space grey', desert: 'desert titanium beige', natural: 'natural titanium',
  citrus: 'citrus yellow', titanium: 'natural titanium', 'titânio': 'natural titanium',
  midnight: 'midnight dark blue', starlight: 'starlight cream',
};

await Bun.$`mkdir -p ${DIR}`.quiet();

const lista = [...familias.values()].sort((a, b) => b.qtd - a.qtd);
const faltando = [];
for (const f of lista) {
  f.arquivo = `${DIR}/${f.slug}.jpg`;
  if (!(await Bun.file(f.arquivo).exists())) faltando.push(f);
}

console.log(`${lista.length} famílias · ${lista.length - faltando.length} com imagem · ${faltando.length} faltando`);

if (!GERAR) {
  console.log('\nas 12 maiores que faltam:');
  for (const f of faltando.slice(0, 12)) console.log(`  ${f.qtd}x  ${f.categoria} — ${f.nome}  (${f.slug})`);
  console.log('\n(use --gerar pra criar; cada imagem consome crédito da chave OpenAI compartilhada com o WaveFlow)');
  process.exit(0);
}

const envText = await Bun.file(`${process.env.HOME}/waveflow-ai/.env.local`).text();
const KEY = (envText.match(/^OPENAI_API_KEY=(.+)$/m)?.[1] || '').replace(/["']/g, '').trim();
if (!KEY) { console.error('!! sem OPENAI_API_KEY'); process.exit(1); }

let feitas = 0, erros = 0;
for (const f of faltando) {
  if (feitas >= LIMITE) break;

  const corMaisComum = f.cores.sort((a, b) =>
    f.cores.filter((x) => x === b).length - f.cores.filter((x) => x === a).length)[0];
  const cor = COR_EN[corMaisComum] || 'space grey';
  const desc = desenhoDoModelo(f.categoria, f.nome) || DESCRICAO[f.categoria] || DESCRICAO.iPhone;

  const prompt =
    `Professional e-commerce product photograph of ${desc}, finished in ${cor}. ` +
    `Two units shown: one from the back showing the camera module clearly, ` +
    `one from the front with the screen off, slightly overlapping, standing upright. ` +
    `Pure white seamless background, soft even studio lighting, subtle contact shadow, ` +
    `razor sharp focus, high detail, product catalog photography. ` +
    `The camera module layout must match the description exactly. ` +
    `Absolutely no text, no logos, no brand marks, no watermark, no people, no hands.`;

  process.stdout.write(`  ${f.categoria} — ${f.nome} … `);
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1024x1024', quality: 'medium', n: 1 }),
      signal: AbortSignal.timeout(180000),
    }).then((x) => x.json());

    if (r.error) { console.log(`ERRO: ${r.error.message.slice(0, 70)}`); erros++; continue; }

    const png = `${DIR}/${f.slug}.png`;
    await Bun.write(png, Buffer.from(r.data[0].b64_json, 'base64'));
    // sips é nativo do macOS — evita dependência nova só pra redimensionar.
    await Bun.$`sips -Z 800 -s format jpeg -s formatOptions 78 ${png} --out ${f.arquivo}`.quiet();
    await Bun.$`rm -f ${png}`.quiet();
    const kb = Math.round((await Bun.file(f.arquivo).size) / 1024);
    console.log(`ok (${kb}KB)`);
    feitas++;
  } catch (err) {
    console.log(`falhou: ${String(err.message).slice(0, 60)}`);
    erros++;
  }
}

console.log(`\n${feitas} imagem(ns) gerada(s), ${erros} erro(s)`);
console.log('agora rode: bun scripts/aplicar-imagens.mjs');
