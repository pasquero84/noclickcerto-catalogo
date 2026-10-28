// ============================================================
// PREÇO DE VENDA — custo do fornecedor -> preços do catálogo
//
// CELULAR (iPhone, Xiaomi/Redmi/Poco, Realme): margem fixa no Pix,
//   R$650 até R$4.000 de custo e R$850 acima; cartão +11%, link 10x +17%.
//
// O QUE NÃO É CELULAR (Stefano, 28/10/2026): acessório, fone, AirTag, cabo,
//   fonte, Apple Watch, iPad, tablet, robô, console…
//   custo até R$4.000:  à vista (Pix) = custo × 1,35
//                       até 10x       = custo × 1,46 (preço total; parcela = total ÷ 10)
//   (começou 30%/40%; o Stefano subiu pra 35%/46% no mesmo dia, 28/10)
//   custo acima disso (MacBook): margem fixa de R$850, igual à do celular.
// Antes disso: Acessório 100% do custo e Fone R$500 fixos (31/08), e o resto
// caía na margem de celular.
//
// TODO preço (Pix, cartão, link) termina em ,90, sempre arredondando pra
// cima: R$143,00 -> R$143,90; R$1.233,95 -> R$1.234,90. A parcela é o total ÷ 10.
// ============================================================

const MARGEM_ATE_4K = 650;
const MARGEM_ACIMA_4K = 850;
const LIMITE_MARGEM = 4000;
const TAXA_CARTAO = 0.11;
const TAXA_LINK = 0.17;
const PARCELAS = 10;

export const MARGEM_VISTA = 0.35;
export const MARGEM_PARCELADO = 0.46;

const CATEGORIAS_NAO_CELULAR = new Set([
  'Acessório', 'Fone', 'MacBook', 'Apple Watch', 'iPad', 'Tablet', 'Robô', 'Console',
]);
// A categoria Xiaomi mistura celular com Redmi Pad, Buds, robô, TAG… — pelo nome.
const NOME_NAO_CELULAR = /\b(pad|buds|band|watch|robot|rob[ôo]|vacuum|aspirador|air\s*tag|tag|ps5|playstation|console|xbox|switch|tv|caixa de som|speaker)\b/i;

const r2 = (n) => Math.round(n * 100) / 100;

/** Próximo valor terminado em ,90 (nunca abaixo do calculado). */
export function final90(n) {
  const v = Math.round(n * 100);
  const base = Math.floor(v / 100) * 100 + 90;
  return (v <= base ? base : base + 100) / 100;
}

export function ehCelular(categoria, nome = '') {
  if (CATEGORIAS_NAO_CELULAR.has(categoria)) return false;
  return !NOME_NAO_CELULAR.test(nome);
}

export function calcPrecos(custo, categoria, nome = '') {
  if (!ehCelular(categoria, nome) && custo <= LIMITE_MARGEM) {
    const pix = final90(custo * (1 + MARGEM_VISTA));
    const parcelado = final90(custo * (1 + MARGEM_PARCELADO));
    return {
      preco_venda: parcelado,
      preco_pix: pix,
      preco_cartao: parcelado,
      preco_link: parcelado,
      preco_10x: r2(parcelado / PARCELAS),
      lucro_pix: r2(pix - custo),
      // bruto: a taxa da maquininha/link sai daqui (ver docs/WORKLOG 28/10)
      lucro_cartao: r2(parcelado - custo),
    };
  }
  const margem = custo <= LIMITE_MARGEM ? MARGEM_ATE_4K : MARGEM_ACIMA_4K;
  const pix = final90(custo + margem);
  const cartao = final90(pix * (1 + TAXA_CARTAO));
  const link = final90(pix * (1 + TAXA_LINK));
  return {
    preco_venda: cartao,
    preco_pix: pix,
    preco_cartao: cartao,
    preco_link: link,
    preco_10x: r2(link / PARCELAS),
    lucro_pix: r2(pix - custo),
    lucro_cartao: r2(pix - custo),
  };
}
