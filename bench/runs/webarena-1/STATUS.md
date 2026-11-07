# webarena-1: WebArena-Verified hard subset, forum (reddit) site

- Benchmark: ServiceNow WebArena-Verified, hard subset, tasks whose only site is the forum (42 tasks).
- Site: am1n3e/webarena-verified-reddit (slim image), amd64 under QEMU in Colima on an Apple Silicon Mac.
- Agent: hand browser device (accessibility outline, act/type/select) in headless Chromium; planner gpt-6.1-sol; 30 turns, 4 min per task.
- Scoring: the official `webarena-verified eval-tasks` evaluator on each task's agent response and recorded network trace. Nothing scored by us.

## Result so far (stopped early: laptop disk under 4 GB)

- 28 of 42 tasks attempted. 16 scored 1 by the official evaluator; 12 scored 0 or could not be scored.
- 4 of the 12 (67, 580, 597, 638) lost their browser mid-task to a harness hang and have no trace; they count as failures.
- 14 tasks not yet run.

## Why the scored failures failed

- Wrong task type or status in the answer (610, 617, 644): the agent did the work but reported NAVIGATE or NOT_FOUND instead of MUTATE/SUCCESS.
- Missing network event (409, 625): the post or reply never reached the site.
- Partial answer (68): found 1 of 2 required book entries.
