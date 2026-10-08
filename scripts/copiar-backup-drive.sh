#!/usr/bin/env bash
# Copia o backup mais novo do GitHub (ainda criptografado) pro Google Drive do PC. Agendado no Windows toda segunda.
# Abrir uma cópia: bash scripts/abrir-backup.sh lê do GitHub; da pasta do Drive, ver a nota no Obsidian.
# bash scripts/copiar-backup-drive.sh [pasta-destino]
set -euo pipefail
cd "$(dirname "$0")/.."
dest=${1:-"/g/Meu Drive/Backups/Escritorio Village"}
log="$dest/ultimo.log"
mkdir -p "$dest"
id=$(gh run list --workflow backup.yml --status success --limit 1 --json databaseId,createdAt -q '.[0].databaseId')
day=$(gh run view "$id" --json createdAt -q '.createdAt[0:10]')
dir="$dest/$day"
if [ -f "$dir/backup.sql.enc" ]; then echo "$(date -Iseconds) já tinha $day" >> "$log"; exit 0; fi
tmp=$(mktemp -d)
gh run download "$id" -D "$tmp"
mkdir -p "$dir"
find "$tmp" -name '*.enc' -exec cp {} "$dir/" \;
rm -rf "$tmp"
# guarda as 26 cópias mais novas (meio ano)
ls -1d "$dest"/20??-??-?? 2>/dev/null | sort | head -n -26 | while read -r old; do rm -rf "$old"; done
echo "$(date -Iseconds) copiado $day (run $id)" >> "$log"
