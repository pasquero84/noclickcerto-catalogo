#!/usr/bin/env bun
// ============================================================
// APLICA as imagens geradas nos produtos do catálogo
//
// Liga cada produto à imagem da FAMÍLIA dele (uma imagem serve os 8 iPhone 17
// Pro Max, por exemplo). Não sobrescreve foto que já exista: se o fornecedor
// mandar a foto real um dia, ela vale mais que a gerada e fica.
//
// uso: bun scripts/aplicar-imagens.mjs [--aplicar]
// ============================================================

import { slugImagem } from './lib-familia.mjs';

const APLICAR = process.argv.includes('--aplicar');
const catalogo = JSON.parse(await Bun.file('catalogo.json').text());

let ligados = 0, jaTinha = 0, semImagem = 0;
const faltando = new Map();

for (const p of catalogo.produtos) {
  // foto do fornecedor tem prioridade sobre a gerada — é a real
  const temReal = p.foto_url && !String(p.foto_url).includes('/imagens/produtos/');
  if (temReal) { jaTinha++; continue; }

  const slug = slugImagem(p.categoria, p.nome, p.condicao);
  const arquivo = `imagens/produtos/${slug}.jpg`;
  if (!(await Bun.file(arquivo).exists())) {
    semImagem++;
    faltando.set(slug, (faltando.get(slug) || 0) + 1);
    continue;
  }

  const url = `/${arquivo}`;
  if (p.foto_url !== url) { p.foto_url = url; ligados++; }
  if (!Array.isArray(p.fotos) || !p.fotos.length) p.fotos = [url];
}

console.log(`\n${catalogo.produtos.length} produtos`);
console.log(`  ${ligados} ligados à imagem da família`);
console.log(`  ${jaTinha} já tinham foto real (mantida)`);
console.log(`  ${semImagem} ainda sem imagem`);

if (faltando.size) {
  console.log('\nfamílias sem imagem:');
  for (const [slug, n] of [...faltando.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${n}x  ${slug}`);
  }
}

if (!APLICAR) {
  console.log('\n(simulação — use --aplicar pra gravar)');
  process.exit(0);
}

await Bun.write('catalogo.json', JSON.stringify(catalogo, null, 2));
console.log('\n✓ catalogo.json atualizado');
