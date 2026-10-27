// ============================================================
// VALIDAÇÃO ESTRUTURAL DO CATÁLOGO — trava antes de publicar
//
// Companheira do `auditor.mjs`, que cobre PREÇO (histórico, mediana dos pares,
// piso por categoria). Em 30/09/2026 o catálogo publicado mostrou que preço não
// era o único jeito de sair coisa errada no ar:
//
//   - 30 produtos com nome que é fragmento da lista do fornecedor:
//     "• 16 Pro 128GB — R$ 3.", "SILVE", "⚡ Cabo Lightning:", "ista atualizada 05/06/"
//   - 188 códigos únicos para 203 linhas: ACS-0011 repetido 10x, cada repetição
//     um produto diferente — busca por código devolve o item errado
//   - um cabo de custo R$15 anunciado a R$665, porque a margem de R$650, que é
//     de aparelho, caiu num acessório
//
// O auditor não pegava nada disso: ele olha preço contra pares, e um cabo com
// nome "SILVE" não tem par para comparar. Daí este segundo portão, estrutural.
//
// Uso (mesmo formato do auditor, para encaixar em ingerir.mjs):
//   import { validarEstrutura, relatorioEstrutura } from './validar-catalogo.mjs';
//   const problemas = validarEstrutura(produtos);
//   if (problemas.length) { console.error(relatorioEstrutura(problemas)); process.exit(1); }
// ============================================================

/**
 * Nome que não é nome de produto, e sim sobra do parse da lista do fornecedor.
 * Devolve o motivo (string) ou null quando o nome está bom.
 *
 * Calibrado contra o catálogo real: zero falso positivo nos 203 produtos
 * publicados e nos nomes legítimos ("iPhone 17 Pro Max 256GB Japonês Laranja",
 * "MacBook Air M4 13 256GB Meia-noite", "AirPods Pro 3 USB-C").
 */
const APARELHO = /iphone|ipad|imac|macbook|airpods|airtag|watch|pencil|buds|fone|cabo|fonte|earpods|redmi|poco|realme|galaxy/i;

export function nomeCorrompido(nome) {
  if (typeof nome !== "string") return "não é texto";
  const n = nome.trim();
  if (!n) return "vazio";
  // "iPhone", "iPad", "iMac" começam com minúscula de propósito — não são fragmento.
  if (/^[a-zà-ú]/.test(n) && !/^i[A-Z]/.test(n)) return "começa com minúscula (fragmento de frase cortada)";
  // Curto sem número e sem nome de aparelho = sobra ("SILVE", "Dorudo.", "SKY BLUE").
  // Calibrado em 24/10: o limite seco de 12 caracteres barrava "Buds 5 Pro" e
  // "AirPods Max", que são produto de verdade.
  if (n.length < 12 && !/\d/.test(n) && !APARELHO.test(n)) return `curto demais (${n.length} caracteres) — parece só a cor ou a variante`;
  if (/^[•\-*·⚡]/.test(n)) return "começa com marcador de lista";
  if (/R\$/.test(n)) return "tem preço dentro do nome";
  if (/[:—-]\s*$/.test(n)) return "termina com pontuação de lista";
  if (/\b(lista|tabela)\s+atualizada\b/i.test(n)) return "é cabeçalho da lista do fornecedor";
  if (/\d{2}\/\d{2}\/?$/.test(n)) return "termina com data (linha de cabeçalho)";
  if (/^[A-ZÀ-Ú\s.]+$/.test(n) && n.length < 20) return "só maiúsculas (parece cor/variante)";
  return null;
}

/**
 * Preço que a margem de aparelho estragou. Dois defeitos diferentes:
 *
 *   1. Margem de celular num item barato — o cabo de R$15 que virou R$665.
 *      Medido pela razão, não pelo lucro absoluto: seminovo de custo R$990 com
 *      margem R$650 dá 1,7x e é normal.
 *
 *   2. Acessório caro — acessório não custa R$6.600. Quando custa, é aparelho
 *      que entrou com a categoria errada (ACS-0011 e ACS-0012 são iPhones
 *      americanos classificados como Acessório). Aqui o sinal é o CUSTO, não a
 *      margem: um AirTag de R$430 vendido a R$860 é margem legítima de
 *      acessório e não pode ser barrado.
 */
const CUSTO_MAXIMO_ACESSORIO = 1500;

export function precoDesproporcional(p) {
  const custo = Number(p?.custo);
  const pix = Number(p?.preco_pix);
  if (!Number.isFinite(custo) || custo <= 0) return "custo ausente ou zero";
  if (!Number.isFinite(pix) || pix <= 0) return "preco_pix ausente ou zero";

  const razao = pix / custo;
  if (razao > 2.5) return `custo R$${custo} → pix R$${pix} (${razao.toFixed(1)}x o custo)`;
  if (p.categoria === "Acessório" && custo > CUSTO_MAXIMO_ACESSORIO) {
    return `acessório com custo de aparelho (R$${custo}) — categoria provavelmente errada`;
  }
  return null;
}

/**
 * Os três portões estruturais. Devolve uma lista de problemas; vazia = pode publicar.
 * Cada item: { tipo, codigo, nome, motivo }.
 */
export function validarEstrutura(produtos) {
  const problemas = [];
  if (!Array.isArray(produtos)) return [{ tipo: "entrada", codigo: "-", nome: "-", motivo: "produtos não é uma lista" }];

  const vistos = new Map();
  for (const p of produtos) {
    // Oculto já está fora da vitrine (e de /p/): é o lixo antigo guardado só
    // porque código nunca some. Não trava publicação.
    if (p?.oculto) continue;
    const codigo = p?.codigo ?? "(sem código)";
    const nome = p?.nome ?? "(sem nome)";

    const mNome = nomeCorrompido(p?.nome);
    if (mNome) problemas.push({ tipo: "nome", codigo, nome, motivo: mNome });

    const mPreco = precoDesproporcional(p);
    if (mPreco) problemas.push({ tipo: "preco", codigo, nome, motivo: mPreco });

    if (!p?.codigo) {
      problemas.push({ tipo: "codigo", codigo, nome, motivo: "produto sem código" });
    } else if (vistos.has(p.codigo)) {
      problemas.push({
        tipo: "codigo", codigo, nome,
        motivo: `código repetido — já usado por "${vistos.get(p.codigo)}"`,
      });
    } else {
      vistos.set(p.codigo, nome);
    }
  }
  return problemas;
}

/** Texto para o console quando a publicação é barrada. */
export function relatorioEstrutura(problemas) {
  if (!problemas.length) return "estrutura do catálogo: ok";
  const porTipo = { nome: [], codigo: [], preco: [], entrada: [] };
  for (const p of problemas) (porTipo[p.tipo] ??= []).push(p);

  const rotulo = {
    nome: "NOME CORROMPIDO (sobra do parse da lista do fornecedor)",
    codigo: "CÓDIGO DUPLICADO (busca por código devolve o produto errado)",
    preco: "PREÇO DESPROPORCIONAL (margem de aparelho em item que não é aparelho)",
    entrada: "ENTRADA INVÁLIDA",
  };

  const l = [`PUBLICAÇÃO BARRADA — ${problemas.length} problema(s) estrutural(is)`, "─".repeat(70)];
  for (const [tipo, itens] of Object.entries(porTipo)) {
    if (!itens.length) continue;
    l.push(`\n${rotulo[tipo]} — ${itens.length}`);
    for (const p of itens) l.push(`  ${String(p.codigo).padEnd(10)} "${p.nome}"\n      ${p.motivo}`);
  }
  l.push("\n─".repeat(70));
  l.push("Nenhum produto foi publicado. Corrija a origem e rode de novo.");
  return l.join("\n");
}
