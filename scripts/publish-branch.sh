#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$root"
version=$(bun -e 'console.log(require("./package.json").version)')
source_commit=$(git rev-parse --short HEAD)
npm pack --silent --pack-destination "$work" > "$work/name.txt"
tar -xzf "$work/$(cat "$work/name.txt")" -C "$work"
cd "$work/package"
bun -e 'const p=require("./package.json"); delete p.scripts; delete p.devDependencies; delete p.private; require("fs").writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n")'
export GIT_DIR="$root/.git"
export GIT_INDEX_FILE="$work/index"
export GIT_WORK_TREE="$work/package"
git add -A .
tree=$(git write-tree)
git fetch -q origin release 2>/dev/null || true
parent=$(git rev-parse -q --verify origin/release || true)
if [ -n "$parent" ] && [ "$(git rev-parse "$parent^{tree}")" = "$tree" ]; then
  echo "release branch already matches $version ($source_commit)"
  exit 0
fi
message="release $version from $source_commit"
if [ -n "$parent" ]; then commit=$(echo "$message" | git commit-tree "$tree" -p "$parent"); else commit=$(echo "$message" | git commit-tree "$tree"); fi
git push -q origin "$commit:refs/heads/release"
echo "release branch: $version from $source_commit ($commit)"
