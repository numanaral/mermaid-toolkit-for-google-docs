#!/usr/bin/env bash
set -euo pipefail

STYLES="site/styles"
SCRIPTS="site/scripts"
OUT="_site"

sass \
  "$STYLES/index.scss:$OUT/styles/index.css" \
  "$STYLES/gallery.scss:$OUT/styles/gallery.css" \
  "$STYLES/features.scss:$OUT/styles/features.css" \
  "$STYLES/support.scss:$OUT/styles/support.css" \
  "$STYLES/legal.scss:$OUT/styles/legal.css" \
  "$STYLES/limitations.scss:$OUT/styles/limitations.css" \
  --style=compressed --no-source-map

esbuild "$SCRIPTS/index.ts" "$SCRIPTS/gallery.ts" \
  --bundle --outdir="$OUT/scripts" --minify --target=es2020 \
  --splitting --format=esm

eleventy
