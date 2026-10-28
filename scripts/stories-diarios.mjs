#!/usr/bin/env bun
// ============================================================
// STORIES DIÁRIOS — 2 artes 9:16 (1080x1920) de iPhone por dia
//
// Pedido do Stefano (27/10/2026, via Gerente de Sessões), regras dele:
//   1. sempre iPhone, aparelho do catálogo com o preço ATUAL do catalogo.json
//   2. sempre com preço: PRIMEIRO 10x no cartão (preco_link ÷ 10), DEPOIS o Pix
//      como "super desconto"
//   3. sempre ENTREGA GRÁTIS em Ubatuba, de Itamambuca à Praia Grande; outras
//      regiões: consultar valores (regra dele de 27/10)
//   4. sempre "Compre com quem você confia — evite cair em golpes na internet"
//   5. garantia: 3 meses até o iPhone 14, 6 meses do 15 em diante
//   + modelo diferente a cada story, sem repetir o mesmo modelo na semana
//
// Zonas seguras do Stories: o Instagram cobre ~250px em cima (perfil) e ~250px
// embaixo (caixa de mensagem) — todo texto fica entre 250 e 1670.
//
// Visual: o do criativo de produto de 31/08 (scripts/criativo-produto.mjs —
// azul-petróleo, dourado, Barlow Condensed, selos), só que em 9:16. Foto: a
// que o produto JÁ usa no site (/imagens/produtos/<modelo>-<cor>.jpg). Produto
// sem foto do próprio modelo não entra — a foto genérica do fornecedor mostra
// caixas de 17 Pro e anunciaria o aparelho errado.
//
// Nada é publicado aqui. Publicação: scripts/postar-story.mjs (desligado até o
// Stefano aprovar as 2 primeiras artes).
//
// uso: bun scripts/stories-diarios.mjs [AAAA-MM-DD] [--sem-historico]
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_SAIDA = '/Volumes/Externo SSD/01-NoClickCerto/Marca e Artes/Stories Catalogo';
const DIAS_SEM_REPETIR = 7;

// Regra do Stefano (27/10/2026): grátis de Itamambuca à Praia Grande; fora disso, consultar.
export const ENTREGA = {
  titulo: 'Entrega grátis em Ubatuba',
  detalhe: 'de Itamambuca à Praia Grande',
  fora: 'outras regiões, consulte',
};
export const WHATSAPP = '(12) 99104-8039'; // o mesmo do catálogo (meta.whatsapp)

// "iPhone 16 Pro Max 256GB Preto" -> { modelo: "iPhone 16 Pro Max", geracao: 16 }
export function modeloDe(nome) {
  const m = String(nome).match(/iPhone\s+(\d{1,2})\s*(Pro Max|Pro|Plus|Air|Mini|E\b)?/i);
  if (!m) return null;
  const variante = m[2] ? ` ${m[2].replace(/\b\w/g, (c) => c.toUpperCase())}` : '';
  return { modelo: `iPhone ${m[1]}${variante}`, geracao: parseInt(m[1], 10) };
}

export const garantiaMeses = (geracao) => (geracao >= 15 ? 6 : 3);

// 10x = preço do link ÷ 10 (regra 2), arredondado pro centavo.
export const parcela10x = (p) => Math.round((p.preco_link / 10) * 100) / 100;

export function elegiveis(catalogo) {
  return (catalogo.produtos || []).filter(
    (p) =>
      p.categoria === 'iPhone' &&
      !p.oculto &&
      p.status === 'Disponível' &&
      !/\bCPO\b/i.test(p.nome) && // CPO tem garantia própria de 1 ano; não mistura com a regra 5
      Number(p.preco_link) > 0 &&
      Number(p.preco_pix) > 0 &&
      /^\/imagens\/produtos\/iphone-/.test(p.foto_url || '') &&
      modeloDe(p.nome)
  );
}

/**
 * Escolhe os 2 do dia: 1 modelo "recente" (15 em diante) e 1 "até o 14",
 * nenhum usado nos últimos 7 dias. Dentro do modelo vai a melhor oferta (menor
 * Pix). Determinístico pela data — rodar de novo no mesmo dia dá o mesmo par.
 */
export function escolherDoDia(catalogo, historico, data) {
  const usados = new Set(
    historico
      .filter((h) => h.data < data && diasEntre(h.data, data) < DIAS_SEM_REPETIR)
      .map((h) => h.modelo)
  );
  const porModelo = new Map();
  for (const p of elegiveis(catalogo)) {
    const { modelo, geracao } = modeloDe(p.nome);
    const atual = porModelo.get(modelo);
    if (!atual || p.preco_pix < atual.produto.preco_pix) porModelo.set(modelo, { modelo, geracao, produto: p });
  }
  const livres = [...porModelo.values()].filter((m) => !usados.has(m.modelo));
  // Se a semana esgotar os modelos (catálogo pequeno), libera o mais antigo.
  const pool = livres.length >= 2 ? livres : [...porModelo.values()];
  const giro = (lista) => {
    const ordenada = [...lista].sort((a, b) => a.modelo.localeCompare(b.modelo));
    return ordenada.length ? ordenada[semente(data) % ordenada.length] : null;
  };
  const recente = giro(pool.filter((m) => m.geracao >= 15));
  const antigo = giro(pool.filter((m) => m.geracao <= 14));
  const escolhidos = [recente, antigo].filter(Boolean);
  for (const m of pool) if (escolhidos.length < 2 && !escolhidos.includes(m)) escolhidos.push(m);
  return escolhidos.slice(0, 2);
}

function diasEntre(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
function semente(data) {
  return Math.floor(Date.parse(data) / 86_400_000);
}

// Com centavos só quando tem (28/10: preço termina em ,90 — R$143,90 não pode virar R$144).
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const brlC = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Os textos da arte — separados pra teste conferir as 5 regras. */
export function textos(escolha) {
  const p = escolha.produto;
  const capacidade = (p.nome.match(/\b\d{2,4}\s*(GB|TB)\b/i) || [''])[0].replace(/\s+/g, '');
  return {
    titulo: escolha.modelo,
    subtitulo: escolha.subtitulo || [capacidade, p.condicao].filter(Boolean).join(' · '),
    bateria: p.condicao === 'Seminovo' && p.bateria && /\d/.test(p.bateria) ? `Bateria ${p.bateria}` : '',
    parcela: `10x de ${brlC(parcela10x(p))}`,
    parcelaRotulo: 'no cartão',
    pix: brl(p.preco_pix),
    pixRotulo: 'no Pix · super desconto',
    // fila de 28/10 (acessório/eletrônico/Xiaomi): garantia vem pronta — a do site, "Lacrado de fábrica"
    garantia: escolha.garantia || `${garantiaMeses(escolha.geracao)} meses de garantia`,
    entrega: `${ENTREGA.titulo} — ${ENTREGA.detalhe} · ${ENTREGA.fora}`,
    confianca: 'Compre com quem você confia',
    golpe: 'Evite cair em golpes na internet',
    codigo: p.codigo,
  };
}

export function htmlDoStory(escolha, fotoB64) {
  const t = textos(escolha);
  // Nome comprido ("Redmi Note 15 Pro 5G") não cabe em 116px numa linha.
  const tamTitulo = t.titulo.length > 21 ? 84 : t.titulo.length > 17 ? 100 : 116;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter',system-ui,sans-serif;
    background:linear-gradient(180deg,#04263f 0%,#063350 55%,#04263f 100%);color:#fff;position:relative}
  .topo{position:absolute;top:250px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center}
  .brand{font-family:'Barlow Condensed',sans-serif;font-size:56px;font-weight:700;line-height:1}
  .brand span{color:#ffc759}
  .brand small{display:block;font-family:'Inter',sans-serif;font-size:19px;font-weight:600;letter-spacing:3px;
    text-transform:uppercase;color:rgba(255,255,255,.7);margin-top:8px}
  .tag{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:40px;
    padding:14px 26px;font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .foto{position:absolute;top:380px;left:220px;width:640px;height:480px;border-radius:44px;
    background:#fff url(data:image/jpeg;base64,${fotoB64}) center/contain no-repeat;
    box-shadow:0 30px 80px rgba(0,0,0,.45)}
  .info{position:absolute;top:898px;left:72px;right:72px}
  h1{font-family:'Barlow Condensed',sans-serif;font-size:116px;font-weight:700;line-height:.92;
    letter-spacing:-1px}
  .sub{font-size:30px;font-weight:600;color:rgba(255,255,255,.78);margin-top:14px}
  .sub b{color:#ffc759;font-weight:700}
  .preco{margin-top:30px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);
    border-radius:30px;padding:30px 36px}
  .parc{font-family:'Barlow Condensed',sans-serif;font-size:104px;font-weight:700;line-height:.95;color:#ffc759}
  .parc small{font-family:'Inter',sans-serif;font-size:30px;font-weight:600;color:rgba(255,255,255,.8);margin-left:12px}
  .pix{margin-top:14px;font-size:34px;font-weight:600;color:rgba(255,255,255,.85)}
  .pix b{font-family:'Barlow Condensed',sans-serif;font-size:66px;font-weight:700;color:#5ce6a8;margin:0 8px}
  .selos{position:absolute;top:1366px;left:72px;right:72px;display:flex;gap:18px}
  .selo{flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:22px;
    padding:20px 18px;text-align:center;font-size:27px;font-weight:700;line-height:1.25;
    display:flex;align-items:center;justify-content:center}
  .selo.entrega{flex:1.55;background:#25d366;color:#06301c;border-color:#25d366;font-size:28px;line-height:1.15}
  .selo.entrega small{display:block;font-size:25px;font-weight:700;margin-top:4px}
  .selo.entrega em{display:block;font-style:normal;font-size:20px;font-weight:600;opacity:.78;margin-top:4px}
  .rodape{position:absolute;top:1528px;left:72px;right:72px;text-align:center}
  .confia{font-family:'Barlow Condensed',sans-serif;font-size:54px;font-weight:700;line-height:1}
  .golpe{font-size:26px;font-weight:600;color:#ffc759;margin-top:10px}
  .zap{font-size:24px;font-weight:600;color:rgba(255,255,255,.7);margin-top:12px}
</style></head><body>
<div class="topo">
  <div class="brand">NoClick<span>Certo</span><small>Ubatuba · Litoral Norte</small></div>
  <div class="tag">${esc(escolha.produto.condicao)}</div>
</div>
<div class="foto"></div>
<div class="info">
  <h1 style="font-size:${tamTitulo}px">${esc(t.titulo)}</h1>
  <div class="sub">${esc(t.subtitulo)}${t.bateria ? ` · <b>${esc(t.bateria)}</b>` : ''}</div>
  <div class="preco">
    <div class="parc">${esc(t.parcela)}<small>${esc(t.parcelaRotulo)}</small></div>
    <div class="pix">ou<b>${esc(t.pix)}</b>${esc(t.pixRotulo)}</div>
  </div>
</div>
<div class="selos">
  <div class="selo entrega"><div>${esc(ENTREGA.titulo)}<small>${esc(ENTREGA.detalhe)}</small><em>${esc(ENTREGA.fora)}</em></div></div>
  <div class="selo">${esc(t.garantia)}</div>
</div>
<div class="rodape">
  <div class="confia">${esc(t.confianca)}</div>
  <div class="golpe">${esc(t.golpe)}</div>
  <div class="zap">WhatsApp ${esc(WHATSAPP)} · código ${esc(t.codigo)}</div>
</div>
</body></html>`;
}

// ---- CLI ----
if (import.meta.main) {
  const data = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toLocaleDateString('sv-SE');
  const semHistorico = process.argv.includes('--sem-historico');
  if (!existsSync('/Volumes/Externo SSD')) {
    console.error('!! SSD Externo não está montado — as artes nascem lá (regra da casa).');
    process.exit(1);
  }
  const pasta = join(PASTA_SAIDA, data.slice(0, 7));
  mkdirSync(pasta, { recursive: true });
  const arqHist = join(PASTA_SAIDA, 'historico.json');
  const historico = existsSync(arqHist) ? JSON.parse(readFileSync(arqHist, 'utf8')) : [];

  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'catalogo.json'), 'utf8'));
  const escolhas = escolherDoDia(catalogo, semHistorico ? [] : historico, data);
  if (escolhas.length < 2) {
    console.error(`!! só ${escolhas.length} iPhone elegível — confira o catálogo`);
    process.exit(1);
  }

  const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const saidas = [];
  for (const [i, e] of escolhas.entries()) {
    const foto = readFileSync(join(RAIZ, e.produto.foto_url)).toString('base64');
    const base = join(pasta, `${data}-story${i + 1}-${e.produto.codigo}`);
    writeFileSync(`${base}.html`, htmlDoStory(e, foto));
    await Bun.$`${CHROME} --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1920 --virtual-time-budget=8000 --screenshot=${base}.png file://${base}.html`.quiet();
    saidas.push({ data, story: i + 1, modelo: e.modelo, codigo: e.produto.codigo, png: `${base}.png`, ...textos(e) });
    const t = textos(e);
    console.log(`✓ story ${i + 1}: ${e.produto.codigo} ${e.modelo} — ${t.parcela} ${t.parcelaRotulo} | ${t.pix} no Pix | ${t.garantia}`);
    console.log(`  ${base}.png`);
  }

  if (!semHistorico) {
    const resto = historico.filter((h) => h.data !== data);
    writeFileSync(arqHist, JSON.stringify([...resto, ...saidas.map(({ data, story, modelo, codigo, png }) => ({ data, story, modelo, codigo, png }))], null, 2));
  }
}
