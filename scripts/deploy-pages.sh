#!/usr/bin/env bash
# Build for GitHub Pages and push the bundle to the gh-pages branch.
# Site: https://bilalishakcanada-wq.github.io/websample/
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_BASE=/websample/ npx vite build
cp dist/index.html dist/404.html          # SPA fallback: Pages serves 404.html for deep links
touch dist/.nojekyll                       # keep files that start with an underscore
rm -rf .gh-pages && mkdir .gh-pages
cp -R dist/. .gh-pages/
cd .gh-pages
git init -q && git checkout -q -b gh-pages
git add -A && git -c user.name=poso-deploy -c user.email=deploy@poso.ba commit -qm "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f "$(git -C .. remote get-url origin)" gh-pages:gh-pages
cd .. && rm -rf .gh-pages
echo "Objavljeno: https://bilalishakcanada-wq.github.io/websample/"
