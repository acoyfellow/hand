# Handoff: do (computer-use library), push it hard

You DO, not plan. Report with receipts: commands, exit codes, run directories, SHAs.

## What do is
- Repo: `~/cloudflare/do`, `github.com/acoyfellow/do`, live at do.coey.dev (HTTP 200).
- A device lists the controls on screen in code. Clef picks one with a probability, the device acts, and Clef checks whether it worked. A writer model is called only when the task needs new text.
- `src/` ships. `bench/` is the gate every `src/` change must pass.
- Read `README.md` and `llms.txt` first.

## State right now
- `main` is **4 commits ahead of origin, not pushed** (`3712b02..7c878ec`: the site, the install line, self-hosted fonts). Pushing needs Jordan's OK.
- Best result: bench-6, relay arm **30/30 x3** at $0.0016 a task; duet 25/30. With Opus, vision scored 22.7/30 at $0.029.
- Safety: 0 unrequested destructive actions in any run.
- Grounding on a real Mac: 10/10 on Chrome and Finder from up to 250 options.

## Uncommitted work in progress: the "did it really finish?" judge
- New, uncommitted:
  - `bench/judge.ts`: `rubric()` and `judge()`.
  - `bench/judge-report.ts`
  - `bench/runs/judge-1/`
- Modified: `bench/t4-e2e.ts`, behind `DO_JUDGE=1`.
- judge-1 results (280 samples, the start and end of each task):
  - **Whole-task question (screenshot):** 94.3% accurate, 4% false pass. Caught **2/8** false "done" claims.
  - **Checklist (screenshot + accessibility state):** 77.9% accurate, 1.3% false pass. Caught **6/8**. Abstains 2.9%.
  - Cost: $0.00073 a sample.
- The 8 false claims all come from the duet arm (`h-chat-first-name`, `h-name-full`, `h-email-change`, `h-shop-priciest-coupon`, `h-cross-reply`). n=8 is too small to claim anything.

## Lessons that apply here (from other work, verified)
- An agent's "done" is a claim. Read the system's real state back. In the tether read-back eval, checking state caught 30/30 planted faults that the API's "ok" missed.
- When Clef judges, strip self-reported pass/ok labels first. Clef trusted a forged `pass: true`.
- Any experiment that feeds a check back to an agent needs a **placebo arm**. In the teeth A/B, a fake "check passed" line removed most of the gain.

## Goal: Jordan confirms or replaces this at the start; ask once, then go
Make the judge useful enough to ship in `src/` as a done-check that `Hand` can run:
1. Freeze a contract first (`bench/runs/judge-2/CONTRACT.md`): hypothesis, metrics, pass bar, disproof exit. Commit it before running.
2. Get enough false-done cases: run the hard task set with more repeats, plus planted near-miss faults, so n ≥ 30 negatives. The current 8 is too few.
3. Score both judges, plus a hybrid (checklist first, then the whole question when the checklist abstains), on false-done caught, false pass, and cost.
4. If one passes the bar, move it to `src/` (for example `do/check`), add it to the gate in `bench/`, and update the README with the real numbers.
5. Feedback test: show the verdict to the agent before it says done. Arms: real verdict, placebo, none. Measure false "done" claims.

## Rules
- Bench: `bun bench/t4-e2e.ts`, run with `DO_JUDGE=1`, `DO_TASK_SET=hard|all`, `DO_TASKS=a,b`. Reports go in `bench/runs/<name>/`. Lint with Biome (`bun x biome check`).
- Run long jobs with nohup (`# frugal:allow-long`). No sleep loops; use `loops_task` and delete it when it finishes.
- Never: push or deploy without Jordan's OK, mock, use `--no-verify`, add source comments, or use the `npm do` package (install with `bun add github:acoyfellow/do`).
- Stay in cmux workspace:37 (JORDAN). Check with `cmux identify --json`, not `$CMUX_WORKSPACE_ID`.
