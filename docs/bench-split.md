# Splitting the benchmark so it runs in minutes

## Why it is slow today

Every computer-use tool needs a screen to itself. All 50 desk tasks run on macOS VMs, and Apple allows two macOS VMs per physical Mac, so a run is roughly tasks × 90 s ÷ 2. The desk-4 grid (180 attempts) takes 2–4 hours.

Most of those tasks do not need macOS. The 30 Workbench tasks are a web app in Chrome. Only the 20 native tasks (System Settings, Finder, Calendar, Notes, TextEdit, Reminders) need a real Mac.

## The split

| Lane | What runs there | Where | Parallel | Target wall time |
|---|---|---|---|---|
| **web** | Workbench PWA tasks, browser-only entrants (hand browser, browser-use, Stagehand, Claude/Codex CU on a Linux screen) | Cloudflare Containers: Linux + Xvfb + Chrome, one task per container | 50+ | under 10 min for 30 tasks × 12 cells |
| **linux-desk** | New native Linux desktop tasks (file manager, text editor, settings, calendar) for tools that support Linux | Same containers with a full desktop (XFCE) | 50+ | under 10 min |
| **mac** | The 20 native macOS tasks only | macOS VMs cloned from the golden snapshot, 2 per Mac, on every Mac available | 2 per Mac | about 15 min per cell on 2 Macs |

Scores stay separate per lane. Mac results are never mixed with Linux results, because a tool can be good at one and bad at the other.

## What a run looks like

1. The runner reads the plan: lanes × entrants × models × tasks.
2. **web** and **linux-desk** episodes are queued to a Worker that starts one container per episode. The container boots from a pinned image, loads the task's starting state, runs the entrant, then posts back the app state and the trace. The Worker scores from app state, exactly like desk-3.
3. **mac** episodes go to a local pool of VM slots. Each slot restores the golden disk (an APFS clone, about 1 s) before every episode, so no task leaks state into the next.
4. All episodes land in one `episodes.jsonl` with `lane` set. The gate script checks every lane separately.

## Fairness rules carried over

- Contract frozen before data; every lane lists its tasks, entrants, models and limits.
- Same model across entrants when comparing tools; makers' default models reported as a separate table.
- Gateway cache off for scored calls.
- Container image and golden Mac disk are pinned by hash and recorded in the contract.
- Screenshot-based tools and accessibility-based tools see the same screen size.

## Build order

1. **Container image** for the web lane: Xvfb, Chrome, the Workbench server, the hand MCP and each entrant's runtime. Prove one episode end to end against the desk-3 result for the same task.
2. **Worker queue** that fans episodes out to containers and collects results, with a hard spend stop.
3. **Mac slot pool**: restore golden disk before each episode, auto login (FileVault off, auto-login on in the golden image), two VMs per Mac, plus any other Mac on the LAN that runs the same script.
4. **Linux desktop tasks**: 20 tasks mirroring the Mac ones, with state checks and scripted oracles like desk-3.
5. **One command**: `bun lab/bench.ts --plan plans/desk-5.json` runs all lanes and writes one summary.

## Not solved by this

- macOS still cannot run on Cloudflare: Apple's licence and boot chain require Apple hardware. The Mac lane scales only with Macs.
- Codex computer use and cua need a human click to grant macOS permissions once per golden image. Do it once in the golden image and every clone inherits it.
