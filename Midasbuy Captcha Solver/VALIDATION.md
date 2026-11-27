# Separation validation - 2026-11-27

## Guided detection and manual correction v1.1.0

- Analysis now maps live iframe piece/handle rectangles into cropped image pixels.
  Candidate size, row and source search are constrained by the true piece element.
- Existing decoded image sprites can supply origin-clean tile PNGs. Useful alpha
  silhouettes account for transparent padding; opaque, missing or protected images
  explicitly retain image-outline fallback. No sprite URL fetching or canvas
  origin bypass is used, and raw sprite URLs are not sent to the engine.
- Overlapping gap hypotheses are grouped; ambiguity is measured between physical
  locations. Disagreeing within-group offsets remain reviewable; supported alpha
  geometry can reject incompatible appearance variants without lowering thresholds.
- Manual point correction creates a separate job with source-job provenance and
  a manual status, never an invented confidence score. Both image clicks and four
  labeled numeric coordinate inputs are available; Solve is disabled until edits
  are applied. Original analysis and stale-image protections are retained.
- Trial files additionally retain guidance and manual-source metadata. A backend
  health feature check asks users to restart older engines instead of ignoring hints.
- 26 Format A tests and 10 engine/trial tests pass, including DOM mapping, sprite
  padding, same-gap grouping, conflicting offsets, invalid geometry and manual points.
  12 existing solver Node tests pass. A real saved-image manual correction returned
  manual [111,0] with no automatic score.
- Local nested-frame browser tests passed real DOM guidance, decoded sprite
  extraction, B selection, A staged drag, both format switches, image/manual numeric
  correction, Stop and close-window release. Manual form geometry was measured at
  390/1440/1728 with no findings; rendered screenshot inspected.
- These checks do not establish certainty in every scene or live provider success.
  Protected/unexposed sprites and genuine ambiguous targets still require review.

## Format-switch crash repair v1.0.2

- Reproduced a blank window when switching B to A after a B solve: B click events
  lack `remaining`, but the A render called `remaining.toFixed(2)` before the reset
  effect cleared the old log. React unmounted the interface on that exception.
- Results and attempt logs are now tagged and filtered by their source format
  synchronously during rendering. Engine connection and per-format capture areas
  remain available; the new format never interprets the old format's entries.
- Regression browser test now switches B to A after B submission, and A to B after
  the staged drag, checking heading, panel, cleared log and preserved connection.
  Both directions pass with zero page errors; Stop and close-window release pass.
- 12 Node tests and build pass. Held-drag fixture remains about 2.3 seconds.
  Rendered geometry at 390/1440/1728 passes without spacing findings.

## Smooth drag update v1.0.1

- Replaced fixed-count, storage-blocked movement with elapsed-time eased motion:
  700ms per stage, approximately one update per display frame when commands respond.
  Late frames are skipped; trial logging is queued without blocking the held drag.
- Retained three actual remeasurement stages, a continuous held pointer, movement
  scale correction, and emergency release on Stop/control-window closure.
- Added a nine-second held-operation deadline with a short release timeout, targeting
  release before ten seconds. A frozen/disconnected browser cannot guarantee delivery.
- 12 Node tests pass, including stalled-operation deadline release and simulated
  command latency. Nested cross-origin local browser test measured about 2.3 seconds
  from press to release, reached the final target, and passed Stop/close release.
- Analysis time and after-release screenshot/log saving are outside the drag budget.
  Tests now use isolated port 18765 and leave a running user engine on 8765 alone.

- `captcha-data-extraction` restored to its original tracked files, including its
  v1.0.7 manifest, built assets, documentation and tests. Its 15 unit tests pass.
- Independent extension manifest, title and toolbar name: Midasbuy Captcha Solver
  v1.0.0. Its build contains no folder chooser or batch capture UI.
- 10 solver Node tests and 9 engine/trial Python tests pass.
- Nested cross-origin browser fixture at DPR 1.25 passes B ordered selections plus
  OK; A three-stage held drag; stale-result rejection; Stop; and close-window release.
- Both formats retain independent trial1/trial2 numbering, with initial image,
  annotation, analysis JSON, per-action JSON events, final status, and after-image
  when available. Browser fixtures use evidence folders rather than real trial paths.
- Rendered checks at 390/1440/1728 pass without overflow or undersized controls.
  Better Design spacing measurement completed without findings; screenshot inspected.
- Local fixture success does not prove provider acceptance. Live provider acceptance
  remains unverified. Existing Format A detector uncertainty has not been changed.

## Dark teal gap regression - 2026-11-27

- The supplied lotus image previously returned no match: saturation < 100 removed
  99.8% of a visually selected dark-teal gap interior. A no-candidate fallback now
  segments dark luminance without excluding saturated colors, then applies the
  original shape and outline confidence requirements.
- Real engine analysis of the saved image returns detected: equal 49px boxes at
  [68,239] and [180,240], displacement [112,1], outline score 0.8014. Annotation
  visually checked. This is a detection result, not live verification.
- 20 Format A tests pass, including this real image shifted and scaled 1.5x,
  and a synthetic saturated gap. All 10 previous saved-image candidate results
  retain identical boxes, displacements, scores, and status.
- All 22 saved samples execute: 12 detected, 8 uncertain, 2 unmatched. These counts
  do not establish accuracy; no confidence thresholds were lowered. The Python
  engine loads the detector per analysis, so extension rebuild/reload is unnecessary.
