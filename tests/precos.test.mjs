// Regra de preço — celular margem fixa; o resto 30% Pix / 40% em 10x (28/10/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcPrecos, ehCelular } from '../scripts/precos.mjs';
import { reprecificar } from '../scripts/reprecificar.mjs';

test('acessório, fone, MacBook, Watch, tablet, robô: Pix = custo×1,30 e 10x = custo×1,40', () => {
  for (const cat of ['Acessório', 'Fone', 'MacBook', 'Apple Watch', 'iPad', 'Tablet', 'Robô', 'Console']) {
    const p = calcPrecos(100, cat, 'x');
    assert.equal(p.preco_pix, 130, cat);
    assert.equal(p.preco_link, 140, cat);
    assert.equal(p.preco_10x, 14, cat);
  }
});

test('celular não muda: R$650 até 4.000 de custo e R$850 acima', () => {
  assert.equal(calcPrecos(4000, 'iPhone', 'iPhone 16 Pro').preco_pix, 4650);
  assert.equal(calcPrecos(4001, 'iPhone', 'iPhone 16 Pro').preco_pix, 4851);
  assert.equal(calcPrecos(1540, 'Xiaomi', 'Note15 5G 8/256').preco_pix, 2190);
});

test('na categoria Xiaomi, Redmi Pad, Buds e robô contam como não-celular', () => {
  assert.equal(ehCelular('Xiaomi', 'Redmi Pad 2 256GB cinza'), false);
  assert.equal(ehCelular('Xiaomi', 'Redmi Buds 6'), false);
  assert.equal(ehCelular('Xiaomi', 'Redmi Note 14 Pro 5G'), true);
  assert.equal(ehCelular('iPhone', 'iPhone 15 Pro Max'), true);
});

test('reprecificar só mexe em não-celular e respeita produto sem custo', () => {
  const cat = { produtos: [
    { codigo: 'ACS-1', nome: 'Cabo', categoria: 'Acessório', custo: 60, preco_pix: 120, preco_link: 140.4 },
    { codigo: 'IPH-1', nome: 'iPhone 13', categoria: 'iPhone', custo: 2000, preco_pix: 2650 },
    { codigo: 'ACS-2', nome: 'Capa', categoria: 'Acessório', preco_pix: 50 },
  ] };
  const m = reprecificar(cat);
  assert.deepEqual(m.map((x) => x.codigo), ['ACS-1']);
  assert.equal(cat.produtos[0].preco_pix, 78);
  assert.equal(cat.produtos[0].preco_10x, 8.4);
  assert.equal(cat.produtos[1].preco_pix, 2650);
});
