// ============================================================
// PÁGINA DE PRODUTO — /p/<CODIGO>
//
// Landing de conversão por produto, pensada pro Stefano mandar o link direto
// pro cliente no WhatsApp. Renderizada no servidor de propósito: o preview
// que o WhatsApp/Instagram mostram (Open Graph) só funciona com as tags no
// HTML inicial — em página feita só por JS o link chega "pelado".
//
// ⚠️ Tema CLARO, igual ao catálogo (index.html). Até 31/08/2026 essa página
// era escura/azul enquanto o catálogo era claro — o Stefano flagrou a
// inconsistência ("muda o padrão pra cor azul"). Os dois têm que ser a
// mesma loja.
//
// Agrupa as cores do mesmo aparelho: o catálogo tem uma linha por cor
// (IPH-0019 Azul, IPH-0020 Verde = mesmo iPhone 16 256GB), mas o cliente tem
// que ver um produto com as cores disponíveis, não três produtos.
// ============================================================

const WA = '5512991048039';
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
  if (p.condicao !== 'Seminovo') return 'Lacrado de fábrica';
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

  const produtos = (catalogo.produtos || []).filter((p) => !p.oculto);
  const alvo = produtos.find((p) => p.codigo === codigo);

  if (!alvo) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(404).send(
      `<!doctype html><meta charset="utf-8"><title>Produto não encontrado</title>
       <meta http-equiv="refresh" content="3;url=/">
       <body style="font-family:system-ui;background:#fff;color:#12151a;display:grid;place-items:center;height:100vh;margin:0">
       <div style="text-align:center"><p style="font-size:18px">Produto não encontrado.</p>
       <p style="color:#8b93a1">Levando você pro catálogo…</p></div></body>`
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
  const parcelaLink = barato.preco_10x || Math.round((link / 10) * 100) / 100;
  const parcelaCartao = Math.round((cartao / 10) * 100) / 100;
  const economia = Math.round(link - pix);

  const foto = alvo.foto_url || (Array.isArray(alvo.fotos) && alvo.fotos[0]) || null;

  const titulo = `${base} — ${brlCurto(pix)} no Pix`;
  const descricao = [
    alvo.condicao === 'Seminovo'
      ? `Seminovo${alvo.bateria ? `, bateria ${alvo.bateria}` : ''}`
      : 'Lacrado de fábrica',
    cores.length ? `${cores.length} cor${cores.length > 1 ? 'es' : ''}: ${cores.join(', ')}` : null,
    `10× de ${brlCurto(parcelaLink)} no link`,
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
${foto ? `<meta property="og:image" content="${esc(foto.startsWith('http') ? foto : origem + foto)}">` : ''}
<meta property="og:url" content="${origem}/p/${esc(alvo.codigo)}">
<meta property="og:site_name" content="NoClickCerto">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.svg">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --ink:#12151a;--ink-2:#5b6270;--ink-3:#8b93a1;--line:#e6e8ec;--line-strong:#d3d7de;
    --alt:#f6f7f9;--pix:#0a8f4d;--pix-bg:#e9f7ef;--wa:#1eb455;--wa-hover:#199a49;--warn:#b45309;
  }
  body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,system-ui,sans-serif;
    background:#fff;color:var(--ink);-webkit-font-smoothing:antialiased}
  .wrap{max-width:520px;margin:0 auto;padding:16px 16px 100px}
  a{color:inherit;text-decoration:none}

  .topo{display:flex;justify-content:space-between;align-items:center;padding:6px 0 16px}
  .brand{font-size:19px;font-weight:800;letter-spacing:-.4px}
  .brand span{color:#0a6fd8}
  .voltar{font-size:13.5px;color:var(--ink-2);font-weight:600}

  .media{background:#fdfdfd;border:1px solid var(--line);border-radius:16px;
    aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:16px}
  .media img{width:100%;height:100%;object-fit:contain;padding:9%}
  .media{position:relative}
  .ilus{position:absolute;bottom:9px;right:11px;font-size:10px;font-weight:700;color:var(--ink-3);
    background:rgba(255,255,255,.9);padding:3px 9px;border-radius:7px}

  .bdgs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
  .bdg{font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;
    padding:4px 10px;border-radius:20px}
  .b-cond{background:var(--pix-bg);color:var(--pix)}
  .b-bat{background:#fef3e2;color:var(--warn)}

  h1{font-size:26px;font-weight:800;letter-spacing:-.5px;line-height:1.15;margin-bottom:4px}
  .cod{font-size:12px;color:var(--ink-3);letter-spacing:1px;font-weight:600}

  .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:14px;
    box-shadow:0 1px 2px rgba(16,24,40,.04)}

  .old{font-size:13px;color:var(--ink-3);text-decoration:line-through;font-weight:600;margin-bottom:2px}
  .pix{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
  .pix b{font-size:38px;font-weight:800;letter-spacing:-1px;color:var(--ink);line-height:1}
  .pix span{font-size:11.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
    color:var(--pix);background:var(--pix-bg);padding:4px 9px;border-radius:7px}
  .econ{font-size:12.5px;font-weight:700;color:var(--warn);margin-top:7px}
  .linhas{margin-top:14px;border-top:1px solid var(--line);padding-top:12px;
    display:flex;flex-direction:column;gap:8px}
  .linha{display:flex;justify-content:space-between;align-items:baseline;font-size:13.5px;gap:10px}
  .linha span{color:var(--ink-2)}
  .linha small{display:block;color:var(--ink-3);font-size:11px;margin-top:1px}
  .linha b{font-weight:700;font-size:15px;color:var(--ink);white-space:nowrap}

  .rot{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
    color:var(--ink-3);margin-bottom:10px}
  .cores{display:flex;gap:7px;flex-wrap:wrap}
  .cor{background:var(--alt);border:1px solid var(--line-strong);
    border-radius:9px;padding:8px 14px;font-size:13.5px;font-weight:600}
  .desc p{font-size:14px;line-height:1.6;color:var(--ink-2);margin-bottom:8px}
  .desc p:last-child{margin-bottom:0}

  .selos{display:flex;flex-direction:column;gap:9px;margin-top:16px}
  .selo{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:var(--ink-2);line-height:1.4}
  .selo i{font-style:normal;color:var(--pix);font-weight:800;flex-shrink:0}
  .selo b{color:var(--ink)}

  .ctabar{position:fixed;left:0;right:0;bottom:0;background:#fff;
    border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom));
    box-shadow:0 -6px 20px rgba(16,24,40,.06)}
  .ctabar-in{max-width:520px;margin:0 auto}
  .cta{display:block;background:var(--wa);color:#fff;border-radius:13px;padding:15px;
    text-align:center;font-size:15.5px;font-weight:700}
  .cta small{display:block;font-size:11.5px;font-weight:600;opacity:.85;margin-top:2px}

  .confia{margin-top:24px;text-align:center;font-size:12.5px;color:var(--ink-3);line-height:1.6}
  .confia b{display:block;color:var(--ink);font-size:14.5px;margin-bottom:3px;font-weight:700}
</style></head>
<body><div class="wrap">
  <div class="topo">
    <a href="/" class="brand">NoClick<span>Certo</span></a>
    <a href="/" class="voltar">← ver tudo</a>
  </div>

  <div class="media">
    ${foto ? `<img src="${esc(foto)}" alt="${esc(base)}">` : ''}
    ${(!foto || foto.includes('/imagens/produtos/')) ? '<div class="ilus">Imagem ilustrativa</div>' : ''}
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
    ${link > pix ? `<div class="old">De ${brl(link)}</div>` : ''}
    <div class="pix"><b>${brlCurto(pix)}</b><span>no Pix</span></div>
    ${economia > 0 ? `<div class="econ">Economize ${brlCurto(economia)} pagando no Pix</div>` : ''}
    <div class="linhas">
      <div class="linha"><div><span>Cartão presencial, 10×</span><small>total ${brl(cartao)}</small></div><b>${brl(parcelaCartao)}</b></div>
      <div class="linha"><div><span>Link de pagamento, 10×</span><small>total ${brl(link)}</small></div><b>${brl(parcelaLink)}</b></div>
    </div>
  </div>

  ${alvo.descricao ? `<div class="card">
    <div class="rot">Sobre o produto</div>
    <div class="desc">${esc(alvo.descricao).split('\n').map((l) => `<p>${l}</p>`).join('')}</div>
  </div>` : ''}

  ${cores.length
    ? `<div class="card">
        <div class="rot">Cores disponíveis</div>
        <div class="cores">${cores.map((c) => `<div class="cor">${esc(c)}</div>`).join('')}</div>
      </div>`
    : ''}

  <div class="selos">
    <div class="selo"><i>✓</i><div><b>${esc(garantia(alvo))}</b></div></div>
    <div class="selo"><i>✓</i><div>Entrega <b>grátis</b> em Ubatuba</div></div>
    <div class="selo"><i>✓</i><div>Pagou até as 15h, recebe em até <b>48h úteis</b></div></div>
    <div class="selo"><i>✓</i><div>Pix, cartão presencial ou link de pagamento em 10×</div></div>
  </div>

  <div class="confia">
    <b>Compre com quem você conhece.</b>
    Evite cair em golpes — aqui você sabe quem está do outro lado.
  </div>
</div>

<div class="ctabar"><div class="ctabar-in">
  <a class="cta" href="https://wa.me/${WA}?text=${msg}" target="_blank" rel="noopener">
    Quero esse — chamar no WhatsApp
    <small>resposta na hora</small>
  </a>
</div></div>
</body></html>`);
}
