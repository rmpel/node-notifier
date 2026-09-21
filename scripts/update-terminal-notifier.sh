#!/usr/bin/env bash
# Replaces the vendored macOS notifier with an official terminal-notifier
# release from https://github.com/julienXX/terminal-notifier/releases.
#
# The bundle is downloaded straight from the upstream GitHub release and
# verified against the SHA-256 recorded below, so what ends up in
# vendor/mac.noindex can be reproduced and audited by anyone.
#
# Usage: scripts/update-terminal-notifier.sh [VERSION] [SHA256]
set -euo pipefail

VERSION="${1:-3.1.0}"
SHA256="${2:-e969d4ae20287da1ba55495ae31dcedd8e9069deb8ce4eed24f6561a5fc3e4d5}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/mac.noindex"
URL="https://github.com/julienXX/terminal-notifier/releases/download/${VERSION}/terminal-notifier-${VERSION}.zip"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fsSL "$URL" -o "$TMP/terminal-notifier.zip"

ACTUAL="$(shasum -a 256 "$TMP/terminal-notifier.zip" | awk '{print $1}')"
if [ "$ACTUAL" != "$SHA256" ]; then
  echo "SHA-256 mismatch for terminal-notifier-${VERSION}.zip" >&2
  echo "  expected: $SHA256" >&2
  echo "  actual:   $ACTUAL" >&2
  exit 1
fi

unzip -q "$TMP/terminal-notifier.zip" -d "$TMP/unpacked"
if [ ! -d "$TMP/unpacked/terminal-notifier.app" ]; then
  echo "terminal-notifier.app not found in the release archive" >&2
  exit 1
fi

rm -rf "$DEST/terminal-notifier.app"
mkdir -p "$DEST"
cp -R "$TMP/unpacked/terminal-notifier.app" "$DEST/terminal-notifier.app"

echo "Installed terminal-notifier ${VERSION} into vendor/mac.noindex"
if command -v lipo >/dev/null 2>&1; then
  echo -n "Architectures: "
  lipo -archs "$DEST/terminal-notifier.app/Contents/MacOS/terminal-notifier"
fi
