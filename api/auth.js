const { senhaConfere, emitirToken, cors } = require('./_auth');

// Limite de tentativas por IP. Memória da instância serverless: segura o
// chute em sequência (que cai quase sempre na mesma instância quente), não é
// muro absoluto — pra isso, regra de rate limit no Firewall da Vercel.
const JANELA_MS = 15 * 60 * 1000;
const MAX_ERROS = 5;
const erros = new Map(); // ip -> { n, desde }

const ipDe = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = ipDe(req);
  const agora = Date.now();
  const reg = erros.get(ip);
  if (reg && agora - reg.desde < JANELA_MS && reg.n >= MAX_ERROS) {
    res.setHeader('Retry-After', String(Math.ceil((reg.desde + JANELA_MS - agora) / 1000)));
    return res.status(429).json({ error: 'Muitas tentativas. Espere 15 minutos.' });
  }

  const { password } = req.body || {};
  if (!senhaConfere(password)) {
    const atual = reg && agora - reg.desde < JANELA_MS ? reg : { n: 0, desde: agora };
    atual.n += 1;
    erros.set(ip, atual);
    await espera(800); // atrasa o chute em massa
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  erros.delete(ip);
  const { token, expires } = emitirToken(30 * 24 * 60 * 60 * 1000);
  res.json({ success: true, token, expires });
};
