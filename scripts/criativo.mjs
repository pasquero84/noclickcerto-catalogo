#!/usr/bin/env bun
// ============================================================
// GERADOR DE CRIATIVO — arte quadrada 1080x1080 pro WhatsApp/Instagram
//
// Monta a arte a partir do catálogo REAL (nunca preço inventado) e renderiza
// com o Chrome do sistema em headless — mesmo caminho do render de PDF que já
// é usado nos outros projetos (não depende de Homebrew nem de puppeteer full).
//
// Regras de copy fixas (ditas pelo Stefano em 31/08/2026):
//   - entrega grátis em Ubatuba
//   - pago até as 15h -> até 48h úteis
//   - garantia: até o iPhone 14 = 3 meses | acima do 14 = 6 meses
//   - "Compre com quem você confia. Evite cair em golpes."
//
// uso: bun scripts/criativo.mjs seminovos   [--abrir]
//      bun scripts/criativo.mjs lacrados
// ============================================================

const TIPO = process.argv[2] || 'seminovos';
const SAIDA = `${process.env.HOME}/Documents/Projetos/_criativos`;

const catalogo = JSON.parse(await Bun.file('catalogo.json').text());

const condicao = TIPO === 'lacrados' ? 'Lacrado' : 'Seminovo';
const itens = catalogo.produtos
  .filter(
    (p) =>
      p.categoria === 'iPhone' &&
      p.condicao === condicao &&
      p.status === 'Disponível' &&
      p.preco_pix
  );

// Agrupa por modelo+capacidade: o catálogo tem uma linha por cor, mas na arte
// o cliente quer ver o aparelho uma vez só, com as cores ao lado.
const porModelo = new Map();
for (const p of itens) {
  const modelo = p.nome
    .replace(/\b(preto|branco|azul|verde|vermelho|rosa|roxo|amarelo|laranja|dourado|prata|silver|gold|grafite|cinza|desert|natural|citrus|titanium|as is)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const atual = porModelo.get(modelo);
  const cor = (p.nome.match(/\b(Preto|Branco|Azul|Verde|Vermelho|Rosa|Roxo|Amarelo|Laranja|Dourado|Prata|Silver|Gold|Grafite|Cinza|Desert|Natural|Citrus|Titanium)\b/i) || [])[0];
  if (!atual) {
    porModelo.set(modelo, { modelo, preco: p.preco_pix, bateria: p.bateria, cores: new Set(cor ? [cor] : []) });
  } else {
    if (p.preco_pix < atual.preco) atual.preco = p.preco_pix;
    if (cor) atual.cores.add(cor);
    if (!atual.bateria && p.bateria) atual.bateria = p.bateria;
  }
}

const linhas = [...porModelo.values()]
  .sort((a, b) => b.preco - a.preco)
  .slice(0, 7);

const R = (v) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1080px;overflow:hidden;
    font-family:'Inter',system-ui,sans-serif;
    background:linear-gradient(165deg,#04263f 0%,#075b7d 45%,#0d8ca3 100%);
    color:#fff;position:relative}

  /* espuma de onda no rodapé — a cara da marca, sem imagem externa */
  .wave{position:absolute;left:0;right:0;bottom:0;height:220px;
    background:
      radial-gradient(ellipse 700px 130px at 15% 100%, rgba(255,255,255,.20), transparent 70%),
      radial-gradient(ellipse 620px 110px at 70% 100%, rgba(255,255,255,.14), transparent 70%),
      radial-gradient(ellipse 900px 90px at 45% 108%, rgba(255,255,255,.28), transparent 72%);
    pointer-events:none}
  .sun{position:absolute;top:-140px;right:-120px;width:520px;height:520px;border-radius:50%;
    background:radial-gradient(circle,rgba(255,199,89,.30),rgba(255,199,89,0) 62%)}

  .wrap{position:relative;z-index:2;height:100%;padding:46px 58px 42px;display:flex;flex-direction:column}

  header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  .brand{font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:700;
    letter-spacing:.5px;line-height:1}
  .brand span{color:#ffc759}
  .handle{font-size:14px;color:rgba(255,255,255,.62);letter-spacing:2.4px;
    text-transform:uppercase;margin-top:5px;font-weight:500}
  .data{text-align:right;font-size:13px;color:rgba(255,255,255,.62);
    letter-spacing:1.6px;text-transform:uppercase;font-weight:600}

  h1{font-family:'Barlow Condensed',sans-serif;font-size:64px;font-weight:700;
    line-height:.92;text-transform:uppercase;letter-spacing:-.5px}
  h1 em{font-style:normal;display:block;color:#ffc759}
  .sub{font-size:17px;color:rgba(255,255,255,.80);margin-top:10px;font-weight:500}

  .lista{margin-top:24px;flex:1;display:flex;flex-direction:column;gap:8px;justify-content:flex-start}
  .item{display:flex;align-items:center;gap:16px;
    background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.11);
    border-radius:12px;padding:11px 18px}
  .nome{flex:1;min-width:0}
  .nome b{display:block;font-size:19px;font-weight:600;letter-spacing:-.2px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta{font-size:13px;color:rgba(255,255,255,.58);margin-top:3px;font-weight:500}
  .preco{font-family:'Barlow Condensed',sans-serif;font-size:31px;font-weight:700;
    color:#5ce6a8;white-space:nowrap;letter-spacing:.3px}
  .preco small{display:block;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;
    color:rgba(255,255,255,.52);letter-spacing:1.6px;text-transform:uppercase;
    text-align:right;margin-top:-3px}

  .selos{display:flex;gap:9px;margin-top:18px}
  .selo{flex:1;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.14);
    border-radius:11px;padding:11px 13px;text-align:center}
  .selo b{display:block;font-size:14px;font-weight:700;margin-bottom:3px}
  .selo span{font-size:12px;color:rgba(255,255,255,.66);line-height:1.35;font-weight:500}

  footer{margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end}
  .confia{font-family:'Barlow Condensed',sans-serif;font-size:27px;font-weight:600;line-height:1.05}
  .confia small{display:block;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;
    color:rgba(255,255,255,.62);margin-top:6px;letter-spacing:.2px}
  .cta{background:#ffc759;color:#04263f;border-radius:11px;padding:13px 24px;
    font-size:16px;font-weight:700;text-align:center;white-space:nowrap}
  .cta small{display:block;font-size:11px;font-weight:600;opacity:.72;margin-top:1px}
</style></head><body>
<div class="sun"></div><div class="wave"></div>
<div class="wrap">
  <header>
    <div>
      <div class="brand">NoClick<span>Certo</span></div>
      <div class="handle">Ubatuba · Litoral Norte</div>
    </div>
    <div class="data">Tabela de ${hoje}</div>
  </header>

  <h1>iPhone<em>${condicao === 'Seminovo' ? 'seminovos' : 'lacrados'}</em></h1>
  <div class="sub">${condicao === 'Seminovo' ? 'Bateria testada · aparelho conferido antes de entregar' : 'Novo, lacrado de fábrica · nota fiscal'}</div>

  <div class="lista">
    ${linhas
      .map((l) => {
        const cores = [...l.cores].slice(0, 4).join(' · ');
        const bat = l.bateria && !/^[—-]+$/.test(String(l.bateria).trim()) ? `bateria ${l.bateria}` : null;
        const meta = [bat, cores || null]
          .filter(Boolean)
          .join('  ·  ');
        return `<div class="item">
          <div class="nome"><b>${l.modelo}</b>${meta ? `<div class="meta">${meta}</div>` : ''}</div>
          <div class="preco">${R(l.preco)}<small>no pix</small></div>
        </div>`;
      })
      .join('')}
  </div>

  <div class="selos">
    <div class="selo"><b>Entrega grátis</b><span>em Ubatuba</span></div>
    <div class="selo"><b>Pagou até 15h</b><span>recebe em até 48h úteis</span></div>
    ${condicao === 'Seminovo'
      ? '<div class="selo"><b>Garantia real</b><span>até o 14: 3 meses<br>acima do 14: 6 meses</span></div>'
      : '<div class="selo"><b>Lacrado de fábrica</b><span>com nota fiscal</span></div>'}
  </div>

  <footer>
    <div class="confia">Compre com quem você conhece.<small>Evite cair em golpes — aqui você sabe quem está do outro lado.</small></div>
    <div class="cta">Chama no WhatsApp<small>catalogo.noclickcerto.com.br</small></div>
  </footer>
</div></body></html>`;

await Bun.$`mkdir -p ${SAIDA}`.quiet();
const htmlPath = `${SAIDA}/criativo-${TIPO}.html`;
const pngPath = `${SAIDA}/criativo-${TIPO}-${new Date().toISOString().slice(0, 10)}.png`;
await Bun.write(htmlPath, html);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await Bun.$`${CHROME} --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1080 --virtual-time-budget=6000 --screenshot=${pngPath} file://${htmlPath}`.quiet();

console.log(`✓ ${linhas.length} produtos na arte`);
console.log(`  ${pngPath}`);
