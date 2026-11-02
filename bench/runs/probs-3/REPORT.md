# do eval report

Run: `probs-3`

## Test 1: grounding (does the click land on the right control?)

| arm | n | all | icon-only | repeated label | small | field | $/pick | median ms | errors |
|---|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 3264 | **96.2%** | 92.8% (1080) | 92.2% (998) | 93.7% (1241) | 100.0% (137) | $0.00019 | 474 | 0 |

Arms are `model/method`. Clef methods: `ax_text` (accessibility list only), `ax_image` (list + screenshot), `marks` (numbered boxes, no labels), `hybrid` (numbered boxes + labels), `grid` (3 hops of a 4x4 grid, no structure). Baselines: `kimi-k2.6/xy` and `qwen3.8-27b/xy` answer pixel coordinates; `kimi-k2.6/marks` picks a numbered box.

## Test 2: calibration (does p predict a correct pick?)

| arm | n | ECE | AUC(p: right vs wrong) | p>=0.5 cover / acc | p>=0.8 cover / acc | p>=0.9 cover / acc | p>=0.95 cover / acc | tau for 98% acc |
|---|---|---|---|---|---|---|---|---|
| clef/ax_text | 3264 | 0.076 | 0.980 | 96.8% / 98.1% | 87.3% / 100.0% | 70.3% / 100.0% | 38.7% / 100.0% | 0.48 (covers 97.0%) |

ECE: expected calibration error over 10 bins (0 is perfect). Cover: share of picks at or above the threshold; acc: accuracy of those picks. For grid, p is the product over hops.

Total spend recorded in this run: $0.617.
