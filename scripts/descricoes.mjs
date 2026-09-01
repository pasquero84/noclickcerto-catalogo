#!/usr/bin/env bun
// ============================================================
// DESCRIÇÃO DE PRODUTO — ficha técnica por modelo
//
// Por que não é copiado do site da Apple: o TEXTO de marketing deles é obra
// protegida. Já a ESPECIFICAÇÃO é fato — tamanho de tela, número de câmeras,
// tipo de conector. Fato não tem dono, e é isso que o cliente precisa saber.
// Então a ficha aqui é escrita do zero, com dado técnico correto.
//
// Só entra o que é verificável. Nada de "a melhor câmera já feita".
//
// uso: bun scripts/descricoes.mjs [--aplicar]
// ============================================================

const APLICAR = process.argv.includes('--aplicar');

// tela (polegadas), câmeras traseiras, conector, observação de geração
const FICHA = [
  { re: /17\s*pro\s*max/i, tela: '6,9"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Tela ProMotion com taxa de atualização adaptativa e ilha dinâmica' },
  { re: /17\s*pro(?!\s*max)/i, tela: '6,3"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Tela ProMotion com taxa de atualização adaptativa e ilha dinâmica' },
  { re: /17\s*air/i, tela: '6,5"', cams: '1 câmera traseira', porta: 'USB-C', extra: 'Modelo mais fino da linha, com ilha dinâmica' },
  { re: /17e/i, tela: '6,1"', cams: '2 câmeras traseiras', porta: 'USB-C', extra: 'Versão de entrada da geração 17' },
  { re: /17(?!\s*(pro|air|e))/i, tela: '6,3"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'USB-C', extra: 'Ilha dinâmica' },
  { re: /16\s*pro\s*max/i, tela: '6,9"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Tela ProMotion, ilha dinâmica, botão de Controle da Câmera e Botão de Ação' },
  { re: /16\s*pro(?!\s*max)/i, tela: '6,3"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Tela ProMotion, ilha dinâmica, botão de Controle da Câmera e Botão de Ação' },
  { re: /16\s*plus/i, tela: '6,7"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'USB-C', extra: 'Ilha dinâmica, botão de Controle da Câmera e Botão de Ação' },
  { re: /16(?!\s*(pro|plus|e))/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'USB-C', extra: 'Ilha dinâmica, botão de Controle da Câmera e Botão de Ação' },
  { re: /15\s*pro\s*max/i, tela: '6,7"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Estrutura em titânio, tela ProMotion, ilha dinâmica e Botão de Ação' },
  { re: /15\s*pro(?!\s*max)/i, tela: '6,1"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'USB-C', extra: 'Estrutura em titânio, tela ProMotion, ilha dinâmica e Botão de Ação' },
  { re: /15\s*plus/i, tela: '6,7"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'USB-C', extra: 'Ilha dinâmica' },
  { re: /15(?!\s*(pro|plus))/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'USB-C', extra: 'Ilha dinâmica' },
  { re: /14\s*pro\s*max/i, tela: '6,7"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Tela ProMotion e ilha dinâmica' },
  { re: /14\s*pro(?!\s*max)/i, tela: '6,1"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Tela ProMotion e ilha dinâmica' },
  { re: /14\s*plus/i, tela: '6,7"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
  { re: /14(?!\s*(pro|plus))/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
  { re: /13\s*pro\s*max/i, tela: '6,7"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Tela ProMotion' },
  { re: /13\s*pro(?!\s*max)/i, tela: '6,1"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Tela ProMotion' },
  { re: /13\s*mini/i, tela: '5,4"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
  { re: /13(?!\s*(pro|mini))/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
  { re: /12\s*pro\s*max/i, tela: '6,7"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Sensor LiDAR' },
  { re: /12\s*pro(?!\s*max)/i, tela: '6,1"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: 'Sensor LiDAR' },
  { re: /12(?!\s*(pro|mini))/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
  { re: /11\s*pro\s*max/i, tela: '6,5"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: null },
  { re: /11\s*pro(?!\s*max)/i, tela: '5,8"', cams: '3 câmeras traseiras (principal, ultra-angular e teleobjetiva)', porta: 'Lightning', extra: null },
  { re: /11(?!\s*pro)/i, tela: '6,1"', cams: '2 câmeras traseiras (principal e ultra-angular)', porta: 'Lightning', extra: null },
];

const CAP = /\b(\d{2,4})\s?GB\b|\b(\d{1,2})\s?TB\b/i;
const ORIGEM_TXT = {
  LLA: 'Versão LL/A (modelo americano). A garantia da Apple é global.',
  'LL/A': 'Versão LL/A (modelo americano). A garantia da Apple é global.',
  'JAPONÊS': 'Versão japonesa. A garantia da Apple é global.',
  JAPONES: 'Versão japonesa. A garantia da Apple é global.',
  ANATEL: 'Versão nacional, homologada pela Anatel.',
};

function fichaDe(nome) {
  return FICHA.find((f) => f.re.test(nome)) || null;
}

function capacidade(nome) {
  const m = nome.match(CAP);
  if (!m) return null;
  return m[1] ? `${m[1]} GB` : `${m[2]} TB`;
}

function origemDe(nome) {
  const n = nome.toUpperCase();
  for (const [k, v] of Object.entries(ORIGEM_TXT)) if (n.includes(k)) return v;
  return null;
}

export function descricaoDe(p) {
  const linhas = [];

  if (p.categoria === 'iPhone') {
    const f = fichaDe(p.nome);
    const cap = capacidade(p.nome);
    if (f) {
      const ficha = [
        `Tela de ${f.tela}`,
        cap ? `${cap} de armazenamento` : null,
        f.cams,
        `Conector ${f.porta}`,
      ].filter(Boolean);
      linhas.push(ficha.join(' · '));
      if (f.extra) linhas.push(f.extra);
    } else if (cap) {
      linhas.push(`${cap} de armazenamento`);
    }
    const org = origemDe(p.nome);
    if (org) linhas.push(org);
  }

  // condição — o que MUDA a decisão de compra
  if (p.condicao === 'Seminovo') {
    const bat = p.bateria && !/^[—-]+$/.test(String(p.bateria).trim()) ? p.bateria : null;
    linhas.push(
      `Aparelho seminovo, testado antes de sair daqui${bat ? `, com saúde de bateria ${bat}` : ''}.`
    );
    const g = parseInt((p.nome.match(/\b(\d{1,2})\b/) || [])[1] || '0', 10);
    linhas.push(g > 14 ? 'Garantia de 6 meses.' : 'Garantia de 3 meses.');
  } else {
    linhas.push('Aparelho novo, lacrado de fábrica.');
    linhas.push('Nota fiscal disponível mediante solicitação, com acréscimo de 8%.');
  }

  linhas.push('Entrega grátis em Ubatuba. Pagamento até as 15h, entrega em até 48h úteis.');
  return linhas.join('\n');
}

// ── CLI ──
if (import.meta.main) {
  const catalogo = JSON.parse(await Bun.file('catalogo.json').text());
  let escritas = 0, semFicha = 0;

  for (const p of catalogo.produtos) {
    if (p.oculto) continue;
    const d = descricaoDe(p);
    if (p.categoria === 'iPhone' && !fichaDe(p.nome)) semFicha++;
    if (p.descricao !== d) { p.descricao = d; escritas++; }
  }

  const amostra = catalogo.produtos.filter((p) => !p.oculto && p.categoria === 'iPhone').slice(0, 2);
  for (const p of amostra) {
    console.log(`\n── ${p.nome} (${p.codigo})`);
    console.log(p.descricao.split('\n').map((l) => '   ' + l).join('\n'));
  }
  console.log(`\n${escritas} descrições escritas · ${semFicha} iPhone(s) sem ficha técnica mapeada`);

  if (!APLICAR) { console.log('(simulação — use --aplicar pra gravar)'); process.exit(0); }
  await Bun.write('catalogo.json', JSON.stringify(catalogo, null, 2));
  console.log('✓ catalogo.json atualizado');
}
