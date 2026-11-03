# desk-1 contract

Frozen before desk-1 data is collected. Harness: `lab/desktop.ts` and `lab/desktop-tasks.ts` at the commit that adds this file.

## Question

On real Mac apps, with the same planner model, does hand or agent-desktop finish more tasks, and at what cost?

## Entrants

| id | Tool | Version | Who decides |
|---|---|---|---|
| hand | hand macOS device (`native/ax`) | HEAD | planner names a control; Clef picks, checks risk and verifies |
| agent-desktop | vercel-labs/agent-desktop | 1.0.2 | planner reads the JSON tree and picks a ref |

Both use `kimi-k2.6`, thinking off. Both run headless (semantic accessibility actions, no keystrokes or mouse) as each tool ships by default.

## Tasks and truth

- 10 tasks in `lab/desktop-tasks.ts`: 6 in Calculator, 4 in TextEdit. 3 repeats, entrant order alternates each repeat.
- Truth: Calculator's display read through the accessibility API; TextEdit's document text read with AppleScript. Never the agent's claim.
- TextEdit tasks use a new untitled document created for the episode and closed without saving.
- Episodes run one at a time on the real desktop. Max 20 planner turns.

## Pass bar

hand wins if it finishes at least as many tasks as agent-desktop (within 1) at lower cost per task. Any result is published.
