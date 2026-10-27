#!/usr/bin/env bun
// ============================================================
// POSTAR STORY — publica no Stories do Instagram do NoClickCerto uma arte
// gerada por scripts/stories-diarios.mjs
//
// ⚠️ DESLIGADO por padrão. Só publica com as DUAS travas:
//    1. a flag --publicar
//    2. o arquivo ~/Library/NCK/stories/LIGADO (criado só depois do Stefano
//       aprovar as 2 primeiras artes — pedido dele de 27/10/2026)
// Sem isso, faz um ensaio: diz qual arte postaria e para.
//
// Credenciais (o Stefano preenche; a IA nunca copia segredo):
//    ~/Library/NCK/stories/.env  com  NCK_IG_USER_ID=...  e  NCK_IG_TOKEN=...
//    (token do Instagram Login do app NoClickCerto — o mesmo que o WaveFlow
//    renova em instagram_tokens; permissão instagram_business_content_publish)
//
// Como a imagem chega no Instagram: a API só aceita URL pública de JPEG.
// A arte é convertida pra JPEG, copiada pra stories/ deste repositório e
// publicada no site (o build serve stories/), em
// https://catalogo.noclickcerto.com.br/stories/<arquivo>.jpg
//
// uso: bun scripts/postar-story.mjs <AAAA-MM-DD> <1|2> [--publicar]
//      (horários sugeridos: story 1 às 11h, story 2 às 18h — ops/README-stories.md)
// ============================================================

import { readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_SAIDA } from './stories-diarios.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const NCK = `${process.env.HOME}/Library/NCK/stories`;
const SITE = 'https://catalogo.noclickcerto.com.br';
const API = 'https://graph.instagram.com/v21.0';

const [data, numero] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PUBLICAR = process.argv.includes('--publicar');
if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') || !['1', '2'].includes(numero)) {
  console.error('uso: bun scripts/postar-story.mjs <AAAA-MM-DD> <1|2> [--publicar]');
  process.exit(1);
}

const historico = JSON.parse(readFileSync(join(PASTA_SAIDA, 'historico.json'), 'utf8'));
const item = historico.find((h) => h.data === data && String(h.story) === numero);
if (!item || !existsSync(item.png)) {
  console.error(`!! não há arte do story ${numero} de ${data} — rode scripts/stories-diarios.mjs ${data}`);
  process.exit(1);
}

const ligado = existsSync(join(NCK, 'LIGADO'));
console.log(`story ${numero} de ${data}: ${item.codigo} ${item.modelo}\n  ${item.png}`);
if (!PUBLICAR || !ligado) {
  console.log(`(ensaio — nada publicado: ${!PUBLICAR ? 'falta --publicar' : `falta ${NCK}/LIGADO (só depois do OK do Stefano)`})`);
  process.exit(0);
}

const env = Object.fromEntries(
  (existsSync(join(NCK, '.env')) ? readFileSync(join(NCK, '.env'), 'utf8') : '')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
const { NCK_IG_USER_ID: IG, NCK_IG_TOKEN: TOKEN } = env;
if (!IG || !TOKEN) {
  console.error(`!! faltam NCK_IG_USER_ID / NCK_IG_TOKEN em ${NCK}/.env`);
  process.exit(1);
}

// 1. JPEG público no site
const jpg = `${basename(item.png, '.png')}.jpg`;
mkdirSync(join(RAIZ, 'stories'), { recursive: true });
await Bun.$`sips -s format jpeg -s formatOptions 90 ${item.png} --out ${join(RAIZ, 'stories', jpg)}`.quiet();
const git = (...a) => Bun.spawnSync(['git', ...a], { cwd: RAIZ, stdout: 'pipe', stderr: 'pipe' });
for (const passo of [
  ['fetch', '--quiet', 'origin', 'main'],
  ['merge', '--ff-only', '--quiet', 'origin/main'],
  ['add', `stories/${jpg}`],
  ['commit', '--quiet', '-m', `Story ${data} #${numero} (${item.codigo})`, '--', `stories/${jpg}`],
  ['push', '--quiet', 'origin', 'HEAD:main'],
]) {
  const r = git(...passo);
  if (r.exitCode !== 0) {
    console.error(`!! git ${passo[0]}: ${r.stderr.toString().trim()}`);
    process.exit(1);
  }
}
const url = `${SITE}/stories/${jpg}`;
for (let i = 0; i < 40; i++) {
  const r = await fetch(url, { method: 'HEAD' });
  if (r.ok && (r.headers.get('content-type') || '').includes('jpeg')) break;
  if (i === 39) {
    console.error(`!! a imagem não apareceu no site: ${url}`);
    process.exit(1);
  }
  await Bun.sleep(6000);
}

// 2. container STORIES → espera processar → publica
const post = (caminho, params) =>
  fetch(`${API}/${caminho}?${new URLSearchParams({ ...params, access_token: TOKEN })}`, { method: 'POST' }).then((r) => r.json());
const criado = await post(`${IG}/media`, { image_url: url, media_type: 'STORIES' });
if (!criado.id) {
  console.error('!! Instagram recusou o container:', JSON.stringify(criado.error || criado));
  process.exit(1);
}
for (let i = 0; i < 20; i++) {
  const st = await fetch(`${API}/${criado.id}?fields=status_code&access_token=${TOKEN}`).then((r) => r.json());
  if (st.status_code === 'FINISHED') break;
  if (st.status_code === 'ERROR' || i === 19) {
    console.error('!! container não ficou pronto:', JSON.stringify(st));
    process.exit(1);
  }
  await Bun.sleep(3000);
}
const pub = await post(`${IG}/media_publish`, { creation_id: criado.id });
if (!pub.id) {
  console.error('!! falha ao publicar:', JSON.stringify(pub.error || pub));
  process.exit(1);
}
console.log(`✓ publicado no Stories (media ${pub.id}) — ${url}`);
