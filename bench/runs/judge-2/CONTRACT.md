# judge-2 contract

Frozen before any judge-2 data is collected. Changes after the first run go in a new contract.

## Question

Can a cheap done-check tell when an agent's "done" is false, without rejecting real successes?

## Data

- Arms `duet` and `pilot`, which often claim done on tasks they failed, plus `relay:kimi-k2.6`, which usually succeeds.
- `DO_TASK_SET=all`, `DO_JUDGE=1`, at least 3 repeats, more until there are at least 30 false-done claims.
- Truth is `task.check(state)` read from the app, never the agent's claim.
- Judges see the task, the screenshot and the accessibility state. They never see the agent's claim, its steps or any pass/ok label.

## Definitions

- **False-done claim:** the agent said done and truth is false. Scored on the end sample.
- **True-done claim:** the agent said done and truth is true.
- **Negative:** any judged sample (start or end) where truth is false.
- **Caught:** the judge's verdict on a false-done claim is not `pass`.
- **False pass rate:** share of negatives the judge passes.
- **False alarm rate:** share of true-done claims the judge does not pass.

## Judges

1. `whole`: one Clef question with the screenshot. Pass when p >= 0.5.
2. `checklist`: a rubric of 1 to 4 end-state requirements, each checked by Clef with the screenshot and the accessibility state. Pass when every p >= 0.65, fail when any p < 0.35, otherwise abstain.
3. `hybrid`: `checklist`, and when it abstains, `whole`.

Thresholds are the judge-1 values and are not tuned on judge-2.

## Pass bar for a judge

All of:

- at least 30 false-done claims in the data,
- caught >= 80%, with the Wilson 95% lower bound >= 60%,
- false pass rate <= 2%,
- false alarm rate <= 10%,
- abstain rate <= 5% (hybrid never abstains),
- cost <= $0.001 a check.

If more than one judge passes, ship the one with the highest catch rate, then the lowest cost.

## Disproof exit

If no judge passes, nothing moves to `src/`. Point 1 is recorded as failed in `lead.json` with the numbers, and the loop stops and reports.

## Feedback A/B (after a judge ships)

Separate contract, `bench/runs/judge-ab-1/CONTRACT.md`, frozen before that run.

## Addendum 1, before planted data (2026-11-02)

Natural runs gave 20 false-done claims on 5 tasks, below the 30 required. As the Data section allows, planted near-miss faults are added as run `judge-2-faults`:

- Arm `relay:kimi-k2.6` on all 30 tasks, 3 repeats, `DO_JUDGE=1`, `DO_FAULT=last-write`.
- `last-write`: after the agent's last value-changing step (a type, a select, or a click that changes app state), the app quietly reverts that one change before the agent says done. The agent is not told. The screen re-renders honestly, so truth (`task.check`) stays the judge of record.
- Every other rule, judge and threshold is unchanged. judge-2 and judge-2-faults are scored together; the report also lists them separately.
