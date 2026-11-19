# Midasbuy CAPTCHA tools

Local screenshot collection and image analysis for two CAPTCHA formats. The project includes a Chrome / Edge capture extension, a click-in-order symbol matcher, reviewed development images, diagnostics, and rollback snapshots.

**Project release: v1.1.1** · [Changelog](CHANGELOG.md) · [GitHub releases](https://github.com/safin1337/midasbuy-captcha/releases)

| Component | Current state |
| --- | --- |
| Capture extension | v1.0.7; ready-to-load build in `captcha-data-extraction/dist` |
| Format B matcher | v1.1.0; five-candidate localization and three selections in prompt order |
| Format A | Slider screenshots and examples; no slider detector implemented |
| Local snapshots | v1.0.0 baseline and v1.1.0 matcher snapshot, with checksum verification |

Project and component versions are separate. v1.1.1 documents the existing tools and packages the current extension; it does not change recognition or capture behavior.

## Collect screenshots

Python and Node.js are not needed to use the bundled extension.

1. Download and extract this repository, or clone it:
   ```powershell
   git clone https://github.com/safin1337/midasbuy-captcha.git
   cd midasbuy-captcha
   ```
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select `captcha-data-extraction/dist`.
4. Open the CAPTCHA tab, click the extension icon, and choose **Format A (Slider)** or **Format B (selector)**.
5. Choose the **final destination folder**, such as `D:\Projects\midasbuy-captcha\Format_B\raw_data`. Photos save directly there, without extra subfolders. Each format remembers its own folder.
6. Mark the capture rectangle, then mark the reload button inside it.
7. Click **Start 10 captures**. Keep the CAPTCHA visible and the controls open. **Stop** or **Escape** interrupts the run.

The destination appears as `Currently Selected: [Hidden by Chrome]\midasbuy-captcha\Format_B\raw_data` when the extension knows that relative suffix. Otherwise, only the selected folder name appears after the hidden-path prefix. Ancestors are never guessed.

Each run saves up to ten new `inputN.png` files, continues the highest existing number, and skips filename collisions. Reload cycles target five seconds, with a random capture threshold one to three seconds after each reload and image-readiness checks. Slow loading extends the cycle.

The capture engine takes a visible-viewport screenshot and crops it in memory to avoid browser-level clipped captures suspected of causing embedded-frame flashing. Live elimination of that flash has not been confirmed.

See the [extension guide](captcha-data-extraction/README.md) for permissions, upgrades, timing, and troubleshooting. After updating the build, close the controls and reload the extension on the extensions page.

## Analyze a Format B image

The default matcher finds five physical symbols, compares the three prompt shapes using rotation-aware contour points and family evidence, and proposes three distinct targets in order. Weak matches retain review flags.

On Windows PowerShell, from the repository root, create the shared Python environment once:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Use Python 3.12 or later. Save a full verification-dialog screenshot, including its close button, in `Format_B/raw_data`, then run:

```powershell
.\detect.ps1 -Image .\Format_B\raw_data\input.png
```

Inspect `Format_B/output/annotated.png`, `dot-gallery.png`, `dot-alignment.png`, and `result.json`. The JSON includes proposed candidate IDs, coordinates, scores, alternatives, mask recovery, and review reasons.

Other modes:

```powershell
# Locate five symbols without matching prompt order.
.\detect.ps1 -Image .\Format_B\raw_data\input.png -CandidatesOnly

# Use the previous matcher.
.\detect.ps1 -Image .\Format_B\raw_data\input.png -LegacyMatcher
```

See the [Format B guide](Format_B/README.md) for coordinate conventions, evaluation, and diagnostic outputs.

## Validation and limits

- The v1.1.0 matcher snapshot records **75/75 correct target proposals on 25 reviewed development images**, with candidate boxes and previously confident selections unchanged. These images were used during development; this is not unseen production accuracy. The input19 recovery still requires review.
- Extension v1.0.7 passed 15 unit tests, a ten-image local Chromium run with a cross-origin iframe and 125% display scale, folder persistence and direct-save checks, and rendering checks at 390, 460, 1440, and 1728 pixels.
- The native folder-selection dialog and live Midasbuy compatibility remain unverified. Browser integration uses local fixtures and a stubbed picker with real directory handles.
- Recognition scores are uncalibrated. Pixel stability cannot distinguish a valid challenge from a provider error graphic. Inspect the preview and review flags.
- Analysis does not move the mouse or submit CAPTCHA answers. The extension clicks only the marked reload point and saves screenshots.

Detailed evidence: [matcher validation](versions/v1.1.0/validation.json) and [extension verification](captcha-data-extraction/VALIDATION.md).

## Development checks

From the repository root:

```powershell
.\.venv\Scripts\python.exe .\Format_B\test_detector.py
.\.venv\Scripts\python.exe .\Format_B\test_anchor.py
.\.venv\Scripts\python.exe .\Format_B\test_input19_regression.py
```

For extension development, install Node.js and npm:

```powershell
cd captcha-data-extraction
npm.cmd ci
npm.cmd test
npm.cmd run build
```

The optional `tests/browser.cjs`, `tests/visual.cjs`, and root `inspect-midasbuy.cjs` currently reference Playwright from the adjacent SoulShopBD checkout. Adjust that local dependency before using them elsewhere. The inspection script contacts Midasbuy and submits a supplied player ID to reproduce a verification prompt; normal build and unit-test commands do not require it.

## Repository layout

```text
Format_A/                 Slider samples and collection data
Format_B/                 Symbol matcher, datasets, examples, and diagnostics
captcha-data-extraction/   Extension source, tests, and loadable dist build
experiments/              Development experiments and comparison results
inspection/               Browser-inspection evidence
versions/                 Verified historical matcher snapshots
detect.ps1                Root launcher forwarding to Format_B
requirements.txt          Shared Python dependencies
VERSION                   Current project release
CHANGELOG.md              Project and component change history
versioning.py             Snapshot verification and restore utility
```

Dependencies, virtual environments, caches, generated `output/` directories, and extension browser profiles are excluded from Git. Reviewed datasets, diagnostics, and historical archives are included.

## Snapshots and rollback

Git release tags capture the whole tracked project. Local ZIP snapshots have a narrower, documented matcher scope; they do not include the extension.

```powershell
.\.venv\Scripts\python.exe .\versioning.py verify v1.1.0

# Show the restore plan without changing files.
.\.venv\Scripts\python.exe .\versioning.py restore v1.0.0
```

Add `--apply` only when ready to overwrite snapshot-listed files. Extra newer files are retained. A restore also resets `VERSION` to the snapshot version. Preserve later labels and results first. See [snapshot history and rollback](versions/README.md).
