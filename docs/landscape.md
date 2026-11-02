# Competitive landscape

Snapshot from 2026-11-02. GitHub stars are from the GitHub API that day. Claims about commercial products come from their public material and have not been rechecked.

## Who is out there

| Project | What it is | How it sees the screen |
|---|---|---|
| browser-use (120k stars) | Python library and cloud for browser agents | Page structure plus screenshots, driven by a big model |
| UI-TARS (ByteDance, 40k) | Its own vision model and a desktop app | Screenshots only |
| cua (32k) | Sandboxed computers on macOS, Linux and Windows, plus benchmarks | Mixed, works with any model |
| Stagehand (Browserbase, 26k) | Plain-words browser actions for code | Page structure, driven by a big model |
| Agent S (13k) | Research agent | Screenshots plus accessibility |
| Microsoft UFO (10k) | Windows agent | Windows accessibility |
| agent-desktop (Vercel, 8k) | Rust Mac computer use with a visible cursor | Accessibility, no model inside |
| Anthropic, OpenAI, Google | Computer use built into their models | Screenshots |

## Where do already wins

- **Cost.** Others send screenshots or long page dumps to a big model every step. do uses a small model that picks from a list: about $0.002 a task.
- **It knows when it is unsure.** Every pick has a probability, so do can stop instead of guessing.
- **Checkable safety.** It blocks destructive clicks, flags on-screen text that tries to steer the agent, and reads back what it typed.

## What we need to match the best

1. **More than the Mac.** Browser support from code first, then Linux. Most agent work happens in a browser.
2. **Sandboxes.** A disposable computer per agent. The Mac VM allows only two at a time; a Linux desktop in the cloud removes that limit.
3. **A score on a public benchmark** such as OSWorld or WebArena. Our 30 tasks are our own test app.
4. **A fallback for unlabelled screens:** canvas apps, games, icon-only buttons.
5. **One-command install** that sets up the MCP server.
6. **Watch and replay** of every run.

## What would put us ahead

1. **Proof that a task really finished,** read from the app's real state, not the agent's word.
2. **Probabilities the caller can use:** ask the user below a threshold, run alone above it.
3. **Cheap and fast enough to run all the time:** about 3 s and $0.002 a task.
4. **Several agents on one machine,** with a shared lock and one cursor each.
5. **A public benchmark that reports cost,** tasks per dollar as well as success rate.

## The bet

Do not race browser-use on features. Be the cheap, checkable hand that big-model agents call, and prove it on a public benchmark. Order: browser device, an OSWorld run, the done-check in `src/`, one-command install.
