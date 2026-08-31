#!/usr/bin/env bun
// ============================================================
// PARSER DE TABELA DE FORNECEDOR — NoClickCerto
//
// Lê o texto cru que os fornecedores mandam no WhatsApp e devolve produtos
// estruturados. Os fornecedores NÃO usam formato padrão, então o parser é
// stateful: guarda o "produto corrente" e associa as linhas seguintes.
//
// Dois formatos vistos em produção (31/08/2026):
//
//   A) preço na linha do nome, cores soltas embaixo (EasyStore seminovos)
//        16 pro max 256GB 🇺🇸 4800
//        🔋90%pra cima
//        PRETO
//        DESERT
//      -> 1 produto, 2 cores, mesmo preço
//
//   B) nome sem preço, uma linha por cor COM preço (EasyStore lacrados/Trend)
//        17PRO MAX 256GB LLA 🇺🇸
//        Branco 7050
//        Azul 6950
//      -> 1 produto, 2 cores, preço por cor (fica o MAIOR, ver consolidar.mjs)
//
// uso: bun scripts/parse-fornecedor.mjs <arquivo.txt> [--json]
// ============================================================

// Linhas que são cabeçalho de seção/ruído, nunca produto.
const RUIDO = [
  /^(lista|tabela|hor[áa]rio|aten[çc][ãa]o|obs|agradec|gostar[íi]amos|retirada|convite|entrar no grupo|ler mais|somente admins|algu[ée]m que)/i,
  /^(chegou+|chegoo+u+|dispon[íi]vel|novidade)s?!*$/i,
  /^(segunda|s[áa]bado|domingo|feriado)/i,
  /^\d{1,2}[h:]\d{0,2}\s*[àa]s/i,
  /^[\s\p{Emoji}\p{So}]*$/u,
];

// Cabeçalhos que definem a condição/categoria dos produtos que vêm abaixo.
const SECOES = [
  { re: /iphones?\s*seminovos?/i, condicao: 'Seminovo', categoria: 'iPhone' },
  { re: /iphones?\s*lacrados?/i, condicao: 'Lacrado', categoria: 'iPhone' },
  { re: /xiaomi/i, condicao: 'Lacrado', categoria: 'Xiaomi' },
  { re: /macbook/i, condicao: 'Lacrado', categoria: 'MacBook' },
  { re: /ipad/i, condicao: 'Lacrado', categoria: 'iPad' },
  { re: /apple\s*watch/i, condicao: 'Lacrado', categoria: 'Apple Watch' },
];

// Cores conhecidas — usado pra decidir se uma linha é "cor + preço" ou um
// produto novo. Lista cresce conforme aparecem cores novas nas tabelas.
const CORES = [
  'preto', 'branco', 'azul', 'verde', 'vermelho', 'rosa', 'roxo', 'amarelo',
  'laranja', 'dourado', 'dourdo', 'prata', 'silver', 'gold', 'grafite', 'cinza',
  'desert', 'titanio', 'titânio', 'natural', 'citrus', 'meia noite', 'estelar',
  'lilas', 'lilás', 'bege', 'creme', 'ultramarine', 'teal', 'sage', 'space',
];

// Preço no fim da linha. O (?<![\d/]) evita casar com o "256" de "8/256"
// (RAM/armazenamento) — bug real visto na 1ª rodada: "MACBOOK NEO 8/256"
// virava nome "MACBOOK NEO 8/" com preço 256.
const RE_PRECO = /(?<![\d/])(?:r\$\s*)?(\d{2,3}(?:\.\d{3})+|\d{3,6})(?:,(\d{2}))?\s*$/i;
// Capacidade: "256GB", "1TB" e também o padrão RAM/armazenamento "8/256"
// que EasyStore e Trend usam em MacBook e Xiaomi.
const RE_CAPACIDADE = /\b\d{2,4}\s*(gb|tb)\b|\b\d{1,2}\s*\/\s*\d{2,4}\b/i;
const RE_BATERIA = /(\d{2,3})\s*%|bateria/i;

function limpa(s) {
  return s
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}️]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ehRuido(linha) {
  const l = limpa(linha);
  if (!l || l.length < 2) return true;
  return RUIDO.some((re) => re.test(l));
}

function detectaSecao(linha) {
  const l = limpa(linha);
  // Cabeçalho não tem preço nem capacidade — quem tem é produto. Sem esta
  // guarda, "MACBOOK NEO 8/256" (produto) virava cabeçalho de seção e o
  // produto sumia, sobrando só a linha da cor.
  if (RE_PRECO.test(l) || RE_CAPACIDADE.test(l)) return null;
  return SECOES.find((s) => s.re.test(l)) || null;
}

function extraiPreco(linha) {
  const m = limpa(linha).match(RE_PRECO);
  if (!m) return null;
  const inteiro = m[1].replace(/\./g, '');
  const centavos = m[2] ? `.${m[2]}` : '';
  const v = parseFloat(inteiro + centavos);
  // Preço de aparelho: abaixo de 100 quase sempre é capacidade/ruído solto.
  return Number.isFinite(v) && v >= 100 ? v : null;
}

function ehLinhaDeCor(linha) {
  const l = limpa(linha).toLowerCase().replace(RE_PRECO, '').trim();
  if (!l) return false;
  // Curta e composta só de cores conhecidas (ex.: "Branco", "preto azul verde")
  const palavras = l.split(/[\s,/]+/).filter(Boolean);
  if (palavras.length > 4) return false;
  return palavras.every((p) => CORES.includes(p));
}

function extraiCores(linha) {
  const l = limpa(linha).toLowerCase().replace(RE_PRECO, '').trim();
  return l
    .split(/[\s,/]+/)
    .filter((p) => CORES.includes(p))
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
}

function detectaCategoria(nome) {
  const n = nome.toLowerCase();
  if (/iphone|\bip\b|^\d{1,2}\s*(pro|air|plus|mini|e\b)/.test(n)) return 'iPhone';
  if (/ipad/.test(n)) return 'iPad';
  if (/macbook|mac\s*book/.test(n)) return 'MacBook';
  if (/watch/.test(n)) return 'Apple Watch';
  if (/xiaomi|redmi|poco|note\s*\d/.test(n)) return 'Xiaomi';
  if (/realme/.test(n)) return 'Realme';
  if (/airpods|fone|buds/.test(n)) return 'Fone';
  if (/tablet|galaxy tab/.test(n)) return 'Tablet';
  return 'Acessório';
}

export function parseTabelaFornecedor(texto, { fornecedor = null } = {}) {
  const linhas = texto.split('\n');
  const produtos = [];
  let secao = null;
  let atual = null;

  const fecha = () => {
    if (atual && atual.variacoes.length) produtos.push(atual);
    atual = null;
  };

  for (const bruta of linhas) {
    const linha = limpa(bruta);
    if (!linha) continue;

    const novaSecao = detectaSecao(bruta);
    if (novaSecao) {
      fecha();
      secao = novaSecao;
      continue;
    }

    if (ehRuido(bruta)) continue;

    const preco = extraiPreco(bruta);

    // Formato B: linha de cor com preço, pertence ao produto corrente.
    if (atual && ehLinhaDeCor(bruta)) {
      const cores = extraiCores(bruta);
      if (!cores.length) continue;
      for (const cor of cores) {
        atual.variacoes.push({ cor, custo: preco ?? atual.precoBase ?? null });
      }
      continue;
    }

    // Linha de bateria: metadado do produto corrente, não é produto.
    if (atual && RE_BATERIA.test(linha) && !preco) {
      const m = linha.match(/(\d{2,3})\s*%/);
      if (m) atual.bateria = `${m[1]}%+`;
      continue;
    }

    // Caso contrário: começa produto novo.
    const nome = limpa(bruta).replace(RE_PRECO, '').trim();
    if (!nome || nome.length < 3) continue;
    // Precisa parecer aparelho: ter capacidade OU preço.
    if (!RE_CAPACIDADE.test(nome) && !preco) continue;

    fecha();
    // O nome manda na categoria quando ele é explícito (ex.: um "MACBOOK NEO"
    // logo depois da seção "IPHONE LACRADOS" — o fornecedor emenda categorias
    // sem cabeçalho novo). Só cai na seção quando o nome não denuncia nada.
    const porNome = detectaCategoria(nome);
    const categoria =
      porNome !== 'Acessório' && porNome !== secao?.categoria
        ? porNome
        : secao?.categoria || porNome;
    atual = {
      nomeOriginal: nome,
      categoria,
      condicao: secao?.condicao || 'Lacrado',
      bateria: null,
      precoBase: preco,
      fornecedor,
      variacoes: [],
    };
    // Formato A: preço já veio na linha do nome; cores podem vir depois.
    if (preco) atual.variacoes.push({ cor: null, custo: preco });
  }
  fecha();

  // Formato A com cores embaixo: a variação sem cor vira redundante.
  for (const p of produtos) {
    const comCor = p.variacoes.filter((v) => v.cor);
    if (comCor.length) p.variacoes = comCor;
    p.variacoes = p.variacoes.filter((v) => v.custo != null);
  }

  return produtos.filter((p) => p.variacoes.length);
}

// ---- CLI ----
if (import.meta.main) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('uso: bun scripts/parse-fornecedor.mjs <arquivo.txt> [--json]');
    process.exit(1);
  }
  const texto = await Bun.file(arquivo).text();
  const produtos = parseTabelaFornecedor(texto);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(produtos, null, 2));
  } else {
    console.log(`${produtos.length} produtos encontrados:\n`);
    for (const p of produtos) {
      const cores = p.variacoes
        .map((v) => `${v.cor || '—'} R$${v.custo}`)
        .join(' | ');
      console.log(`  [${p.categoria}/${p.condicao}] ${p.nomeOriginal}`);
      console.log(`     ${cores}${p.bateria ? `  (bat ${p.bateria})` : ''}`);
    }
  }
}
