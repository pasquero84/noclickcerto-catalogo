/**
 * Os três portões que faltavam para o catálogo — nome, código e preço.
 *
 *   bun test tests/validar-catalogo.test.mjs
 *
 * Os casos ruins não são inventados: todos saíram do catálogo que estava no ar
 * em 30/09/2026 (evidência em docs/evidencia-catalogo-2026-09-30/). Os casos
 * bons são produtos reais do mesmo arquivo — se algum deles for barrado, a
 * regra está apertada demais e travaria publicação legítima.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { nomeCorrompido, precoDesproporcional, validarEstrutura, relatorioEstrutura } from "../scripts/validar-catalogo.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

test("nome: fragmento da lista do fornecedor é barrado", () => {
  const reais = [
    ["• 16 Pro 128GB — R$ 3.", "marcador de lista"],
    ["⚡ Cabo Lightning:", "marcador de lista"],
    ["ista atualizada  05/06/", "frase cortada"],
    ["SILVE", "só a cor"],
    ["LARANJA", "só a cor"],
    ["SKY BLUE", "só a cor"],
    ["ROSA.", "só a cor"],
    ["Dorudo.", "sobra de texto"],
    ["Branco .", "só a cor"],
  ];
  for (const [nome, porque] of reais) {
    assert.ok(nomeCorrompido(nome), `deveria barrar (${porque}): ${JSON.stringify(nome)}`);
  }
  assert.ok(nomeCorrompido(""), "nome vazio");
  assert.ok(nomeCorrompido(null), "nome ausente");
  assert.ok(nomeCorrompido(42), "nome não-texto");
});

test("nome: produto de verdade passa — inclusive os que começam com minúscula", () => {
  const legitimos = [
    "iPhone 17 Pro Max 256GB Japonês Laranja",
    "iPad Air 11 M3 128GB Azul",
    "iMac 24 M4 256GB Prata",
    "MacBook Air M4 13 256GB Meia-noite",
    "Apple Watch Series 11 46mm Preto",
    "Xiaomi Redmi Note 14 256GB Verde",
    "AirPods Pro 3 USB-C",
    "AirTag Pack com 4 unidades",
    "Buds 5 Pro",
    "AirPods Max",
  ];
  for (const nome of legitimos) {
    assert.equal(nomeCorrompido(nome), null, `barrou nome bom: ${JSON.stringify(nome)} → ${nomeCorrompido(nome)}`);
  }
});

test("preço: margem de aparelho num acessório é barrada", () => {
  // O caso que motivou a trava: cabo de R$15 anunciado por R$665.
  assert.ok(precoDesproporcional({ codigo: "ACS-0010", categoria: "Acessório", custo: 15, preco_pix: 665 }));
  assert.ok(precoDesproporcional({ codigo: "ACS-0010", categoria: "Acessório", custo: 40, preco_pix: 690 }));
  assert.ok(precoDesproporcional({ codigo: "ACS-0010", categoria: "Acessório", custo: 60, preco_pix: 710 }));
  // iPhone com custo de acessório: o custo veio errado da lista.
  assert.ok(precoDesproporcional({ codigo: "IPH-0090", categoria: "iPhone", custo: 100, preco_pix: 750 }));
  // Acessório de R$6.600: é iPhone americano com a categoria errada (ACS-0011 real).
  assert.ok(precoDesproporcional({ codigo: "ACS-0011", categoria: "Acessório", custo: 6600, preco_pix: 7450 }));
  assert.ok(precoDesproporcional({ codigo: "ACS-0011", categoria: "Acessório", custo: 1880, preco_pix: 2530 }));
  // Dados faltando não passam calados.
  assert.ok(precoDesproporcional({ categoria: "iPhone", custo: 0, preco_pix: 650 }));
  assert.ok(precoDesproporcional({ categoria: "iPhone", custo: 1000 }));
});

test("preço: aparelho com margem normal passa", () => {
  const ok = [
    { categoria: "iPhone", custo: 7050, preco_pix: 7900 },   // margem 850
    { categoria: "iPhone", custo: 990, preco_pix: 1640 },    // seminovo barato, margem 650 = 1,7x
    { categoria: "iPad", custo: 2500, preco_pix: 3150 },
    { categoria: "MacBook", custo: 6000, preco_pix: 6850 },
    // Acessório com markup de acessório: AirTag Pack real (custo 430 → 860, 2x).
    // Margem alta em acessório é normal; o que não é normal é acessório caro.
    { categoria: "Acessório", custo: 430, preco_pix: 860 },
    { categoria: "Fone", custo: 500, preco_pix: 1000 },
  ];
  for (const p of ok) {
    assert.equal(precoDesproporcional(p), null, `barrou preço bom: ${JSON.stringify(p)} → ${precoDesproporcional(p)}`);
  }
});

test("código: repetido é barrado, e o motivo diz quem já usava", () => {
  const problemas = validarEstrutura([
    { codigo: "ACS-0011", nome: "iPhone 16 256GB Americano", categoria: "iPhone", custo: 3750, preco_pix: 4400 },
    { codigo: "ACS-0011", nome: "iPhone 15 256GB Americano", categoria: "iPhone", custo: 2600, preco_pix: 3250 },
  ]);
  const dup = problemas.filter((p) => p.tipo === "codigo");
  assert.equal(dup.length, 1, "só a segunda ocorrência é problema");
  assert.match(dup[0].motivo, /código repetido/);
  assert.match(dup[0].motivo, /iPhone 16 256GB Americano/, "diz quem já ocupava o código");
});

test("oculto não conta: lixo antigo guardado não trava a publicação", () => {
  assert.deepEqual(validarEstrutura([
    { codigo: "IPH-0001", nome: "iPhone 17 Pro Max 256GB Laranja", categoria: "iPhone", custo: 7050, preco_pix: 7900 },
    { codigo: "IPH-0077", nome: "• 16 Pro 128GB — R$ 3.", categoria: "iPhone", custo: 990, preco_pix: 1640, oculto: true },
    { codigo: "ACS-0011", nome: "SILVE", categoria: "Acessório", custo: 6600, preco_pix: 7450, oculto: true },
    { codigo: "ACS-0011", nome: "LARANJA", categoria: "Acessório", custo: 6350, preco_pix: 7000, oculto: true },
  ]), []);
});

test("código: produto sem código é barrado", () => {
  const problemas = validarEstrutura([{ nome: "iPhone 17 Pro Max 256GB Preto", categoria: "iPhone", custo: 7050, preco_pix: 7900 }]);
  assert.ok(problemas.some((p) => p.tipo === "codigo" && /sem código/.test(p.motivo)));
});

test("catálogo íntegro passa inteiro e não gera relatório", () => {
  const bom = [
    { codigo: "IPH-0001", nome: "iPhone 17 Pro Max 256GB Japonês Laranja", categoria: "iPhone", custo: 7050, preco_pix: 7900 },
    { codigo: "IPH-0002", nome: "iPhone 16 Pro 128GB Titânio Natural", categoria: "iPhone", custo: 4500, preco_pix: 5350 },
    { codigo: "ACS-0001", nome: "AirTag Pack com 4 unidades", categoria: "Acessório", custo: 430, preco_pix: 860 },
  ];
  assert.deepEqual(validarEstrutura(bom), []);
  assert.match(relatorioEstrutura([]), /ok/);
});

test("relatório agrupa por tipo e diz que nada foi publicado", () => {
  const txt = relatorioEstrutura(validarEstrutura([
    { codigo: "ACS-0010", nome: "⚡ Cabo Lightning:", categoria: "Acessório", custo: 15, preco_pix: 665 },
    { codigo: "ACS-0010", nome: "⚡ Fonte 20W:", categoria: "Acessório", custo: 40, preco_pix: 690 },
  ]));
  assert.match(txt, /PUBLICAÇÃO BARRADA/);
  assert.match(txt, /NOME CORROMPIDO/);
  assert.match(txt, /CÓDIGO DUPLICADO/);
  assert.match(txt, /PREÇO DESPROPORCIONAL/);
  assert.match(txt, /Nenhum produto foi publicado/);
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTADO REAL — o catálogo de verdade tem que passar. Em 30/09/2026 acusava
 * 30 nomes, 15 códigos repetidos e 24 preços; em 21-24/10 o lixo foi ocultado
 * (oculto=true) e os nomes de 01/09 limpos, e o teste ficou verde.
 * ─────────────────────────────────────────────────────────────────────────────
 */
test("o catalogo.json do repositório está estruturalmente limpo", () => {
  const cat = JSON.parse(readFileSync(join(RAIZ, "catalogo.json"), "utf8"));
  const problemas = validarEstrutura(cat.produtos);
  assert.equal(problemas.length, 0, `\n\n${relatorioEstrutura(problemas)}\n`);
});
