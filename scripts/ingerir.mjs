#!/usr/bin/env bun
// ============================================================
// INGESTÃO DIÁRIA — do texto do fornecedor até o catálogo publicado
//
//   texto cru  ->  parse  ->  consolida  ->  precifica  ->  catalogo.json
//
// Regras respeitadas (ver docs e memória do projeto):
//   - catálogo mestre CRESCE, nunca remove produto (regra antiga, mantida)
//   - código de produto nunca muda, é vínculo permanente
//   - preço do fornecedor MAIS CARO quando o produto existe nos dois
//   - margem fixa: R$650 até R$4.000 de custo, R$850 acima
//
// uso:
//   bun scripts/ingerir.mjs <arq.txt:FOR001> [arq2.txt:FOR002]     (dry-run)
//   bun scripts/ingerir.mjs ... --aplicar                          (grava json)
//   bun scripts/ingerir.mjs ... --aplicar --publicar               (sobe pro ar)
// ============================================================

import { parseTabelaFornecedor } from './parse-fornecedor.mjs';
import { consolidar, chaveProduto } from './consolidar.mjs';
import { auditarCatalogo, bloquear, relatorio } from './auditor.mjs';

const MARGEM_ATE_4K = 650;
const MARGEM_ACIMA_4K = 850;
const LIMITE_MARGEM = 4000;
const TAXA_CARTAO = 0.11;
const TAXA_LINK = 0.17;
const PARCELAS = 10;

// Margens especiais por categoria, fechadas com o Stefano em 31/08/2026:
// a fórmula de R$650/R$850 é pra CELULAR. Cabo/fonte/EarPods/AirTag
// ("Acessório") a preço fixo ficavam absurdos (cabo de R$15 vendendo por
// R$665) — ele pediu percentual pra esses. Fone SEM FIO (AirPods, Buds) é
// caro feito celular, então margem fixa também, só que menor: R$500.
const MARGEM_PCT_POR_CATEGORIA = { Acessório: 1.0 }; // 100% do custo
const MARGEM_FIXA_POR_CATEGORIA = { Fone: 500 };

export function calcPrecos(custo, categoria) {
  let margem;
  if (categoria in MARGEM_PCT_POR_CATEGORIA) {
    margem = Math.round(custo * MARGEM_PCT_POR_CATEGORIA[categoria] * 100) / 100;
  } else if (categoria in MARGEM_FIXA_POR_CATEGORIA) {
    margem = MARGEM_FIXA_POR_CATEGORIA[categoria];
  } else {
    margem = custo <= LIMITE_MARGEM ? MARGEM_ATE_4K : MARGEM_ACIMA_4K;
  }
  const pix = Math.round((custo + margem) * 100) / 100;
  const cartao = Math.round(pix * (1 + TAXA_CARTAO) * 100) / 100;
  const link = Math.round(pix * (1 + TAXA_LINK) * 100) / 100;
  return {
    preco_venda: cartao,
    preco_pix: pix,
    preco_cartao: cartao,
    preco_link: link,
    preco_10x: Math.round((link / PARCELAS) * 100) / 100,
    lucro_pix: margem,
    lucro_cartao: margem,
  };
}

const PREFIXOS = {
  iPhone: 'IPH', iPad: 'IPD', MacBook: 'MCB', 'Apple Watch': 'APW',
  Xiaomi: 'XMI', Realme: 'RLM', Tablet: 'TAB', Acessório: 'ACS',
  Fone: 'FNE', Robô: 'ROB',
};

function proximoCodigo(categoria, produtos) {
  const pref = PREFIXOS[categoria] || 'PRD';
  const nums = produtos
    .filter((p) => p.codigo?.startsWith(pref))
    .map((p) => parseInt(p.codigo.split('-')[1] || '0', 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${pref}-${String(next).padStart(4, '0')}`;
}

const args = process.argv.slice(2);
const entradas = args.filter((a) => !a.startsWith('--'));
const APLICAR = args.includes('--aplicar');
const PUBLICAR = args.includes('--publicar');

if (!entradas.length) {
  console.error('uso: bun scripts/ingerir.mjs <arq.txt:FOR001> [--aplicar] [--publicar]');
  process.exit(1);
}

// 1. parse + consolida
const listas = [];
for (const entrada of entradas) {
  const [arquivo, fornecedor] = entrada.split(':');
  const texto = await Bun.file(arquivo).text();
  listas.push(parseTabelaFornecedor(texto, { fornecedor: fornecedor || 'FOR001' }));
}
const consolidado = consolidar(listas);

// 2. casa com o catálogo existente pela MESMA chave usada na consolidação,
//    pra um produto que já existe não entrar de novo com código novo.
const catalogo = JSON.parse(await Bun.file('catalogo.json').text());
const produtos = catalogo.produtos;
// Snapshot ANTES de qualquer mudança de hoje — é a referência de histórico
// que o QA usa pra pegar queda suspeita de preço no próprio produto.
const antesDeHoje = new Map(produtos.map((p) => [p.codigo, { custo: p.custo }]));
// Um produto do fornecedor pode casar com VÁRIOS do catálogo: a base antiga
// tem uma linha por cor (XMI-0012 Preto, 0013 Azul, 0014 Verde = o mesmo
// aparelho), enquanto a tabela nova traz as cores juntas. Se atualizasse só
// um, o mesmo aparelho ficaria com preços diferentes no site.
const indice = new Map();
for (const p of produtos) {
  const k = chaveProduto({ nomeOriginal: p.nome, categoria: p.categoria, condicao: p.condicao });
  if (!indice.has(k)) indice.set(k, []);
  indice.get(k).push(p);
}

const novos = [];
const atualizados = [];

for (const c of consolidado) {
  const precos = calcPrecos(c.custo);
  const existentes = indice.get(c.chave);

  if (existentes?.length) {
    for (const existente of existentes) {
      const antes = existente.preco_pix;
      Object.assign(existente, {
        custo: c.custo,
        ...precos,
        fornecedor: c.fornecedorPreco || existente.fornecedor,
      });
      if (c.cores.length) existente.cores = c.cores;
      if (c.bateria) existente.bateria = c.bateria;
      existente.status = 'Disponível';
      if (antes !== precos.preco_pix) {
        atualizados.push({ ...c, codigo: existente.codigo, nome: existente.nome, antes, depois: precos.preco_pix });
      }
    }
  } else {
    const codigo = proximoCodigo(c.categoria, produtos);
    const novo = {
      codigo,
      nome: c.nome,
      categoria: c.categoria,
      condicao: c.condicao,
      status: 'Disponível',
      fornecedor: c.fornecedorPreco || 'FOR001',
      custo: c.custo,
      ...precos,
      bateria: c.bateria,
      cores: c.cores,
      origem: null,
      garantia: null,
      descricao: '',
      destaque: false,
      lancamento: false,
      promocao: false,
      fotos: [],
    };
    produtos.push(novo);
    indice.set(c.chave, [novo]);
    novos.push(novo);
  }
}

// 3. relatório
const R = (v) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
console.log(`\n${consolidado.length} produtos na tabela de hoje`);
console.log(`  ${novos.length} novos · ${atualizados.length} com preço alterado\n`);

for (const n of novos) {
  console.log(`  + ${n.codigo}  ${n.nome}`);
  console.log(`      custo ${R(n.custo)} → PIX ${R(n.preco_pix)} · link 10× ${R(n.preco_10x)}`);
}
for (const a of atualizados) {
  const seta = a.depois > a.antes ? '↑' : '↓';
  console.log(`  ${seta} ${a.codigo}  ${a.nome}`);
  console.log(`      PIX ${R(a.antes)} → ${R(a.depois)}`);
}

// 3b. QA de preço — SEMPRE roda, mesmo em dry-run, pra avisar antes de
// aplicar. Pedido do Stefano (31/08/2026, depois de um iPad com custo R$16
// escapar pro ar): "toda vez que se atualizar ele tem que rodar e procurar
// esse tipo de erro" — não é mais um script separado que alguém precisa
// lembrar de rodar, é parte do próprio pipeline de ingestão.
const reprovados = auditarCatalogo(produtos, antesDeHoje);
console.log(relatorio(reprovados, produtos.length));

if (!APLICAR) {
  console.log('\n(dry-run — nada foi gravado. use --aplicar)');
  process.exit(0);
}

if (reprovados.length) {
  bloquear(reprovados);
  console.log(`⚠️  ${reprovados.length} item(ns) travado(s) em "Consultar Disponibilidade" pelo QA — resto do catálogo segue normal`);
}

catalogo.meta.ultima_atualizacao = new Date().toISOString().slice(0, 10);
catalogo.meta.total_produtos = produtos.length;
await Bun.write('catalogo.json', JSON.stringify(catalogo, null, 2));
console.log(`\n✓ catalogo.json gravado — ${produtos.length} produtos no total`);

if (!PUBLICAR) {
  console.log('(local apenas — use --publicar pra subir pro ar)');
  process.exit(0);
}

// 4. publica via a própria API do admin (usa o GITHUB_TOKEN que vive no
//    Vercel; o git push local não funciona porque o Keychain não responde
//    sem interação).
const BASE = 'https://catalogo.noclickcerto.com.br';
const senha = process.env.ADMIN_PASSWORD;
if (!senha) {
  console.error('!! defina ADMIN_PASSWORD no ambiente pra publicar');
  process.exit(1);
}

const auth = await fetch(`${BASE}/api/auth`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: senha }),
}).then((r) => r.json());

if (!auth.token) {
  console.error('!! falha na autenticação do admin:', auth);
  process.exit(1);
}

const save = await fetch(`${BASE}/api/save`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.token}`,
  },
  body: JSON.stringify({
    catalog: catalogo,
    message: `Tabela dos fornecedores ${catalogo.meta.ultima_atualizacao} (${novos.length} novos, ${atualizados.length} atualizados)`,
  }),
}).then((r) => r.json());

console.log(save.success || save.commit ? '✓ publicado — Vercel republica em ~30s' : `!! erro ao publicar: ${JSON.stringify(save)}`);
