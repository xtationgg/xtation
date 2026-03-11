#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-$HOME/Desktop/html/backups}"
STAMP="${2:-$(date +"%Y%m%d-%H%M%S")}"
ARCHIVE_NAME="xtation-source-backup-${STAMP}.zip"
OUTPUT_PATH="${BACKUP_DIR%/}/${ARCHIVE_NAME}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xtation-backup.XXXXXX")"
STAGING_DIR="${TMP_DIR}/CLient-D82pm"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

rsync -a \
  --exclude '.git' \
  --exclude '.playwright-cli' \
  --exclude '.claude' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'dist-desktop' \
  --exclude 'output' \
  --exclude '.DS_Store' \
  "$ROOT_DIR/" "$STAGING_DIR/"

ditto -ck --sequesterRsrc --keepParent "$STAGING_DIR" "$OUTPUT_PATH"

printf 'Created source backup: %s\n' "$OUTPUT_PATH"
