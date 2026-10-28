// ============================================================
// AJUSTES DA TABELA — limpeza aprovada pelo Stefano em 28/10/2026, junto com a
// margem nova (via Gerente de Sessões). Roda dentro do reprecificar.mjs, antes
// do preço; pode rodar de novo sem estragar nada.
//
//   - duplicados: fica o código mais antigo (com a foto e o custo mais
//     recente dos dois); o outro some do site e ganha `duplicado_de`, pra
//     ingestão mandar a cotação dele pro que ficou (ver ingerir.mjs);
//   - Realme que entrou como Xiaomi (XMI-0077..0081) e Redmi Pad 2 como Xiaomi
//     (XMI-0057) voltam pra categoria certa;
//   - IPH-0028 tinha o mesmo nome do lacrado IPH-0013: ganha "Seminovo";
//   - lixo de lista (ACS-0010/0011/0012) fica oculto.
// ============================================================

import { chaveProduto } from './consolidar.mjs';

// [fica, sai]
export const DUPLICADOS = [
  ['ACS-0001', 'ACS-0016'], // Fonte 20W USB-C
  ['ACS-0002', 'ACS-0017'], // Cabo Lightning 2M
  ['ACS-0003', 'ACS-0019'], // Cabo Tipo C-C 1M
  ['ACS-0004', 'ACS-0018'], // EarPods USB-C
  ['ACS-0013', 'ACS-0015'], // Apple Pencil USB-C
  ['APW-0011', 'APW-0017'], // Apple Watch Ultra 3 49mm
  ['RLM-0004', 'XMI-0077'], // Realme Note 70 8/256 Preto
  ['TAB-0002', 'XMI-0057'], // Redmi Pad 2 8/256 Cinza — vira duplicado quando volta pra Tablet
];

export const CATEGORIAS = {
  'XMI-0077': 'Realme', 'XMI-0078': 'Realme', 'XMI-0079': 'Realme', 'XMI-0080': 'Realme', 'XMI-0081': 'Realme',
  'XMI-0057': 'Tablet',
};

export const NOMES = { 'IPH-0028': 'iPhone 15 128GB Preto Seminovo' };

export const LIXO = ['ACS-0010', 'ACS-0011', 'ACS-0012'];

const JANELA_COTACAO_DIAS = 3;

// Junta as cotações dos dois (por fornecedor fica a mais recente) e o custo
// passa a ser o maior entre as cotações dos últimos dias — mesma regra do
// maior preço da ingestão.
function juntaCotacoes(a = {}, b = {}) {
  const todas = { ...a };
  for (const [f, q] of Object.entries(b)) if (!todas[f] || q.data > todas[f].data) todas[f] = q;
  return todas;
}

function custoDasCotacoes(cotacoes) {
  const qs = Object.values(cotacoes);
  if (!qs.length) return null;
  const ultima = qs.map((q) => Date.parse(q.data)).reduce((a, b) => Math.max(a, b));
  const recentes = qs.filter((q) => (ultima - Date.parse(q.data)) / 86_400_000 <= JANELA_COTACAO_DIAS);
  return Math.max(...recentes.map((q) => q.custo));
}

const chave = (p) => chaveProduto({ nomeOriginal: p.nome, categoria: p.categoria, condicao: p.condicao });

export function ajustarTabela(catalogo) {
  const produtos = catalogo.produtos || [];
  const um = (codigo) => produtos.find((p) => p.codigo === codigo);
  const feito = [];

  for (const [codigo, categoria] of Object.entries(CATEGORIAS)) {
    const p = um(codigo);
    if (p && p.categoria !== categoria) { feito.push(`${codigo}: categoria ${p.categoria} -> ${categoria}`); p.categoria = categoria; }
  }
  for (const [codigo, nome] of Object.entries(NOMES)) {
    const p = um(codigo);
    if (p && p.nome !== nome) { feito.push(`${codigo}: nome "${p.nome}" -> "${nome}"`); p.nome = nome; }
  }
  for (const p of produtos) {
    if (LIXO.includes(p.codigo) && !p.oculto) { p.oculto = true; feito.push(`${p.codigo} "${p.nome}": oculto (lixo de lista)`); }
  }

  for (const [fica, sai] of DUPLICADOS) {
    const a = um(fica);
    const b = um(sai);
    if (!a || !b || b.duplicado_de === fica) continue;
    a.cotacoes = juntaCotacoes(a.cotacoes, b.cotacoes);
    const custo = custoDasCotacoes(a.cotacoes);
    if (custo) a.custo = custo;
    if (!a.foto_url && b.foto_url) { a.foto_url = b.foto_url; a.fotos = b.fotos || [b.foto_url]; }
    if (b.cores?.length) a.cores = [...new Set([...(a.cores || []), ...b.cores])];
    b.oculto = true;
    b.duplicado_de = fica;
    feito.push(`${sai} "${b.nome}": oculto, duplicado de ${fica} (custo ${a.custo})`);

    // Linhas da mesma família por cor (TAB-0001 Verde × TAB-0002 Cinza) andam
    // juntas, como na ingestão.
    for (const irmao of produtos) {
      if (irmao === a || irmao.oculto || chave(irmao) !== chave(a)) continue;
      irmao.custo = a.custo;
      irmao.cotacoes = juntaCotacoes(irmao.cotacoes, a.cotacoes);
    }
  }
  return feito;
}
