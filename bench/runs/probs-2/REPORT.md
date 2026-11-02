# do eval report

Run: `probs-2`

## Test 1: grounding (does the click land on the right control?)

| arm | n | all | icon-only | repeated label | small | field | $/pick | median ms | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 1632 | **96.1%** | 92.4% (540) | 91.8% (498) | 93.4% (622) | 100.0% (68) | $0.00019 | 453 | 0 |

Arms are `model/method`. Clef methods: `ax_text` (accessibility list only), `ax_image` (list + screenshot), `marks` (numbered boxes, no labels), `hybrid` (numbered boxes + labels), `grid` (3 hops of a 4x4 grid, no structure). Baselines: `kimi-k2.6/xy` and `qwen3.8-27b/xy` answer pixel coordinates; `kimi-k2.6/marks` picks a numbered box.

## Test 2: calibration (does p predict a correct pick?)

| arm | n | ECE | AUC(p: right vs wrong) | p>=0.5 cover / acc | p>=0.8 cover / acc | p>=0.9 cover / acc | p>=0.95 cover / acc | tau for 98% acc |
|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 1632 | 0.074 | 0.979 | 97.0% / 98.0% | 87.3% / 99.9% | 70.9% / 100.0% | 38.8% / 100.0% | 0.51 (covers 96.7%) |

ECE: expected calibration error over 10 bins (0 is perfect). Cover: share of picks at or above the threshold; acc: accuracy of those picks. For grid, p is the product over hops.

Total spend recorded in this run: $0.308.
