// ============================================================
// PÁGINA DE PRODUTO — /p/<CODIGO>
//
// Landing de conversão por produto, pensada pro Stefano mandar o link direto
// pro cliente no WhatsApp. Renderizada no servidor de propósito: o preview
// que o WhatsApp/Instagram mostram (Open Graph) só funciona com as tags no
// HTML inicial — em página feita só por JS o link chega "pelado".
//
// Agrupa as cores do mesmo aparelho: o catálogo tem uma linha por cor
// (IPH-0019 Azul, IPH-0020 Verde = mesmo iPhone 16 256GB), mas o cliente tem
// que ver um produto com as cores disponíveis, não três produtos.
// ============================================================

const WA = '5512992006037';
const CORES_RE =
  /\b(Preto|Branco|Azul|Verde|Vermelho|Rosa|Roxo|Amarelo|Laranja|Dourado|Prata|Silver|Gold|Grafite|Cinza|Desert|Natural|Citrus|Titanium|Midnight|Starlight)\b/i;

const brl = (v) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const brlCurto = (v) =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function modeloBase(nome) {
  return nome.replace(CORES_RE, '').replace(/\s+/g, ' ').trim();
}

function garantia(p) {
  if (p.condicao !== 'Seminovo') return 'Lacrado de fábrica, com nota fiscal';
  const m = p.nome.match(/\b(\d{1,2})\b/);
  const geracao = m ? parseInt(m[1], 10) : null;
  if (p.categoria !== 'iPhone' || !geracao) return '3 meses de garantia';
  return geracao > 14 ? '6 meses de garantia' : '3 meses de garantia';
}

export default async function handler(req, res) {
  const codigo = String(req.query.c || req.query.codigo || '').toUpperCase().trim();

  const origem = `https://${req.headers.host}`;
  let catalogo;
  try {
    const r = await fetch(`${origem}/catalogo.json`, { headers: { 'User-Agent': 'ncc-p/1.0' } });
    catalogo = await r.json();
  } catch {
    res.status(500).send('catálogo indisponível');
    return;
  }

  const produtos = catalogo.produtos || [];
  const alvo = produtos.find((p) => p.codigo === codigo);

  if (!alvo) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(404).send(
      `<!doctype html><meta charset="utf-8"><title>Produto não encontrado</title>
       <meta http-equiv="refresh" content="3;url=/">
       <body style="font-family:system-ui;background:#0a0a0c;color:#f5f5f7;display:grid;place-items:center;height:100vh;margin:0">
       <div style="text-align:center"><p style="font-size:18px">Produto não encontrado.</p>
       <p style="color:#8e8e93">Levando você pro catálogo…</p></div></body>`
    );
    return;
  }

  // Irmãos = mesmo aparelho, cores diferentes.
  const base = modeloBase(alvo.nome);
  const irmaos = produtos.filter(
    (p) =>
      modeloBase(p.nome) === base &&
      p.condicao === alvo.condicao &&
      p.status !== 'Consultar Disponibilidade'
  );
  const familia = irmaos.length ? irmaos : [alvo];

  const cores = [
    ...new Set(
      familia
        .map((p) => (p.nome.match(CORES_RE) || [])[0])
        .filter(Boolean)
        .map((c) => c[0].toUpperCase() + c.slice(1).toLowerCase())
    ),
  ];

  // Preço mostrado = o menor da família (é o "a partir de" honesto).
  const barato = familia.reduce((a, b) => (a.preco_pix <= b.preco_pix ? a : b));
  const pix = barato.preco_pix;
  const cartao = barato.preco_cartao || Math.round(pix * 1.11 * 100) / 100;
  const link = barato.preco_link || Math.round(pix * 1.17 * 100) / 100;
  const parcela = barato.preco_10x || Math.round((link / 10) * 100) / 100;

  const titulo = `${base} — ${brlCurto(pix)} no Pix`;
  const descricao = [
    alvo.condicao === 'Seminovo'
      ? `Seminovo${alvo.bateria ? `, bateria ${alvo.bateria}` : ''}`
      : 'Lacrado, com nota fiscal',
    cores.length ? `${cores.length} cor${cores.length > 1 ? 'es' : ''}: ${cores.join(', ')}` : null,
    `10× de ${brlCurto(parcela)} no link`,
    'Entrega grátis em Ubatuba',
  ]
    .filter(Boolean)
    .join(' · ');

  const msg = encodeURIComponent(
    `Olá! Tenho interesse no ${base} (${alvo.codigo}).\nVi por ${brlCurto(pix)} no Pix. Está disponível?`
  );

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} | NoClickCerto</title>
<meta name="description" content="${esc(descricao)}">
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${origem}/p/${esc(alvo.codigo)}">
<meta property="og:site_name" content="NoClickCerto">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#04263f">
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;background:#04263f;color:#f5f5f7;
    min-height:100vh;
    background-image:radial-gradient(ellipse 900px 500px at 50% -10%, rgba(13,140,163,.42), transparent 65%)}
  .wrap{max-width:520px;margin:0 auto;padding:22px 18px 40px}
  a{color:inherit;text-decoration:none}

  .topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}
  .brand{font-family:'Barlow Condensed',sans-serif;font-size:25px;font-weight:700;line-height:1}
  .brand span{color:#ffc759}
  .voltar{font-size:13px;color:rgba(255,255,255,.6);font-weight:500}

  .bdgs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
  .bdg{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;
    padding:5px 11px;border-radius:20px}
  .b-cond{background:rgba(92,230,168,.16);color:#5ce6a8;border:1px solid rgba(92,230,168,.3)}
  .b-bat{background:rgba(255,199,89,.14);color:#ffc759;border:1px solid rgba(255,199,89,.28)}

  h1{font-family:'Barlow Condensed',sans-serif;font-size:39px;font-weight:700;
    line-height:1.02;letter-spacing:-.4px;margin-bottom:6px}
  .cod{font-size:12px;color:rgba(255,255,255,.45);letter-spacing:1.6px;font-weight:600}

  .card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
    border-radius:16px;padding:20px;margin-top:22px}

  .pix{display:flex;align-items:baseline;gap:10px}
  .pix b{font-family:'Barlow Condensed',sans-serif;font-size:47px;font-weight:700;
    color:#5ce6a8;line-height:1}
  .pix span{font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;
    color:rgba(255,255,255,.55)}
  .linhas{margin-top:15px;border-top:1px solid rgba(255,255,255,.1);padding-top:13px;
    display:flex;flex-direction:column;gap:9px}
  .linha{display:flex;justify-content:space-between;align-items:baseline;font-size:14px}
  .linha span{color:rgba(255,255,255,.66)}
  .linha b{font-weight:600;font-size:16px}
  .destaque b{color:#ffc759}

  .rot{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;
    color:rgba(255,255,255,.45);margin-bottom:10px}
  .cores{display:flex;gap:7px;flex-wrap:wrap}
  .cor{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);
    border-radius:9px;padding:8px 14px;font-size:14px;font-weight:500}

  .selos{display:flex;flex-direction:column;gap:10px;margin-top:22px}
  .selo{display:flex;gap:11px;align-items:flex-start;font-size:14px;
    color:rgba(255,255,255,.82);line-height:1.45}
  .selo i{font-style:normal;color:#5ce6a8;font-size:15px;flex-shrink:0}

  .cta{position:sticky;bottom:16px;margin-top:26px;display:block;
    background:#25d366;color:#06301c;border-radius:14px;padding:17px;
    text-align:center;font-size:17px;font-weight:700;
    box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .cta small{display:block;font-size:12px;font-weight:600;opacity:.72;margin-top:2px}

  .confia{margin-top:26px;text-align:center;font-size:13px;
    color:rgba(255,255,255,.55);line-height:1.6}
  .confia b{display:block;color:rgba(255,255,255,.85);font-size:15px;margin-bottom:4px;
    font-family:'Barlow Condensed',sans-serif;font-weight:600}
</style></head>
<body><div class="wrap">
  <div class="topo">
    <a href="/" class="brand">NoClick<span>Certo</span></a>
    <a href="/" class="voltar">← ver tudo</a>
  </div>

  <div class="bdgs">
    <span class="bdg b-cond">${esc(alvo.condicao)}</span>
    ${alvo.bateria && !/^[—-]+$/.test(String(alvo.bateria).trim())
      ? `<span class="bdg b-bat">bateria ${esc(alvo.bateria)}</span>`
      : ''}
  </div>

  <h1>${esc(base)}</h1>
  <div class="cod">${esc(alvo.codigo)}</div>

  <div class="card">
    <div class="pix"><b>${brlCurto(pix)}</b><span>no Pix</span></div>
    <div class="linhas">
      <div class="linha"><span>Cartão presencial</span><b>${brl(cartao)}</b></div>
      <div class="linha destaque"><span>Link de pagamento, 10×</span><b>${brl(parcela)}</b></div>
      <div class="linha"><span>Total no link</span><b>${brl(link)}</b></div>
    </div>
  </div>

  ${cores.length
    ? `<div class="card">
        <div class="rot">Cores disponíveis</div>
        <div class="cores">${cores.map((c) => `<div class="cor">${esc(c)}</div>`).join('')}</div>
      </div>`
    : ''}

  <div class="selos">
    <div class="selo"><i>✓</i><div>${esc(garantia(alvo))}</div></div>
    <div class="selo"><i>✓</i><div>Entrega <b>grátis</b> em Ubatuba</div></div>
    <div class="selo"><i>✓</i><div>Pagou até as 15h, recebe em até <b>48h úteis</b></div></div>
    <div class="selo"><i>✓</i><div>Pix, cartão presencial ou link de pagamento em 10×</div></div>
  </div>

  <a class="cta" href="https://wa.me/${WA}?text=${msg}" target="_blank" rel="noopener">
    Quero esse — chamar no WhatsApp
    <small>resposta rápida, direto com o Stefano</small>
  </a>

  <div class="confia">
    <b>Compre com quem você conhece.</b>
    Evite cair em golpes — aqui você sabe quem está do outro lado.
  </div>
</div></body></html>`);
}
