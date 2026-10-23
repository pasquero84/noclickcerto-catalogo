// Autenticação do admin — compartilhada por auth/save/upload/catalogo.
// Arquivo com "_" na frente: a Vercel não publica como rota.
//
// Auditoria de segurança de 23/10/2026:
//  - a senha era comparada com `!==` (tempo variável) e sem limite de tentativas;
//  - o token era assinado com a PRÓPRIA senha (quem visse um token podia testar
//    senhas offline contra a assinatura);
//  - timingSafeEqual com tamanhos diferentes lançava erro (500).
const crypto = require('crypto');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Segredo próprio pra assinar o token (ADMIN_TOKEN_SECRET na Vercel). Sem ele,
// cai num derivado da senha — funciona, mas é o modo antigo: criar a variável.
function segredoDoToken() {
  if (process.env.ADMIN_TOKEN_SECRET) return process.env.ADMIN_TOKEN_SECRET;
  const senha = process.env.ADMIN_PASSWORD;
  return senha ? crypto.createHmac('sha256', senha).update('ncc-admin-token-v2').digest('hex') : null;
}

function senhaConfere(tentativa) {
  const senha = process.env.ADMIN_PASSWORD;
  if (!senha || typeof tentativa !== 'string' || !tentativa) return false;
  return crypto.timingSafeEqual(sha256(tentativa), sha256(senha));
}

function assinar(payload) {
  return crypto.createHmac('sha256', segredoDoToken()).update(String(payload)).digest('hex');
}

function emitirToken(validadeMs) {
  const expires = Date.now() + validadeMs;
  return { token: `${expires}.${assinar(expires)}`, expires };
}

function tokenValido(token) {
  if (!token || !segredoDoToken()) return false;
  const partes = String(token).split('.');
  if (partes.length !== 2) return false;
  const [payload, sig] = partes;
  const expires = parseInt(payload, 10);
  if (isNaN(expires) || Date.now() > expires) return false;
  return crypto.timingSafeEqual(sha256(sig), sha256(assinar(payload)));
}

function tokenDaRequisicao(req) {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

// O admin é servido pelo próprio domínio: nenhuma outra origem precisa chamar
// estas rotas. Sem `Access-Control-Allow-Origin: *`.
const ORIGEM = 'https://catalogo.noclickcerto.com.br';
function cors(res, metodos) {
  res.setHeader('Access-Control-Allow-Origin', ORIGEM);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', metodos);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

// Só arquivo de foto dentro de imagens/ — o DELETE do upload aceitava qualquer
// caminho do repositório (catalogo.json, vercel.json, api/*.js).
function caminhoDeImagemValido(p) {
  return typeof p === 'string' && !p.includes('..') &&
    /^imagens\/(?:[a-z0-9_-]+\/)*[a-z0-9._-]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(p);
}

module.exports = { senhaConfere, emitirToken, tokenValido, tokenDaRequisicao, cors, caminhoDeImagemValido };
