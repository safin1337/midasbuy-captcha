# Format_A - Slider puzzle

The solver extension can supply `--guidance` JSON with piece/handle DOM bounds and
optional origin-clean sprite pixels. This constrains detection to the actual piece,
accounts for transparent sprite padding, and groups overlapping gap hypotheses.
Conflicting offsets remain reviewable. Explicit user-selected center pairs produce
`status: manual` with no automatic confidence score. See the independent solver's
README for manual correction controls and trial retention.

This format asks the user to drag a puzzle piece onto its matching cutout.

- `raw_data/input1.png`: saved slider example; `examples/regressions/teal-gap.png` reproduces the colored-gap failure.
- `detect.py`, `geometry.py`, `annotate.py`, `drag.py`, and `test_detector.py`: experimental detector, measurements, annotations, calibrated drag preview, and synthetic checks.
- The middle of the close **X** is the anchor `(0,0)`, matching Format B. Positive x goes right and positive y goes down; screenshot coordinates are also retained.
- The click-order detector is separate in `../Format_B` and rejects slider screenshots.
- Python dependencies are shared through the project root `.venv` and `requirements.txt`.

Keep future slider-specific scripts, inputs, examples, and outputs in this folder.

## Course experiment

Python/OpenCV slider experiment for Format_A. Format_B code is unchanged.
The original rabbit screenshot has not been made available as a local file. Save it as
`Format_A/raw_data/rabbit.png` before running the sample command below. The detector
has not yet been validated against that screenshot.

Run from `D:\Projects\midasbuy-captcha` in PowerShell using the existing environment:

```powershell
.\.venv\Scripts\python.exe .\Format_A\detect.py .\Format_A\raw_data\rabbit.png --roi 29 100 425 247
```

The image-region coordinates above were read visually from the 485 x 486 chat image.
Adjust them if the saved file differs. The region must contain the photograph, piece,
and gap; exclude the header and slider controls.

Outputs: `Format_A/output/annotated.png` and `result.json`. Equal-sized square boxes
enclose the estimated piece (green) and gap (orange). Piece corners **A, B, C, D** and
gap corners **1, 2, 3, 4** run clockwise from top-left. An arrow joins the centers;
the footer reports horizontal distance **Z**, vertical offset, each corner pair's
horizontal distance, and detection status. The detected blue handle center is marked
**0 px**. The footer is appended below the screenshot, preserving image coordinates.
Coordinates use the
original input image, with (0,0) at its upper left. `offset_image_px[0]` is gap x minus
piece x. The visual estimate for the supplied rabbit image is approximately 137 pixels;
this is not a measured detector result.

For full dialog screenshots, the detector reuses Format B's close-X locator. The
**middle of the close X** is the anchor `(0,0)`. `relative_piece_box`,
`relative_gap_box`, and `relative_scene_box` use this origin; positive x goes right
and positive y goes down. Absolute boxes retain screenshot coordinates. A magenta
cross marks the anchor in the annotation. `anchor.scale` uses header width / 425.
Without `--roi`, the photograph region is derived from that anchor and the sample
425:247 image proportions. Explicit `--roi` overrides the region while retaining
the detected anchor. For photograph-only crops with no close X, `anchor` is null
and relative coordinates are omitted. Format B's implementation is not modified.

`alignment` contains both centers, all eight corners, four pairwise offsets and
diagonal distances, horizontal Z, and X-relative corners when an anchor exists.
`matched_piece_box` and `matched_gap_box` preserve the original outline rectangles;
`piece_box` and `gap_box` are their enclosing square overlays. Corners use pixel
centers: right/bottom are x + width - 1 and y + height - 1.

Equal boxes guarantee equal corner displacements. `geometry_consistent` checks
measurement consistency only; it does not increase the outline score or turn an
`uncertain` detection into `detected`. Slider movement uses horizontal Z, not the
diagonal distance. `slider.zero_center` is in screenshot coordinates; the `--handle`
argument to `drag.py` is in actual desktop screen coordinates. Translate the screenshot
position and display scale before using it. The drag preview reports image Z, movement
scale, and screen displacement, and rejects inconsistent box measurements.

## Method and limits

1. Segment dark, low-saturation shapes inside the photograph. When that produces
   no eligible candidate, try luminance-only thresholds 35/45/55/65 for dark colored
   translucent gaps. This fallback retains the size, silhouette, and outline-score
   gates, and records `segmentation_method` and `segmentation_threshold` in JSON.
2. Filter candidate gaps by size, aspect ratio, and occupied area.
3. Extract each candidate's silhouette boundary.
4. Search left on approximately the same row for a matching piece outline using a
   distance transform and template correlation. This ignores photograph texture.
5. Rank candidates and report `uncertain` for a weak or ambiguous result.
6. Enclose matching rectangles in equal squares; measure centers and corresponding
   corners. Locate a unique blue handle below the photograph as the zero marker.

This baseline assumes a near-square dark gap, a visible piece outline to its left,
and horizontal movement. Scores are heuristic, not accuracy probabilities. Dark scenery,
scaling, unrelated borders, or a different puzzle style may defeat it. The detector
needs evaluation on real labeled images before any accuracy claim. Exit status is
0 for detected, 1 for uncertain/no match, and 2 for invalid input.

## Desktop drag for a practice puzzle

A screenshot itself cannot be dragged. Open your interactive practice puzzle, review
the annotation, and measure the scale between image movement and slider movement.
Use the slider handle's actual screen coordinates. Window placement, browser zoom,
display scaling, and slider travel affect these measurements.

Preview only (replace the handle coordinates and scale with your measurements):

```powershell
.\.venv\Scripts\python.exe .\Format_A\drag.py .\Format_A\output\result.json --handle 98 376 --scale 1
```

For one real drag, install the optional mouse dependency and append `--execute` to
that command. It waits five seconds and retains PyAutoGUI's corner abort feature.
No live desktop movement has been tested or performed as part of this experiment.

```powershell
.\.venv\Scripts\python.exe -m pip install pyautogui
```

Run synthetic checks:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s .\Format_A -p "test_*.py" -v
```

## Manual live test and diagnostics

Run `.\.venv\Scripts\python.exe .\Format_A\live_test.py`, enter the current
puzzle's horizontal distance, then hover over the handle during the five-second
countdown. The script performs one drag. All attached Windows monitors are supported,
including negative coordinates; gaps between monitors are rejected. Before/after
desktop screenshots and `latest.json` are saved in `Format_A/output/live_test/`.
These screenshots include all monitors. Pointer movement alone does not establish
that a browser accepted the drag or completed verification.

`check_desktop_drag.py --monitor 1` opens a temporary local window and tests a real
135-pixel drag without interacting with a website. On 2026-11-27, the secondary-monitor
check received mouse-down/move/up events and measured 135 pixels of rectangle movement.
This verified mouse transport at negative Y coordinates, not live CAPTCHA completion.
