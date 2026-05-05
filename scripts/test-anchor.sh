#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
exec node \
  --import tsx \
  --no-warnings \
  node_modules/.bin/mocha \
  --timeout 15000 \
  --exit \
  "tests/**/*.ts"
