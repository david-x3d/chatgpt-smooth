#!/usr/bin/env bash
# Claude Smooth – permanent install for Chromium browsers on Linux.
#
# Chrome and its relatives only install extensions from outside the Chrome Web
# Store when a browser policy allows it. This script writes that policy for every
# supported browser it finds. No developer mode; the browser downloads the signed
# extension from the GitHub releases and keeps it up to date by itself.
#
#   sudo bash chromium-linux.sh               install
#   sudo bash chromium-linux.sh --uninstall   remove the policy again
#
# Afterwards restart the browser. It shows "Managed by your organization", which
# only refers to this one extension policy.

set -euo pipefail

ID="apcfbbbgjehepnkgalebhbmomegdndno"
UPDATE_URL="https://github.com/david-x3d/claude-smooth/releases/latest/download/updates.xml"
FILE="claude-smooth.json"

# browser name | executables to look for | policy folder
BROWSERS=(
  "Google Chrome|google-chrome-stable google-chrome-beta google-chrome-unstable google-chrome|/etc/opt/chrome/policies/managed"
  "Chromium / Helium|chromium chromium-browser helium-browser helium|/etc/chromium/policies/managed"
  "Brave|brave brave-browser brave-browser-beta brave-browser-nightly|/etc/brave/policies/managed"
  "Microsoft Edge|microsoft-edge-stable microsoft-edge-beta microsoft-edge-dev microsoft-edge|/etc/opt/edge/policies/managed"
  "Vivaldi|vivaldi-stable vivaldi-snapshot vivaldi|/etc/vivaldi/policies/managed"
)

if [[ $EUID -ne 0 ]]; then
  echo "Please run with sudo:  sudo bash $0 ${1:-}" >&2
  exit 1
fi

found() {
  local bin
  for bin in $1; do
    command -v "$bin" >/dev/null 2>&1 && return 0
    # also look in the invoking user's PATH-only places (e.g. ~/.local/bin)
    [[ -n "${SUDO_USER:-}" ]] && [[ -x "$(getent passwd "$SUDO_USER" | cut -d: -f6)/.local/bin/$bin" ]] && return 0
  done
  return 1
}

if [[ "${1:-}" == "--uninstall" ]]; then
  for entry in "${BROWSERS[@]}"; do
    IFS="|" read -r name _ dir <<<"$entry"
    if [[ -f "$dir/$FILE" ]]; then
      rm -f "$dir/$FILE"
      echo "✓ $name: removed"
    fi
  done
  echo "Done. Restart the browser."
  exit 0
fi

POLICY=$(cat <<JSON
{
  "ExtensionSettings": {
    "$ID": {
      "installation_mode": "normal_installed",
      "update_url": "$UPDATE_URL"
    }
  }
}
JSON
)

any=0
for entry in "${BROWSERS[@]}"; do
  IFS="|" read -r name bins dir <<<"$entry"
  found "$bins" || continue
  any=1
  # another policy file that also sets ExtensionSettings would win over this one
  if [[ -d "$dir" ]] && grep -l '"ExtensionSettings"' "$dir"/*.json 2>/dev/null | grep -v "/$FILE$" >/dev/null; then
    echo "! $name: $dir already sets ExtensionSettings – please add this there by hand:" >&2
    echo "$POLICY" >&2
    continue
  fi
  mkdir -p "$dir"
  printf '%s\n' "$POLICY" > "$dir/$FILE"
  chmod 644 "$dir/$FILE"
  echo "✓ $name: $dir/$FILE"
done

if [[ $any -eq 0 ]]; then
  echo "No supported Chromium browser found." >&2
  exit 1
fi

echo
echo "Done. Restart the browser – Claude Smooth gets installed automatically"
echo "and keeps itself up to date from the GitHub releases."
echo "Check: chrome://policy (reload policies) and chrome://extensions"
