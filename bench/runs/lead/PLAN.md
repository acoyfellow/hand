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

| point | run | result |
|---|---|---|
| 1 done-check | judge-2 + judge-2-faults | **FAILED, disproof exit.** 125 false-done claims. Best judge (checklist) catches 75% (lower bound 67%) but false-passes 4.5% and rejects 41% of real successes. Bar: 80%, 2%, 10%. Nothing moved to `src/`. |
| 2 probabilities | probs-3 | **PASS** on unseen screens: 1632 picks, 60 wrong. Ask 6.6%, 78% of wrong picks caught, 0.85% wrong when acting, no bin overconfident. Rule (`p < 0.5` or top-two gap `< 0.6`) found on probs-2, confirmed on probs-3. |
| 3 browser device | lead-browser-1 | **PASS on older src.** 30/30 x3, $0.0016, 3.68 s median. Stale since the ask rule and MiniWoB device changes; needs a rerun. |
| 4 parallel agents | parallel-1 | **PASS.** 3 agents x 10 tasks at once: 30/30, 72 actions, 0 lost, 0 crossed. Stale for the same reason. |
| 5 public benchmark | public-1 | **Not run.** MiniWoB++ harness built (`bench/public.ts`). On a 14-task smoke, do went from 4 to 7 after device fixes (refs in outline, clickable non-semantic elements, set-value fallback). Date pickers and the flight form still fail. WebArena unreachable (image host down, ~180 GB). |

## Log

- 2026-11-02: judge-1 committed as the baseline (`6fc0630`). Contract locked. Driver `1e87d794`.
- Point 1 hit its disproof exit. The loop stops here by contract and reports to Jordan.
