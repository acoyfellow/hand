# parallel-1 contract

Frozen before parallel-1 data is collected.

## Question

Can several agents share one browser at the same time without losing or crossing each other's actions?

## Setup

- One Chromium, 3 agents (`a1`, `a2`, `a3`). Each agent has its own tab and its own `Hand` over `src/devices/browser.ts`.
- Each agent runs the same 10 tasks from `bench/tasks.ts` one after another with the relay planner loop. All 3 agents start together, so up to 3 tasks run at once.
- Every action the device performs is recorded with the agent id, the tab it was sent to, and the control it targeted.

## Measured from real state, never from the agent

- **Lost action:** an action the agent issued that left no matching event in its own tab. Each tab records every pointer and input event the page receives.
- **Crossed action:** an event that lands in a tab other than the one its agent owns.
- **Task success:** `task.check(state)` in that agent's tab.

## Pass bar

All of:

- 30 agent-task runs complete,
- 0 lost actions,
- 0 crossed actions,
- task success >= 28/30.

## Disproof exit

Any crossed action fails point 4 with the event log, and the loop stops and reports.
