# Changelog

Dates use Asia/Dhaka time. Project release versions, matcher versions, and extension versions are tracked separately.

## [v1.2.0] - 2026-11-27

Feature release: independent solver extension v1.1.0; capture extension v1.0.7 and
Format B matcher v1.1.0 are unchanged.

### Added

- Standalone **Midasbuy Captcha Solver** Chrome/Edge extension, with a ready-to-load
  build, authenticated loopback Python engine, review preview and single-attempt input.
- Format B integration selects the three proposed symbols in order and clicks OK,
  preserving matcher uncertainty and requiring acknowledgement for uncertain proposals.
- Format A outline detection, colored-gap fallback, X-centered coordinates, equal
  square overlays, paired-corner measurements, DOM guidance and optional origin-clean
  sprite silhouettes with transparent-padding handling and grouped gap hypotheses.
- Smooth three-stage held drag: 20%, half the measured remainder, then final correction.
  Live DOM measurements update scale; a nine-second watchdog requests release before
  the ten-second target. Local browser tests measure about 2.3 seconds per drag.
- Manual piece/gap center correction with explicit manual provenance, distinct from
  automatic confidence. Format switching clears incompatible logs without losing setup.
- Independent Format A/B trial folders inside the solver directory, retaining initial
  and final images, analysis, guidance, stage/click history and terminal status.
- Multi-monitor Python drag diagnostics, synthetic/real-image regressions, local
  cross-origin iframe browser tests and reproducible local Playwright tooling.

### Preservation and limits

- Data extractor source, settings and bundled build remain unchanged. Format B's
  existing localization defect and runtime review flags are not claimed fixed.
- Generated trial data, engine jobs, browser profiles, pairing codes, dependency
  folders and temporary development snapshots are excluded from Git.
- No claim of universal recognition or live provider acceptance. Protected sprites
  fall back to image outlines; ambiguous cases still require review or manual points.
- See [release validation and setup](docs/releases/v1.2.0.md).

## [v1.1.3] - 2026-11-23

Data and documentation release. Matcher v1.1.0 and capture extension v1.0.7 are unchanged.

### Added

- Complete per-image contour diagnostics for inputs26-46, raw input46, contact sheets, and batch reports.
- Hash-bound user-confirmed ordered labels for inputs26-46: 63/63 correct targets across 21 captures (20 unique images; input36 and input39 are identical).
- Input46 localization RCA and trace: false background candidate D ranks fifth at 0.7433, while a partial gray-document hypothesis ranks twelfth at 0.6780.

### Documentation and limits

- Separated correct ordered selections from five-object localization quality. Input46 selects A -> C -> E correctly but misses the gray document and includes background as D; this defect remains unfixed.
- Recorded the withdrawn input44 correction; D -> E -> B is confirmed correct.
- Preserved runtime review flags on 18 targets across 13 new-batch images. User confirmations do not change confidence thresholds, runtime decisions, or the template library.
- Clarified that reviewed saved outputs are not independent production accuracy or live verification. Live submission, bounded retries, and improved localization checks are not implemented by this release.

### Verification

- Rescored saved inference against all reviewed labels with raw-image hash validation; see the updated [evaluation report](Format_B/diagnostics/dot_evaluation/report.md).
- Checked diagnostic completeness, source hashes, version consistency, and documentation links. Contour geometry/assignment and input19 recovery regressions passed; see the [release validation report](Format_B/diagnostics/v1.1.3-validation.json).

## [v1.1.2] - 2026-11-19

### Current features

- Capture extension v1.0.7 with direct folder selection, separate A/B destinations, sequential PNG naming, and ten-image batches.
- Format B matcher v1.1.0 with five-candidate localization, ordered contour matching, and review flags for uncertain proposals.
- Matcher validation at `Format_B/diagnostics/v1.1.0-validation.json`, alongside extension verification and setup guides.
- Refined project documentation and consistent punctuation.

## [v1.1.1] - 2026-11-19

Documentation and distribution release of the current project. Runtime behavior is unchanged from the initial repository import.

### Added

- Root changelog covering the current project, matcher history, and capture-extension updates.
- GitHub release with a standalone unpacked-extension ZIP for capture extension v1.0.7.

### Changed

- Reorganized the root README around screenshot collection, image analysis, setup, verification, and repository structure.
- Documented separate project, matcher, and extension version numbers.
- Clarified exact output-folder selection, hidden-path display, known validation limits, and the optional browser tools' local Playwright dependency.

### Included component state

- **Extension v1.0.7:** select any permitted final output folder; save directly into it; remember separate A/B destinations; reopen the picker at the previous destination; display `Currently Selected: [Hidden by Chrome]` followed by a known suffix or folder name.
- **Capture fix from v1.0.6:** replace repeated browser-level clipped screenshots with visible-viewport screenshots cropped in memory. Local capture checks passed; disappearance of the user's live flicker is not confirmed.
- **Matcher v1.1.0:** bounded color-mask recovery for weak, unverified matches, with candidate locations and decision thresholds preserved.
- **Format A:** slider examples and capture support; no slider detector implemented.

### Verification

- Documentation links and version metadata checked for this release.
- Existing runtime evidence: 15 extension unit tests, the local ten-image direct-folder browser regression, multi-width render checks, and the detector and anchor tests passed before this documentation update.
- The matcher validation records 75/75 correct proposals on 25 reviewed development images. This is not an independent accuracy benchmark; input19 remains review-required.
- Native folder-dialog behavior and live Midasbuy compatibility remain unverified.

## [v1.1.0] - 2026-11-19

Initial whole-project Git import and annotated release tag. Includes source, datasets, diagnostics, development experiments, and extension v1.0.7. Excludes dependencies, virtual environments, caches, generated output directories, and extension browser profiles.

### Matcher v1.1.0

- Added bounded recovery of fine colored strokes inside existing candidate boxes for weak, unverified-family matches.
- Corrected the reviewed input19 proposal from D-C-E to D-A-E while retaining uncertainty flags.
- Recorded recovery details in `result.json`.
- Preserved candidate boxes, previously confident selections, and decision thresholds.
- Saved validation for 75/75 reviewed target proposals across 25 development images. Unlabelled inputs were excluded.

### Capture extension through v1.0.7

- Collect up to ten changed, stable screenshots per run using a marked capture rectangle and reload point.
- Continue sequential `inputN.png` names, check collisions, preserve saved images when stopped, and remember independent format calibration.
- Target five-second reload cycles with random one-to-three-second capture thresholds and image-download readiness checks, including cross-origin frames.
- Keep one control window, support Stop and Escape, and preserve run diagnostics locally.
- Accept usable selections after harmless viewport or SPA-fragment changes; validate that the box and reload point remain usable.
- Avoid browser-level screenshot clips and crop in memory; stop if viewport geometry changes during capture.
- Select the exact final save folder for each format, migrate existing legacy destinations without creating folders, and use the requested hidden-path display.

## v1.0.0 - 2026-11-19

Historical local matcher baseline before the input19 correction.

- Preserved five-candidate localization, ordered contour-point matching, the legacy matcher, reviewed fixtures, diagnostics, and launchers.
- Recorded 74/75 correct reviewed proposals, no incorrect confident proposals, and 125/125 candidate-center checks before the input19 recovery change.

See [matcher validation](Format_B/diagnostics/v1.1.0-validation.json) and [extension verification](captcha-data-extraction/VALIDATION.md) for recorded regression results.

[v1.1.1]: https://github.com/safin1337/midasbuy-captcha/compare/v1.1.0...v1.1.1
[v1.1.0]: https://github.com/safin1337/midasbuy-captcha/tree/v1.1.0

[v1.1.2]: https://github.com/safin1337/midasbuy-captcha/compare/v1.1.1...v1.1.2

[v1.1.3]: https://github.com/safin1337/midasbuy-captcha/compare/v1.1.2...v1.1.3
