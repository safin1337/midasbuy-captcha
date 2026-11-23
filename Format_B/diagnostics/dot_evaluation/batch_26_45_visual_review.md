# Format B visual review: inputs 26-45

Fresh offline inference with current matcher; assistant visual review, not user-confirmed labels or website-verified outcomes. Visual centers are approximate manual annotations. Runtime review flags remain unchanged; no training data or reviewed_orders.json updates. Not independent production accuracy.

All 20 folders contain complete diagnostic outputs. Five candidates located in 20/20 images; 60/60 target proposals agree with assistant visual inspection (20/20 complete orders). 18 targets across 13 images retain runtime review flags. No visually identified incorrect resolved targets.

The batch contains 19 unique image hashes: input36 and input39 are byte-identical. Counts above include both captures.

| Image | Proposed order | Visual agreement | Flagged prompt positions |
| --- | --- | --- | --- |
| [input26.png](input26/annotated.png) | E -> D -> A | 3/3 | [2] |
| [input27.png](input27/annotated.png) | C -> B -> E | 3/3 | [2] |
| [input28.png](input28/annotated.png) | D -> C -> A | 3/3 | [] |
| [input29.png](input29/annotated.png) | B -> D -> A | 3/3 | [2] |
| [input30.png](input30/annotated.png) | D -> A -> B | 3/3 | [3] |
| [input31.png](input31/annotated.png) | B -> D -> A | 3/3 | [2] |
| [input32.png](input32/annotated.png) | E -> D -> C | 3/3 | [2, 3] |
| [input33.png](input33/annotated.png) | C -> A -> D | 3/3 | [1] |
| [input34.png](input34/annotated.png) | D -> E -> B | 3/3 | [1, 2] |
| [input35.png](input35/annotated.png) | B -> A -> E | 3/3 | [] |
| [input36.png](input36/annotated.png) | B -> E -> D | 3/3 | [1, 3] |
| [input37.png](input37/annotated.png) | E -> C -> B | 3/3 | [] |
| [input38.png](input38/annotated.png) | A -> D -> C | 3/3 | [1] |
| [input39.png](input39/annotated.png) | B -> E -> D | 3/3 | [1, 3] |
| [input40.png](input40/annotated.png) | A -> C -> B | 3/3 | [1, 3] |
| [input41.png](input41/annotated.png) | E -> A -> C | 3/3 | [2] |
| [input42.png](input42/annotated.png) | B -> E -> A | 3/3 | [] |
| [input43.png](input43/annotated.png) | A -> D -> B | 3/3 | [] |
| [input44.png](input44/annotated.png) | D -> E -> B | 3/3 | [] |
| [input45.png](input45/annotated.png) | D -> C -> B | 3/3 | [] |

Each image folder contains candidates.png, annotated.png, dot-gallery.png, dot-alignment.png, individual masks and point previews, and result.json. The JSON visual-review report records hashes, approximate manually inspected centers, per-position comparisons, and reasons for runtime flags.

## Runtime review reasons

- input26.png: position 2: ambiguous_reference_family
- input27.png: position 2: ambiguous_reference_family
- input29.png: position 2: ambiguous_reference_family
- input30.png: position 3: ambiguous_reference_family
- input31.png: position 2: ambiguous_reference_family
- input32.png: position 2: ambiguous_reference_family; position 3: close_or_better_alternative, ambiguous_assignment
- input33.png: position 1: close_or_better_alternative, ambiguous_assignment
- input34.png: position 1: close_or_better_alternative, ambiguous_assignment; position 2: ambiguous_reference_family
- input36.png: position 1: close_or_better_alternative; position 3: ambiguous_reference_family
- input38.png: position 1: ambiguous_reference_family, ambiguous_assignment
- input39.png: position 1: close_or_better_alternative; position 3: ambiguous_reference_family
- input40.png: position 1: ambiguous_reference_family; position 3: ambiguous_reference_family, ambiguous_assignment
- input41.png: position 2: ambiguous_reference_family
