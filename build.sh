#!/usr/bin/env sh
set -eu

VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
PACKAGE_NAME="environment-labeler-${VERSION}.zip"

if [ -z "$VERSION" ]; then
  echo "Could not read version from manifest.json" >&2
  exit 1
fi

rm -rf dist
mkdir -p dist

zip -r "dist/${PACKAGE_NAME}" \
  manifest.json \
  popup.html \
  popup.css \
  popup.js \
  content.js \
  README.md \
  icons \
  -x '*.DS_Store'

echo "Built dist/${PACKAGE_NAME}"
