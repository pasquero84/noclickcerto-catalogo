#!/usr/bin/env bun
// ============================================================
// FILA DE STORIES — 3 por dia, misturando iPhone, outro celular e
// acessório/eletrônico (pedido do Stefano de 28/10/2026, via Gerente)
//
//   story 1  iPhone             (regras e escolha do stories-diarios.mjs)
//   story 2  Xiaomi/Poco/Realme (celular; margem R$650/R$850)
//   story 3  acessório/eletrônico (Pix custo×1,30 · 10x custo×1,40 — precos.mjs)
//
// Mesmos pills dos stories de iPhone: 10x no cartão primeiro, Pix como super
// desconto, entrega grátis Itamambuca→Praia Grande, garantia, "Compre com quem
// você confia". Não-iPhone lacrado leva "Lacrado de fábrica" (a regra do site).
//
// Só produto com foto própria no site e cotado pelo fornecedor nos últimos
// DIAS_COTACAO dias (estoque do fornecedor de verdade). Nenhum modelo repete
// dentro da fila.
//
// NADA é publicado. Sai numa pasta revisável no SSD com revisao.html; o
// Stefano aprova antes de qualquer postagem (scripts/postar-story.mjs).
//
// uso: bun scripts/fila-stories.mjs [AAAA-MM-DD início] [--dias 3]
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_SAIDA, escolherDoDia, htmlDoStory, textos } from './stories-diarios.mjs';
import { calcPrecos, ehCelular } from './precos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIAS_COTACAO = 7;

const somaDias = (data, n) => new Date(Date.parse(data) + n * 86_400_000).toISOString().slice(0, 10);
const ultimaCotacao = (p) => Object.values(p.cotacoes || {}).map((c) => c.data || '').sort().pop() || '';

// "Poco X8 Pro 5G 8/256 Preto" -> titulo "Poco X8 Pro 5G", subtitulo "8/256 · Lacrado"
export function tituloDe(p) {
  const nome = p.nome.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const cap = nome.match(/\b\d{1,2}\s*\/\s*\d{2,4}\b|\b\d{2,4}\s*(GB|TB)\b/i);
  const titulo = (cap ? nome.slice(0, cap.index) : nome).replace(/\b(Global|Original)\b/gi, '').trim();
  const marca = { macbook: 'MacBook', airpods: 'AirPods', ipad: 'iPad', airtag: 'AirTag', earpods: 'EarPods' };
  const tituloOk = titulo.replace(/\b(macbook|airpods|ipad|airtag|earpods)\b/gi, (w) => marca[w.toLowerCase()]);
  return { titulo: tituloOk, subtitulo: [cap?.[0].replace(/\s+/g, ''), p.condicao].filter(Boolean).join(' · ') };
}

export function candidatos(catalogo, data, filtro) {
  const corte = somaDias(data, -DIAS_COTACAO);
  const porFoto = new Map();
  for (const p of catalogo.produtos || []) {
    if (p.oculto || p.status !== 'Disponível' || !p.foto_url || !(p.custo > 0) || !filtro(p)) continue;
    if (ultimaCotacao(p) < corte) continue;
    const precos = calcPrecos(p.custo, p.categoria, p.nome);
    const atual = porFoto.get(p.foto_url);
    if (!atual || precos.preco_pix < atual.produto.preco_pix) porFoto.set(p.foto_url, { produto: { ...p, ...precos } });
  }
  return [...porFoto.values()].sort((a, b) => a.produto.codigo.localeCompare(b.produto.codigo));
}

export function montarFila(catalogo, historico, inicio, dias) {
  const celulares = candidatos(catalogo, inicio, (p) => p.categoria !== 'iPhone' && ehCelular(p.categoria, p.nome));
  const outros = candidatos(catalogo, inicio, (p) => !ehCelular(p.categoria, p.nome));
  const hist = [...historico];
  const fila = [];
  for (let d = 0; d < dias; d++) {
    const data = somaDias(inicio, d);
    const iphones = escolherDoDia(catalogo, hist, data);
    const iphone = iphones[d % 2] || iphones[0];
    hist.push({ data, modelo: iphone.modelo });
    const dia = [iphone];
    for (const [lista, garantiaLacrado] of [[celulares, true], [outros, true]]) {
      if (!lista.length) continue;
      const c = lista[(d * 3 + Number(data.slice(8))) % lista.length];
      lista.splice(lista.indexOf(c), 1); // não repete na fila
      const { titulo, subtitulo } = tituloDe(c.produto);
      dia.push({
        modelo: titulo, produto: c.produto, subtitulo,
        garantia: garantiaLacrado && c.produto.condicao === 'Lacrado' ? 'Lacrado de fábrica' : 'Garantia: consulte',
      });
    }
    fila.push({ data, stories: dia });
  }
  return fila;
}

// ---- CLI ----
if (import.meta.main) {
  const inicio = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || somaDias(new Date().toLocaleDateString('sv-SE'), 1);
  const iDias = process.argv.indexOf('--dias');
  const dias = iDias > 0 ? parseInt(process.argv[iDias + 1], 10) : 3;
  if (!existsSync('/Volumes/Externo SSD')) {
    console.error('!! SSD Externo não está montado — as artes nascem lá (regra da casa).');
    process.exit(1);
  }
  const pasta = join(PASTA_SAIDA, `Fila-${inicio}`);
  mkdirSync(pasta, { recursive: true });
  const arqHist = join(PASTA_SAIDA, 'historico.json');
  const historico = existsSync(arqHist) ? JSON.parse(readFileSync(arqHist, 'utf8')) : [];
  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'catalogo.json'), 'utf8'));
  const fila = montarFila(catalogo, historico, inicio, dias);

  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const registro = [];
  for (const { data, stories } of fila) {
    for (const [i, e] of stories.entries()) {
      const foto = readFileSync(join(RAIZ, e.produto.foto_url)).toString('base64');
      const nome = `${data}-story${i + 1}-${e.produto.codigo}`;
      const base = join(pasta, nome);
      writeFileSync(`${base}.html`, htmlDoStory(e, foto));
      await Bun.$`${CHROME} --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1920 --virtual-time-budget=8000 --screenshot=${base}.png file://${base}.html`.quiet();
      const t = textos(e);
      const precoNovo = !ehCelular(e.produto.categoria, e.produto.nome);
      registro.push({ data, story: i + 1, codigo: e.produto.codigo, titulo: t.titulo, categoria: e.produto.categoria,
        custo: e.produto.custo, parcela: t.parcela, pix: t.pix, garantia: t.garantia, png: `${nome}.png`, preco_pendente: precoNovo });
      console.log(`✓ ${data} #${i + 1} ${e.produto.codigo} ${t.titulo} — ${t.parcela} | ${t.pix} Pix${precoNovo ? '  (margem nova, pendente)' : ''}`);
    }
  }
  writeFileSync(join(pasta, 'fila.json'), JSON.stringify(registro, null, 2));
  writeFileSync(join(pasta, 'revisao.html'), paginaRevisao(inicio, registro));
  console.log(`\nrevisão: ${join(pasta, 'revisao.html')}`);
}

function paginaRevisao(inicio, registro) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const dias = [...new Set(registro.map((r) => r.data))];
  const card = (r) => `<figure><img src="${esc(r.png)}" loading="lazy"><figcaption>
    <b>#${r.story} · ${esc(r.titulo)}</b> <span>${esc(r.codigo)} · ${esc(r.categoria)}</span>
    <span>${esc(r.parcela)} · ${esc(r.pix)} no Pix · ${esc(r.garantia)}</span>
    ${r.preco_pendente ? '<em>preço com a margem nova (30% Pix / 40% 10x) — esperando o seu ok</em>' : ''}</figcaption></figure>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fila de Stories ${inicio}</title><style>
:root{--bg:#f5f7f9;--fg:#0b2233;--mut:#5a6b78;--card:#fff;--acc:#d97706}
@media (prefers-color-scheme:dark){:root{--bg:#0b1620;--fg:#e8eef3;--mut:#93a4b1;--card:#13222e;--acc:#fbbf24}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
h1{margin:0 0 4px}p{color:var(--mut);margin:0 0 20px;max-width:760px}h2{margin:28px 0 12px}
.dia{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
figure{margin:0;background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 1px 4px #0002}
img{width:100%;display:block;aspect-ratio:9/16;object-fit:cover}
figcaption{padding:10px 12px;display:grid;gap:3px}figcaption span{color:var(--mut);font-size:13px}
em{color:var(--acc);font-size:13px;font-style:normal;font-weight:600}
</style></head><body>
<h1>Fila de Stories — ${dias.length} dias a partir de ${inicio}</h1>
<p>${registro.length} stories, 3 por dia: iPhone, outro celular e acessório/eletrônico. Nada foi postado. As artes só vão ao ar depois do seu ok.
Preços do catálogo de ${new Date().toLocaleDateString('pt-BR')}.</p>
${dias.map((d) => `<h2>${new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</h2>
<div class="dia">${registro.filter((r) => r.data === d).map(card).join('')}</div>`).join('')}
</body></html>`;
}
