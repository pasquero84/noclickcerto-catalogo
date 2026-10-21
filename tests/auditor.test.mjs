/**
 * Auditor de preço — pares de comparação.
 *
 *   bun test tests/auditor.test.mjs
 *
 * Caso real de 21/10: a EasyStore trouxe AirPods Max (R$2.650/2.850) e Apple
 * Watch Ultra 3 (R$4.450). O auditor passou a comparar o AirPods Pro 3 (R$1.299)
 * com os Max e o Apple Watch SE 3 (R$1.499) com o Ultra 3 — e travaria os dois
 * em "Consultar Disponibilidade", tirando de venda produto com preço certo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditarCatalogo } from '../scripts/auditor.mjs';

const p = (codigo, nome, categoria, custo) => ({ codigo, nome, categoria, condicao: 'Lacrado', custo });

test('AirPods Pro não é par de AirPods Max; Watch SE não é par de Watch Ultra', () => {
  const produtos = [
    p('FNE-0001', 'Buds 5 Pro', 'Fone', 500),
    p('FNE-0002', 'AirPods Pro 3', 'Fone', 1299),
    p('FNE-0003', 'AirPods Max 2', 'Fone', 2850),
    p('FNE-0004', 'AirPods Max', 'Fone', 2650),
    p('APW-0005', 'Apple Watch SE 3 GPS 40mm S/M MidNight', 'Apple Watch', 1499),
    p('APW-0006', 'Apple Watch Series 11 42mm', 'Apple Watch', 2900),
    p('APW-0007', 'Apple Watch Ultra 3', 'Apple Watch', 4450),
    p('APW-0008', 'Apple Watch Ultra 3 Titânio', 'Apple Watch', 4600),
  ];
  assert.deepEqual(auditarCatalogo(produtos).map((r) => r.produto.codigo), []);
});

test('continua pegando erro de digitação de verdade (17 Pro Max a R$700)', () => {
  const produtos = [
    p('IPH-0001', 'iPhone 17 Pro Max 256GB Laranja', 'iPhone', 7050),
    p('IPH-0002', 'iPhone 17 Pro Max 256GB Azul', 'iPhone', 6950),
    p('IPH-0003', 'iPhone 17 Pro 256GB Branco', 'iPhone', 6450),
    p('IPH-0004', 'iPhone 17 Pro Max 256GB Branco', 'iPhone', 700),
  ];
  assert.deepEqual(auditarCatalogo(produtos).map((r) => r.produto.codigo), ['IPH-0004']);
});

test('Apple Watch Ultra a R$450 (preço cortado) continua travado', () => {
  const produtos = [
    p('APW-0007', 'Apple Watch Ultra 3', 'Apple Watch', 4450),
    p('APW-0008', 'Apple Watch Ultra 3 Titânio', 'Apple Watch', 4600),
    p('APW-0009', 'Apple Watch Ultra 2', 'Apple Watch', 3900),
    p('APW-0010', 'Apple Watch Ultra 3 Preto', 'Apple Watch', 450),
  ];
  assert.deepEqual(auditarCatalogo(produtos).map((r) => r.produto.codigo), ['APW-0010']);
});
