#!/bin/bash
# Rodado pelo launchd (ops/com.noclickcerto.stories.plist): 11h story 1, 18h story 2.
# Gera as artes do dia se ainda não existirem e tenta postar. Sem o arquivo
# ~/Library/NCK/stories/LIGADO o postar-story.mjs só faz ensaio (nada publica).
set -u
N="${1:?uso: stories-agendado.sh 1|2}"
cd "$HOME/noclickcerto-catalogo" || exit 1
HOJE=$(date +%F)
LOG="$HOME/Library/NCK/stories/stories.log"
mkdir -p "$(dirname "$LOG")"
{
  echo "=== $(date '+%F %T') story $N"
  ls "/Volumes/Externo SSD/01-NoClickCerto/Marca e Artes/Stories Catalogo/${HOJE:0:7}/${HOJE}-story${N}-"*.png >/dev/null 2>&1 \
    || "$HOME/.bun/bin/bun" scripts/stories-diarios.mjs "$HOJE"
  "$HOME/.bun/bin/bun" scripts/postar-story.mjs "$HOJE" "$N" --publicar
} >> "$LOG" 2>&1
