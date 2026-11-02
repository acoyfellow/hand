# Lead loop plan

Contract: the terraloop locked on 2026-11-02. Gate: `bun run check && bun bench/lead-gate.ts`.
Each point writes `bench/runs/<run>/lead.json` with `{ point, pass, metrics, srcCommit, mock: false }`. The gate reads the run named in `bench/runs/lead/points.json` for each point.

## Order

1. **Point 3, browser device in `src/`.** Move the CDP device out of `bench/` into `src/devices/browser.ts` behind a small `Cdp` interface so `src/` stays free of Playwright. Rerun all 30 tasks x 3 on it. Bar: mean >= 28/30, <= $0.003 a task, median <= 4 s.
2. **Point 1, done-check.** Contract `bench/runs/judge-2/CONTRACT.md` frozen first. Collect >= 30 false-done negatives (duet arm repeats plus planted near-miss faults). Score whole, checklist, hybrid. Ship the winner as `src/check.ts`. Then the A/B: real verdict, placebo, none.
3. **Point 2, probabilities.** Calibration of Clef's pick p against ground truth from t1 and t4 traces; ask-below-threshold in `Hand` returns `ASK`. Bar: above-threshold picks right within 5 points of claimed p (reliability), and asking removes >= 70% of wrong actions at <= 10% ask rate.
4. **Point 4, parallel agents.** 3 agents x 10 tasks at once on one browser, each in its own tab with its own agent id; check per-agent receipts for lost or crossed actions.
5. **Point 5, public benchmark.** WebArena-lite or Mind2Web-live style subset that runs locally; >= 50 tasks, do against a screenshot baseline, report tasks per dollar.

## Status

| point | run | status |
|---|---|---|
| 1 done-check | - | not started |
| 2 probabilities | - | not started |
| 3 browser device | - | in progress |
| 4 parallel agents | - | not started |
| 5 public benchmark | - | not started |

## Log

- 2026-11-02: judge-1 committed as the baseline (`6fc0630`). Contract locked. Driver `1e87d794`.
