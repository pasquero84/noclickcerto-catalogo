/**
 * O que vai pro ar — o site só pode ver preço de venda, nunca custo/margem/fornecedor.
 *   bun test tests/build-publico.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogoPublico } from '../scripts/build-publico.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEGREDOS = ['custo', 'lucro_pix', 'lucro_cartao', 'fornecedor', 'cotacoes', 'auditoria_bloqueio', 'nome_interno', 'oculto'];

test('catálogo público não tem custo, margem, fornecedor, cotações nem produto oculto', () => {
  const completo = JSON.parse(readFileSync(join(RAIZ, 'catalogo.json'), 'utf8'));
  const pub = catalogoPublico(completo);
  assert.ok(pub.produtos.length > 100);
  assert.equal(pub.produtos.length, completo.produtos.filter((p) => !p.oculto).length);
  for (const p of pub.produtos) for (const s of SEGREDOS) assert.equal(p[s], undefined, `${p.codigo}.${s}`);
  assert.equal(pub.fornecedores, undefined);
  for (const s of ['margem', 'taxa_antecipacao', 'versao_formula']) assert.equal(pub.meta[s], undefined, `meta.${s}`);
  const texto = JSON.stringify(pub);
  for (const s of ['"custo"', '"lucro_', '"cotacoes"', 'EasyStore', 'Trend Shop', 'FOR001', 'FOR002']) assert.ok(!texto.includes(s), s);
  const p = pub.produtos[0];
  for (const c of ['codigo', 'nome', 'preco_pix', 'preco_cartao', 'preco_link', 'preco_10x', 'status']) assert.ok(c in p, c);
});

test('public/ só tem a lista fechada (nada de scripts, tests, docs, catalogo.json)', () => {
  execFileSync('node', [join(RAIZ, 'scripts/build-publico.mjs')], { cwd: RAIZ });
  const pub = join(RAIZ, 'public');
  assert.deepEqual(readdirSync(pub).sort(), ['admin', 'catalogo.publico.json', 'favicon.svg', 'imagens', 'index.html']);
  assert.deepEqual(readdirSync(join(pub, 'admin')), ['index.html']);
  assert.ok(!existsSync(join(pub, 'catalogo.json')));
});
