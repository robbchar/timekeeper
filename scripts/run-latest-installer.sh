#!/usr/bin/env bash
set -euo pipefail

# Find the newest TimeKeeper installer in release/
INSTALLER="$(ls -1 release/TimeKeeper-Setup-*.exe 2>/dev/null | sort | tail -n 1 || true)"

if [[ -z "$INSTALLER" ]]; then
  echo "No installer found in release/. Run 'npm run build:installer' first."
  exit 1
fi

echo "Launching installer: $INSTALLER"
"$INSTALLER"