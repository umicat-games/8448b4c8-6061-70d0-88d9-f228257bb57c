#!/usr/bin/env bash
# Deploy this game's local build to its in-editor PREVIEW (S3 + CDN).
# Additive sync (no --delete): dist assets are content-hashed so leaving old
# files is harmless; index.html is overwritten no-cache. Then invalidate the
# cdn.umicat.ai CloudFront distribution so the new build serves immediately.
#
# NOTE: this is a TEMPORARY override of the preview. Any session-server
# workspace rebuild (reconnect-for-SDK-update, agent turn, fresh clone) will
# clobber it — the workspace builds from its own checkout, which only pulls
# this branch on a FRESH CLONE (workspace deletion / ~1h idle). For changes to
# stick, get the workspace to re-clone the branch.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GID=d25d06c2-0ae4-4083-8eff-ded32d3125aa
DIST="$REPO/dist"
BUCKET=unboxy-dev
CF_DIST=E31A40598Q73XJ   # cdn.umicat.ai

[ -f "$DIST/index.html" ] || { echo "ERROR: $DIST/index.html missing — run 'npx vite build' first"; exit 1; }

echo "==> sync hashed build output (assets/) — immutable (content-hashed names)"
aws s3 sync "$DIST/assets/" "s3://$BUCKET/previews/$GID/assets/" \
  --cache-control "public,max-age=31536000,immutable"

# Everything else lives at FIXED paths (index.html, scenes/*.json,
# tilemaps/*.json, uploaded/*, manifest.json). Caching these immutable poisons
# the browser so a rebuilt scene never re-loads — the "edits revert after Build"
# bug. no-cache = the browser must revalidate every load (304 when unchanged).
echo "==> sync fixed-path files (scenes/tilemaps/uploaded/html) — no-cache"
aws s3 sync "$DIST/" "s3://$BUCKET/previews/$GID/" \
  --cache-control "no-cache" \
  --exclude "assets/*"

# `aws s3 sync` compares size+mtime — index.html is ALWAYS the same size (the JS
# hash it references is a fixed-length string), so if the local dist mtime isn't
# strictly newer than S3's, sync SILENTLY SKIPS it and the deployed index.html
# keeps pointing at an OLD JS bundle (the "hard-refresh still shows the old build"
# bug). Force it every time.
echo "==> force index.html (sync can skip it — same size)"
aws s3 cp "$DIST/index.html" "s3://$BUCKET/previews/$GID/index.html" \
  --cache-control "no-cache"

echo "==> invalidate CDN"
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST" \
  --paths "/previews/$GID/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' --output table

echo "==> done — hard-refresh the editor (Cmd+Shift+R)"
