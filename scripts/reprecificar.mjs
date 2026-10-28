#!/usr/bin/env bun
// ============================================================
// REPRECIFICAR — aplica a regra de precos.mjs a todo o catálogo, a partir do
// custo que já está gravado. A ingestão só reprecifica o que chega na tabela
// do dia; quando a REGRA muda (28/10: 30%/40% pra tudo que não é celular),
// este script passa o resto.
//
// uso: bun scripts/reprecificar.mjs              (ensaio: mostra o que mudaria)
//      bun scripts/reprecificar.mjs --aplicar    (grava catalogo.json; publicar é à parte)
// ============================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcPrecos, ehCelular } from './precos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARQ = join(RAIZ, 'catalogo.json');

export function reprecificar(catalogo) {
  const mudancas = [];
  for (const p of catalogo.produtos || []) {
    if (p.oculto || !(p.custo > 0) || ehCelular(p.categoria, p.nome)) continue;
    const novo = calcPrecos(p.custo, p.categoria, p.nome);
    if (novo.preco_pix === p.preco_pix && novo.preco_link === p.preco_link) continue;
    mudancas.push({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, oculto: !!p.oculto, custo: p.custo,
      antes: { pix: p.preco_pix, link: p.preco_link, x10: p.preco_10x }, depois: { pix: novo.preco_pix, link: novo.preco_link, x10: novo.preco_10x } });
    Object.assign(p, novo);
  }
  return mudancas;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalogo = JSON.parse(readFileSync(ARQ, 'utf8'));
  const mudancas = reprecificar(catalogo);
  const brl = (n) => n?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const m of mudancas) {
    console.log(`${m.codigo}${m.oculto ? ' (oculto)' : ''}  ${m.nome}  custo ${brl(m.custo)}  |  Pix ${brl(m.antes.pix)} -> ${brl(m.depois.pix)}  |  10x ${brl(m.antes.x10)} -> ${brl(m.depois.x10)} (total ${brl(m.depois.link)})`);
  }
  console.log(`\n${mudancas.length} produto(s) mudariam de preço.`);
  if (process.argv.includes('--aplicar')) {
    writeFileSync(ARQ, JSON.stringify(catalogo, null, 2) + '\n');
    console.log('catalogo.json gravado (não publicado).');
  } else console.log('(ensaio — nada gravado)');
}
