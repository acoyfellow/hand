# do eval report

Run: `probs-1`

## Test 1: grounding (does the click land on the right control?)

| arm | n | all | icon-only | repeated label | small | field | $/pick | median ms | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 408 | **95.8%** | 91.1% (135) | 90.4% (125) | 92.3% (155) | 100.0% (17) | $0.00019 | 550 | 0 |

Arms are `model/method`. Clef methods: `ax_text` (accessibility list only), `ax_image` (list + screenshot), `marks` (numbered boxes, no labels), `hybrid` (numbered boxes + labels), `grid` (3 hops of a 4x4 grid, no structure). Baselines: `kimi-k2.6/xy` and `qwen3.8-27b/xy` answer pixel coordinates; `kimi-k2.6/marks` picks a numbered box.

## Test 2: calibration (does p predict a correct pick?)

| arm | n | ECE | AUC(p: right vs wrong) | p>=0.5 cover / acc | p>=0.8 cover / acc | p>=0.9 cover / acc | p>=0.95 cover / acc | tau for 98% acc |
|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 408 | 0.082 | 0.978 | 96.6% / 98.2% | 86.5% / 100.0% | 71.1% / 100.0% | 39.5% / 100.0% | 0.48 (covers 96.8%) |

ECE: expected calibration error over 10 bins (0 is perfect). Cover: share of picks at or above the threshold; acc: accuracy of those picks. For grid, p is the product over hops.

Total spend recorded in this run: $0.077.
