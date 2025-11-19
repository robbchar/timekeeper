#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${APPDATA:-}" ]]; then
  echo "APPDATA is not set. This script is intended for Windows."
  exit 1
fi

SRC="$APPDATA/timekeeper"
TIMESTAMP="$(date +'%Y%m%d-%H%M%S')"
DEST_BASE="$APPDATA/timekeeper-backups"
DEST="$DEST_BASE/timekeeper-$TIMESTAMP"

mkdir -p "$DEST_BASE"

if [[ -d "$SRC" ]]; then
  mkdir -p "$DEST"

  echo -n "Copying backup"

  # run the copy in the background
  cp -a "$SRC/." "$DEST/" &
  cp_pid=$!

  # hide cursor
  printf '\e[?25l'
  # always restore cursor, even on Ctrl+C
  trap 'printf "\e[?25h"; exit' INT TERM EXIT

  spin_states=('.  ' '.. ' '...')
  i=0
  while kill -0 "$cp_pid" 2>/dev/null; do
    printf "\rCopying backup%s " "${spin_states[$i]}"
    i=$(((i + 1) % ${#spin_states[@]}))
    sleep 0.3
  done

  wait "$cp_pid"

  # restore cursor and clear trap
  printf '\e[?25h\r'
  trap - INT TERM EXIT

  printf "Backup created at: %s\n" "$DEST"
else
  echo "No existing data directory at '$SRC'; nothing to back up."
fi