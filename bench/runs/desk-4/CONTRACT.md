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

## Addendum, 2026-11-04, harness fault in the Claude computer use cells

The first 30 claude-cu episodes all failed in 0 turns at $0: Claude 5.5 models refuse the `computer_20251124` tool (HTTP 400, "does not support tool types"). Their computer tool is the new `computer_toolset_20260801`, which takes no display size and returns one tool_use per action, with a `toolset_name` that results must echo back. The adapter now uses the toolset for 5.5 models and keeps `computer_20251124` for older ones. The 30 void episodes are kept in `claude-cu-void-tool-type.jsonl` and are not scored. Both claude-cu cells rerun from the start with no other change. A one-task check of the fix (pwa-mail-spam, not scored) passed in 5 turns for $0.12.

## Addendum, 2026-11-04, spend limit raised to $200

The runner stopped at $56 with 11 claude-cu@claude-opus-5-5 tasks not run. Jordan raised the limit to $200 so the row can finish. Only those 11 tasks run; no finished episode is rerun or changed.

## Addendum, 2026-11-04, kimi-k3 replaced by DeepSeek V4 Pro

kimi-k3 was refused for this account on every call (HTTP 403, "This account is not allowed to access @cf/moonshotai/kimi-k3", code 5018), so no kimi-k3 episode was ever run. Jordan chose to replace it with the strongest DeepSeek on Workers AI: `@cf/deepseek-ai/deepseek-v4-pro-0813`, priced from the Workers AI model catalogue at $1.32 per million input tokens and $3.96 per million output tokens. It passed the same `probeModel` check as the other models before any scored episode. The hand and agent-desktop rows for it run the same 15 tasks under the same rules. The spend limit is $200.

## Addendum, 2026-11-04, proxy 502 on two claude-cu@claude-opus-5-5 episodes

mac-textedit-edit-line and mac-cross-copy-to-note ended with `harness: anthropic 502: Bad Gateway` from the local model proxy, at $0 and 0 turns. That is a transport fault, not a model result. Both are moved to `claude-cu-void-proxy-502.jsonl` and rerun once with no other change.

## Addendum, 2026-11-04, duplicate agent-desktop@deepseek-v4-pro episodes

To finish sooner, agent-desktop@deepseek-v4-pro ran on both VMs at once. Lane b had loaded its task list before the runner learned to re-read finished episodes, so pwa-mail-spam and pwa-editor-keep ran on both lanes. Lane a's episodes, which started first, are scored. Lane b's copies are moved to `agent-desktop-deepseek-duplicate-lane-b.jsonl` and are not scored, whatever their result.
Later the same day, with both lanes running the last tasks from opposite ends, mac-settings-dark started on both lanes at once. Lane a's episode is scored, as before; lane b's copy is added to the same side file. `lab/grid-gate.ts` now fails if any cell has a task recorded twice.
