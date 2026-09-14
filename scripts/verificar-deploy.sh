#!/bin/bash
# Confere se o que está em produção (catalogo.noclickcerto.com.br) bate com
# o index.html do commit atual — sem isso não dá pra saber, só por olhar o
# site, se o design que você vê é o mais novo ou um deploy antigo esquecido.
#
# Nasceu do INC de 14/09/2026: produção ficou 3 meses (e ~15 commits) presa
# num deploy de 05/06/2026, ninguém percebeu até o Stefano notar visualmente
# "parece um design antigo". Rode isto ANTES de confiar que "já está no ar".
#
# Uso: ./scripts/verificar-deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

echo "Baixando produção (catalogo.noclickcerto.com.br)…"
curl -s https://catalogo.noclickcerto.com.br/ -o "$TMP"

if diff -q "$TMP" index.html > /dev/null; then
  echo "✅ Produção bate exatamente com o index.html deste commit ($(git rev-parse --short HEAD))."
  exit 0
else
  echo "⚠️  DIVERGE — produção NÃO é o que está commitado agora."
  echo "    Linhas diferentes: $(diff "$TMP" index.html | wc -l | tr -d ' ')"
  echo "    Rode: vercel --prod --yes   (a partir deste diretório, com o git limpo)"
  exit 1
fi
