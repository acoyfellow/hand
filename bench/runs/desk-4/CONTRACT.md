# desk-4: model grid (frozen 2026-11-03, before any data)

Question: how much of desk-3's result is the tool and how much is the model?

## Tasks

15 tasks from the desk-3 suite, picked by the desk-3 seed-3 shuffle: the first 8 PWA tasks and the first 7 native macOS tasks. Listed in `lab/desk/grid.ts` (`GRID_TASKS`). Same task text, same state checks, same oracles as desk-3.

## Cells (12)

- hand × claude-opus-5-5, claude-sonnet-5-5, gpt-6.1-sol, glm-5.3, kimi-k3
- agent-desktop × the same five models
- Claude computer use × claude-opus-5-5, claude-sonnet-5-5 (it only runs Claude models)
- Codex and cua are not in the grid: they are still blocked on the macOS permission recorded in desk-3.

hand and agent-desktop use the same planner loop, the same system prompt and the same `done` tool as desk-3; only the model changes. Every model is called through `lab/desk/models.ts` with the gateway cache off. gpt-6.1-sol runs through the Responses API with reasoning effort low (its chat endpoint refuses tools with reasoning). Claude models run with default settings.

A model that refuses the account (for example a 403) is recorded with that reason and not swapped for another model.

## Machines

Two VMs, sandbox-1 and sandbox-2, both cloned from `golden-desk-3.img`. Each cell runs entirely on one VM, so a tool never shares a screen. Lane assignment is fixed before the run and is in the runner's command line.

## Limits

30 turns and 4 minutes per task, one attempt each, no retries of a failed task. Spend limit $60 for desk-4; the runner stops at $56.

## Scoring

Success only from app state after the episode. Also recorded: cost, seconds, turns, and whether the tool said it was done when it was not.

## Not in scope

The hand Mac cursor overlay is built in a separate worktree at the same time and is not installed in either VM until scoring ends, because a drawn cursor would appear in screenshot-based tools' screens.
