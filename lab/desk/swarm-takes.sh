#!/bin/sh
OUT=/Users/jcoeyman/cloudflare/do/bench/runs/demo-swarm
mkdir -p "$OUT/takes"
take=1
while [ "$take" -le "${DEMO_TAKES:-6}" ]; do
  echo "== take $take"
  DESK_VM_HOST=192.168.64.9 HAND_HEADED=1 DESK_PWA_QUIET=1 DESK_PWA_WINDOW=560,730 DEMO_RECORD_SECONDS="${DEMO_RECORD_SECONDS:-100}" DEMO_WINDOW="$(swift /Users/jcoeyman/.do/vm/vm-window.swift "do · sandbox-1" | cut -d" " -f1)" bun /Users/jcoeyman/cloudflare/do/lab/desk/swarm-demo.ts 2>&1 | grep -E "PASS|FAIL|all passed"
  cp "$OUT/receipt.json" "$OUT/takes/take-$take.json"
  if grep -q '"passed": false' "$OUT/receipt.json"; then
    take=$((take + 1))
    continue
  fi
  cp "$OUT/raw.mov" "$OUT/takes/take-$take.mov"
  echo "TAKE-PASSED $take"
  exit 0
done
echo "TAKES-EXHAUSTED"
