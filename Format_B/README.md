# Format_B - Click-in-order symbols

Current release: **v1.1.0**. For weak matches with unverified families, a bounded
local color-mask recovery step preserves fine window strokes inside existing boxes.
It does not move candidates or relax decision thresholds. `result.json` records
any recovery in `mask_recovery`. The input19 regression now proposes D-A-E and
retains its uncertainty flags.

The release passed 75/75 reviewed target selections on the 25 saved development
samples, with all candidate boxes and previously confident selections unchanged.
This is not unseen accuracy. Run `test_input19_regression.py` for the new failure
case, or `evaluate_dots.py --saved-results --reviewed-only` to rescore reviewed
outputs without processing newly added unlabelled images.

The prior v1.0.0 snapshot and rollback instructions are in `../versions/README.md`.

Original screenshots live in `raw_data/`. Generated masks, previews, and reports stay in `output/` and `diagnostics/`.

## Ordered contour-point matcher (default)

The normal `detect.ps1` command now runs `dot_matcher.py`. It detects the five
physical candidates A-E, extracts the header prompts left to right, and samples
evenly spaced dots along both external and internal contours. Shapes are centered
and scaled without stretching, then compared over a full turn in 5-degree steps.
The comparison measures bidirectional nearest-contour distances and coverage.
Separate contours are not connected, and missing strokes are not invented.

Matching considers alternate masks within each of the same five physical locations.
This matters when the representative mask drops part of an icon. Contour evidence
is combined with the existing family/template evidence, with current-image
templates excluded. Global assignment selects distinct physical candidates in
prompt order. Scores are uncalibrated; ambiguous shapes, alternatives, and uncertain
localization remain flagged for review.

```powershell
cd D:\Projects\midasbuy-captcha
.\detect.ps1 -Image .\Format_B\raw_data\input5.png
```

Inspect these files in `Format_B/output/`:

- `annotated.png`: the proposed order on the screenshot, with review markers.
- `dot-gallery.png`: three prompt point sets above five candidate point sets.
- `dot-alignment.png`: selected matches with blue prompt dots over orange target dots.
- `dots-prompt-1.png` etc. and `dots-A.png` etc.: individual point previews.
- `result.json`: ordered candidate IDs, coordinates, final and contour-only 3x5
  scores, per-pair mask boxes, rotation angles, normalized point coordinates,
  and review reasons. Selected candidates' point previews use their selected masks.

Run `..\.venv\Scripts\python.exe .\test_contour_points.py` from this folder for
geometry and assignment regressions, and `..\.venv\Scripts\python.exe .\evaluate_dots.py`
for saved-sample evaluation. The latter writes `diagnostics/dot_evaluation/report.md`
and `summary.json`, separating correct proposals from resolved matches. Images
without reviewed prompt-order labels are listed as unlabelled.

Localization joins red across the HSV hue boundary and searches pale outlines
without relying on their hue. Complete plausible outlines are scored alongside
clean fragments. Broad, low-contrast background blobs receive a penalty, and
template-search bonuses depend on thin-stroke evidence. Exported boxes enclose
the selected outline instead of averaging fragment centers. Candidate labels use
spatial rows so small box shifts do not swap left/right labels.

Run `..\.venv\Scripts\python.exe .\test_localization_regressions.py` to check full
box coverage of the red icon in input15 and the pale icon in input17. The candidate
evaluator separates older labels from newer assistant visual annotations; these
development checks do not establish accuracy on unseen images.

`reviewed_orders.json` records user-confirmed candidate sequences and image hashes.
The evaluator uses these for additional reviewed samples and refuses labels for
changed images. `evaluate_dots.py --saved-results` rescores existing inference
outputs after label review without rerunning the matcher. User-reviewed proposals
are not blind test results; confirming them does not automatically clear runtime
review flags or insert templates into the recognition library.

Use `-LegacyMatcher` to run the previous matcher. The older measured results and
checks below describe that matcher. `-CandidatesOnly` still performs localization
without any prompt matching. No mouse action or live submission is performed.

## First stage: detect the five physical symbols

Run from Format_B:

```powershell
.\detect.ps1 -Image .\raw_data\input3.png -CandidatesOnly
```

This mode locates five distinct physical symbols and labels them **A-E**. Alternate hue thresholds and raw/repaired masks are internal hypotheses, not additional physical candidates. The three requested symbols are not matched in this stage. Detection still works with the instruction symbols hidden.

Outputs live under `output/candidate_detection/`:

- `candidates.png`: one box per proposed physical symbol.
- `symbol-gallery.png`: all five original crops and their representative masks.
- `symbol-A.png` through `symbol-E.png`: individual source crops.
- `mask-A.png` through `mask-E.png`: representative masks.
- `candidates.json`: the five-object list, close-X-relative coordinates, objectness evidence, and internal hypothesis counts for diagnostics.

Five is the known format count, used as a prior. A blank scene returns zero objects rather than fabricating five. Objectness scores are uncalibrated. Inspect the five-object preview on new images.

The dedicated stage separates foreground strokes (including dark and neutral outlines), groups spatial mask variants, ranks complete symbol-like objects, and suppresses duplicate physical locations. A local template-outline search recovers symbols whose strokes join dark background features such as tree trunks. It uses a generic local symbol library with current-image templates excluded; it does not use the three reference symbols to choose object locations.

The default three-selection mode now consumes these physical objects using the
contour-point matcher above. The previous independent detection/matching path is
available with `-LegacyMatcher`.

Checks:

```powershell
..\.venv\Scripts\python.exe .\test_candidate_stage.py
..\.venv\Scripts\python.exe .\evaluate_candidates.py
```

The final first-stage evaluation located **50/50 physical symbols across 10/10 saved development images**. See `candidate_evaluation_report.md`. The evaluation checks one-to-one correspondence against all five manually reviewed object centers in each of the ten development images. Its results are in `diagnostics/candidate_evaluation/summary.json`; they are not unseen production accuracy.

## Run

Save the full verification dialog, including its X button, in `raw_data/`. No manual crop is needed.

```powershell
cd D:\Projects\midasbuy-captcha\Format_B
.\detect.ps1 -Image .\raw_data\input2.png
```

Results go to `output/`. The Python environment and `requirements.txt` are shared at the project root. The root compatibility command still forwards here.

## Improved detection

- Detects the close X as the coordinate origin and scales processing regions relative to it.
- Separates pale, saturated, and narrow hue ranges. A local-contrast pass separates symbol strokes from similarly colored painted backgrounds.
- Uses the widget's scaled image proportions; bright sky no longer truncates the scene, and shared blue artwork no longer breaks header detection.
- Matches internal openings, windows, and stroke positions over rotations. Both raw and gap-repaired masks are retained; different masks are not discarded just because their boxes overlap.
- Uses a local supervised library of 114 reference/target masks covering 12 families, including distractors. Reliable reference families constrain matching. Weak or ambiguous families cannot steer the target choice: they fall back to shape-only proposals for review.
- Excludes templates from the exact current image by SHA-256 during inference. Target coordinates in training annotations are not used to locate runtime targets.
- Prevents multiple masks of the same physical symbol from receiving different selection numbers.
- Exports alternative matches, per-target decisions, review reasons, resolved matches, and unresolved orders. Uncertain annotations use amber question-mark markers and a review footer.

## Measured results

The saved development examples now have **30/30 correctly proposed target locations**, across **10/10 images**. Ambiguous proposals still require review and are excluded from `resolved_matches`. See `evaluation_report.md` and `diagnostics/final_evaluation/summary.json`.

These examples were used during development, so these figures are not independent production accuracy. Each inference excludes templates from the current source image, but the recognition pipeline was tuned using these examples.

The input 3 castle-versus-towers failure now has a required regression. Its castle proposal is corrected, but uncertain family evidence is still explicitly marked for review. Scores are similarities, not calibrated probabilities. No automatic mouse action or live challenge completion is implemented.

The originally reported windowed-buildings error (`input2.png`) now selects the pale building pair, then the medical box, then the red castle. It passes even with the template library disabled.

## Outputs

- `output/annotated.png`: numbered matches and the red X-center crosshair.
- `output/candidates.png`: candidate boxes.
- `output/reference-*.png`, `candidate-T*.png`: extracted binary masks. Current IDs are listed in the JSON; earlier mask files may remain from previous runs.
- `output/result.json`: scores, original and X-relative positions, structural features, family hints, top alternatives, library exclusion information, and review status.
- `output/error.json`: processing failure details; removed on success.

`relative_center` and `relative_box` use the X center as `(0,0)`; negative X is left and positive Y is down. `center` and `box` retain screenshot coordinates. `anchor.scale` is the dialog header width divided by 425.

## Files

- `detect_symbols.py`, `detect.ps1`: detector and launcher.
- `models/symbols.npz`, `models/symbols.json`: local library and provenance.
- `build_symbol_library.py`: rebuilds the library from the manually labeled `input*.png` examples. Update/review the labels before replacing those training inputs.
- `evaluate_samples.py`: evaluates the reviewed examples with current-image templates excluded.
- `test_reported_failure.py`: regression for the reported building confusion.
- `test_castle_regression.py`: required regression for input 3, family drift, and abstention.
- `test_detector.py`, `test_anchor.py`: other regression checks.
- `examples/`: real fixtures, synthetic examples, and regression outputs.
- `diagnostics/`: baseline, development experiments, and final evaluation. Experiments are not the active runtime implementation.

## Checks

From this folder:

```powershell
..\.venv\Scripts\python.exe .\test_castle_regression.py
..\.venv\Scripts\python.exe .\test_reported_failure.py
..\.venv\Scripts\python.exe .\test_detector.py
..\.venv\Scripts\python.exe .\test_anchor.py
..\.venv\Scripts\python.exe .\evaluate_samples.py
```

To use only direct structural matching:

```powershell
..\.venv\Scripts\python.exe .\detect_symbols.py .\raw_data\input2.png --no-library
```

Expert reference/scene box overrides and `--count` remain available in the Python CLI. Default detection locates the regions automatically.

## Decisions and review behavior

`matches` contains all proposed locations for inspection. Each has `decision` (`proposed` or `review_required`), `review_reasons`, and `target_margin`. `resolved_matches` contains only proposals that passed the matcher checks; `unresolved_orders` identifies those where the detector abstains. These are detector decisions, not website acceptance.

A family hint with `verified: false` is not used as a trusted class. In this mode `semantic_family` is null and the proposal comes from direct shape matching. An uncertain target cannot become resolved merely because it is the last unused candidate.

In `annotated.png`, blue numbers are resolved proposals, amber question-mark numbers require review, and an appended footer lists unresolved orders. Coordinates remain relative to the original screenshot and close X; the footer does not shift the original image.

The full saved-sample evaluation now exits unsuccessfully if any expected target is wrong. Review-required proposals are counted separately from resolved proposals. Development-sample results do not establish unseen production accuracy.

The terminal prints shape similarity on its own line. Review-required targets also print each triggering reason and its measured value and threshold (family similarity, family-score gap, target-score gap, or sequence-score gap). These values use the same decision thresholds saved in `result.json`; review messages distinguish family ambiguity from a low shape score.


