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
git -C "$root" fetch -q origin release 2>/dev/null || true
git -C "$root" worktree add -q --detach "$work/tree"
cd "$work/tree"
if git rev-parse -q --verify origin/release > /dev/null; then git checkout -q -B release origin/release; else git checkout -q --orphan release; fi
git rm -rq --cached . > /dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$work/package/." .
bun -e 'const p=require("./package.json"); delete p.scripts; delete p.devDependencies; delete p.private; require("fs").writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n")'
git add -A
if git diff --cached --quiet; then echo "release branch already matches $version ($source_commit)"; else git commit -qm "release $version from $source_commit" && echo "release branch: $version from $source_commit"; fi
git push -q origin HEAD:release
cd "$root"
git worktree remove --force "$work/tree"
echo "install with: bun add github:acoyfellow/hand#release"
