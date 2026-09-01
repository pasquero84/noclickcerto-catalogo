// Funções compartilhadas de agrupamento por família de produto.
// Ficam aqui e não em gerar-imagens.mjs porque aquele arquivo executa seu CLI
// ao ser importado (e chamava process.exit no meio do aplicar-imagens).

const CORES = /\b(Preto|Branco|Azul|Verde|Vermelho|Rosa|Roxo|Amarelo|Laranja|Dourado|Prata|Silver|Gold|Grafite|Cinza|Desert|Natural|Citrus|Titanium|Midnight|Starlight|Titânio)\b/i;
const CAP = /\b(\d{2,4}\s?GB|\d{1,2}\s?TB|\d{1,2}\/\d{2,4})\b/i;
const RUIDO = /\b(LLA|LL\/A|Japon[êe]s|Anatel|eSIM|AS IS|1ª Linha|Original|Global)\b/gi;

export function familia(nome) {
  return nome
    .replace(CORES, ' ')
    .replace(CAP, ' ')
    .replace(RUIDO, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-·\s]+|[-·\s]+$/g, '');
}

export function slugFamilia(categoria, nome) {
  const f = familia(nome) || categoria;
  return `${categoria}-${f}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Para iPhone a cor É o produto: o card mostra "Azul" e o cliente compara cor
// antes de comprar. Uma imagem por família deixava o card dizendo Azul com
// foto laranja. Então o slug do iPhone carrega a cor.
export const CORES_RE = /\b(Preto|Branco|Azul|Verde|Vermelho|Rosa|Roxo|Amarelo|Laranja|Dourado|Prata|Silver|Gold|Grafite|Cinza|Desert|Natural|Citrus|Titanium|Midnight|Starlight|Titânio)\b/i;
export const CATEGORIAS_POR_COR = new Set(['iPhone']);

export function corDe(nome) {
  const m = nome.match(CORES_RE);
  return m ? m[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : null;
}

export function slugImagem(categoria, nome) {
  const base = slugFamilia(categoria, nome);
  if (!CATEGORIAS_POR_COR.has(categoria)) return base;
  const cor = corDe(nome);
  return cor ? `${base}-${cor}` : base;
}
