# Midasbuy CAPTCHA formats

Current version: **v1.1.0**. The v1.0.0 baseline is archived with verified file
hashes. See [version history and rollback instructions](versions/README.md).

CAPTCHA-specific files are organized by format:

```text
midasbuy-captcha/
  Format_A/                 Slider puzzle
    examples/real/slider-01.png
    README.md
  Format_B/                 Click-in-order symbols
    raw_data/              Original screenshots (input.png through input14.png)
    detect.ps1
    detect_symbols.py
    test_detector.py
    test_anchor.py
    examples/
    output/
    diagnostics/
    README.md
  .venv/                    Shared Python environment
  requirements.txt          Shared Python dependencies
  inspection/               Shared browser inspection evidence
  inspect-midasbuy.cjs       Shared browser inspection tool
  detect.ps1                Compatibility command forwarding to Format_B
```

## Format_A - Slider

The slider sample is preserved under `Format_A/examples/real/slider-01.png`. A slider detection implementation has not been added yet.

## Format_B - Click in order

Place click-order screenshots in Format_B/raw_data. Run from that folder:

```powershell
cd D:\Projects\midasbuy-captcha\Format_B
.\detect.ps1 -Image .\input.png
```

Results are written to `Format_B/output/`. The X-centered detector, examples, tests, and detailed instructions live in Format_B.

The existing root command still works and resolves `input.png` inside Format_B/raw_data when it is not present at the root:

```powershell
cd D:\Projects\midasbuy-captcha
.\detect.ps1 -Image .\input.png
```

Explicit paths also work:

```powershell
.\Format_B\detect.ps1 -Image .\Format_B\raw_data\input.png
```

The detector does not move the mouse or submit CAPTCHAs. Match scores remain uncalibrated; inspect the numbered preview and review flag.

## Screenshot collection extension

The Chrome / Edge extension (v1.0.7) is in `captcha-data-extraction`. Load its `dist` folder as an unpacked extension, choose Format A or Format B, select the final folder where photos will be saved, and mark the screenshot rectangle and reload button. Each format remembers its own destination. Each run collects up to ten new PNGs directly in that folder, continuing the highest existing numbered filename. See [installation and usage](captcha-data-extraction/README.md).

## Checks

From the project root:

```powershell
.\.venv\Scripts\python.exe .\Format_B\test_detector.py
.\.venv\Scripts\python.exe .\Format_B\test_anchor.py
```

## Shared tools

The shared browser inspection script remains `inspect-midasbuy.cjs`; its captures remain in `inspection/`. It uses Playwright from the adjacent SoulShopBD project and submits the supplied player ID only to reproduce the verification prompt. Deliberate pauses are random 1-5 seconds, while network/readiness waits can be longer.

To recreate the shared Python environment with an available Python 3.12+ interpreter:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Five-object recognition preview

From Format_B, run `.\detect.ps1 -Image .\raw_data\input3.png -CandidatesOnly` to inspect the five physical symbols before order matching. See `Format_B/candidate_evaluation_report.md` and `Format_B/output/candidate_detection/candidates.png`.

The default launcher now matches the three prompt shapes against those five
candidates using rotation-aware contour points plus existing family evidence.
See `Format_B/output/dot-gallery.png`, `dot-alignment.png`, and `result.json`.
Use `-LegacyMatcher` for the previous matcher. Details and evaluation commands
are in `Format_B/README.md`.
