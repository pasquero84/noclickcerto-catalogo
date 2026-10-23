/**
 * Rotas do admin — auditoria de segurança de 23/10/2026.
 *   bun test tests/api-admin.test.mjs
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.ADMIN_PASSWORD = 'senha-de-teste';
delete process.env.ADMIN_TOKEN_SECRET;
const A = require('../api/_auth.js');
const auth = require('../api/auth.js');
const catalogo = require('../api/catalogo.js');

function chamar(handler, { method = 'POST', body = {}, headers = {}, ip = '1.1.1.1' } = {}) {
  return new Promise((ok) => {
    const res = {
      code: 200, headers: {}, body: null,
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(b) { this.body = b; ok(this); },
      send(b) { this.body = b; ok(this); },
      end() { ok(this); },
    };
    handler({ method, body, headers: { 'x-forwarded-for': ip, ...headers } }, res);
  });
}

test('senha certa dá token; o token vale; adulterado não vale', async () => {
  const r = await chamar(auth, { body: { password: 'senha-de-teste' }, ip: '9.9.9.1' });
  assert.equal(r.code, 200);
  assert.ok(A.tokenValido(r.body.token));
  const [exp, sig] = r.body.token.split('.');
  assert.equal(A.tokenValido(`${Number(exp) + 1}.${sig}`), false);
  assert.equal(A.tokenValido(`${exp}.abc`), false); // tamanho diferente: antes dava 500
  assert.equal(A.tokenValido(''), false);
  assert.notEqual(r.headers['Access-Control-Allow-Origin'], '*');
});

test('token antigo (assinado com a própria senha) deixa de valer', () => {
  const crypto = require('crypto');
  const exp = String(Date.now() + 60_000);
  const antigo = `${exp}.${crypto.createHmac('sha256', 'senha-de-teste').update(exp).digest('hex')}`;
  assert.equal(A.tokenValido(antigo), false);
});

test('senha errada: 401 com atraso; na 6ª tentativa em 15 min, 429', async () => {
  const ip = '9.9.9.2';
  for (let i = 0; i < 5; i++) assert.equal((await chamar(auth, { body: { password: 'chute' + i }, ip })).code, 401);
  const bloqueado = await chamar(auth, { body: { password: 'senha-de-teste' }, ip });
  assert.equal(bloqueado.code, 429); // nem a senha certa passa durante o bloqueio
  assert.equal((await chamar(auth, { body: { password: 'senha-de-teste' }, ip: '9.9.9.3' })).code, 200);
});

test('/api/catalogo (catálogo completo) exige login', async () => {
  assert.equal((await chamar(catalogo, { method: 'GET' })).code, 401);
  assert.equal((await chamar(catalogo, { method: 'GET', headers: { authorization: 'Bearer 123.abc' } })).code, 401);
});

test('DELETE de imagem só aceita imagens/', () => {
  for (const ok of ['imagens/foto.jpg', 'imagens/produtos/iphone-17.png', 'imagens/fornecedor/x_1.webp']) assert.equal(A.caminhoDeImagemValido(ok), true, ok);
  for (const ruim of ['catalogo.json', 'vercel.json', 'api/auth.js', 'imagens/../catalogo.json', 'imagens/x.js', '/imagens/x.jpg', 'imagens/', null]) {
    assert.equal(A.caminhoDeImagemValido(ruim), false, String(ruim));
  }
});
