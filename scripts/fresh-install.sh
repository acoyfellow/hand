#!/bin/sh
set -eu
hash=$(printf "\043"); source_spec=${1:-"github:acoyfellow/hand${hash}release"}
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
cd "$dir"
echo '{"name":"fresh","private":true,"type":"module"}' > package.json
bun add "$source_spec" > add.log 2>&1 || { cat add.log; exit 1; }
echo "installed $source_spec ($(du -sk node_modules/hand | cut -f1) KB)"
test -d node_modules/hand/bench && { echo "FAIL: bench/ shipped"; exit 1; }
test -f node_modules/hand/native/ax.swift || { echo "FAIL: helper source missing"; exit 1; }
cat > imports.ts <<'TS'
import { gatewayTransport } from 'hand/clef';
import { readConfig, readToken } from 'hand/credentials';
import { macosDevice } from 'hand/devices/macos';
import { Hand } from 'hand/hand';
import { helperOrBuild } from 'hand/helper';
import { TOOLS } from 'hand/mcp';
const exported = [gatewayTransport, readConfig, readToken, macosDevice, Hand, helperOrBuild].every((value) => typeof value === 'function');
if (!exported) throw new Error('an import is not a function');
console.log(`imports ok, ${TOOLS.length} MCP tools: ${TOOLS.map((tool) => tool.name).join(' ')}`);
TS
bun imports.ts
bunx hand help | head -1
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | bunx hand mcp > mcp.out
grep -q '"name":"steps"' mcp.out && echo "hand mcp lists tools" || { echo "FAIL: hand mcp"; cat mcp.out; exit 1; }
set +e
HOME="$dir/home" HAND_TOKEN= HAND_ACCOUNT_ID= bunx hand doctor > doctor.out 2>&1
doctor_exit=$?
set -e
cat doctor.out
test "$doctor_exit" -ne 0 || { echo "FAIL: doctor passed with no credentials"; exit 1; }
grep -q 'FIX  Cloudflare account' doctor.out && grep -q 'FIX  Cloudflare API token' doctor.out || { echo "FAIL: doctor did not explain missing credentials"; exit 1; }
echo FRESH-INSTALL-PASS
