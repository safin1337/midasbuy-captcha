# Captcha Data Extraction

A Chrome / Edge Manifest V3 extension. Each **Start 10 captures** run reloads the open CAPTCHA and saves up to ten cropped PNG images. Select **Format A (Slider)** or **Format B (selector)** before starting. Each format keeps its own capture rectangle and reload point.

## Install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select:

   `D:\Projects\midasbuy-captcha\captcha-data-extraction\dist`

4. Pin **Captcha Data Extraction** from the browser's Extensions menu.

The ready-to-load build is already in `dist`. No terminal or Python process is needed to use it.

## First run

1. Open the CAPTCHA in your browser and click the extension's toolbar icon **on that tab**.
2. Select **Format A (Slider)** or **Format B (selector)**.
3. Click **Choose folder** and select the **final folder where photos should be saved**, for example:

   `D:\Projects\midasbuy-captcha\Format_B\raw_data`

   Allow editing when Chrome asks. Any permitted folder is accepted. Images are written directly inside it; the extension does not append format folders or `raw_data`. Each format remembers its own destination and the folder picker starts there on subsequent changes. Chrome may ask for write permission again after restarting.

   The controls display **Currently Selected: [Hidden by Chrome]\midasbuy-captcha\Format_B\raw_data** when the extension can resolve that suffix beneath the previously granted project folder. Chrome does not expose the drive or absolute parent path. For a newly selected folder outside that known parent, the display is **Currently Selected: [Hidden by Chrome]\folder-name**. Missing ancestors are never guessed. No path entry is required.

   On upgrade, an older project-folder selection migrates to each existing `Format_A/raw_data` or `Format_B/raw_data` directory. Missing directories or permission restrictions require a fresh selection; migration creates no folders and does not save images in the project root.

4. Click **Mark capture area**. On the CAPTCHA tab, drag a rectangle matching the magenta box in your reference: include the entire verification card and desired outside margin. Release, then click the center of the reload button at the bottom left. That calibration click only marks the point; it does not activate the underlying button. Escape cancels calibration.
5. Click **Start 10 captures**. Leave the CAPTCHA tab open and keep the CAPTCHA inside the marked box, with its reload button at the marked point. Browser banner or viewport-size changes alone do not invalidate an otherwise usable selection. If the CAPTCHA itself moves, use **Adjust capture area**.

The control window can sit beside the browser or be brought forward to stop a run. It must remain open. Close it before opening the extension on a different target tab. Reopening the toolbar icon while a control window exists focuses that window. Concurrent toolbar clicks are serialized so they create one window. A stale window ID pointing to an unrelated New Tab is never treated as the controls.

## Output

| Selection | Destination |
| --- | --- |
| Format A (Slider) | The final folder selected for A |
| Format B (selector) | The final folder selected for B |

The extension scans filenames once at the beginning of a run, retaining only the highest number, then increments its in-memory counter after each save. Before creating a file it checks that exact filename and skips any collision; it does not rescan the folder for each screenshot. For the existing Format B dataset ending in `input14.png`, the next complete batch is `input15.png` through `input24.png`. `input.png` is left intact. Format A maintains an independent counter and starts at `input1.png` if no numbered files exist.

Taking only the first three directory entries is unsafe: the browser's directory iterator does not provide a descending-order option or guarantee numeric order. Sorting all filenames to obtain the top three still requires reading all filenames. The once-per-run scan follows the [directory iteration specification](https://fs.spec.whatwg.org/#directory-iteration).

Each run stops automatically after ten successful saves. Click **Start 10 captures** again for another batch. It does not loop indefinitely.

Click **Stop**, or press **Escape** in the CAPTCHA tab or control window, to interrupt. Already saved images remain. Closing the control window detaches browser input; a browser crash or forced shutdown may leave an empty new file, which can be removed manually. Avoid modifying the dataset from another program during a run: the extension serializes its own runs, but the browser file API does not offer an atomic exclusive-create operation across other programs.

## Capture behavior

- Uses Chrome's debugger mouse input (`mouseMoved`, `mousePressed`, `mouseReleased`) at your marked reload point, including inside an iframe. This produces browser mouse events; it does not physically move the Windows cursor or conceal automation.
- Targets **five seconds from one reload to the next**, including image checks, screenshot capture, and file-writing time. Each cycle chooses a fresh random capture threshold **1–3 seconds after reload**. Readiness checks run during that interval; once the threshold and readiness checks pass, it captures, saves, and waits only the remainder of the five seconds before reloading. It does not add independent delays on top of the five-second budget. The first reload starts immediately; there is no remaining-cycle wait after the final save. Stop and Escape interrupt all waits.
- Requires a visible change in the central challenge image and three stable comparisons, with readiness sampled every 250 milliseconds. It rechecks immediately before saving. Also waits for tracked image downloads (including Fetch/XHR responses with image MIME types) to finish and become quiet. Unrelated Fetch/XHR/document requests do not block readiness. Cross-origin iframe targets are monitored through Chrome's debugger. A tracked failed image request stops the run. If readiness or file writing takes more than five seconds, that cycle extends until complete; the next cycle starts a fresh five-second budget, with no burst to catch up. Browser scheduling may cause small timing variations.
- Network completion and pixel stability cannot semantically distinguish a CAPTCHA from a provider's error graphic. Inspect the preview and stop if the provider shows an error.
- Stops on a 25-second image timeout, file error, browser debugger disconnection, tab closure, navigation to a different page, an invalid reload point, or a capture box that is outside the visible page. It no longer rejects harmless full-viewport height/width, scroll, display-density, or SPA-fragment differences. There are no automatic reload retries after an error.
- Shows an elapsed waiting message after five seconds. Timeout messages distinguish an unchanged CAPTCHA, unfinished image downloads, and an unstable image. Screenshot and viewport commands have an eight-second watchdog so a stalled browser command produces an error rather than waiting indefinitely.
- Stores the latest run's version, state, saved-image count, last generated filename, readiness counts, and stop message locally in extension storage. It does not store request URLs, headers, tokens, or image content in that report. Errors and interrupted runs reappear when the controls reopen for the same target tab and extension version. An old version's error is not displayed as a new failure after upgrading.
- Captures the visible viewport without a browser-level clip, then crops the selected rectangle in memory, including its chosen margin. This avoids repeated clipped surface captures that can flash embedded frames. Cropping uses the current viewport and captured bitmap dimensions, never the saved calibration viewport. Only the crop is saved. If the viewport or scroll changes during a screenshot, the run stops instead of saving a misaligned image. PNG dimensions use the browser's current screenshot pixel density; on a high-DPI screen they may exceed the displayed CSS dimensions.
- Captures the **current tab's visible viewport**; it does not stitch a page or solve/submit the CAPTCHA. The magenta selection overlay is removed before capture.
- Save destination is the final folder remembered for the chosen format. It does not infer whether a provider has switched between a slider and selector challenge; stop, select the correct format, and recalibrate if that happens.

Chrome shows its normal debugging banner during calibration and capture, so both use the same viewport. Leave it in place. Opening DevTools can disconnect the debugger and stop the run. Mark the rectangle again if the page layout changes.

## Development and verification

```powershell
cd D:\Projects\midasbuy-captcha\captcha-data-extraction
npm.cmd ci
npm.cmd test
npm.cmd run build
```

Reload the extension on `chrome://extensions` after rebuilding. All runtime assets, including fonts, are bundled locally. The extension does not upload captured images.

`tests/browser.cjs` runs a real Chromium extension with a separate control popup and cross-origin local challenge iframe at 125% display scale, using Playwright from the adjacent SoulShopBD project. It calls the same background function used by the toolbar and verifies that repeated opens and capture create no extra windows. An intentionally unfinished child-frame telemetry request must not block the ten-image batch. A separate test manifest grants only `http://127.0.0.1/*` and `http://localhost/*`, because the test harness cannot physically click the browser toolbar to grant `activeTab`. Test images live in Chrome's isolated origin-private file system, leaving the actual datasets untouched. The production `dist/manifest.json` retains only `activeTab`, `scripting`, `storage`, and `debugger` permissions. This test does not establish live Midasbuy compatibility or test Chrome's native folder selection dialog.

Browser API references: [Chrome debugger](https://developer.chrome.com/docs/extensions/reference/api/debugger), [File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
