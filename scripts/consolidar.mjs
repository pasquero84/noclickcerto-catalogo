#!/usr/bin/env bun
// ============================================================
// CONSOLIDADOR DE FORNECEDORES — NoClickCerto
//
// Regra de negócio definida pelo Stefano em 31/08/2026 (INVERTEU a antiga,
// que ficava com o menor custo):
//
//   Mesmo produto em mais de um fornecedor  ->  UM cadastro só
//   Preço  ->  o do fornecedor MAIS CARO
//   Cores  ->  união de todas as cores de todos os fornecedores
//
// Por quê (palavras dele): margem maior pra dar desconto na negociação, e
// como a venda é casada (cliente paga antes, ele compra depois), ele ainda
// garimpa o preço menor na hora da compra. "Eu ganho mais na compra do que
// na própria venda."
//
// uso: bun scripts/consolidar.mjs <arq1.txt:FOR001> <arq2.txt:FOR002> [--json]
// ============================================================

import { parseTabelaFornecedor } from './parse-fornecedor.mjs';

const RUIDO_NOME = [
  /\b(ll\/?a|lla)\b/gi,        // código de origem americana
  /\bjapon[eê]s\b/gi,
  /\bglobal\b/gi,
  /\([^)]*\)/g,                 // "(6GPU/5GPU/8 RAM/256 GB SSD)"
  /\bssd\b/gi,
  /\bram\b/gi,
  /\bgpu\b/gi,
];

/**
 * Identidade do produto: o que define "é o mesmo aparelho".
 * "17PRO MAX 256GB LLA" (EasyStore) e "iPhone 17 Pro Max 256GB LL/A" (Trend)
 * têm que cair na MESMA chave, senão duplica no catálogo.
 */
export function chaveProduto({ nomeOriginal, categoria, condicao }) {
  let n = nomeOriginal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  // Capacidade sai ANTES de limpar ruído: o Trend escreve a capacidade DENTRO
  // do parêntese ("Macbook Neo (6GPU/5GPU/8 RAM/256 GB SSD)") e o parêntese é
  // justamente um dos ruídos removidos. Ler depois perdia a capacidade e o
  // produto não consolidava com o "MACBOOK NEO 8/256" do outro fornecedor.
  let capacidade = null;
  const mTb = n.match(/\b(\d{1,2})\s*tb\b/);
  const mGb = n.match(/\b(\d{2,4})\s*gb\b/);
  const mRam = n.match(/\b\d{1,2}\s*\/\s*(\d{2,4})\b/);
  if (mTb) capacidade = `${parseInt(mTb[1], 10) * 1024}`;
  else if (mGb) capacidade = mGb[1];
  else if (mRam) capacidade = mRam[1];

  for (const re of RUIDO_NOME) n = n.replace(re, ' ');

  // "iphone 17 pro" e "17 pro" são o mesmo — o prefixo da marca é opcional
  // nas tabelas, então sai da chave.
  n = n.replace(/\b(iphone|apple)\b/g, ' ');

  // Separa número colado em letra: "17pro" -> "17 pro", "15c" fica "15 c".
  n = n
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2');

  // Tira só a capacidade do miolo — ela já virou campo próprio.
  // ATENÇÃO: 4G/5G NÃO sai daqui. Tirar isso fez "Note15 4G" (R$1.230) e
  // "Note15 5G" (R$1.540) colidirem na mesma chave, e a regra do maior preço
  // vendeu o 4G pelo preço do 5G. São aparelhos diferentes.
  n = n
    .replace(/\b\d{2,4}\s*(gb|tb)\b/g, ' ')
    .replace(/\b\d{1,2}\s*\/\s*\d{2,4}\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Cores que vazaram pro nome (comum nas linhas de Xiaomi) não entram na
  // identidade — elas são variação, não produto diferente.
  const CORES_NO_NOME = /\b(preto|branco|azul|verde|vermelho|rosa|roxo|amarelo|laranja|dourado|prata|silver|cinza|grafite|desert|citrus)\b/g;
  n = n.replace(CORES_NO_NOME, ' ').replace(/\s+/g, ' ').trim();

  return [categoria, condicao, n, capacidade || '?'].join('|');
}

/**
 * Aplica a regra: um cadastro, preço do mais caro, cores somadas.
 */
export function consolidar(listas) {
  const porChave = new Map();

  for (const produtos of listas) {
    for (const p of produtos) {
      const chave = chaveProduto(p);
      const custos = p.variacoes.map((v) => v.custo).filter((c) => c != null);
      if (!custos.length) continue;
      const maiorAqui = Math.max(...custos);

      if (!porChave.has(chave)) {
        porChave.set(chave, {
          chave,
          nome: p.nomeOriginal,
          categoria: p.categoria,
          condicao: p.condicao,
          bateria: p.bateria,
          custo: maiorAqui,
          fornecedorPreco: p.fornecedor, // de quem veio o preço que ficou
          cores: new Set(),
          fornecedores: new Set(),
          precosPorFornecedor: {},
        });
      }

      const alvo = porChave.get(chave);

      // REGRA: fica o MAIS CARO.
      if (maiorAqui > alvo.custo) {
        alvo.custo = maiorAqui;
        alvo.fornecedorPreco = p.fornecedor;
      }

      // REGRA: cores somam.
      for (const v of p.variacoes) if (v.cor) alvo.cores.add(v.cor);
      if (p.fornecedor) {
        alvo.fornecedores.add(p.fornecedor);
        alvo.precosPorFornecedor[p.fornecedor] = maiorAqui;
      }
      if (!alvo.bateria && p.bateria) alvo.bateria = p.bateria;
      // Nome mais descritivo ganha (o Trend escreve por extenso, ajuda o cliente).
      if (p.nomeOriginal.length > alvo.nome.length) alvo.nome = p.nomeOriginal;
    }
  }

  return [...porChave.values()]
    .map((p) => ({
      ...p,
      cores: [...p.cores].sort(),
      fornecedores: [...p.fornecedores].sort(),
    }))
    .sort((a, b) => b.custo - a.custo);
}

// ---- CLI ----
if (import.meta.main) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!args.length) {
    console.error('uso: bun scripts/consolidar.mjs <arq.txt:FOR001> [arq2.txt:FOR002]');
    process.exit(1);
  }

  const listas = [];
  for (const arg of args) {
    const [arquivo, fornecedor] = arg.split(':');
    const texto = await Bun.file(arquivo).text();
    listas.push(parseTabelaFornecedor(texto, { fornecedor: fornecedor || arquivo }));
  }

  const consolidado = consolidar(listas);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(consolidado, null, 2));
  } else {
    const duplicados = consolidado.filter((p) => p.fornecedores.length > 1);
    console.log(
      `${consolidado.length} produtos únicos · ${duplicados.length} vieram de mais de um fornecedor\n`
    );
    for (const p of consolidado) {
      const multi = p.fornecedores.length > 1;
      const precos = Object.entries(p.precosPorFornecedor)
        .map(([f, v]) => `${f} R$${v}`)
        .join(' vs ');
      console.log(
        `${multi ? '🔀' : '  '} [${p.categoria}/${p.condicao}] ${p.nome}`
      );
      console.log(
        `     custo R$${p.custo}${multi ? `  (${precos} → fica o maior)` : ''}`
      );
      if (p.cores.length) console.log(`     cores: ${p.cores.join(', ')}`);
    }
  }
}
