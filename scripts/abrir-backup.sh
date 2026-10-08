#!/usr/bin/env bash
# Baixa o backup mais novo do GitHub e abre com a chave privada do PC.
# bash scripts/abrir-backup.sh [pasta-destino] [chave-privada.pem]
set -euo pipefail
dest=${1:-/d/Backups/escritorio-village}
key=${2:-/d/Backups/escritorio-village/chave-privada.pem}
id=$(gh run list --workflow backup.yml --status success --limit 1 --json databaseId -q '.[0].databaseId')
dir="$dest/$(date +%Y-%m-%d)"
mkdir -p "$dir"
gh run download "$id" -D "$dir/tmp"
src=$(dirname "$(find "$dir/tmp" -name backup.sql.enc | head -n 1)")
openssl pkeyutl -decrypt -inkey "$key" -pkeyopt rsa_padding_mode:oaep -in "$src/chave.bin.enc" -out "$dir/k.bin"
openssl enc -d -aes-256-cbc -pbkdf2 -in "$src/backup.sql.enc" -out "$dir/backup.sql" -pass file:"$(cygpath -m "$dir/k.bin" 2>/dev/null || echo "$dir/k.bin")"
rm -rf "$dir/tmp" "$dir/k.bin"
echo "$dir/backup.sql ($(wc -c < "$dir/backup.sql") bytes)"
