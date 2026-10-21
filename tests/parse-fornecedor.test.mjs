/**
 * Parser das tabelas de fornecedor — testes com o texto REAL dos grupos.
 *
 *   bun test tests/parse-fornecedor.test.mjs
 *
 * Nenhum exemplo é inventado: cada arquivo em tests/fixtures/ é a mensagem
 * como chegou no WhatsApp (copiada do leitor ~/wa-fornecedores/listas/ ou do
 * texto que o Stefano colou na sessão). Os defeitos que estes testes travam
 * aconteceram de verdade:
 *
 *   - 28/09 e 20/10: o formato novo da EasyStore (`• 16 Pro Max 256GB — R$ 4.650`)
 *     virou produto "• 16 Pro Max 256GB — R$ 4." custando R$650 — o regex de
 *     preço lia só o "650" depois do ponto de milhar. IPH-0078 ficou à venda
 *     por R$1.640 sendo um 14 Pro Max de R$2.990.
 *   - 19/10: a tabela do Trend (`🔘*Laranja* *R$7450*`) era ignorada inteira —
 *     o asterisco do negrito do WhatsApp no fim da linha escondia o preço.
 *   - 21/10: a EasyStore mandou "novidades" com cor em emoji (`💙 256GB — R$ 6.640`)
 *     e virou "ACS-0016 256GB — R$ 6." como acessório.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTabelaFornecedor,
  contaLinhasComPreco,
  nomeDeProdutoValido,
} from '../scripts/parse-fornecedor.mjs';
import { consolidar } from '../scripts/consolidar.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const AMOSTRAS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'amostras');
const ler = (dir, arq) => readFileSync(join(dir, arq), 'utf8');

// Resumo comparável: "nome | categoria/condicao | cor:preço, cor:preço"
function resumo(produtos) {
  return produtos.map((p) => {
    const vs = p.variacoes.map((v) => `${v.cor ?? '—'}:${v.custo}`).join(', ');
    return `${p.nomeOriginal} | ${p.categoria}/${p.condicao} | ${vs}`;
  });
}

// Nenhum produto pode sair com cara de lixo, em nenhum arquivo real.
function semLixo(produtos) {
  for (const p of produtos) {
    assert.equal(nomeDeProdutoValido(p.nomeOriginal), true, `nome lixo: "${p.nomeOriginal}"`);
    assert.doesNotMatch(p.nomeOriginal, /R\$|—|^[•\-*]/, `resto de lista no nome: "${p.nomeOriginal}"`);
    for (const v of p.variacoes) assert.ok(v.custo >= 100, `preço quebrado em "${p.nomeOriginal}": ${v.custo}`);
  }
}

test('EasyStore 20/10 (seminovos, formato novo com • e 🔋 | cores)', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'easystore-2026-10-20-seminovos.txt'), { fornecedor: 'FOR001' });
  semLixo(ps);
  assert.deepEqual(resumo(ps), [
    'iPhone 16 Pro Max 256GB | iPhone/Seminovo | Preto:4650, Desert:4650',
    'iPhone 16 Pro 128GB | iPhone/Seminovo | Preto:3700, Desert:3700, Natural:3700',
    'iPhone 16 128GB | iPhone/Seminovo | Azul:3350, Preto:3350',
    'iPhone 15 Pro Max 256GB | iPhone/Seminovo | Preto:3800, Azul:3800, Natural:3800',
    'iPhone 15 Pro 128GB | iPhone/Seminovo | Preto:3300, Azul:3300',
    'iPhone 15 128GB | iPhone/Seminovo | Preto:2440, Azul:2440, Rosa:2440',
    'iPhone 14 Pro Max 256GB | iPhone/Seminovo | Preto:3200, Dourado:3200',
    'iPhone 14 Pro Max 128GB | iPhone/Seminovo | Roxo:2990, Preto:2990',
    'iPhone 14 Pro 256GB | iPhone/Seminovo | Preto:2680, Roxo:2680',
    'iPhone 14 128GB | iPhone/Seminovo | Azul:1825, Preto:1825, Roxo:1825, Branco:1825',
    'iPhone 14 256GB | iPhone/Seminovo | Preto:1990, Branco:1990',
    'iPhone 13 Pro Max 128GB | iPhone/Seminovo | Branco:2520, Azul:2520',
    'iPhone 13 Pro 128GB | iPhone/Seminovo | Preto:2250, Azul:2250',
    'iPhone 13 128GB | iPhone/Seminovo | Azul:1650, Preto:1650, Branco:1650, Rosa:1650',
    'iPhone 13 256GB | iPhone/Seminovo | Azul:1750, Preto:1750, Branco:1750, Verde:1750',
    'iPhone 12 128GB | iPhone/Seminovo | Branco:1320, Preto:1320',
    // "🔥 IPHONE 12 pro" + "• 12 128 GB — R$ 1650": o "Pro" vem do cabeçalho;
    // "Dorudo" é o jeito que a EasyStore escreve Dourado.
    'iPhone 12 Pro 128GB | iPhone/Seminovo | Dourado:1650',
  ]);
  assert.equal(ps[0].bateria, '90%+');
  assert.equal(ps[3].bateria, '85%+');
});

test('EasyStore 28/09 (mesmo formato novo — origem do IPH-0077..0090)', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'easystore-2026-09-28.txt'), { fornecedor: 'FOR001' });
  semLixo(ps);
  assert.equal(ps.length, 14);
  assert.deepEqual(resumo(ps).slice(0, 2), [
    'iPhone 16 Pro Max 256GB | iPhone/Seminovo | Preto:4800, Desert:4800',
    'iPhone 16 Pro 128GB | iPhone/Seminovo | Preto:3990, Desert:3990, Natural:3990',
  ]);
  assert.equal(resumo(ps).at(-1), 'iPhone 12 Pro Max 256GB | iPhone/Seminovo | Branco:2100');
});

test('EasyStore 21/10 (novidades: cor em emoji, capacidade — preço, acessórios)', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'easystore-2026-10-21-novidades.txt'), { fornecedor: 'FOR001' });
  semLixo(ps);
  assert.deepEqual(resumo(ps), [
    'iPhone 18 Pro Max 256GB | iPhone/Lacrado | Burgundy:9190',
    'iPhone 17 Pro Max 256GB | iPhone/Lacrado | Azul:6640, Branco:6850',
    'iPhone 17 Pro 256GB | iPhone/Lacrado | Laranja:6390, Azul:6390',
    'iPhone 16 Pro Max 256GB | iPhone/Lacrado | Preto:6180',
    'iPhone 15 Pro Max 256GB CPO | iPhone/Lacrado | Branco:5100, Preto:5100',
    'Apple Watch Ultra 3 | Apple Watch/Lacrado | —:4450',
    'Apple Pencil USB-C | Acessório/Lacrado | —:499',
    'Apple Pencil 2 | Acessório/Lacrado | —:475',
    'AirPods Max | Fone/Lacrado | Azul:2650, Laranja:2650, Roxo:2650, Starlight:2650',
    'AirPods Max 2 | Fone/Lacrado | Azul:2850, Roxo:2850',
    'iPad 11 128GB | iPad/Lacrado | Rosa:2650, Azul:2650',
    'MacBook Neo 8/256 | MacBook/Lacrado | Indigo:4600',
    'MacBook Air M5 16/512 | MacBook/Lacrado | Midnight:7580',
  ]);
});

test('Trend 19/10 (preço em *R$X*, cores com |, seções de garantia)', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'trend-2026-10-19.txt'), { fornecedor: 'FOR002' });
  semLixo(ps);
  assert.deepEqual(resumo(ps), [
    'iPhone 17 Pro Max 512GB | iPhone/Seminovo | Laranja:7450',
    'iPhone 17 Pro Max 256GB | iPhone/Seminovo | Silver:6500',
    'iPhone 17 Pro 512GB | iPhone/Seminovo | Azul:6500',
    'iPhone 16 128GB | iPhone/Seminovo | Preto:3250',
    'iPhone 17 Pro Max 256GB | iPhone/Seminovo | Laranja:6450, Silver:6450',
    'iPhone 16 Pro Max 256GB | iPhone/Seminovo | Desert:4300',
    'iPhone 16 128GB | iPhone/Seminovo | Branco:3250',
    'iPhone 15 128GB | iPhone/Seminovo | Preto:2400',
    'iPhone 16 Pro Max 256GB | iPhone/Seminovo | Desert:4250',
    'iPhone 15 128GB | iPhone/Seminovo | Rosa:2350',
    'iPhone 14 Pro 128GB | iPhone/Seminovo | Gold:2400',
    'iPhone 13 Pro 128GB | iPhone/Seminovo | Azul:2170, Branco:2170',
    'iPhone 12 Pro Max 128GB | iPhone/Seminovo | Dourado:1900, Branco:1900',
  ]);
});

test('Trend 19/10 consolidado: mesmo aparelho em 2 seções vira 1, fica o MAIOR preço', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'trend-2026-10-19.txt'), { fornecedor: 'FOR002' });
  const c = consolidar([ps]);
  assert.equal(c.length, 9); // 13 linhas, 4 aparelhos repetidos entre seções
  const pm256 = c.find((p) => p.nome === 'iPhone 17 Pro Max 256GB');
  assert.equal(pm256.custo, 6500);
  assert.deepEqual(pm256.cores, ['Laranja', 'Silver']);
  assert.equal(c.find((p) => p.nome === 'iPhone 16 Pro Max 256GB').custo, 4300);
  // A cotação guardada por fornecedor também é a MAIOR, não a da última seção
  // (bug pego no ensaio de 21/10: 17 Pro Max ia a R$6.450 em vez de R$6.500).
  assert.equal(pm256.precosPorFornecedor.FOR002, 6500);
  assert.equal(c.find((p) => p.nome === 'iPhone 16 Pro Max 256GB').precosPorFornecedor.FOR002, 4300);
});

test('EasyStore x Trend: mesmo aparelho dos dois casa na mesma chave (vale o MAIOR)', () => {
  const es = parseTabelaFornecedor(ler(FIX, 'easystore-2026-10-20-seminovos.txt'), { fornecedor: 'FOR001' });
  const tr = parseTabelaFornecedor(ler(FIX, 'trend-2026-10-19.txt'), { fornecedor: 'FOR002' });
  const c = consolidar([es, tr]);
  const p16pm = c.find((p) => p.chave.includes('|16 pro max|256'));
  assert.equal(p16pm.custo, 4650); // EasyStore 4650 > Trend 4300
  assert.equal(p16pm.fornecedorPreco, 'FOR001');
  const p15 = c.find((p) => p.chave === 'iPhone|Seminovo|15|128');
  assert.equal(p15.custo, 2440); // EasyStore 2440 > Trend 2400
  assert.deepEqual(p15.cores, ['Azul', 'Preto', 'Rosa']);
});

test('contaLinhasComPreco: o leitor do WhatsApp enxerga as tabelas novas', () => {
  // Antes: Trend dava 0 (ignorado) e o "R$ 4.650" contava como "650".
  assert.equal(contaLinhasComPreco(ler(FIX, 'trend-2026-10-19.txt')), 13);
  assert.equal(contaLinhasComPreco(ler(FIX, 'easystore-2026-10-20-seminovos.txt')), 17);
  assert.ok(contaLinhasComPreco(ler(FIX, 'easystore-2026-10-21-novidades.txt')) >= 12);
  assert.equal(contaLinhasComPreco('Bom dia! Chegou mercadoria 🔥'), 0);
});

test('nomeDeProdutoValido barra os lixos que foram ao ar', () => {
  for (const lixo of ['• 16 Pro 128GB — R$ 3.', 'Dorudo.', 'Branco .', 'SILVE', 'R$ 3.', '256GB — R$ 6.', 'Burgundy —', 'midnget', 'indigo', 'Preto / Azul']) {
    assert.equal(nomeDeProdutoValido(lixo), false, lixo);
  }
  for (const ok of ['iPhone 16 Pro Max 256GB', 'AirPods Max', 'Buds 5 Pro', 'Redmi15C 4/128 preto verde', 'Apple Pencil 2', 'MacBook Neo 8/256']) {
    assert.equal(nomeDeProdutoValido(ok), true, ok);
  }
});

// ---- regressão: formatos antigos (31/08 a 05/09) continuam funcionando ----

test('amostra EasyStore 31/08: Xiaomi com preço na linha, seminovo formato A, lacrado formato B', () => {
  const ps = parseTabelaFornecedor(ler(AMOSTRAS, 'easystore-20260831.txt'), { fornecedor: 'FOR001' });
  semLixo(ps);
  const r = resumo(ps);
  assert.equal(ps.length, 14);
  assert.equal(r[0], 'Redmi15C 4/128 preto verde | Xiaomi/Lacrado | —:780');
  assert.equal(r[6], 'Poco c71 3/64 Preto | Xiaomi/Lacrado | —:600');
  assert.equal(r[7], 'iPhone 16 Pro Max 256GB | iPhone/Seminovo | Preto:4800, Desert:4800');
  assert.equal(r[10], 'iPhone 17 Pro Max 256GB LLA | iPhone/Lacrado | Branco:7050, Azul:6950, Laranja:7125');
  assert.equal(r[12], 'iPhone 17 Air 256GB | iPhone/Lacrado | Dourado:5140');
  assert.equal(r[13], 'MacBook Neo 8/256 | MacBook/Lacrado | Silver:4690');
});

test('amostra Trend 31/08: nome por extenso, preço R$ colado', () => {
  const ps = parseTabelaFornecedor(ler(AMOSTRAS, 'trend-20260831.txt'), { fornecedor: 'FOR002' });
  semLixo(ps);
  assert.deepEqual(resumo(ps), [
    'iPhone 17 Pro Max 256GB LL/A | iPhone/Lacrado | Silver:6999',
    'iPhone 17 Pro 256GB LL/A | iPhone/Lacrado | Silver:6449',
    'MacBook Neo (6GPU/5GPU/8 RAM/256GB SSD) | MacBook/Lacrado | Citrus:4400, Silver:4750',
  ]);
});

test('EasyStore 01/09: "Dorudo.5140" e "Branco .3710" viram cor do aparelho, não produto', () => {
  const ps = parseTabelaFornecedor(ler(FIX, 'easystore-2026-09-01.txt'), { fornecedor: 'FOR001' });
  semLixo(ps);
  const r = resumo(ps);
  assert.ok(r.includes('iPhone 17 Air 256GB | iPhone/Lacrado | Dourado:5140'), r.join('\n'));
  assert.ok(r.includes('iPhone 17E 256GB | iPhone/Lacrado | Branco:3710, Preto:3710'), r.join('\n'));
  // "16 Pro128GB CPO" (capacidade colada) não pode jogar a cor no 16 PLUS de cima
  const plus = ps.find((p) => /16 Plus/i.test(p.nomeOriginal));
  assert.deepEqual(plus.variacoes.map((v) => v.cor), ['Azul', 'Verde']);
});

test('nenhum arquivo real gera produto lixo', () => {
  const arquivos = [
    [FIX, 'easystore-2026-09-01.txt'], [FIX, 'easystore-2026-09-02.txt'],
    [FIX, 'easystore-2026-09-04.txt'], [FIX, 'easystore-2026-09-05.txt'],
    [FIX, 'easystore-2026-09-28.txt'], [FIX, 'easystore-2026-10-20-seminovos.txt'],
    [FIX, 'easystore-2026-10-21-novidades.txt'], [FIX, 'trend-2026-10-19.txt'],
    [AMOSTRAS, 'easystore-20260831.txt'], [AMOSTRAS, 'trend-20260831.txt'],
  ];
  for (const [dir, arq] of arquivos) semLixo(parseTabelaFornecedor(ler(dir, arq)));
});
