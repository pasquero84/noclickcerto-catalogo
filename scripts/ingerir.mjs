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
//   bun scripts/ingerir.mjs <arq.txt:FOR001[:AAAA-MM-DD]> [arq2.txt:FOR002]  (dry-run)
//   bun scripts/ingerir.mjs ... --aplicar                          (grava json)
//   bun scripts/ingerir.mjs ... --aplicar --publicar               (sobe pro ar)
// ============================================================

import { parseTabelaFornecedor, nomeDeProdutoValido } from './parse-fornecedor.mjs';
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

// 0. publicando: parte do catálogo que está no ar (origin/main), nunca de uma
//    cópia local velha ou suja. Até 21/10 a publicação era pela API do admin;
//    quando ela falhava (token do GitHub vencido, `Bad credentials`) o
//    catalogo.json local ficava alterado sem commit e a rodada seguinte
//    empilhava em cima — foi assim que o lixo de 20 e 21/10 se acumulou.
const git = (...a) => Bun.spawnSync(['git', ...a], { stdout: 'pipe', stderr: 'pipe' });
const saidaGit = (r) => (r.stdout.toString() + r.stderr.toString()).trim();
if (PUBLICAR) {
  const sujo = saidaGit(git('status', '--porcelain', '--', 'catalogo.json'));
  if (sujo) {
    console.error('!! catalogo.json tem alteração local sem commit — não publico em cima disso.');
    console.error('   confira com `git diff catalogo.json` e descarte (`git checkout -- catalogo.json`) ou commite.');
    process.exit(1);
  }
  const fetch_ = git('fetch', '--quiet', 'origin', 'main');
  const ff = fetch_.exitCode === 0 ? git('merge', '--ff-only', '--quiet', 'origin/main') : fetch_;
  if (ff.exitCode !== 0) {
    console.error(`!! não consegui alinhar com origin/main: ${saidaGit(ff)}`);
    process.exit(1);
  }
}

// 1. parse + consolida
// Entrada: arquivo:FORNECEDOR[:AAAA-MM-DD]. A data é a da tabela (padrão:
// hoje) — serve pra reprocessar uma lista antiga sem fingir que é cotação nova.
const HOJE = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
const listas = [];
const dataCotacao = {};
for (const entrada of entradas) {
  const [arquivo, fornecedor = 'FOR001', data = HOJE] = entrada.split(':');
  const texto = await Bun.file(arquivo).text();
  listas.push(parseTabelaFornecedor(texto, { fornecedor }));
  dataCotacao[fornecedor] = data;
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
const recusados = [];

// REGRA DO MAIOR PREÇO entre rodadas: o leitor do WhatsApp roda uma ingestão
// por MENSAGEM, então EasyStore às 10h e Trend às 14h nunca chegam juntos no
// consolidar(). Sem memória, o último a falar ditava o preço (Trend 16 Pro Max
// R$4.300 derrubaria o R$4.650 da EasyStore da manhã). Cada produto guarda a
// última cotação de cada fornecedor e o custo é a maior das cotações recentes.
const JANELA_COTACAO_DIAS = 3;
const diasAtras = (data) => (Date.parse(HOJE) - Date.parse(data)) / 86_400_000;

function cotacaoVencedora(cotacoes) {
  const recentes = Object.entries(cotacoes).filter(([, q]) => diasAtras(q.data) <= JANELA_COTACAO_DIAS);
  recentes.sort((a, b) => b[1].custo - a[1].custo);
  return recentes[0] ? { fornecedor: recentes[0][0], custo: recentes[0][1].custo } : null;
}

for (const c of consolidado) {
  const existentes = indice.get(c.chave);

  if (existentes?.length) {
    for (const existente of existentes) {
      const antes = existente.preco_pix;
      const cotacoes = { ...(existente.cotacoes || {}) };
      for (const [f, custo] of Object.entries(c.precosPorFornecedor)) cotacoes[f] = { custo, data: dataCotacao[f] || HOJE };
      const venc = cotacaoVencedora(cotacoes) || { fornecedor: c.fornecedorPreco, custo: c.custo };
      // Margem pela categoria do PRODUTO DO CATÁLOGO (Acessório 100%, Fone R$500,
      // aparelho R$650/R$850) — sem ela, um Apple Pencil de R$499 saía por R$1.149.
      const precos = calcPrecos(venc.custo, existente.categoria);
      Object.assign(existente, {
        custo: venc.custo,
        ...precos,
        fornecedor: venc.fornecedor || existente.fornecedor,
        cotacoes,
      });
      if (c.cores.length) existente.cores = c.cores;
      if (c.bateria) existente.bateria = c.bateria;
      existente.status = 'Disponível';
      if (antes !== precos.preco_pix) {
        atualizados.push({ ...c, codigo: existente.codigo, nome: existente.nome, antes, depois: precos.preco_pix });
      }
    }
  } else {
    // Última barreira contra produto lixo ("• 16 Pro 128GB — R$ 3.", "Dorudo.",
    // "Burgundy —"): o parser já não gera isso, mas se um formato novo de
    // fornecedor escapar, o item fica de fora e aparece no relatório.
    if (!nomeDeProdutoValido(c.nome)) {
      recusados.push(c);
      continue;
    }
    const codigo = proximoCodigo(c.categoria, produtos);
    const cotacoes = Object.fromEntries(
      Object.entries(c.precosPorFornecedor).map(([f, custo]) => [f, { custo, data: dataCotacao[f] || HOJE }])
    );
    const novo = {
      codigo,
      nome: c.nome,
      categoria: c.categoria,
      condicao: c.condicao,
      status: 'Disponível',
      fornecedor: c.fornecedorPreco || 'FOR001',
      custo: c.custo,
      ...calcPrecos(c.custo, c.categoria),
      cotacoes,
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
for (const r of recusados) {
  console.log(`  ✗ RECUSADO (nome parece sobra de lista): "${r.nome}" custo ${R(r.custo)}`);
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

// 4. publica com commit + push no GitHub; a Vercel republica sozinha a cada
//    push na main. A chave SSH do Mac funciona sem interação (testado 21/10,
//    inclusive sem ssh-agent, que é como o launchd do leitor roda).
//    Antes era pela API do admin (/api/save), que depende do GITHUB_TOKEN
//    guardado na Vercel — quando ele venceu (`Bad credentials`, 20/10) a
//    publicação parou e o erro nem derrubava o processo: o WhatsApp avisava
//    "catálogo já está atualizado" sem nada ter ido pro ar.
const mensagem = `Tabela dos fornecedores ${catalogo.meta.ultima_atualizacao} (${novos.length} novos, ${atualizados.length} atualizados)`;
if (!saidaGit(git('status', '--porcelain', '--', 'catalogo.json'))) {
  console.log('✓ nada mudou no catálogo — nada a publicar');
  process.exit(0);
}
const passos = [
  ['add', 'catalogo.json'],
  ['commit', '--quiet', '-m', mensagem, '--', 'catalogo.json'],
  ['push', '--quiet', 'origin', 'HEAD:main'],
];
for (const passo of passos) {
  const r = git(...passo);
  if (r.exitCode !== 0) {
    console.error(`!! erro ao publicar (git ${passo[0]}): ${saidaGit(r)}`);
    process.exit(1);
  }
}
const sha = saidaGit(git('rev-parse', '--short', 'HEAD'));
console.log(`✓ publicado (commit ${sha}) — Vercel republica em ~30s`);
