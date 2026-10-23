const { tokenValido, tokenDaRequisicao, cors } = require('./_auth');

module.exports = async function handler(req, res) {
  cors(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!tokenValido(tokenDaRequisicao(req))) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { catalog, message } = req.body || {};
  if (!catalog) return res.status(400).json({ error: 'catalog ausente' });

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = 'pasquero84/noclickcerto-catalogo';
  const HEADERS = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'NoClickCerto-Admin/1.0'
  };

  try {
    // Get current SHA
    const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/catalogo.json`, { headers: HEADERS });
    const getJson = await getRes.json();
    if (!getJson.sha) return res.status(500).json({ error: 'Não foi possível obter SHA do arquivo', detail: getJson.message });

    // Update catalog date
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    catalog.meta = catalog.meta || {};
    catalog.meta.ultima_atualizacao = dateStr;
    catalog.meta.total_produtos = catalog.produtos ? catalog.produtos.length : 0;

    const content = Buffer.from(JSON.stringify(catalog, null, 2), 'utf8').toString('base64');
    const commitMsg = message || `Admin: atualização do catálogo ${dateStr}`;

    const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/catalogo.json`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ message: commitMsg, content, sha: getJson.sha })
    });

    const putJson = await putRes.json();

    if (putJson.content && putJson.content.sha) {
      res.json({ success: true, sha: putJson.content.sha, commit: putJson.commit.sha, message: commitMsg });
    } else {
      res.status(500).json({ error: putJson.message || 'Erro ao commitar no GitHub' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
