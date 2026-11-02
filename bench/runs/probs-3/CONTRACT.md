# probs-3 contract

Frozen before probs-3 data is collected.

## Why a new contract

probs-2 failed the probs-1 bar on 1632 picks: only 50% of wrong picks had `p < 0.5`. Looking at probs-2, the gap between Clef's top two options separates wrong picks much better. That rule was found on probs-2, so it must be tested on screens probs-2 never saw.

## Rule under test

`Hand` asks (returns `UNSURE`, does not act) when `p < 0.5` **or** the top pick's probability minus the second's is below `0.6`. Implemented as `shouldAsk` in `src/steer.ts` and the default in `src/mcp.ts`. Both numbers are fixed here.

## Data

- `bun bench/t1-grounding.ts`, `DO_MODELS=clef DO_METHODS=ax_text`, `DO_PER_SCREEN=20`.
- Fresh screens: `DO_EXTRA_SEEDS=7`, scoring only rounds 4 to 7 (seeds +400 to +700), none of which probs-1 or probs-2 used.
- Truth is the known target, never Clef.
- At least 500 picks and at least 20 wrong picks, otherwise the point does not pass.

## Pass bar

Same bar as probs-1, applied to the new rule:

- ask rate <= 10%,
- wrong actions removed >= 70%,
- no probability bin with >= 20 picks overconfident by more than 5 points,
- wrong action rate when acting <= 2%.

## Disproof exit

If the bar is missed, point 2 is recorded as failed and the loop reports. No retune on probs-3.
