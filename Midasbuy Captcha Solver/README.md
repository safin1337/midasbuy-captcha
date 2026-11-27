# Midasbuy Captcha Solver

Independent Chrome/Edge extension for Format A (slider) and Format B (ordered symbols).
The separate `captcha-data-extraction` extension is unchanged. This app reuses the
project's Python detectors and `.venv`; its extension UI, engine and logs live here.

## Run

From PowerShell:

```powershell
cd 'D:\Projects\midasbuy-captcha'
.\.venv\Scripts\python.exe '.\Midasbuy Captcha Solver\engine\bridge.py'
```

Keep the terminal open. Copy the temporary connection code it prints.

1. In `chrome://extensions`, enable Developer mode and click **Load unpacked**.
2. Select `D:\Projects\midasbuy-captcha\Midasbuy Captcha Solver\dist`.
3. Open the puzzle tab and click **Midasbuy Captcha Solver** in the toolbar.
4. Choose Format A/B. Click **Mark capture area**, draw the complete verification
   dialog including close X and footer, then click inside the area to confirm it.
5. Enter the engine code and click **Connect engine**. Close DevTools and other
   extensions debugging the same tab.
6. Click **Analyze puzzle**, review the preview, then **Solve once**. Uncertain
   proposals require acknowledgement; incomplete results cannot be sent.

Format A holds the pointer during 20%, 50% of the measured remainder, then final
remainder stages. Live DOM feedback updates the movement scale without mid-drag
screenshots. Format B selects the three proposed symbols and clicks OK.

Version 1.0.1 uses smooth, elapsed-time motion (about 700ms per stage) and skips
obsolete animation frames when browser commands run slowly. Trial-file writes no
longer pause motion. The held drag has a nine-second watchdog that requests release,
reserving the remaining second for release before the ten-second target. A frozen
or disconnected browser cannot guarantee delivery. Analysis and after-release file
saving are outside this drag-time budget; measured drag time is recorded in trials.

Stop, Escape in the controls/top page, or closing the controls attempts to release
held input. No automatic retries occur. Input sent is not proof of provider acceptance.
Keep the page position and zoom unchanged between analyzing and solving.

## Guided slider detection (v1.1.0)

Format A analysis sends only the moving piece and handle geometry from the iframe
to the local engine. The engine maps them to the cropped image using the visible
handle, restricts candidate sizes/rows, and searches for the piece inside its real
DOM region. When an already decoded image exposes the piece sprite, the extension
extracts its tile pixels locally; the engine uses useful alpha transparency to
remove padding and match its external silhouette. No sprite URL is fetched or sent
to the engine. Missing, opaque, or origin-protected sprite pixels use the image
outline fallback and are reported in the evidence.

Overlapping boxes at one physical gap are grouped before comparing alternatives.
Conflicting displacements within a group still require review unless reliable
sprite geometry rejects the incompatible variants. Similar distinct target scores,
weak outlines, or inconsistent piece positions remain uncertain; thresholds were
not lowered to claim certainty.

After analysis, **Set points manually** opens the original cropped screenshot.
Click the visible piece center (P), then gap center (G), or enter the four image
coordinates. **Apply manual points** creates a new analysis job, preserves the
original, and labels the result **manual**. It does not inflate the automatic score.
Points must be in the photograph, on the same row within four pixels, with G to the
right of P. Review them and use **Solve once** for the existing smooth staged drag.

After installing this update, restart the Python engine and reconnect with its new
code, then reload the solver extension. The engine now supports the manual endpoint.

## Trial data

Each format has independent numbering:

```text
Midasbuy Captcha Solver/
  Format_A/trial/trial1/, trial2/, ...
  Format_B/trial/trial1/, trial2/, ...
```

Each attempt retains `initial.png`, `annotated.png`, `analysis.json`, `trial.json`,
and `after.png` when a final capture is available. A records observed piece/handle
positions, stage movement, remaining distance and scale. B records proposed order,
actual click coordinates, confirmation and outcome. Numbering never overwrites old
folders. Unexpected shutdown can leave `in_progress` with the last saved event.
Test attempts use `evidence/solver_fixture_trials` instead of these real trial folders.

## Development and limits

```powershell
cd 'D:\Projects\midasbuy-captcha\Midasbuy Captcha Solver'
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:visual
..\.venv\Scripts\python.exe -m unittest discover -s .\engine -p 'test_*.py' -v
```

The local browser fixture uses port 18765, separate from your engine on 8765. It checks real browser
input in nested cross-origin iframes with known/recorded detection results, not
recognition accuracy. Format A's initial outline detection remains experimental.
Live provider acceptance remains unverified. The engine listens only on loopback,
requires a session code, and makes no authenticated supplier requests.
