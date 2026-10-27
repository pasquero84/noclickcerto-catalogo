/**
 * Stories diários — as 5 regras do Stefano (27/10/2026) conferidas no catálogo REAL.
 *   bun test tests/stories-diarios.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escolherDoDia, textos, elegiveis, modeloDe, garantiaMeses, parcela10x, htmlDoStory } from '../scripts/stories-diarios.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = JSON.parse(readFileSync(join(RAIZ, 'catalogo.json'), 'utf8'));

test('regra 1: só iPhone do catálogo, disponível, não oculto, com foto do próprio modelo', () => {
  const el = elegiveis(catalogo);
  assert.ok(el.length >= 14, `só ${el.length} elegíveis`);
  for (const p of el) {
    assert.equal(p.categoria, 'iPhone');
    assert.equal(p.status, 'Disponível');
    assert.ok(!p.oculto);
    assert.match(p.foto_url, /^\/imagens\/produtos\/iphone-/);
  }
});

test('regras 2-5: 10x (link ÷ 10) primeiro, Pix "super desconto", entrega grátis, confiança, garantia', () => {
  const [e] = escolherDoDia(catalogo, [], '2026-10-27');
  const t = textos(e);
  assert.equal(t.parcela, `10x de R$ ${(e.produto.preco_link / 10).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  assert.match(t.pixRotulo, /super desconto/);
  assert.equal(t.entrega, 'Entrega grátis em Ubatuba — de Itamambuca à Praia Grande · outras regiões, consulte');
  assert.equal(t.confianca, 'Compre com quem você confia');
  assert.equal(t.golpe, 'Evite cair em golpes na internet');
  const html = htmlDoStory(e, '');
  assert.ok(html.indexOf(t.parcela) < html.indexOf(t.pix), '10x tem que vir antes do Pix');
  for (const s of [t.parcela, t.pix, 'super desconto', 'Entrega grátis em Ubatuba', 'de Itamambuca à Praia Grande', 'outras regiões, consulte', 'Compre com quem você confia', 'golpes na internet', t.garantia]) assert.ok(html.includes(s), s);
});

test('regra 5: 3 meses até o 14, 6 meses do 15 em diante', () => {
  assert.equal(garantiaMeses(11), 3);
  assert.equal(garantiaMeses(14), 3);
  assert.equal(garantiaMeses(15), 6);
  assert.equal(garantiaMeses(17), 6);
  assert.deepEqual(modeloDe('iPhone 16 Pro Max 256GB Preto'), { modelo: 'iPhone 16 Pro Max', geracao: 16 });
  assert.equal(parcela10x({ preco_link: 6435 }), 643.5);
});

test('2 por dia, 1 recente (15+) e 1 até o 14, sem repetir modelo na semana', () => {
  const historico = [];
  const dias = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  for (const data of dias) {
    const par = escolherDoDia(catalogo, historico, data);
    assert.equal(par.length, 2, data);
    assert.notEqual(par[0].modelo, par[1].modelo);
    assert.ok(par.some((m) => m.geracao >= 15) && par.some((m) => m.geracao <= 14), `${data}: ${par.map((m) => m.modelo)}`);
    for (const m of par) historico.push({ data, modelo: m.modelo });
  }
  const modelos = historico.map((h) => h.modelo);
  assert.equal(new Set(modelos).size, modelos.length, `repetiu modelo na semana: ${modelos}`);
});

test('mesmo dia = mesmo par (rodar de novo não troca a arte aprovada)', () => {
  const a = escolherDoDia(catalogo, [], '2026-10-27').map((m) => m.produto.codigo);
  const b = escolherDoDia(catalogo, [], '2026-10-27').map((m) => m.produto.codigo);
  assert.deepEqual(a, b);
});
