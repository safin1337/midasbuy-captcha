# Reviewed batch after v1.1.0

Refreshed after v1.1.0 mask recovery. All 12 batch orders agree with user-confirmed physical target locations. Development regressions, not unseen accuracy.

| Image | Current order | Review flags |
| --- | --- | --- |
| [input14.png](input14/candidates.png) | C -> A -> E | [] |
| [input15.png](input15/candidates.png) | B -> E -> A | [1] |
| [input16.png](input16/candidates.png) | A -> E -> C | [2] |
| [input17.png](input17/candidates.png) | B -> D -> A | [2, 3] |
| [input18.png](input18/candidates.png) | E -> D -> C | [] |
| [input19.png](input19/candidates.png) | D -> A -> E | [1, 2] |
| [input20.png](input20/candidates.png) | B -> C -> E | [] |
| [input21.png](input21/candidates.png) | A -> C -> D | [] |
| [input22.png](input22/candidates.png) | C -> B -> A | [2, 3] |
| [input23.png](input23/candidates.png) | E -> D -> C | [1] |
| [input24.png](input24/candidates.png) | E -> D -> C | [] |
| [input25.png](input25/candidates.png) | C -> B -> E | [2, 3] |

input19 now proposes D-A-E. Recovery preserves fine window strokes inside the existing candidate A box. The close competing scores remain flagged. All candidate boxes and previously confident selections are unchanged.
