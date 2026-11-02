# public-1 contract

Frozen before public-1 data is collected.

## Benchmark

MiniWoB++ (Farama-Foundation/miniwob-plusplus at `33c3b4dd`), the task set BrowserGym ships as `miniwob` (125 tasks, from `browsergym/experiments/.../metadata/miniwob.csv`). WebArena was the first choice; its image host did not answer and it needs about 180 GB, so it is out of reach on this machine. This is recorded as a limit, not hidden.

## Protocol

- Every one of the 125 tasks, seed chosen by `seed = 1000 + index`, 1 episode each. No task is dropped for being hard (drag, canvas, colour wheels stay in).
- Setup matches BrowserGym's `AbstractMiniwobTask.setup`: open the task page, `Math.seedrandom(seed)`, `core.EPISODE_MAX_TIME = 1000000`, `core.startEpisodeReal()`, read the goal with `core.getUtterance()`.
- Success is MiniWoB's own reward: `WOB_RAW_REWARD_GLOBAL > 0` after the agent stops, exactly BrowserGym's `validate`. Never the agent's claim.
- Max 10 agent steps (BrowserGym's default for miniwob).
- Viewport 1280 x 800; the task div is not zoomed.

## Arms

1. `do`: a planner LLM (`kimi-k2.6`, no screenshots) with do's `Hand` tools (`outline`, `act`, `type`, `select`, `done`) over `src/devices/browser.ts`, default `Hand` options from `src/mcp.ts`.
2. `vision`: the same planner model family given a screenshot every step and answering pixel actions, the screenshot baseline. Uses `kimi-k2.6` with images, the same vision loop as `bench/t4-e2e.ts`.

## Metrics

- success rate per arm (out of 125),
- cost per task and tasks solved per dollar,
- median seconds per task.

## Pass bar for point 5

- both arms run all 125 tasks,
- `do` solves at least as many tasks as `vision` (within 3 tasks counts as a tie),
- `do` has at least 3x the tasks solved per dollar of `vision`.

## Disproof exit

If `do` solves more than 3 fewer tasks than `vision`, or its tasks-per-dollar edge is under 3x, point 5 fails with the numbers and the loop reports.

## Addendum 1, before any data

The viewport line above would shrink MiniWoB's 160 x 210 task area inside a 1280 x 800 screenshot and unfairly hurt the screenshot arm. Both arms instead use BrowserGym's own MiniWoB viewport, 332 x 214, and BrowserGym's setup script, read at run time from `browsergym/miniwob/base.py` so it cannot drift. Everything else is unchanged.
