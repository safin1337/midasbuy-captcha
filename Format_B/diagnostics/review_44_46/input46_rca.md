# Input46 localization RCA

Input44 was clarified by the user as correct: D -> E -> B. No input44 correction is needed.

## Visual findings

The three selected physical targets in input46 are correct: A -> C -> E in the saved preview. A is the pale pink upper building, C is the magenta gate, and E is the lower yellow/purple gate. Candidate D is a false positive on background artwork at box [508, 184, 25, 25]. The missing fifth physical object is the gray document with an X on the left, approximately centered at [214, 208]. Candidate letters may change after localization is corrected; compare physical centers rather than letters.

## Verified execution evidence

The saved inference source hash matches the current raw input46 image. A fresh trace of the existing physical_symbols function reproduced its saved localization; no runtime code was edited.

- False background D: independent rank 5, objectness 0.7433, template similarity 0.6494, appearance quality 0.7724, 12 mask variants. Local contrast and thin-stroke evidence both scored 1.0 despite the crop containing only artwork.
- A partial document hypothesis at [205, 185, 28, 38] ranked 12th, objectness 0.6780, template similarity 0.5023, appearance quality 0.7748, 12 variants. The object was not entirely absent from proposals; its extracted representation was incomplete and scored poorly.
- Larger nearby masks were noisy or merged with background: for example [195, 183, 37, 48] had appearance quality 0.4822 and weak thin-stroke evidence. The current trace does not establish which individual HSV threshold is the sole cause.
- Candidate selection takes independent[:5]. It accepts localization when five objects exist and the fifth objectness is at least 0.60. Fifth-to-sixth separation was 0.0299; it is recorded but does not affect this decision.
- The matcher correctly chose A -> C -> E and never selected D. Localization therefore failed despite the three requested targets being correct. There are four correct physical candidate locations and one false positive, with one real object missed.

## Root cause and improvement direction

1. Segmentation/ranking: the gray document is incompletely isolated, while thin high-contrast background texture earns enough appearance and generic-template evidence to outrank it. Improve extraction of coherent gray/blue strokes and preserve a complete folded-page contour and internal X before ranking.
2. Object validation: contrast and thinness alone cannot establish a symbol. Compare complete contour coverage, stroke-color consistency, shape completeness, and relative scale against competing hypotheses. Validate these signals across all reviewed images; do not hardcode a left-side region or simply remove right-side candidates.
3. Uncertainty: use validated candidate plausibility and fifth-versus-next separation to request review when the five-object set is weak. Raising the 0.60 threshold alone would not recover the missing document, and rejecting D without improving the document could merely promote another background patch.
4. Reporting: keep ordered-target correctness separate from five-object localization quality. A correct three-target sequence must not be reported as proof that all five candidates are real.

## Verification required for a future fix

Preserve the current working matcher first and stage changes separately. Add an input46 localization regression asserting five distinct real physical objects, document coverage near [214, 208], and no candidate at the current false D patch. Preserve the three correct selected centers and order independently of regenerated letters. Run the full reviewed localization and ordered-target regression set before adopting any change. No matcher, training-library, or user-reviewed label changes were made during this investigation.

## Evidence

- ../dot_evaluation/input46/candidates.png
- ../dot_evaluation/input46/result.json
- input46_localization_trace.json
- input46_missing_document_crop.png
- input46_D_crop.png
- input46_D_mask.png
