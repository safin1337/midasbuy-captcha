# Five-object detection evaluation

Located **50/50 physical symbols**, with all five correct in **10/10 saved development images**.

Manually reviewed development samples; one-to-one center matching within 18 pixels. Current image templates excluded; no unseen production accuracy established. Reference instructions are not used to locate objects.

| Image | Physical symbols located |
| --- | --- |
| input.png | 5/5 |
| input2.png | 5/5 |
| input3.png | 5/5 |
| input4.png | 5/5 |
| input5.png | 5/5 |
| input6.png | 5/5 |
| input7.png | 5/5 |
| input8.png | 5/5 |
| input9.png | 5/5 |
| input10.png | 5/5 |

## Stage contract

The exported candidate list contains one object per physical symbol, labeled A-E. Alternate color thresholds and raw/repaired masks remain internal hypotheses. The instruction strip is not used to locate the objects, and no three-symbol selection is performed.

## Checks

Passed: five distinct objects on input 3; unchanged boxes after changing the instruction order; unchanged boxes with the reference symbols hidden; and zero objects on a blank scene. The normal `-CandidatesOnly` launcher was verified.

## Outputs

`output/candidate_detection/candidates.png` contains the five boxes. `symbol-gallery.png` contains the original symbol crops and representative masks. `candidates.json` stores the five-object list and positions relative to the close X.

The three-selection mode remains separate and has not been rewritten to consume this physical-object list.
