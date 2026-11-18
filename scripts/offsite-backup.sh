#!/usr/bin/env bash
# Menyalin folder backups/ ke penyimpanan lain dengan rclone.
# Pakai: RCLONE_REMOTE=namaremote:folder ./scripts/offsite-backup.sh
# rclone copy hanya menambah dan memperbarui berkas; tidak menghapus apa pun di tujuan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${BACKUP_DIR:-$ROOT/backups}"
REMOTE="${RCLONE_REMOTE:-}"

if [ -z "$REMOTE" ]; then
  echo "RCLONE_REMOTE belum diatur. Contoh: RCLONE_REMOTE=cloud:anugerahlink-backups" >&2
  exit 1
fi
if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone belum terpasang. Lihat docs/app/DEPLOY.md." >&2
  exit 1
fi
if [ ! -d "$SRC" ]; then
  echo "Folder cadangan tidak ada: $SRC" >&2
  exit 1
fi

rclone copy "$SRC" "$REMOTE" --transfers 2 --log-level INFO
echo "Cadangan disalin ke $REMOTE"
