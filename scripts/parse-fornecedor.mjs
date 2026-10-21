#!/usr/bin/env bun
// ============================================================
// PARSER DE TABELA DE FORNECEDOR — NoClickCerto
//
// Lê o texto cru que os fornecedores mandam no WhatsApp e devolve produtos
// estruturados. Os fornecedores NÃO usam formato padrão, então o parser é
// stateful: guarda o "produto corrente" e associa as linhas seguintes.
//
// Formatos vistos em produção (exemplos reais em tests/fixtures/):
//
//   A) preço na linha do nome, cores soltas embaixo (EasyStore seminovos 31/08)
//        16 pro max 256GB 🇺🇸 4800
//        🔋90%pra cima
//        PRETO
//      -> 1 produto, cores com o mesmo preço
//
//   B) nome sem preço, uma linha por cor COM preço (EasyStore lacrados/Trend)
//        17PRO MAX 256GB LLA 🇺🇸
//        Branco 7050
//        Azul 6950
//      -> 1 produto, preço por cor (fica o MAIOR, ver consolidar.mjs)
//
//   C) EasyStore desde 28/09: marcador, travessão, preço com milhar, cores na
//      linha da bateria depois do "|"
//        🔥 IPHONE 12 pro
//        • 12 128 GB — R$ 1.650
//        🔋 85%+ | Dorudo
//      -> o "Pro" que falta no item vem do cabeçalho da família
//
//   D) Trend desde 19/10: tudo em *negrito* do WhatsApp, cores separadas por |
//        📱*iPhone 17 Pro Max 256GB US🇺🇸*
//        🔘*Laranja | Silver* *R$6450*
//
//   E) EasyStore "novidades" 21/10: cor como emoji, linha "capacidade — preço"
//      debaixo do nome do aparelho
//        🔥 iPhone 17 Pro Max 🇺🇸
//        💙 256GB — R$ 6.640
//        🤍256GB — R$ 6.850
//
// uso: bun scripts/parse-fornecedor.mjs <arquivo.txt> [--json]
// ============================================================

// Linhas que são cabeçalho de seção/ruído, nunca produto.
const RUIDO = [
  /^(lista|tabela|hor[áa]rio|aten[çc][ãa]o|obs|agradec|gostar[íi]amos|retirada|convite|entrar no grupo|ler mais|somente admins|algu[ée]m que)/i,
  /^(chegou+|chegoo+u+|dispon[íi]vel|novidade)s?!*$/i,
  /^(segunda|s[áa]bado|domingo|feriado)/i,
  /^\d{1,2}[h:]\d{0,2}\s*[àa]s/i,
  /^[\s\p{Emoji}\p{So}\p{P}]*$/u,
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

// Cores conhecidas — usado pra decidir se uma linha SEM preço é cor do produto
// corrente ou um produto novo. Linha COM preço aceita cor desconhecida (ver
// ehLinhaDeCor), então esta lista só precisa cobrir o que vem solto.
const CORES = [
  'preto', 'branco', 'azul', 'verde', 'vermelho', 'rosa', 'roxo', 'amarelo',
  'laranja', 'dourado', 'dourdo', 'dorudo', 'prata', 'silver', 'gold', 'grafite', 'cinza',
  'desert', 'titanio', 'titânio', 'natural', 'citrus', 'meia noite', 'estelar',
  'lilas', 'lilás', 'bege', 'creme', 'ultramarine', 'teal', 'sage', 'space',
  'starlight', 'midnight', 'midnget', 'indigo', 'blush', 'burgundy', 'lavanda',
  'sky', 'blue', 'black', 'white', 'pink', 'orange', 'cosmic', 'deep', 'mist',
];

// Erros de digitação recorrentes dos fornecedores -> nome certo da cor.
const COR_CANONICA = {
  dourdo: 'Dourado', dorudo: 'Dourado', midnget: 'Midnight', silve: 'Silver',
};

// EasyStore (21/10) escreve a cor como emoji antes da capacidade.
const COR_EMOJI = [
  ['💙', 'Azul'], ['🤍', 'Branco'], ['🧡', 'Laranja'], ['🖤', 'Preto'],
  ['💜', 'Roxo'], ['💚', 'Verde'], ['🩷', 'Rosa'], ['💛', 'Dourado'],
  ['🩶', 'Cinza'], ['🍷', 'Burgundy'],
];

// Palavra de aparelho/acessório: se aparece, a linha é produto, nunca cor.
const RE_APARELHO = /\b(iphone|ipad|mac|macbook|imac|airpods?|airtag|watch|pencil|apple|xiaomi|redmi|poco|realme|samsung|galaxy|jbl|fone|earpods|cabo|fonte|carregador|capa|capinha|pel[íi]cula|teclado|mouse|magic|tablet|buds|rob[ôo]|note|kindle|cpo|garantia|lacrados?|seminovos?)\b/i;

// Preço no fim da linha. Os dois cuidados do lookbehind:
//   - não casar com o "256" de "8/256" (RAM/armazenamento) — bug de 31/08:
//     "MACBOOK NEO 8/256" virava nome "MACBOOK NEO 8/" com preço 256;
//   - não casar com o pedaço depois do ponto de milhar — bug de 28/09 e 20/10:
//     "R$ 4.650" virava preço 650 e nome "• 16 Pro Max 256GB — R$ 4.".
// O ponto solto continua permitido antes do preço: a EasyStore escreve
// "Dorudo.5140" e "Branco .3710".
const RE_PRECO = /(?<![\d/]|\d[.,])(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,6})(?:,(\d{2}))?\s*$/i;
// Capacidade: "256GB", "1TB", "Pro128GB" (colado) e o padrão RAM/armazenamento
// "8/256" que EasyStore e Trend usam em MacBook e Xiaomi.
const RE_CAPACIDADE = /(?<!\d)\d{2,4}\s*(gb|tb)\b|\b\d{1,2}\s*\/\s*\d{2,4}\b/i;
// iPhone com capacidade sem "GB": "16 Promax 256 CPO" (EasyStore 01/09).
const RE_IPHONE_CAP_SOLTA = /^(iphone\s*)?\d{1,2}\s*(pro\s*max|promax|pro|plus|max|mini|air|e)?\s+(64|128|256|512)\b/i;
const RE_BATERIA = /(\d{2,3})\s*%|bateria/i;
// Cabeçalho de família/aparelho sem preço e sem capacidade: "🔥 IPHONE 12 pro",
// "🔥 iPhone 17 Pro Max 🇺🇸". Vale como "pai" pras linhas de baixo.
const RE_PAI_IPHONE = /^iphone\s*(\d{1,2})\s*(pro\s*max|promax|pro|plus|max|mini|air|e)?\s*$/i;
const RE_SEPARADOR = /^[━─—_=\-\s]{5,}$/;

function limpa(s) {
  return s
    .replace(/[*_~]/g, ' ') // negrito/itálico do WhatsApp
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tira sobras de lista das pontas: "• ", " —", " -", ":" e o "R$" órfão.
function aparaPontas(s) {
  return s
    .replace(/\br\$\s*$/i, '')
    .replace(/^[\s•·\-–—:|.]+/, '')
    .replace(/[\s•·\-–—:|.]+$/, '')
    .trim();
}

function ehRuido(linha) {
  const l = limpa(linha);
  if (!l || l.length < 2) return true;
  return RUIDO.some((re) => re.test(l));
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

function semPreco(linha) {
  return aparaPontas(limpa(linha).replace(RE_PRECO, ''));
}

function temCapacidade(s) {
  return RE_CAPACIDADE.test(s) || RE_IPHONE_CAP_SOLTA.test(s);
}

function detectaSecao(linha) {
  const l = limpa(linha);
  // Cabeçalho não tem preço nem capacidade — quem tem é produto. Sem esta
  // guarda, "MACBOOK NEO 8/256" (produto) virava cabeçalho de seção e o
  // produto sumia, sobrando só a linha da cor.
  if (extraiPreco(l) || temCapacidade(l)) return null;
  return SECOES.find((s) => s.re.test(l)) || null;
}

function normalizaCor(c) {
  const k = c.toLowerCase().trim();
  if (COR_CANONICA[k]) return COR_CANONICA[k];
  return k.replace(/(^|\s)\p{L}/gu, (x) => x.toUpperCase());
}

function corDoEmoji(bruta) {
  return COR_EMOJI.find(([e]) => bruta.includes(e))?.[1] ?? null;
}

// Linha que é só cor(es) do produto corrente.
//  - sem preço: todas as palavras precisam ser cores conhecidas ("PRETO",
//    "Branco preto", "azul laranja roxo starlight");
//  - com preço: aceita cor desconhecida ("Burgundy — R$ 9190", "blush 4480"),
//    desde que seja curta, sem número e sem palavra de aparelho.
function ehLinhaDeCor(linha) {
  const resto = semPreco(linha).toLowerCase();
  if (!resto) return false;
  const palavras = resto.split(/[\s,/|]+/).filter(Boolean);
  if (palavras.every((p) => CORES.includes(p.replace(/\.$/, '')))) return true;
  if (!extraiPreco(linha)) return false;
  if (palavras.length > 3 || /\d/.test(resto) || RE_APARELHO.test(resto)) return false;
  return /^[\p{L}\s,/|.]+$/u.test(resto);
}

function extraiCores(linha) {
  const resto = semPreco(linha);
  const palavras = resto.toLowerCase().split(/[\s,/|]+/).map((p) => p.replace(/\.$/, '')).filter(Boolean);
  // Só cores conhecidas: cada palavra é uma cor ("preto azul verde").
  if (palavras.every((p) => CORES.includes(p))) return palavras.map(normalizaCor);
  // Cor desconhecida: separador é | / , e o resto é UMA cor ("Sky Blue").
  return resto.split(/\s*[,/|]\s*/).map(aparaPontas).filter(Boolean).map(normalizaCor);
}

// Cores da linha da bateria: "🔋 90%+ | Preto / Desert", "🔋 83%+ Preto / Branco".
function coresDaBateria(linha) {
  const resto = limpa(linha)
    .replace(/^.*?\d{2,3}\s*%\s*\+?\s*(pra\s*cima)?/i, '')
    .replace(/^\s*\|/, '')
    .trim();
  if (!resto) return [];
  return resto
    .split(/\s*[/,|]\s*/)
    .map(aparaPontas)
    .filter((c) => c && !/\d/.test(c) && !RE_APARELHO.test(c))
    .map(normalizaCor);
}

function detectaCategoria(nome) {
  const n = nome.toLowerCase();
  if (/iphone|\bip\b|^\d{1,2}\s*(pro|air|plus|mini|e\b|promax|\d{2,4}\s*gb|\d{2,3}\b)/.test(n)) return 'iPhone';
  if (/ipad/.test(n)) return 'iPad';
  if (/macbook|mac\s*book/.test(n)) return 'MacBook';
  if (/watch|\b\d{2}\s*mm\b/.test(n)) return 'Apple Watch';
  if (/xiaomi|redmi|poco|note\s*\d/.test(n)) return 'Xiaomi';
  if (/realme/.test(n)) return 'Realme';
  if (/airpods|fone|buds/.test(n)) return 'Fone';
  if (/tablet|galaxy tab/.test(n)) return 'Tablet';
  return 'Acessório';
}

// Deixa o nome apresentável pro cliente nas famílias Apple. Não muda a
// identidade do produto (chaveProduto normaliza do mesmo jeito), só a vitrine:
// "16 pro max 256GB" -> "iPhone 16 Pro Max 256GB".
const VARIANTES = { pro: 'Pro', max: 'Max', plus: 'Plus', mini: 'Mini', air: 'Air', promax: 'Pro Max', neo: 'Neo' };

function nomeBonito(nome, categoria) {
  let n = nome
    .replace(/\s+(us|usa)$/i, '')
    .replace(/(\d)\s*(gb|tb)\b/gi, (_, d, u) => `${d}${u.toUpperCase()}`);
  if (categoria === 'iPhone') {
    n = n
      .replace(/^iphone\s*/i, '')
      .replace(/(\d)(pro|air|plus|mini|max)/gi, '$1 $2')
      .replace(/(pro|air|plus|mini|max)(\d)/gi, '$1 $2')
      .replace(/\b(pro\s*max|promax|pro|max|plus|mini|air)\b/gi, (w) =>
        w.toLowerCase().replace(/\s+/g, '') === 'promax' ? 'Pro Max' : VARIANTES[w.toLowerCase()])
      .replace(RE_IPHONE_CAP_SOLTA, (m) => (/gb$/i.test(m) ? m : `${m}GB`));
    n = `iPhone ${n}`;
  } else if (categoria === 'iPad') {
    n = n.replace(/^ipad/i, 'iPad');
  } else if (categoria === 'MacBook') {
    n = n.replace(/mac\s*book/i, 'MacBook').replace(/\b(neo|air|pro)\b/gi, (w) => VARIANTES[w.toLowerCase()]);
  } else if (categoria === 'Fone') {
    n = n.replace(/airpods/i, 'AirPods').replace(/\b(max|pro)\b/gi, (w) => VARIANTES[w.toLowerCase()]);
  } else if (categoria === 'Apple Watch' && !/watch/i.test(n)) {
    n = `Apple Watch ${n}`;
  }
  return n.replace(/\s+/g, ' ').trim();
}

/**
 * Nome que pode virar produto no catálogo. Barra as sobras de lista que já
 * foram ao ar: "• 16 Pro 128GB — R$ 3.", "Dorudo.", "Branco .", "SILVE",
 * "Burgundy —", "256GB — R$ 6.".
 */
export function nomeDeProdutoValido(nome) {
  if (typeof nome !== 'string') return false;
  const n = nome.trim();
  if (n.length < 3) return false;
  if (/R\$|[—–]/.test(n)) return false;
  if (/^[•·*\-:|.]/.test(n) || /[:\-—–|.]\s*$/.test(n)) return false;
  const palavras = n.toLowerCase().split(/[\s,/|]+/).filter((p) => /\p{L}/u.test(p));
  if (!palavras.length) return false;
  // Só cor(es) — "SILVE" é "silver" cortado, tratado como cor.
  if (palavras.every((p) => CORES.includes(p) || p === 'silve')) return false;
  // Nome de aparelho tem número (modelo/capacidade) ou palavra de aparelho.
  return /\d/.test(n) || RE_APARELHO.test(n);
}

/** Quantas linhas têm preço — o leitor do WhatsApp usa pra saber se é tabela. */
export function contaLinhasComPreco(texto) {
  return texto.split('\n').filter((l) => extraiPreco(l) != null).length;
}

export function parseTabelaFornecedor(texto, { fornecedor = null } = {}) {
  const linhas = texto.split('\n');
  const produtos = [];
  let secao = null;
  let atual = null;
  let pai = null; // { numero, variante, nome } do cabeçalho "iPhone 17 Pro Max"
  let cpo = false; // depois de um marcador "CPO", iPhones ganham o sufixo

  const fecha = () => {
    if (atual && atual.variacoes.length) produtos.push(atual);
    atual = null;
  };

  const novoProduto = (nomeCru, preco) => {
    fecha();
    // O nome manda na categoria quando ele é explícito (ex.: um "MACBOOK NEO"
    // logo depois da seção "IPHONE LACRADOS" — o fornecedor emenda categorias
    // sem cabeçalho novo). Só cai na seção quando o nome não denuncia nada.
    const porNome = detectaCategoria(nomeCru);
    const categoria =
      porNome !== 'Acessório' && porNome !== secao?.categoria
        ? porNome
        : secao?.categoria || porNome;
    let nome = nomeBonito(nomeCru, categoria);
    if (cpo && categoria === 'iPhone' && !/\bcpo\b/i.test(nome)) nome += ' CPO';
    if (!nomeDeProdutoValido(nome)) return null;
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
    return atual;
  };

  const addCor = (cor, custo) => {
    if (!atual || custo == null) return;
    const ja = atual.variacoes.find((v) => v.cor === cor);
    if (ja) ja.custo = Math.max(ja.custo, custo);
    else atual.variacoes.push({ cor, custo });
  };

  for (const bruta of linhas) {
    const linha = limpa(bruta);
    if (!linha) continue;

    if (RE_SEPARADOR.test(linha)) {
      fecha();
      pai = null;
      cpo = false;
      continue;
    }

    const novaSecao = detectaSecao(bruta);
    if (novaSecao) {
      fecha();
      secao = novaSecao;
      pai = null;
      cpo = false;
      continue;
    }

    if (ehRuido(bruta)) continue;

    const preco = extraiPreco(bruta);
    const resto = semPreco(bruta);

    // Marcador "CPO" solto (sem preço/capacidade): vale pros iPhones de baixo.
    if (!preco && !temCapacidade(resto) && /\bcpo\b/i.test(resto)) {
      fecha();
      cpo = true;
      continue;
    }

    // Cabeçalho de família/aparelho: "🔥 IPHONE 12 pro", "🔥 iPhone 17 Pro Max".
    const mPai = !preco && resto.match(RE_PAI_IPHONE);
    if (mPai) {
      fecha();
      pai = { numero: mPai[1], variante: (mPai[2] || '').trim(), nome: resto };
      continue;
    }

    // Formato E: "💙 256GB — R$ 6.640" debaixo do "iPhone 17 Pro Max".
    const soCapacidade = resto.match(/^(\d{2,4}\s*(?:gb|tb))(?:\s+(.+))?$/i);
    if (soCapacidade && preco) {
      if (!pai) continue; // capacidade solta sem aparelho: não dá pra saber o que é
      const nomeFilho = nomeBonito(`${pai.nome} ${soCapacidade[1]}`, 'iPhone');
      const cor = corDoEmoji(bruta) || (soCapacidade[2] ? extraiCores(soCapacidade[2])[0] : null);
      if (atual?.nomeOriginal !== nomeFilho) {
        if (!novoProduto(`${pai.nome} ${soCapacidade[1]}`, null)) continue;
      }
      addCor(cor, preco);
      continue;
    }

    // Formato B/E: linha de cor (com ou sem preço) do produto corrente.
    if (atual && ehLinhaDeCor(bruta)) {
      const cores = extraiCores(bruta);
      if (!cores.length) continue;
      for (const cor of cores) addCor(cor, preco ?? atual.precoBase ?? null);
      continue;
    }

    // Linha de bateria: metadado do produto corrente; no formato C traz as cores.
    if (atual && RE_BATERIA.test(linha) && !preco) {
      const m = linha.match(/(\d{2,3})\s*%/);
      if (m) atual.bateria = `${m[1]}%+`;
      for (const cor of coresDaBateria(bruta)) addCor(cor, atual.precoBase);
      continue;
    }

    // Caso contrário: começa produto novo.
    let nome = resto;
    if (!nome || nome.length < 3) continue;
    // Precisa parecer aparelho: ter capacidade OU preço.
    if (!temCapacidade(nome) && !preco) continue;
    // Item da EasyStore sem a variante que está no cabeçalho:
    // "🔥 IPHONE 12 pro" + "• 12 128 GB" = iPhone 12 Pro 128GB.
    if (pai?.variante) {
      const mItem = nome.match(/^(iphone\s*)?(\d{1,2})(?!\d)\s*(.*)$/i);
      if (mItem && mItem[2] === pai.numero && !/\b(pro|max|plus|mini|air)\b|^e\b/i.test(mItem[3])) {
        nome = `${mItem[2]} ${pai.variante} ${mItem[3]}`;
      }
    }
    novoProduto(nome, preco);
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
