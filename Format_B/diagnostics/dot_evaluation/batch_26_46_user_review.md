# User-reviewed Format B results: inputs 26-46

User reviewed inputs26-46, reported input46 localization defect, and withdrew the initial input44 correction. Other ordered proposals were accepted.

Reviewed saved proposals, not blind or live verification. Candidate letters refer to saved previews; expected centers and hashes preserve target identities. Historical assistant visual-review reports are retained separately.

Ordered targets: **63/63**, across **21/21 captures** (20 unique images). Input36 and input39 are byte-identical. **18 targets across 13 images retain runtime review flags**.

Input46 has a correct A -> C -> E answer but an incorrect five-candidate set: D is background, and the gray document on the left was missed. Do not interpret ordered-target accuracy as complete localization accuracy. See [RCA](../review_44_46/input46_rca.md).

| Sample | Confirmed order | Positions flagged for review |
| --- | --- | --- |
| [input26](input26/annotated.png) | E -> D -> A | 2 |
| [input27](input27/annotated.png) | C -> B -> E | 2 |
| [input28](input28/annotated.png) | D -> C -> A | None |
| [input29](input29/annotated.png) | B -> D -> A | 2 |
| [input30](input30/annotated.png) | D -> A -> B | 3 |
| [input31](input31/annotated.png) | B -> D -> A | 2 |
| [input32](input32/annotated.png) | E -> D -> C | 2, 3 |
| [input33](input33/annotated.png) | C -> A -> D | 1 |
| [input34](input34/annotated.png) | D -> E -> B | 1, 2 |
| [input35](input35/annotated.png) | B -> A -> E | None |
| [input36](input36/annotated.png) | B -> E -> D | 1, 3 |
| [input37](input37/annotated.png) | E -> C -> B | None |
| [input38](input38/annotated.png) | A -> D -> C | 1 |
| [input39](input39/annotated.png) | B -> E -> D | 1, 3 |
| [input40](input40/annotated.png) | A -> C -> B | 1, 3 |
| [input41](input41/annotated.png) | E -> A -> C | 2 |
| [input42](input42/annotated.png) | B -> E -> A | None |
| [input43](input43/annotated.png) | A -> D -> B | None |
| [input44](input44/annotated.png) | D -> E -> B | None |
| [input45](input45/annotated.png) | D -> C -> B | None |
| [input46](input46/annotated.png) | A -> C -> E | None |

## Unattended use

This release does not implement live submission, automatic retries, threshold changes, or the proposed localization fix. User approval of flagged examples does not clear runtime review flags. Future unattended integration should validate candidate quality separately, use bounded retries for uncertain challenges, and leave persistently uncertain attempts unresolved. These behaviors remain proposed, not implemented.
