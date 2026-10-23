// Catálogo COMPLETO (com custo, margem e fornecedor) — só pro admin logado.
// O site público lê /catalogo.publico.json, gerado no build sem esses campos.
// Lê do GitHub (a mesma fonte em que o /api/save grava), então funciona com o
// repositório privado.
const { tokenValido, tokenDaRequisicao, cors } = require('./_auth');

module.exports = async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!tokenValido(tokenDaRequisicao(req))) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const r = await fetch('https://api.github.com/repos/pasquero84/noclickcerto-catalogo/contents/catalogo.json?ref=main', {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'NoClickCerto-Admin/1.0',
      },
    });
    if (!r.ok) {
      const detalhe = await r.text();
      return res.status(502).json({ error: 'Não consegui ler o catálogo no GitHub', detail: `${r.status} ${detalhe.slice(0, 200)}` });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(await r.text());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
