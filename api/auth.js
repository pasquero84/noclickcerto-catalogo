const crypto = require('crypto');

function sign(data, secret) {
  return crypto.createHmac('sha256', secret).update(String(data)).digest('hex');
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  const token = `${payload}.${sign(payload, adminPassword)}`;

  res.json({ success: true, token, expires });
};
