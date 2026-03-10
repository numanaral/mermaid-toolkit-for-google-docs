#!/usr/bin/env bash
set -euo pipefail

STYLES="site/styles"
SCRIPTS="site/scripts"
OUT="_site"

npx concurrently --kill-others \
  "sass $STYLES/index.scss:$OUT/styles/index.css $STYLES/gallery.scss:$OUT/styles/gallery.css $STYLES/features.scss:$OUT/styles/features.css $STYLES/support.scss:$OUT/styles/support.css $STYLES/legal.scss:$OUT/styles/legal.css --watch" \
  "esbuild $SCRIPTS/index.ts $SCRIPTS/gallery.ts --bundle --outdir=$OUT/scripts --watch --target=es2020" \
  "npx @11ty/eleventy --serve"
