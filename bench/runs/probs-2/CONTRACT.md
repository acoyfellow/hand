# probs-2 contract

Frozen before probs-2 data is collected. Same rule, threshold and bar as probs-1, which failed with too few picks (408, 17 wrong). Only the amount of data changes.

## Question

Can a caller trust Clef's pick probability: act alone when it is high, ask the user when it is low?

## Data

- `bun bench/t1-grounding.ts` with `DO_MODELS=clef DO_METHODS=ax_text`, `DO_EXTRA_SEEDS=3` (4x the screens of probs-1, new seeds), `DO_PER_SCREEN=20`, on the current `src/`.
- Each row: the intent, Clef's pick, its probability `p`, and `correct` from the known target. Truth never comes from Clef.
- At least 500 picks and at least 20 wrong picks. If there are fewer than 20 wrong picks, the removal metric is reported but the point does not pass.

## Rule under test

`Hand` acts when `p >= tau` and otherwise returns `UNSURE` (asks) without acting. `tau = 0.5`, fixed here and not tuned on this data.

## Metrics

- **Ask rate:** share of picks with `p < tau`.
- **Wrong actions removed:** share of wrong picks with `p < tau`.
- **Calibration:** picks in bins [0.5, 0.7), [0.7, 0.9), [0.9, 1]. For each bin with at least 20 picks, accuracy minus mean p. Negative means overconfident.
- **Wrong action rate when acting:** share of `p >= tau` picks that are wrong.

## Pass bar

All of:

- ask rate <= 10%,
- wrong actions removed >= 70%,
- no bin overconfident by more than 5 points (accuracy >= mean p - 0.05),
- wrong action rate when acting <= 2%.

## Disproof exit

If the bar is missed, point 2 is recorded as failed with the numbers. No threshold is retuned on probs-2; a retune needs a new contract and fresh data.
