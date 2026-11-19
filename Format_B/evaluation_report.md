# Detection evaluation

## Current result

Correct proposed locations: **30/30**, across **10/10 complete images**.
Resolved proposals: **19**. Proposals requiring review: **11**.

These are manually reviewed development samples used during implementation. Current-image templates are excluded, but this is not unseen production accuracy. Correct proposed coordinates do not override an abstention decision.

| Image | Correct proposals | Unresolved orders |
| --- | --- | --- |
| input.png | 3/3 | none |
| input2.png | 3/3 | 2, 3 |
| input3.png | 3/3 | 3 |
| input4.png | 3/3 | 3 |
| input5.png | 3/3 | none |
| input6.png | 3/3 | 3 |
| input7.png | 3/3 | 3 |
| input8.png | 3/3 | 1, 3 |
| input9.png | 3/3 | 3 |
| input10.png | 3/3 | 2, 3 |

## Input 3 fix

The third proposal is now the pink castle near (84,203), not the towers near (129,336). The matcher preserves both raw and repaired masks and no longer discards distinct appearances based only on box geometry. Reliable reference classes constrain target scoring. Uncertain classifications cannot steer scoring through another family; they fall back to shape-only proposals and remain unresolved.

Input 3 remains visibly marked for review where family/assignment evidence is ambiguous. Unresolved targets do not appear in `resolved_matches`. Amber question-mark markers and the review footer distinguish those proposals from resolved ones.

## Regression checks

Passed: required input 3 regression; reported building confusion with and without the library; rotated/reordered synthetic examples; unique-target assignment; duplicate-shape ambiguity; slider rejection; original, moved, and 125% scaled anchor cases. The full saved-sample evaluation exits with failure if any expected target is wrong.

The previous recorded result was 29/30 proposals; input 3 was the remaining failure. This run corrects it and retains the other nine images. No live challenge completion was tested.
