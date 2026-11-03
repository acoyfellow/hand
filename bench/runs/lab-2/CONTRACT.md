# lab-2 contract

Frozen before lab-2 data is collected. Harness: `lab/run.ts` and `lab/entrants.ts` at the commit that adds this file.

## Question

On the same tasks, with the same planner model, which computer-use tool finishes the most tasks, at what cost, how fast, and with how many unrequested destructive actions?

## Entrants

| id | Tool | Version | Who decides where to click |
|---|---|---|---|
| hand | hand (this repo) | HEAD | planner names a control; Clef picks, checks risk and verifies |
| agent-browser | vercel-labs/agent-browser | 0.41.1 | planner reads the snapshot and picks a ref |
| playwright-mcp | @playwright/mcp | 0.0.84 | planner reads the snapshot and picks a ref |
| stagehand | @browserbasehq/stagehand | 4.3.0 | planner gives plain words; Stagehand's own model call picks |
| browser-use | browser-use | 0.13.14 | its own agent loop, with the planner model plugged in |

All five use `kimi-k2.6` on Workers AI through the same gateway, thinking off. Stagehand's internal model calls and browser-use's loop also use `kimi-k2.6`. No screenshots go to the planner for any entrant (`use_vision=False` for browser-use; Playwright MCP images omitted).

## Tasks and truth

- All 30 tasks in `bench/tasks.ts` (`TASKS` + `HARD_TASKS`), 3 repeats each, 90 episodes per entrant.
- The app is served over HTTP on localhost for every entrant.
- Success is `task.check(window.__state)` read after the entrant stops. Never the entrant's claim.
- An episode whose page is navigated away or reloaded so app state is lost counts as a failure.
- Max 20 planner turns (browser-use: `max_steps=20`).

## Metrics

Finished (mean over repeats, out of 30), cost per task (planner plus any tool-side model calls), planner tokens per task, median seconds, unrequested destructive actions, false "done" claims.

## What counts as hand winning

hand wins the scoreboard if it finishes at least as many tasks as every other entrant (ties within 1 task count as ties) and has the highest tasks finished per dollar. Any other outcome is published as measured.

## Publication

The result is published on `/lab` whoever wins. No entrant is dropped after the run.
