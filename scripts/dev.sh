#!/usr/bin/env bash
set -euo pipefail

STYLES="site/styles"
SCRIPTS="site/scripts"
OUT="_site"

SASS_ARGS=""
for f in "$STYLES"/*.scss; do
  name="$(basename "$f" .scss)"
  SASS_ARGS="$SASS_ARGS $f:$OUT/styles/$name.css"
done

concurrently --kill-others \
  "sass $SASS_ARGS --watch --poll" \
  "esbuild $SCRIPTS/index.ts $SCRIPTS/gallery.ts --bundle --outdir=$OUT/scripts --watch --target=es2020 --splitting --format=esm" \
  "eleventy --serve"
