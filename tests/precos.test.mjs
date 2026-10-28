// Regra de preço aprovada pelo Stefano em 28/10/2026:
//   celular e aparelho (Watch, iPad, MacBook, tablet…): margem fixa R$650 até
//   4.000 de custo, R$850 acima;
//   acessório menor (fone, tag, caixinha de som, cabo) até R$4.000: 35% no Pix / 46% em 10x;
//   todo preço termina em ,90.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcPrecos, ehCelular, ehAcessorio, final90 } from '../scripts/precos.mjs';
import { reprecificar } from '../scripts/reprecificar.mjs';
import { ajustarTabela } from '../scripts/ajustes-tabela.mjs';

test('final ,90 sempre pra cima', () => {
  assert.equal(final90(143), 143.9);
  assert.equal(final90(143.9), 143.9);
  assert.equal(final90(143.91), 144.9);
  assert.equal(final90(1233.7), 1233.9);
  assert.equal(final90(3800), 3800.9);
});

test('acessório menor até R$4.000: Pix = custo×1,35 e 10x = custo×1,46, em ,90', () => {
  for (const cat of ['Acessório', 'Fone']) {
    const p = calcPrecos(110, cat, 'x');
    assert.equal(p.preco_pix, 148.9, cat); // 148,50
    assert.equal(p.preco_link, 160.9, cat); // 160,60
    assert.equal(p.preco_10x, 16.09, cat);
  }
  assert.equal(calcPrecos(400, 'Xiaomi', 'Redmi Buds 6').preco_pix, 540.9);
});

test('Apple Watch, iPad, MacBook, tablet, robô: margem antiga (R$650/R$850, cartão +11%, link +17%)', () => {
  for (const cat of ['Apple Watch', 'iPad', 'MacBook', 'Tablet', 'Robô', 'Console']) {
    const p = calcPrecos(2949, cat, 'x');
    assert.equal(p.preco_pix, 3599.9, cat);
    assert.equal(p.preco_cartao, 3995.9, cat); // 3599,90 × 1,11 = 3995,89
    assert.equal(p.preco_link, 4211.9, cat); // 3599,90 × 1,17 = 4211,88
  }
  assert.equal(calcPrecos(7750, 'MacBook', 'MacBook Air M5').preco_pix, 8600.9);
  assert.equal(calcPrecos(1275, 'Xiaomi', 'Redmi Pad 2 256GB cinza').preco_pix, 1925.9);
});

test('celular: R$650 até 4.000 de custo e R$850 acima, em ,90', () => {
  assert.equal(calcPrecos(4000, 'iPhone', 'iPhone 16 Pro').preco_pix, 4650.9);
  assert.equal(calcPrecos(4001, 'iPhone', 'iPhone 16 Pro').preco_pix, 4851.9);
  assert.equal(calcPrecos(1540, 'Xiaomi', 'Note15 5G 8/256').preco_pix, 2190.9);
});

test('na categoria Xiaomi, Redmi Pad, Buds e robô contam como não-celular; só Buds é acessório', () => {
  assert.equal(ehAcessorio('Xiaomi', 'Redmi Buds 6'), true);
  assert.equal(ehAcessorio('Xiaomi', 'Redmi Pad 2'), false);
  assert.equal(ehAcessorio('Apple Watch', 'Apple Watch S12 46mm'), false);
  assert.equal(ehAcessorio('Acessório', 'AirTag Pack com 4'), true);
  assert.equal(ehCelular('Xiaomi', 'Redmi Pad 2 256GB cinza'), false);
  assert.equal(ehCelular('Xiaomi', 'Redmi Buds 6'), false);
  assert.equal(ehCelular('Xiaomi', 'Redmi Note 14 Pro 5G'), true);
  assert.equal(ehCelular('iPhone', 'iPhone 15 Pro Max'), true);
});

test('reprecificar passa todo produto visível com custo (celular também, pelo ,90)', () => {
  const cat = { produtos: [
    { codigo: 'ACS-1', nome: 'Cabo', categoria: 'Acessório', custo: 60, preco_pix: 120, preco_link: 140.4 },
    { codigo: 'IPH-1', nome: 'iPhone 13', categoria: 'iPhone', custo: 2000, preco_pix: 2650 },
    { codigo: 'ACS-2', nome: 'Capa', categoria: 'Acessório', preco_pix: 50 },
    { codigo: 'ACS-3', nome: 'Lixo', categoria: 'Acessório', custo: 15, preco_pix: 30, oculto: true },
  ] };
  const m = reprecificar(cat);
  assert.deepEqual(m.map((x) => x.codigo), ['ACS-1', 'IPH-1']);
  assert.equal(cat.produtos[0].preco_pix, 81.9); // 60 × 1,35 = 81
  assert.equal(cat.produtos[0].preco_10x, 8.79); // 60 × 1,46 = 87,60 -> 87,90
  assert.equal(cat.produtos[1].preco_pix, 2650.9);
  assert.equal(cat.produtos[3].preco_pix, 30);
  assert.deepEqual(reprecificar(cat), []); // segunda passada não muda nada
});

test('ajustes: duplicado some, o que fica leva foto e custo mais recente; categoria e nome corrigidos', () => {
  const cat = { produtos: [
    { codigo: 'ACS-0013', nome: 'Apple Pencil USB-C', categoria: 'Acessório', condicao: 'Lacrado', custo: 480, cotacoes: { FOR001: { custo: 480, data: '2026-10-28' } } },
    { codigo: 'ACS-0015', nome: 'Pencil USBC', categoria: 'Acessório', condicao: 'Lacrado', custo: 490, foto_url: '/p.jpg', cotacoes: { FOR002: { custo: 490, data: '2026-10-28' } } },
    { codigo: 'APW-0011', nome: 'Apple Watch Ultra 3 49mm', categoria: 'Apple Watch', condicao: 'Lacrado', custo: 4549, cotacoes: { FOR002: { custo: 4549, data: '2026-10-27' } } },
    { codigo: 'APW-0017', nome: 'Apple Watch Ultra 3 49mm Caixa Natural', categoria: 'Apple Watch', condicao: 'Lacrado', custo: 4449, cotacoes: { FOR002: { custo: 4449, data: '2026-10-28' } } },
    { codigo: 'XMI-0078', nome: 'Realme note 80 4/128 preto azul', categoria: 'Xiaomi', condicao: 'Lacrado', custo: 840 },
    { codigo: 'IPH-0028', nome: 'iPhone 15 128GB Preto', categoria: 'iPhone', condicao: 'Seminovo', custo: 2475 },
  ] };
  ajustarTabela(cat);
  const [pencil, pencil2, watch, watch2, realme, iph] = cat.produtos;
  assert.equal(pencil.custo, 490); // maior entre fornecedores
  assert.equal(pencil.foto_url, '/p.jpg');
  assert.equal(pencil2.oculto, true);
  assert.equal(pencil2.duplicado_de, 'ACS-0013');
  assert.equal(watch.custo, 4449); // mesmo fornecedor: vale a cotação mais nova
  assert.equal(watch2.oculto, true);
  assert.equal(realme.categoria, 'Realme');
  assert.equal(iph.nome, 'iPhone 15 128GB Preto Seminovo');
  assert.deepEqual(ajustarTabela(cat), []); // roda de novo sem mexer
});
