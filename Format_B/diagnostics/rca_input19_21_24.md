# RCA: input19, input21, input24

Historical RCA from v1.0.0. Input19 was fixed in v1.1.0 through bounded local mask recovery; the current order is D-A-E. The historical evidence below is retained. The reviewed regression set now passes 75/75 targets; see v1.1.0-validation.json.

The user confirmed current orders input19 D-A-E, input21 A-C-D, input24 E-D-C.
Other batch outputs were confirmed. This investigation did not change the matcher.

## input19: actual matching failure

Current detection locates all five physical icons. Prompt 2 must select candidate A,
the green windowed buildings near (140,127). The matcher instead selects candidate C,
the tilted corner building near (181,216).

The extracted prompt mask contains noise and weak window detail. Candidate A's selected
mask uses green HSV filtering (H 40-80, S 105-255, V 35-175), local-contrast filtering,
and gap repair. The extracted point representation does not preserve its windows well.
The prompt family is unverified: its highest family score is calendar at 0.6859 with
only 0.0067 separation. The family gate therefore falls back to direct contour matching;
it does not use the incorrect calendar guess as trusted classification.

Prompt-2 scores: A 0.6470, B 0.6534, C 0.6845, D 0.6398, E 0.6951.
E is used by prompt 3 in the strongest total assignment, leaving C as the preferred
prompt-2 choice. All extracted A variants were checked: the best contour score is still
0.6470. The candidate shortlist is not discarding an available better A mask.

Root cause: loss of discriminating internal strokes during mask extraction, combined
with a contour score that can favor the wrong building when those details are absent.
The uncertainty checks correctly flag prompt 2, but they cannot recover the lost detail.
Improving extraction and structural comparison is needed; clearing review flags would
not correct the selected shape.

Evidence: input19_matching_rca.json, dot_evaluation/input19/dot-gallery.png,
dot_evaluation/input19/result.json. The older, separate pale-icon localization failure
has been fixed; that earlier failure caused the original third target to be missed.

## input21: candidate-label change

Earlier output A-D-C selected the tiered gate, single gate, and grid at approximately
(53,129), (53,175), (361,171). The current output A-C-D selects the same shapes at
(53,129), (52,174), (361,171). The single gate changed D to C; the grid changed C to D.

## input24: candidate-label change

Earlier output D-E-C selected the grid, tiered gate, and windowed buildings at
approximately (317,349), (95,349), (273,304). The current output E-D-C selects those
same shapes at (316,348), (95,349), (272,303). The grid changed D to E; the tiered gate
changed E to D.

## Shared cause of the label changes

Candidate letters are assigned afresh from detected positions. The earlier detector
sorted source boxes into fixed 12-pixel vertical bins before constructing final boxes.
Nearby icons could fall into different bins even when visually on the same row.
The localization fix changed box geometry and replaced fixed bins with spatial rows,
ordered left to right. Thus some letters changed even though the chosen shapes did not.

Reporting failure: existing previews were regenerated in place, and the letter changes
were not explicitly highlighted. Earlier letters should not be interpreted using newer
previews. Versioned previews and persistent physical identities would prevent confusion.
The reviewed-label registry uses physical target centers so evaluations survive relabeling.

Old ordering evidence is retained in
dot_evaluation/batch_14_25_visual_review_before_localization_fix.json.
After recording the user's confirmations, rescoring saved inference gives 74/75 correct
targets across 25 labeled images, with zero incorrect resolved/confident selections.
The remaining wrong proposal is input19 prompt 2, which is flagged for review.
