const crypto = require('crypto');

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expires = parseInt(payload, 10);
  if (isNaN(expires) || Date.now() > expires) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// Increase body size limit for image uploads
export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = 'pasquero84/noclickcerto-catalogo';
  const HEADERS = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'NoClickCerto-Admin/1.0'
  };

  // Upload image
  if (req.method === 'POST') {
    const { filename, content, codigo } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'filename e content são obrigatórios' });

    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
    const path = `imagens/${cleanName}`;

    try {
      // Check if file already exists (need SHA to update)
      let sha;
      const checkRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, { headers: HEADERS });
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        sha = checkJson.sha;
      }

      const body = {
        message: `Upload foto: ${cleanName}${codigo ? ` (${codigo})` : ''}`,
        content: content.replace(/^data:[^;]+;base64,/, '') // strip data URL prefix
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(body)
      });

      const putJson = await putRes.json();
      if (putJson.content && putJson.content.download_url) {
        // Use raw.githubusercontent.com for direct image access
        const rawUrl = `https://raw.githubusercontent.com/${REPO}/main/${path}`;
        res.json({ success: true, url: rawUrl, path });
      } else {
        res.status(500).json({ error: putJson.message || 'Erro ao fazer upload' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Delete image
  else if (req.method === 'DELETE') {
    const { path: imgPath } = req.body || {};
    if (!imgPath) return res.status(400).json({ error: 'path é obrigatório' });

    try {
      const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imgPath}`, { headers: HEADERS });
      if (!getRes.ok) return res.status(404).json({ error: 'Arquivo não encontrado' });
      const getJson = await getRes.json();

      const delRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imgPath}`, {
        method: 'DELETE',
        headers: HEADERS,
        body: JSON.stringify({ message: `Remove foto: ${imgPath}`, sha: getJson.sha })
      });

      if (delRes.ok) {
        res.json({ success: true });
      } else {
        const delJson = await delRes.json();
        res.status(500).json({ error: delJson.message });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
