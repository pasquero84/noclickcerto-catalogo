#!/usr/bin/env node
// ============================================================
// BUILD DO SITE — só o que o cliente pode ver vai pro ar
//
// Até 23/10/2026 a Vercel publicava a pasta INTEIRA do repositório:
// catalogo.json com custo, lucro e fornecedor de cada produto, os textos crus
// das tabelas dos fornecedores (scripts/amostras, tests/fixtures), o WORKLOG,
// os scripts. Auditoria de segurança de 23/10.
//
// Agora o deploy serve só a pasta public/, montada aqui a partir de uma LISTA
// FECHADA. Arquivo novo na raiz não vai pro ar sem entrar nesta lista.
//
//   catalogo.json (completo, interno)  ->  public/catalogo.publico.json
//
// O admin lê o catálogo completo por /api/catalogo (com login), nunca pelo site.
//
// uso: node scripts/build-publico.mjs   (a Vercel roda via `npm run build`)
// ============================================================

import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'public');

// O que o cliente vê de cada produto. Fica DE FORA: custo, lucro_pix,
// lucro_cartao, fornecedor, cotacoes, auditoria_bloqueio, nome_interno e
// qualquer campo novo que alguém criar — lista de permissão, não de bloqueio.
const CAMPOS_PRODUTO = [
  'codigo', 'nome', 'categoria', 'condicao', 'status',
  'preco_venda', 'preco_pix', 'preco_cartao', 'preco_link', 'preco_10x',
  'bateria', 'cores', 'origem', 'garantia', 'descricao',
  'destaque', 'lancamento', 'promocao', 'foto_url', 'fotos',
];
const CAMPOS_META = [
  'sistema', 'versao', 'ultima_atualizacao', 'whatsapp', 'instagram',
  'prazo_entrega', 'desconto_pix', 'parcelas_cartao',
];

// Arquivos e pastas do site. admin/index.html é a tela de login + painel; sem
// a senha ela não mostra nada (o catálogo completo vem de /api/catalogo).
const ARQUIVOS_DO_SITE = ['index.html', 'favicon.svg', 'imagens', 'admin/index.html'];
// Opcionais: só copia se existir. stories/ = JPEGs dos Stories do Instagram
// (a API da Meta exige URL pública; scripts/postar-story.mjs põe aqui).
const OPCIONAIS = ['stories'];

const so = (obj, campos) =>
  Object.fromEntries(campos.filter((c) => obj[c] !== undefined).map((c) => [c, obj[c]]));

export function catalogoPublico(catalogo) {
  const produtos = (catalogo.produtos || []).filter((p) => !p.oculto).map((p) => so(p, CAMPOS_PRODUTO));
  return {
    meta: { ...so(catalogo.meta || {}, CAMPOS_META), total_produtos: produtos.length },
    produtos,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(SAIDA, { recursive: true });

  for (const item of ARQUIVOS_DO_SITE) {
    const origem = join(RAIZ, item);
    if (!existsSync(origem)) throw new Error(`build: falta ${item}`);
    cpSync(origem, join(SAIDA, item), { recursive: true });
  }

  for (const item of OPCIONAIS) {
    const origem = join(RAIZ, item);
    if (existsSync(origem)) cpSync(origem, join(SAIDA, item), { recursive: true });
  }

  const catalogo = JSON.parse(readFileSync(join(RAIZ, 'catalogo.json'), 'utf8'));
  const publico = catalogoPublico(catalogo);
  writeFileSync(join(SAIDA, 'catalogo.publico.json'), JSON.stringify(publico));
  console.log(`build: public/ com ${ARQUIVOS_DO_SITE.length} itens + catalogo.publico.json (${publico.produtos.length} produtos visíveis)`);
}
