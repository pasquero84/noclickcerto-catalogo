#!/usr/bin/env bun
// ============================================================
// AUDITOR DE PREÇO — trava antes de publicar
//
// Ideia do Stefano (31/08/2026): "se sair o iPhone 17 Pro Max por R$700, isso
// não existe — só em golpe. Provavelmente é erro de digitação do fornecedor ou
// da margem. O agente não publica esse item e libera o resto do catálogo."
//
// A referência NÃO é preço de mercado externo (fonte frágil, muda toda hora e
// depende de scraping que quebra). São três sinais que já temos em casa e são
// mais confiáveis:
//
//   1. HISTÓRICO — o preço daquele MESMO produto no catálogo publicado.
//      Queda maior que o limite = suspeito.
//   2. PARES — a mediana dos produtos da mesma categoria e geração.
//      Pega item NOVO, que não tem histórico ("17 Pro Max" a R$700 quando os
//      irmãos custam R$7.900).
//   3. PISO — chão absoluto por categoria. Um iPhone lacrado a R$200 é erro,
//      não promoção, mesmo que fosse o primeiro do catálogo.
//
// Item reprovado NÃO vai pro ar: fica com status "Consultar Disponibilidade"
// e é reportado. O resto do catálogo publica normal.
//
// uso: bun scripts/auditor.mjs                    (audita catalogo.json local)
//      bun scripts/auditor.mjs --aplicar          (marca reprovados p/ consulta)
// ============================================================

const QUEDA_MAX = 0.40;      // >40% abaixo do próprio preço anterior
const ABAIXO_PARES = 0.50;   // <50% da mediana dos pares
const PUBLICADO = 'https://catalogo.noclickcerto.com.br/catalogo.json';

// Chão por categoria (custo do fornecedor, não preço de venda). Abaixo disso
// é erro de digitação, não oportunidade.
const PISO_CUSTO = {
  iPhone: 700, iPad: 500, MacBook: 1500, 'Apple Watch': 400,
  Xiaomi: 250, Realme: 250, Tablet: 250, Fone: 40, Acessório: 15, Robô: 300,
};

const APLICAR = process.argv.includes('--aplicar');
const catalogo = JSON.parse(await Bun.file('catalogo.json').text());
const produtos = catalogo.produtos;

// ── referência 1: o que está publicado hoje ──
let publicado = new Map();
try {
  const r = await fetch(PUBLICADO, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  for (const p of j.produtos || []) publicado.set(p.codigo, p);
} catch {
  console.log('(não consegui ler o catálogo publicado — auditoria segue sem o histórico)');
}

// ── referência 2: mediana dos pares (mesma categoria + geração + condição) ──
function geracao(nome) {
  const m = nome.match(/\b(\d{1,2})\b/);
  return m ? m[1] : '?';
}
// "Acessório" mistura cabo de R$15 com item de R$2.000 — a mediana da
// categoria inteira não diz nada e reprova produto legítimo. Nessas, o par é
// formado por FAIXA DE PREÇO, não pela categoria.
const HETEROGENEAS = new Set(['Acessório', 'Fone', 'Robô']);
function faixa(custo) {
  if (custo < 50) return '<50';
  if (custo < 150) return '50-150';
  if (custo < 400) return '150-400';
  if (custo < 1000) return '400-1k';
  return '1k+';
}
function chavePar(p) {
  if (HETEROGENEAS.has(p.categoria)) return `${p.categoria}|faixa:${faixa(p.custo)}`;
  return `${p.categoria}|${p.condicao}|${geracao(p.nome)}`;
}
function mediana(ns) {
  const a = [...ns].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const grupos = new Map();
for (const p of produtos) {
  const k = chavePar(p);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(p.custo);
}

// ── audita ──
const reprovados = [];
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

for (const p of produtos) {
  const motivos = [];

  // 1. histórico
  const antes = publicado.get(p.codigo);
  if (antes?.custo && p.custo < antes.custo * (1 - QUEDA_MAX)) {
    const queda = Math.round((1 - p.custo / antes.custo) * 100);
    motivos.push(`caiu ${queda}% vs publicado (${brl(antes.custo)} → ${brl(p.custo)})`);
  }

  // 2. pares
  const pares = (grupos.get(chavePar(p)) || []).filter((c) => c !== p.custo);
  if (pares.length >= 2) {
    const med = mediana(pares);
    if (p.custo < med * ABAIXO_PARES) {
      motivos.push(`${brl(p.custo)} é menos da metade da mediana dos pares (${brl(med)})`);
    }
  }

  // 3. piso
  const piso = PISO_CUSTO[p.categoria];
  if (piso && p.custo < piso) {
    motivos.push(`custo abaixo do piso de ${p.categoria} (${brl(piso)})`);
  }

  if (motivos.length) reprovados.push({ produto: p, motivos });
}

// ── relatório ──
console.log(`\nAuditoria de ${produtos.length} produtos`);
console.log(`  referência: histórico publicado (${publicado.size} itens), pares e piso por categoria\n`);

if (!reprovados.length) {
  console.log('✓ nenhum preço suspeito — catálogo liberado pra publicar');
  process.exit(0);
}

console.log(`⚠️  ${reprovados.length} item(ns) REPROVADO(S) — não devem ir ao ar:\n`);
for (const { produto, motivos } of reprovados) {
  console.log(`  ${produto.codigo}  ${produto.nome}`);
  console.log(`     custo ${brl(produto.custo)} · venderia por ${brl(produto.preco_pix)} no Pix`);
  for (const m of motivos) console.log(`     ✗ ${m}`);
  console.log('');
}

if (!APLICAR) {
  console.log('(auditoria apenas — use --aplicar pra marcar como "Consultar Disponibilidade")');
  process.exit(2);
}

for (const { produto, motivos } of reprovados) {
  produto.status = 'Consultar Disponibilidade';
  produto.auditoria_bloqueio = { em: new Date().toISOString().slice(0, 10), motivos };
}
await Bun.write('catalogo.json', JSON.stringify(catalogo, null, 2));
console.log(`✓ ${reprovados.length} item(ns) marcado(s) como "Consultar Disponibilidade" — o resto do catálogo segue normal`);
process.exit(2);
