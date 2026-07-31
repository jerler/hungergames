# Event Distribution Baseline

This deterministic report measures primary authored event selections. Preparation, aftermath, and status-resolution history entries are excluded so they do not distort catalogue repetition.

## Sample

- Total games: 300
- Half Games: 200
- Full Games: 100
- Excluded non-primary history entries: 16376
- Unclassified Day 1 primary entries: 0

## Interpretation notes

- Appearance is the percentage of games containing a definition at least once.
- Pool share is the percentage of all selections in the same game-size and period pool.
- Consecutive-game overlap counts distinct definition IDs shared by adjacent seeded simulations.
- Never-selected lists are based on catalogue membership and declared periods; selection diagnostics distinguish ineligible, infeasible, planner-bypassed, and weighted-but-unselected definitions.
- Diagnostic feasibility uses isolated deterministic random streams and does not consume gameplay randomness.

## Half Game

Games: 200

### Bloodbath — Cornucopia

- Total selections: 1091
- Average selections per game: 5.46
- Non-solo share: 73.2%
- Consecutive-game overlap: average 0.93, median 1.00, P90 2.00, maximum 4.00 across 199 comparisons
- Top five event share: 29.1%
- Top ten event share: 45.2%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 292 | 26.8% |
| Pair | 497 | 45.6% |
| Trio | 294 | 26.9% |
| Four-plus | 8 | 0.7% |

#### Selection diagnostics

- Games captured: 200
- Selection opportunities: 1098
- Solo selected while a non-solo candidate was feasible: 19
- Opportunities with no feasible non-solo candidate: 280
- Opportunities with no feasible candidate: 7

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 2179 | 292 |
| Pair | 7471 | 497 |
| Trio | 1518 | 294 |
| Four-plus | 151 | 8 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| cornucopia-fatal | 697 | 12 | 187 |
| cornucopia-post-target | 201 | 7 | 93 |
| cornucopia-repeat-fatal | 200 | 0 | 0 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `cornucopia-fatal-thrown-knife-head` | Pair | 891 | 887 | 450 | 20 | 4.4% | weighted-not-selected (430) |
| `cornucopia-fatal-improvised-branch-stabbing` | Pair | 891 | 887 | 448 | 25 | 5.6% | weighted-not-selected (423) |
| `cornucopia-fatal-cherry-bomb-attack` | Pair | 891 | 887 | 447 | 34 | 7.6% | weighted-not-selected (413) |
| `cornucopia-fatal-discovering-hidden-tribute` | Pair | 890 | 886 | 446 | 27 | 6.1% | weighted-not-selected (419) |
| `cornucopia-fatal-silent-neck-break` | Pair | 884 | 880 | 441 | 32 | 7.3% | weighted-not-selected (409) |
| `cornucopia-fatal-fistfight-strangulation` | Pair | 886 | 882 | 439 | 37 | 8.4% | weighted-not-selected (402) |
| `cornucopia-fatal-head-against-rock` | Pair | 887 | 884 | 439 | 35 | 8.0% | weighted-not-selected (404) |
| `cornucopia-fatal-killed-while-fleeing` | Pair | 884 | 880 | 433 | 39 | 9.0% | weighted-not-selected (394) |
| `cornucopia-fatal-thrown-knife-chest` | Pair | 884 | 880 | 433 | 37 | 8.5% | weighted-not-selected (396) |
| `cornucopia-fatal-killing-for-supplies` | Pair | 697 | 693 | 258 | 9 | 3.5% | weighted-not-selected (249) |
| `cornucopia-fatal-arrow-through-head` | Pair | 697 | 693 | 258 | 7 | 2.7% | weighted-not-selected (251) |
| `cornucopia-fatal-cliffside-knife-fight` | Pair | 697 | 694 | 254 | 11 | 4.3% | weighted-not-selected (243) |
| `cornucopia-fatal-own-weapon-reversal` | Pair | 697 | 693 | 253 | 7 | 2.8% | fatality-target-stranded (246) |
| `cornucopia-fatal-bag-strap-strangulation` | Pair | 698 | 694 | 252 | 8 | 3.2% | fatality-target-stranded (245) |
| `cornucopia-fatal-sword-decapitation` | Pair | 697 | 694 | 248 | 15 | 6.0% | fatality-target-stranded (241) |
| `cornucopia-fatal-mercy-killing` | Pair | 697 | 693 | 248 | 11 | 4.4% | fatality-target-stranded (244) |
| `cornucopia-fatal-sword-body-strike` | Pair | 697 | 694 | 246 | 15 | 6.1% | fatality-target-stranded (242) |
| `cornucopia-fatal-spear-abdomen` | Pair | 697 | 693 | 245 | 11 | 4.5% | fatality-target-stranded (246) |
| `cornucopia-fatal-three-way-fight` | Trio | 698 | 344 | 237 | 66 | 27.8% | definition-ineligible (354) |
| `cornucopia-fatal-stabbed-while-distracted` | Pair | 697 | 693 | 234 | 20 | 8.5% | fatality-target-stranded (244) |
| `cornucopia-fatal-supply-net-counterweight` | Trio | 698 | 335 | 222 | 63 | 28.4% | definition-ineligible (363) |
| `cornucopia-fatal-double-cherry-bomb` | Trio | 702 | 362 | 216 | 85 | 39.4% | definition-ineligible (340) |
| `cornucopia-flavour-bow` | Solo | 201 | 201 | 201 | 11 | 5.5% | weighted-not-selected (190) |
| `cornucopia-edge-weapon` | Solo | 201 | 201 | 200 | 32 | 16.0% | weighted-not-selected (168) |
| `cornucopia-heavy-weapon` | Solo | 201 | 201 | 200 | 27 | 13.5% | weighted-not-selected (173) |
| `cornucopia-fatal-weapon-rack-chain-reaction` | Trio | 697 | 305 | 194 | 64 | 33.0% | definition-ineligible (392) |
| `cornucopia-flavour-sword` | Solo | 201 | 201 | 189 | 7 | 3.7% | weighted-not-selected (182) |
| `cornucopia-flavour-spear` | Solo | 201 | 201 | 189 | 3 | 1.6% | weighted-not-selected (186) |
| `cornucopia-flavour-trident` | Solo | 201 | 201 | 188 | 2 | 1.1% | weighted-not-selected (186) |
| `cornucopia-flavour-firebomb` | Solo | 201 | 201 | 155 | 1 | 0.6% | weighted-not-selected (154) |
| `cornucopia-tactical-cache` | Solo | 201 | 201 | 153 | 17 | 11.1% | weighted-not-selected (136) |
| `cornucopia-fatal-two-against-two` | Four-plus | 697 | 522 | 144 | 8 | 5.6% | definition-ineligible (175) |
| `cornucopia-fatal-team-drowning` | Trio | 697 | 622 | 121 | 5 | 4.1% | fatality-survivor-budget (201) |
| `cornucopia-fatal-protective-cherry-bomb-intervention` | Trio | 697 | 620 | 121 | 3 | 2.5% | fatality-survivor-budget (206) |
| `cornucopia-fatal-protective-spear-intervention` | Trio | 697 | 618 | 121 | 1 | 0.8% | fatality-survivor-budget (208) |
| `cornucopia-fatal-backpack-weapon-rack-snare` | Solo | 697 | 123 | 116 | 32 | 27.6% | definition-ineligible (574) |
| `cornucopia-fatal-shield-sled` | Solo | 697 | 125 | 115 | 33 | 28.7% | definition-ineligible (572) |
| `cornucopia-contested-weapon` | Pair | 697 | 693 | 115 | 2 | 1.7% | fatality-survivor-budget (225) |
| `cornucopia-fatal-left-bleeding` | Pair | 697 | 693 | 115 | 0 | 0.0% | fatality-survivor-budget (227) |
| `cornucopia-fatal-poisoned-blow-dart` | Pair | 697 | 693 | 115 | 0 | 0.0% | fatality-survivor-budget (227) |
| `cornucopia-pack-ambush` | Pair | 697 | 693 | 115 | 0 | 0.0% | fatality-survivor-budget (227) |
| `cornucopia-nonfatal-weapon-tug-of-war` | Pair | 201 | 111 | 108 | 25 | 23.1% | definition-ineligible (90) |
| `cornucopia-nonfatal-scare-away` | Pair | 201 | 109 | 108 | 24 | 22.2% | definition-ineligible (92) |
| `cornucopia-nonfatal-breadstick-contest` | Pair | 201 | 108 | 108 | 19 | 17.6% | definition-ineligible (93) |
| `cornucopia-nonfatal-split-fishing-supplies` | Pair | 201 | 110 | 108 | 5 | 4.6% | weighted-not-selected (103) |
| `cornucopia-nonfatal-supply-bag-contest` | Pair | 201 | 108 | 107 | 22 | 20.6% | definition-ineligible (93) |
| `cornucopia-fatal-cast-iron-cookware` | Solo | 697 | 95 | 93 | 26 | 28.0% | definition-ineligible (602) |
| `cornucopia-fatal-crate-avalanche` | Solo | 697 | 94 | 91 | 24 | 26.4% | definition-ineligible (603) |
| `cornucopia-fatal-spiked-pit` | Solo | 697 | 92 | 87 | 25 | 28.7% | definition-ineligible (605) |
| `cornucopia-fatal-loaded-crossbow-inspection` | Solo | 697 | 90 | 85 | 26 | 30.6% | definition-ineligible (607) |
| `cornucopia-fatal-armful-of-knives` | Solo | 697 | 78 | 75 | 18 | 24.0% | definition-ineligible (619) |
| `cornucopia-fatal-accidental-arrow` | Trio | 697 | 617 | 61 | 0 | 0.0% | fatality-survivor-budget (396) |
| `cornucopia-entrance-collision` | Trio | 697 | 617 | 60 | 1 | 1.7% | fatality-survivor-budget (393) |
| `cornucopia-three-way-weapon-melee` | Trio | 697 | 617 | 60 | 0 | 0.0% | fatality-survivor-budget (394) |
| `cornucopia-fatal-podium-detonation-bits` | Solo | 697 | 26 | 24 | 5 | 20.8% | definition-ineligible (671) |
| `cornucopia-fatal-podium-detonation-balloon` | Solo | 697 | 20 | 18 | 3 | 16.7% | definition-ineligible (677) |
| `cornucopia-nonfatal-trio-weapon-rack-domino` | Trio | 201 | 15 | 15 | 2 | 13.3% | definition-ineligible (186) |
| `cornucopia-nonfatal-three-person-supply-team` | Trio | 201 | 15 | 15 | 1 | 6.7% | definition-ineligible (186) |
| `cornucopia-nonfatal-trio-backpack-tear` | Trio | 201 | 15 | 15 | 1 | 6.7% | definition-ineligible (186) |
| `cornucopia-nonfatal-trio-distraction-circle` | Trio | 201 | 15 | 15 | 1 | 6.7% | definition-ineligible (186) |
| `cornucopia-nonfatal-trio-supply-net-pinata` | Trio | 201 | 15 | 15 | 1 | 6.7% | definition-ineligible (186) |
| `cornucopia-nonfatal-trio-canned-peaches-ceasefire` | Trio | 201 | 15 | 15 | 0 | 0.0% | definition-ineligible (186) |
| `cornucopia-nonfatal-trio-crate-battering-ram` | Trio | 201 | 15 | 15 | 0 | 0.0% | definition-ineligible (186) |
| `cornucopia-nonfatal-four-person-shared-haul` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-alliance-name` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-backpack-musical-chairs` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-circular-theft` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-crate-pyramid` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-moving-barricade` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |
| `cornucopia-nonfatal-quartet-tarp-sail` | Four-plus | 201 | 1 | 1 | 0 | 0.0% | definition-ineligible (200) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| Bloodbath — cornucopia-fatal-authored | 887 | 200 | 100.0% | 81.3% |
| Bloodbath — cornucopia-nonfatal-interaction | 101 | 100 | 50.0% | 9.3% |
| Bloodbath — cornucopia-acquisition | 76 | 75 | 37.5% | 7.0% |
| Bloodbath — cornucopia-flavour-acquisition | 24 | 24 | 12.0% | 2.2% |
| Bloodbath — cornucopia-pair-conflict | 2 | 2 | 1.0% | 0.2% |
| Bloodbath — cornucopia-group-conflict | 1 | 1 | 0.5% | 0.1% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `cornucopia-fatal-double-cherry-bomb` | Bloodbath — cornucopia-fatal-authored | 85 | 85 | 42.5% | 7.8% | 0.42 | 85 | 170 | 0 | 0 | 85 | 0 |
| `cornucopia-fatal-three-way-fight` | Bloodbath — cornucopia-fatal-authored | 66 | 66 | 33.0% | 6.0% | 0.33 | 66 | 132 | 0 | 0 | 66 | 0 |
| `cornucopia-fatal-weapon-rack-chain-reaction` | Bloodbath — cornucopia-fatal-authored | 64 | 64 | 32.0% | 5.9% | 0.32 | 64 | 128 | 0 | 0 | 64 | 0 |
| `cornucopia-fatal-supply-net-counterweight` | Bloodbath — cornucopia-fatal-authored | 63 | 63 | 31.5% | 5.8% | 0.32 | 63 | 126 | 0 | 0 | 63 | 0 |
| `cornucopia-fatal-killed-while-fleeing` | Bloodbath — cornucopia-fatal-authored | 39 | 39 | 19.5% | 3.6% | 0.20 | 39 | 39 | 0 | 39 | 0 | 0 |
| `cornucopia-fatal-fistfight-strangulation` | Bloodbath — cornucopia-fatal-authored | 37 | 37 | 18.5% | 3.4% | 0.18 | 37 | 37 | 0 | 37 | 0 | 0 |
| `cornucopia-fatal-thrown-knife-chest` | Bloodbath — cornucopia-fatal-authored | 37 | 37 | 18.5% | 3.4% | 0.18 | 37 | 37 | 0 | 37 | 0 | 0 |
| `cornucopia-fatal-head-against-rock` | Bloodbath — cornucopia-fatal-authored | 35 | 35 | 17.5% | 3.2% | 0.17 | 35 | 35 | 0 | 35 | 0 | 0 |
| `cornucopia-fatal-cherry-bomb-attack` | Bloodbath — cornucopia-fatal-authored | 34 | 34 | 17.0% | 3.1% | 0.17 | 34 | 34 | 0 | 34 | 0 | 0 |
| `cornucopia-fatal-shield-sled` | Bloodbath — cornucopia-fatal-authored | 33 | 33 | 16.5% | 3.0% | 0.17 | 33 | 33 | 33 | 0 | 0 | 0 |
| `cornucopia-edge-weapon` | Bloodbath — cornucopia-acquisition | 32 | 32 | 16.0% | 2.9% | 0.16 | 0 | 0 | 32 | 0 | 0 | 0 |
| `cornucopia-fatal-backpack-weapon-rack-snare` | Bloodbath — cornucopia-fatal-authored | 32 | 32 | 16.0% | 2.9% | 0.16 | 32 | 32 | 32 | 0 | 0 | 0 |
| `cornucopia-fatal-silent-neck-break` | Bloodbath — cornucopia-fatal-authored | 32 | 32 | 16.0% | 2.9% | 0.16 | 32 | 32 | 0 | 32 | 0 | 0 |
| `cornucopia-fatal-discovering-hidden-tribute` | Bloodbath — cornucopia-fatal-authored | 27 | 27 | 13.5% | 2.5% | 0.14 | 27 | 27 | 0 | 27 | 0 | 0 |
| `cornucopia-heavy-weapon` | Bloodbath — cornucopia-acquisition | 27 | 27 | 13.5% | 2.5% | 0.14 | 0 | 0 | 27 | 0 | 0 | 0 |
| `cornucopia-fatal-cast-iron-cookware` | Bloodbath — cornucopia-fatal-authored | 26 | 26 | 13.0% | 2.4% | 0.13 | 26 | 26 | 26 | 0 | 0 | 0 |
| `cornucopia-fatal-loaded-crossbow-inspection` | Bloodbath — cornucopia-fatal-authored | 26 | 26 | 13.0% | 2.4% | 0.13 | 26 | 26 | 26 | 0 | 0 | 0 |
| `cornucopia-fatal-improvised-branch-stabbing` | Bloodbath — cornucopia-fatal-authored | 25 | 25 | 12.5% | 2.3% | 0.13 | 25 | 25 | 0 | 25 | 0 | 0 |
| `cornucopia-fatal-spiked-pit` | Bloodbath — cornucopia-fatal-authored | 25 | 25 | 12.5% | 2.3% | 0.13 | 25 | 25 | 25 | 0 | 0 | 0 |
| `cornucopia-nonfatal-weapon-tug-of-war` | Bloodbath — cornucopia-nonfatal-interaction | 25 | 25 | 12.5% | 2.3% | 0.13 | 0 | 0 | 0 | 25 | 0 | 0 |
| `cornucopia-fatal-crate-avalanche` | Bloodbath — cornucopia-fatal-authored | 24 | 24 | 12.0% | 2.2% | 0.12 | 24 | 24 | 24 | 0 | 0 | 0 |
| `cornucopia-nonfatal-scare-away` | Bloodbath — cornucopia-nonfatal-interaction | 24 | 24 | 12.0% | 2.2% | 0.12 | 0 | 0 | 0 | 24 | 0 | 0 |
| `cornucopia-nonfatal-supply-bag-contest` | Bloodbath — cornucopia-nonfatal-interaction | 22 | 22 | 11.0% | 2.0% | 0.11 | 0 | 0 | 0 | 22 | 0 | 0 |
| `cornucopia-fatal-stabbed-while-distracted` | Bloodbath — cornucopia-fatal-authored | 20 | 20 | 10.0% | 1.8% | 0.10 | 20 | 20 | 0 | 20 | 0 | 0 |
| `cornucopia-fatal-thrown-knife-head` | Bloodbath — cornucopia-fatal-authored | 20 | 20 | 10.0% | 1.8% | 0.10 | 20 | 20 | 0 | 20 | 0 | 0 |
| `cornucopia-nonfatal-breadstick-contest` | Bloodbath — cornucopia-nonfatal-interaction | 19 | 19 | 9.5% | 1.7% | 0.10 | 0 | 0 | 0 | 19 | 0 | 0 |
| `cornucopia-fatal-armful-of-knives` | Bloodbath — cornucopia-fatal-authored | 18 | 18 | 9.0% | 1.6% | 0.09 | 18 | 18 | 18 | 0 | 0 | 0 |
| `cornucopia-tactical-cache` | Bloodbath — cornucopia-acquisition | 17 | 17 | 8.5% | 1.6% | 0.09 | 0 | 0 | 17 | 0 | 0 | 0 |
| `cornucopia-fatal-sword-body-strike` | Bloodbath — cornucopia-fatal-authored | 15 | 15 | 7.5% | 1.4% | 0.07 | 15 | 15 | 0 | 15 | 0 | 0 |
| `cornucopia-fatal-sword-decapitation` | Bloodbath — cornucopia-fatal-authored | 15 | 15 | 7.5% | 1.4% | 0.07 | 15 | 15 | 0 | 15 | 0 | 0 |
| `cornucopia-fatal-cliffside-knife-fight` | Bloodbath — cornucopia-fatal-authored | 11 | 11 | 5.5% | 1.0% | 0.06 | 11 | 11 | 0 | 11 | 0 | 0 |
| `cornucopia-fatal-mercy-killing` | Bloodbath — cornucopia-fatal-authored | 11 | 11 | 5.5% | 1.0% | 0.06 | 11 | 11 | 0 | 11 | 0 | 0 |
| `cornucopia-fatal-spear-abdomen` | Bloodbath — cornucopia-fatal-authored | 11 | 11 | 5.5% | 1.0% | 0.06 | 11 | 11 | 0 | 11 | 0 | 0 |
| `cornucopia-flavour-bow` | Bloodbath — cornucopia-flavour-acquisition | 11 | 11 | 5.5% | 1.0% | 0.06 | 0 | 0 | 11 | 0 | 0 | 0 |
| `cornucopia-fatal-killing-for-supplies` | Bloodbath — cornucopia-fatal-authored | 9 | 9 | 4.5% | 0.8% | 0.04 | 9 | 9 | 0 | 9 | 0 | 0 |
| `cornucopia-fatal-bag-strap-strangulation` | Bloodbath — cornucopia-fatal-authored | 8 | 8 | 4.0% | 0.7% | 0.04 | 8 | 8 | 0 | 8 | 0 | 0 |
| `cornucopia-fatal-two-against-two` | Bloodbath — cornucopia-fatal-authored | 8 | 8 | 4.0% | 0.7% | 0.04 | 8 | 16 | 0 | 0 | 0 | 8 |
| `cornucopia-fatal-arrow-through-head` | Bloodbath — cornucopia-fatal-authored | 7 | 7 | 3.5% | 0.6% | 0.04 | 7 | 7 | 0 | 7 | 0 | 0 |
| `cornucopia-fatal-own-weapon-reversal` | Bloodbath — cornucopia-fatal-authored | 7 | 7 | 3.5% | 0.6% | 0.04 | 7 | 7 | 0 | 7 | 0 | 0 |
| `cornucopia-flavour-sword` | Bloodbath — cornucopia-flavour-acquisition | 7 | 7 | 3.5% | 0.6% | 0.04 | 0 | 0 | 7 | 0 | 0 | 0 |
| `cornucopia-fatal-podium-detonation-bits` | Bloodbath — cornucopia-fatal-authored | 5 | 5 | 2.5% | 0.5% | 0.03 | 5 | 5 | 5 | 0 | 0 | 0 |
| `cornucopia-fatal-team-drowning` | Bloodbath — cornucopia-fatal-authored | 5 | 5 | 2.5% | 0.5% | 0.03 | 5 | 5 | 0 | 0 | 5 | 0 |
| `cornucopia-nonfatal-split-fishing-supplies` | Bloodbath — cornucopia-nonfatal-interaction | 5 | 5 | 2.5% | 0.5% | 0.03 | 0 | 0 | 0 | 5 | 0 | 0 |
| `cornucopia-fatal-podium-detonation-balloon` | Bloodbath — cornucopia-fatal-authored | 3 | 3 | 1.5% | 0.3% | 0.01 | 3 | 3 | 3 | 0 | 0 | 0 |
| `cornucopia-fatal-protective-cherry-bomb-intervention` | Bloodbath — cornucopia-fatal-authored | 3 | 3 | 1.5% | 0.3% | 0.01 | 3 | 3 | 0 | 0 | 3 | 0 |
| `cornucopia-flavour-spear` | Bloodbath — cornucopia-flavour-acquisition | 3 | 3 | 1.5% | 0.3% | 0.01 | 0 | 0 | 3 | 0 | 0 | 0 |
| `cornucopia-contested-weapon` | Bloodbath — cornucopia-pair-conflict | 2 | 2 | 1.0% | 0.2% | 0.01 | 2 | 2 | 0 | 2 | 0 | 0 |
| `cornucopia-flavour-trident` | Bloodbath — cornucopia-flavour-acquisition | 2 | 2 | 1.0% | 0.2% | 0.01 | 0 | 0 | 2 | 0 | 0 | 0 |
| `cornucopia-nonfatal-trio-weapon-rack-domino` | Bloodbath — cornucopia-nonfatal-interaction | 2 | 2 | 1.0% | 0.2% | 0.01 | 0 | 0 | 0 | 0 | 2 | 0 |
| `cornucopia-entrance-collision` | Bloodbath — cornucopia-group-conflict | 1 | 1 | 0.5% | 0.1% | 0.01 | 1 | 2 | 0 | 0 | 1 | 0 |
| `cornucopia-fatal-protective-spear-intervention` | Bloodbath — cornucopia-fatal-authored | 1 | 1 | 0.5% | 0.1% | 0.01 | 1 | 1 | 0 | 0 | 1 | 0 |
| `cornucopia-flavour-firebomb` | Bloodbath — cornucopia-flavour-acquisition | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 1 | 0 | 0 | 0 |
| `cornucopia-nonfatal-three-person-supply-team` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `cornucopia-nonfatal-trio-backpack-tear` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `cornucopia-nonfatal-trio-distraction-circle` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `cornucopia-nonfatal-trio-supply-net-pinata` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- None

Appearing in at least 25% of games:

- `cornucopia-fatal-double-cherry-bomb`
- `cornucopia-fatal-supply-net-counterweight`
- `cornucopia-fatal-three-way-fight`
- `cornucopia-fatal-weapon-rack-chain-reaction`

#### Never selected

- `cornucopia-empty-fjallraven-pack`
- `cornucopia-fatal-accidental-arrow`
- `cornucopia-fatal-left-bleeding`
- `cornucopia-fatal-poisoned-blow-dart`
- `cornucopia-flavour-camping-equipment`
- `cornucopia-flavour-med-kit`
- `cornucopia-flavour-shield`
- `cornucopia-gather-food`
- `cornucopia-hide-inside`
- `cornucopia-nearby-pack`
- `cornucopia-nonfatal-four-person-shared-haul`
- `cornucopia-nonfatal-quartet-alliance-name`
- `cornucopia-nonfatal-quartet-backpack-musical-chairs`
- `cornucopia-nonfatal-quartet-circular-theft`
- `cornucopia-nonfatal-quartet-crate-pyramid`
- `cornucopia-nonfatal-quartet-moving-barricade`
- `cornucopia-nonfatal-quartet-tarp-sail`
- `cornucopia-nonfatal-trio-canned-peaches-ceasefire`
- `cornucopia-nonfatal-trio-crate-battering-ram`
- `cornucopia-pack-ambush`
- `cornucopia-stay-for-more-resources`
- `cornucopia-three-way-weapon-melee`

### Bloodbath — Fleeing

- Total selections: 347
- Average selections per game: 1.74
- Non-solo share: 58.5%
- Consecutive-game overlap: average 0.14, median 0.00, P90 1.00, maximum 2.00 across 199 comparisons
- Top five event share: 29.4%
- Top ten event share: 53.3%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 144 | 41.5% |
| Pair | 157 | 45.2% |
| Trio | 42 | 12.1% |
| Four-plus | 4 | 1.2% |

#### Selection diagnostics

- Games captured: 200
- Selection opportunities: 347
- Solo selected while a non-solo candidate was feasible: 48
- Opportunities with no feasible non-solo candidate: 96
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 4453 | 144 |
| Pair | 2229 | 157 |
| Trio | 888 | 42 |
| Four-plus | 165 | 4 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| flee | 347 | 48 | 96 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `bloodbath-flee-cross-fallen-tree` | Solo | 347 | 347 | 347 | 1 | 0.3% | weighted-not-selected (346) |
| `bloodbath-flee-escape-stampede` | Solo | 347 | 347 | 346 | 4 | 1.2% | weighted-not-selected (342) |
| `bloodbath-flee-hollow-log` | Solo | 347 | 347 | 344 | 10 | 2.9% | weighted-not-selected (334) |
| `bloodbath-flee-leap-across-creek` | Solo | 347 | 347 | 344 | 5 | 1.5% | weighted-not-selected (339) |
| `bloodbath-flee-climb-above-chaos` | Solo | 347 | 347 | 343 | 16 | 4.7% | weighted-not-selected (327) |
| `bloodbath-flee-tall-grass` | Solo | 347 | 347 | 343 | 13 | 3.8% | weighted-not-selected (330) |
| `bloodbath-flee-territorial-goose` | Solo | 347 | 347 | 343 | 13 | 3.8% | weighted-not-selected (330) |
| `bloodbath-flee-bramble-shortcut` | Solo | 347 | 347 | 343 | 11 | 3.2% | weighted-not-selected (332) |
| `bloodbath-flee-emergency-foraging` | Solo | 347 | 347 | 343 | 11 | 3.2% | weighted-not-selected (332) |
| `bloodbath-flee-run-from-cornucopia` | Solo | 347 | 347 | 342 | 17 | 5.0% | weighted-not-selected (325) |
| `bloodbath-flee-cover-tracks` | Solo | 347 | 347 | 342 | 14 | 4.1% | weighted-not-selected (328) |
| `bloodbath-flee-mud-camouflage` | Solo | 347 | 347 | 337 | 15 | 4.5% | weighted-not-selected (322) |
| `bloodbath-flee-follow-insects-water` | Solo | 347 | 347 | 336 | 14 | 4.2% | weighted-not-selected (322) |
| `bloodbath-flee-pair-same-hollow-tree` | Pair | 347 | 259 | 250 | 22 | 8.8% | weighted-not-selected (228) |
| `bloodbath-flee-pair-abandoned-at-creek` | Pair | 347 | 256 | 250 | 5 | 2.0% | weighted-not-selected (245) |
| `bloodbath-flee-pair-decoy-shout` | Pair | 347 | 256 | 249 | 18 | 7.2% | weighted-not-selected (231) |
| `bloodbath-flee-pair-fallen-log-cooperation` | Pair | 347 | 254 | 249 | 18 | 7.2% | weighted-not-selected (231) |
| `bloodbath-flee-pair-shoulder-collision` | Pair | 347 | 261 | 248 | 21 | 8.5% | weighted-not-selected (227) |
| `bloodbath-flee-pair-ankle-hook` | Pair | 347 | 256 | 247 | 18 | 7.3% | weighted-not-selected (229) |
| `bloodbath-flee-pair-ravine-route-argument` | Pair | 347 | 260 | 247 | 15 | 6.1% | weighted-not-selected (232) |
| `bloodbath-flee-break-away-crowd` | Pair | 347 | 261 | 246 | 17 | 6.9% | weighted-not-selected (229) |
| `bloodbath-flee-pair-follow-escape-route` | Pair | 347 | 258 | 243 | 23 | 9.5% | weighted-not-selected (220) |
| `bloodbath-flee-trio-bramble-hideout` | Trio | 347 | 153 | 148 | 11 | 7.4% | definition-ineligible (194) |
| `bloodbath-flee-trio-use-third-as-decoy` | Trio | 347 | 150 | 148 | 10 | 6.8% | definition-ineligible (197) |
| `bloodbath-flee-trio-narrow-deer-path` | Trio | 347 | 153 | 148 | 9 | 6.1% | definition-ineligible (194) |
| `bloodbath-flee-trio-escape-group-fractures` | Trio | 347 | 151 | 148 | 7 | 4.7% | definition-ineligible (196) |
| `bloodbath-flee-trio-redirect-pursuit` | Trio | 347 | 149 | 148 | 4 | 2.7% | definition-ineligible (198) |
| `bloodbath-flee-trio-ravine-betrayal` | Trio | 347 | 148 | 148 | 1 | 0.7% | definition-ineligible (199) |
| `bloodbath-flee-quartet-competing-pairs` | Four-plus | 347 | 55 | 55 | 2 | 3.6% | definition-ineligible (292) |
| `bloodbath-flee-quartet-scree-slope-stampede` | Four-plus | 347 | 56 | 55 | 2 | 3.6% | definition-ineligible (291) |
| `bloodbath-flee-quartet-rope-bridge-chain-reaction` | Four-plus | 347 | 55 | 55 | 0 | 0.0% | definition-ineligible (292) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| Bloodbath — flee | 347 | 200 | 100.0% | 100.0% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `bloodbath-flee-pair-follow-escape-route` | Bloodbath — flee | 23 | 23 | 11.5% | 6.6% | 0.12 | 0 | 0 | 0 | 23 | 0 | 0 |
| `bloodbath-flee-pair-same-hollow-tree` | Bloodbath — flee | 22 | 22 | 11.0% | 6.3% | 0.11 | 0 | 0 | 0 | 22 | 0 | 0 |
| `bloodbath-flee-pair-shoulder-collision` | Bloodbath — flee | 21 | 21 | 10.5% | 6.1% | 0.10 | 0 | 0 | 0 | 21 | 0 | 0 |
| `bloodbath-flee-pair-ankle-hook` | Bloodbath — flee | 18 | 18 | 9.0% | 5.2% | 0.09 | 0 | 0 | 0 | 18 | 0 | 0 |
| `bloodbath-flee-pair-decoy-shout` | Bloodbath — flee | 18 | 18 | 9.0% | 5.2% | 0.09 | 0 | 0 | 0 | 18 | 0 | 0 |
| `bloodbath-flee-pair-fallen-log-cooperation` | Bloodbath — flee | 18 | 18 | 9.0% | 5.2% | 0.09 | 8 | 8 | 0 | 18 | 0 | 0 |
| `bloodbath-flee-break-away-crowd` | Bloodbath — flee | 17 | 17 | 8.5% | 4.9% | 0.09 | 0 | 0 | 0 | 17 | 0 | 0 |
| `bloodbath-flee-run-from-cornucopia` | Bloodbath — flee | 17 | 17 | 8.5% | 4.9% | 0.09 | 0 | 0 | 17 | 0 | 0 | 0 |
| `bloodbath-flee-climb-above-chaos` | Bloodbath — flee | 16 | 16 | 8.0% | 4.6% | 0.08 | 0 | 0 | 16 | 0 | 0 | 0 |
| `bloodbath-flee-mud-camouflage` | Bloodbath — flee | 15 | 15 | 7.5% | 4.3% | 0.07 | 0 | 0 | 15 | 0 | 0 | 0 |
| `bloodbath-flee-pair-ravine-route-argument` | Bloodbath — flee | 15 | 15 | 7.5% | 4.3% | 0.07 | 0 | 0 | 0 | 15 | 0 | 0 |
| `bloodbath-flee-cover-tracks` | Bloodbath — flee | 14 | 14 | 7.0% | 4.0% | 0.07 | 0 | 0 | 14 | 0 | 0 | 0 |
| `bloodbath-flee-follow-insects-water` | Bloodbath — flee | 14 | 14 | 7.0% | 4.0% | 0.07 | 0 | 0 | 14 | 0 | 0 | 0 |
| `bloodbath-flee-tall-grass` | Bloodbath — flee | 13 | 13 | 6.5% | 3.7% | 0.07 | 0 | 0 | 13 | 0 | 0 | 0 |
| `bloodbath-flee-territorial-goose` | Bloodbath — flee | 13 | 13 | 6.5% | 3.7% | 0.07 | 0 | 0 | 13 | 0 | 0 | 0 |
| `bloodbath-flee-bramble-shortcut` | Bloodbath — flee | 11 | 11 | 5.5% | 3.2% | 0.06 | 0 | 0 | 11 | 0 | 0 | 0 |
| `bloodbath-flee-emergency-foraging` | Bloodbath — flee | 11 | 11 | 5.5% | 3.2% | 0.06 | 0 | 0 | 11 | 0 | 0 | 0 |
| `bloodbath-flee-trio-bramble-hideout` | Bloodbath — flee | 11 | 11 | 5.5% | 3.2% | 0.06 | 0 | 0 | 0 | 0 | 11 | 0 |
| `bloodbath-flee-hollow-log` | Bloodbath — flee | 10 | 10 | 5.0% | 2.9% | 0.05 | 0 | 0 | 10 | 0 | 0 | 0 |
| `bloodbath-flee-trio-use-third-as-decoy` | Bloodbath — flee | 10 | 10 | 5.0% | 2.9% | 0.05 | 6 | 6 | 0 | 0 | 10 | 0 |
| `bloodbath-flee-trio-narrow-deer-path` | Bloodbath — flee | 9 | 9 | 4.5% | 2.6% | 0.04 | 1 | 1 | 0 | 0 | 9 | 0 |
| `bloodbath-flee-trio-escape-group-fractures` | Bloodbath — flee | 7 | 7 | 3.5% | 2.0% | 0.04 | 0 | 0 | 0 | 0 | 7 | 0 |
| `bloodbath-flee-leap-across-creek` | Bloodbath — flee | 5 | 5 | 2.5% | 1.4% | 0.03 | 0 | 0 | 5 | 0 | 0 | 0 |
| `bloodbath-flee-pair-abandoned-at-creek` | Bloodbath — flee | 5 | 5 | 2.5% | 1.4% | 0.03 | 2 | 2 | 0 | 5 | 0 | 0 |
| `bloodbath-flee-escape-stampede` | Bloodbath — flee | 4 | 4 | 2.0% | 1.2% | 0.02 | 1 | 1 | 4 | 0 | 0 | 0 |
| `bloodbath-flee-trio-redirect-pursuit` | Bloodbath — flee | 4 | 4 | 2.0% | 1.2% | 0.02 | 0 | 0 | 0 | 0 | 4 | 0 |
| `bloodbath-flee-quartet-competing-pairs` | Bloodbath — flee | 2 | 2 | 1.0% | 0.6% | 0.01 | 0 | 0 | 0 | 0 | 0 | 2 |
| `bloodbath-flee-quartet-scree-slope-stampede` | Bloodbath — flee | 2 | 2 | 1.0% | 0.6% | 0.01 | 0 | 0 | 0 | 0 | 0 | 2 |
| `bloodbath-flee-cross-fallen-tree` | Bloodbath — flee | 1 | 1 | 0.5% | 0.3% | 0.01 | 1 | 1 | 1 | 0 | 0 | 0 |
| `bloodbath-flee-trio-ravine-betrayal` | Bloodbath — flee | 1 | 1 | 0.5% | 0.3% | 0.01 | 1 | 3 | 0 | 0 | 1 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- None

Appearing in at least 25% of games:

- None

#### Never selected

- `bloodbath-flee-quartet-rope-bridge-chain-reaction`

### Day 2+

- Total selections: 1562
- Average selections per game: 7.81
- Non-solo share: 27.0%
- Consecutive-game overlap: average 1.87, median 2.00, P90 3.00, maximum 6.00 across 199 comparisons
- Top five event share: 26.4%
- Top ten event share: 40.5%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 1141 | 73.0% |
| Pair | 420 | 26.9% |
| Trio | 1 | 0.1% |
| Four-plus | 0 | 0.0% |

#### Selection diagnostics

- Games captured: 200
- Selection opportunities: 1562
- Solo selected while a non-solo candidate was feasible: 1060
- Opportunities with no feasible non-solo candidate: 81
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 48631 | 1141 |
| Pair | 14199 | 420 |
| Trio | 38 | 1 |
| Four-plus | 0 | 0 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| ordinary | 1562 | 1060 | 81 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `fallen-cliff` | Solo | 1562 | 1562 | 1551 | 95 | 6.1% | weighted-not-selected (1073) |
| `river-current` | Solo | 1562 | 1562 | 1539 | 156 | 10.1% | weighted-not-selected (1079) |
| `day-collecting-fruit` | Solo | 1562 | 1562 | 1381 | 43 | 3.1% | weighted-not-selected (1213) |
| `forages-for-resources` | Solo | 1562 | 1562 | 1381 | 39 | 2.8% | weighted-not-selected (1229) |
| `identifies-wild-berries` | Solo | 1562 | 1562 | 1381 | 36 | 2.6% | weighted-not-selected (1233) |
| `rough-terrain` | Solo | 1562 | 1562 | 1381 | 36 | 2.6% | weighted-not-selected (1222) |
| `day-exploring-arena` | Solo | 1562 | 1562 | 1381 | 30 | 2.2% | weighted-not-selected (1248) |
| `arena-goose` | Solo | 1562 | 1562 | 1381 | 27 | 2.0% | weighted-not-selected (1264) |
| `day-reaching-higher-ground` | Solo | 1562 | 1562 | 1381 | 27 | 2.0% | weighted-not-selected (1261) |
| `contaminated-water` | Solo | 1562 | 1562 | 1381 | 26 | 1.9% | weighted-not-selected (1286) |
| `raids-nest-for-eggs` | Solo | 1562 | 1562 | 1381 | 26 | 1.9% | weighted-not-selected (1297) |
| `brushfire-supply-run` | Solo | 1562 | 1562 | 1381 | 22 | 1.6% | weighted-not-selected (1277) |
| `day-searching-for-firewood` | Solo | 1562 | 1562 | 1381 | 22 | 1.6% | weighted-not-selected (1281) |
| `deep-cut` | Solo | 1562 | 1562 | 1381 | 20 | 1.4% | weighted-not-selected (1030) |
| `identifies-wild-mushrooms` | Solo | 1562 | 1562 | 1381 | 20 | 1.4% | weighted-not-selected (1297) |
| `day-discovering-river` | Solo | 1562 | 1562 | 1381 | 18 | 1.3% | weighted-not-selected (1303) |
| `day-pricked-by-thorns` | Solo | 1562 | 1562 | 1381 | 17 | 1.2% | weighted-not-selected (1302) |
| `day-sleeping-through-day` | Solo | 1562 | 1562 | 1381 | 16 | 1.2% | weighted-not-selected (1293) |
| `day-scaring-off-another-tribute` | Solo | 1562 | 1562 | 1381 | 15 | 1.1% | weighted-not-selected (1317) |
| `day-ignoring-distant-smoke` | Solo | 1562 | 1562 | 1381 | 13 | 0.9% | weighted-not-selected (1334) |
| `day-discovering-cave-failure` | Solo | 1562 | 1562 | 1381 | 12 | 0.9% | weighted-not-selected (1327) |
| `day-thinking-about-home` | Solo | 1562 | 1562 | 1381 | 11 | 0.8% | weighted-not-selected (1329) |
| `day-picking-flowers` | Solo | 1562 | 1562 | 1381 | 10 | 0.7% | weighted-not-selected (1338) |
| `day-questioning-sanity` | Solo | 1562 | 1562 | 1381 | 9 | 0.7% | weighted-not-selected (1348) |
| `day-camouflaging-in-bushes` | Solo | 1562 | 1562 | 1381 | 8 | 0.6% | weighted-not-selected (1355) |
| `day-discovering-cave-shelter` | Solo | 1562 | 1562 | 1381 | 8 | 0.6% | weighted-not-selected (1351) |
| `day-accidental-self-injury` | Solo | 1562 | 1562 | 1381 | 5 | 0.4% | weighted-not-selected (1354) |
| `day-stalking-another-tribute` | Pair | 1562 | 1562 | 1379 | 45 | 3.3% | weighted-not-selected (1162) |
| `day-chasing-another-tribute` | Pair | 1562 | 1562 | 1379 | 43 | 3.1% | weighted-not-selected (1194) |
| `day-attacking-someone-who-escapes` | Pair | 1562 | 1562 | 1379 | 37 | 2.7% | weighted-not-selected (1227) |
| `day-carve-wooden-club` | Solo | 1562 | 1562 | 1357 | 37 | 2.7% | weighted-not-selected (1201) |
| `day-make-knife` | Solo | 1562 | 1562 | 1357 | 37 | 2.7% | weighted-not-selected (1197) |
| `day-make-stone-hand-axe` | Solo | 1562 | 1562 | 1357 | 26 | 1.9% | weighted-not-selected (1266) |
| `day-build-bow` | Solo | 1562 | 1562 | 1357 | 15 | 1.1% | weighted-not-selected (1302) |
| `day-creating-diversion-and-escaping` | Pair | 1562 | 1562 | 1355 | 44 | 3.2% | weighted-not-selected (1148) |
| `day-defeating-but-sparing` | Pair | 1562 | 1562 | 1352 | 46 | 3.4% | weighted-not-selected (1193) |
| `day-theft-while-distracted` | Pair | 1562 | 1562 | 1316 | 45 | 3.4% | weighted-not-selected (1118) |
| `day-searching-for-water` | Solo | 1562 | 1562 | 1267 | 43 | 3.4% | weighted-not-selected (1098) |
| `steals-fresh-meal` | Pair | 1562 | 1562 | 1193 | 15 | 1.3% | weighted-not-selected (1122) |
| `steals-drink-at-water-source` | Pair | 1562 | 1562 | 1184 | 16 | 1.4% | weighted-not-selected (1129) |
| `steal-from-stronger-tribute` | Pair | 1562 | 1562 | 1167 | 19 | 1.6% | weighted-not-selected (900) |
| `romantic-truce-formation` | Pair | 1562 | 1187 | 1095 | 1 | 0.1% | weighted-not-selected (1092) |
| `day-sneaking-a-nap` | Solo | 1562 | 1562 | 831 | 21 | 2.5% | weighted-not-selected (767) |
| `day-practising-weaponry` | Solo | 1562 | 1562 | 790 | 16 | 2.0% | weighted-not-selected (726) |
| `becomes-hungry` | Solo | 1562 | 1562 | 789 | 55 | 7.0% | weighted-not-selected (624) |
| `becomes-thirsty` | Solo | 1562 | 1562 | 785 | 61 | 7.8% | weighted-not-selected (635) |
| `uses-cornucopia-provisions-water` | Solo | 1562 | 531 | 387 | 23 | 5.9% | definition-ineligible (1031) |
| `uses-cornucopia-provisions-food` | Solo | 1562 | 515 | 380 | 28 | 7.4% | definition-ineligible (1047) |
| `knife-ambush` | Pair | 1562 | 1562 | 276 | 25 | 9.1% | participant-or-item-infeasible (1236) |
| `day-spearfishing` | Solo | 1562 | 1562 | 172 | 4 | 2.3% | participant-or-item-infeasible (1184) |
| `bow-shot` | Pair | 1562 | 1562 | 168 | 14 | 8.3% | participant-or-item-infeasible (1363) |
| `spear-attack` | Pair | 1562 | 1562 | 136 | 11 | 8.1% | participant-or-item-infeasible (1393) |
| `day-hunting-for-food` | Solo | 1562 | 1562 | 114 | 5 | 4.4% | participant-or-item-infeasible (1241) |
| `club-attack` | Pair | 1562 | 1562 | 111 | 14 | 12.6% | participant-or-item-infeasible (1423) |
| `longsword-attack` | Pair | 1562 | 1562 | 82 | 4 | 4.9% | participant-or-item-infeasible (1455) |
| `short-sword-duel` | Pair | 1562 | 1562 | 77 | 7 | 9.1% | participant-or-item-infeasible (1463) |
| `rapier-lunge` | Pair | 1562 | 1562 | 77 | 6 | 7.8% | participant-or-item-infeasible (1465) |
| `axe-attack` | Pair | 1562 | 1562 | 67 | 7 | 10.4% | participant-or-item-infeasible (1470) |
| `axe-based-shelter-renovation` | Solo | 1562 | 1562 | 63 | 3 | 4.8% | participant-or-item-infeasible (1304) |
| `trident-attack` | Pair | 1562 | 1562 | 62 | 3 | 4.8% | participant-or-item-infeasible (1482) |
| `hand-axe-attack` | Pair | 1562 | 1562 | 53 | 10 | 18.9% | participant-or-item-infeasible (1487) |
| `longbow-shot` | Pair | 1562 | 1562 | 49 | 3 | 6.1% | participant-or-item-infeasible (1493) |
| `pike-charge` | Pair | 1562 | 1562 | 49 | 2 | 4.1% | participant-or-item-infeasible (1491) |
| `crossbow-attack` | Pair | 1562 | 1562 | 45 | 2 | 4.4% | participant-or-item-infeasible (1493) |
| `greatsword-charge` | Pair | 1562 | 1562 | 30 | 1 | 3.3% | participant-or-item-infeasible (1516) |
| `firebomb-attack` | Pair | 1562 | 1562 | 22 | 0 | 0.0% | participant-or-item-infeasible (1357) |
| `day-splitting-up-to-search` | Pair | 1562 | 1562 | 21 | 0 | 0.0% | participant-or-item-infeasible (1347) |
| `day-overhearing-conversation` | Trio | 1562 | 1352 | 20 | 0 | 0.0% | participant-or-item-infeasible (1152) |
| `romantic-partner-protection` | Pair | 1562 | 38 | 20 | 0 | 0.0% | definition-ineligible (1524) |
| `day-raiding-unattended-camp` | Trio | 1562 | 1352 | 18 | 1 | 5.6% | participant-or-item-infeasible (1156) |
| `blowgun-poison-attack` | Pair | 1562 | 1562 | 15 | 0 | 0.0% | participant-or-item-infeasible (1365) |
| `poison-vial-attack` | Pair | 1562 | 1562 | 10 | 0 | 0.0% | participant-or-item-infeasible (1370) |
| `bear-trap-attack` | Pair | 1562 | 1562 | 8 | 0 | 0.0% | participant-or-item-infeasible (1372) |
| `day-poison-a-tribute` | Pair | 1562 | 1562 | 8 | 0 | 0.0% | participant-or-item-infeasible (1372) |
| `day-hallucinate-a-tribute` | Pair | 1562 | 1562 | 4 | 0 | 0.0% | participant-or-item-infeasible (1376) |
| `slingshot-chicken-hunt` | Solo | 1562 | 1562 | 4 | 0 | 0.0% | participant-or-item-infeasible (1376) |
| `slingshot-trick-shot` | Solo | 1562 | 1562 | 4 | 0 | 0.0% | participant-or-item-infeasible (1376) |
| `day-working-together` | Pair | 1562 | 3 | 3 | 0 | 0.0% | definition-ineligible (1559) |
| `travel-together-truce-2` | Pair | 1562 | 3 | 3 | 0 | 0.0% | definition-ineligible (1559) |
| `unexpected-pep-talk` | Solo | 1562 | 1562 | 2 | 0 | 0.0% | participant-or-item-infeasible (1378) |
| `amicable-truce-separation-2` | Pair | 1562 | 3 | 1 | 0 | 0.0% | definition-ineligible (1559) |
| `protects-truce-partner` | Pair | 1562 | 3 | 1 | 0 | 0.0% | definition-ineligible (1559) |
| `truce-betrayal-2` | Pair | 1562 | 3 | 1 | 0 | 0.0% | definition-ineligible (1559) |
| `warhammer-attack` | Pair | 1562 | 1562 | 1 | 0 | 0.0% | participant-or-item-infeasible (1548) |
| `amicable-truce-separation-3` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `amicable-truce-separation-4` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `amicable-truce-separation-5` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `amicable-truce-separation-6` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `bird-whistle-nest-search` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `cannot-find-shelter` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `cave-shelter-collapse` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `cold-rain` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `day-fishing` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `finds-dry-rock-overhang` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `finds-hiding-place` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `fishing-gear-catch` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `freezing-night` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `keep-watch-truce-2` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `keep-watch-truce-3` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `keep-watch-truce-4` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `keep-watch-truce-5` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `keep-watch-truce-6` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-both-swing-at-once` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-burning-blanket-panic` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-falling-tree-firewood` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-fatal-tree-fall` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-kicked-burning-log` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-mistaken-for-dinner` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-overengineered-alarm` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-overloaded-shelter` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-pushed-while-dreaming` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-returning-watchkeeper` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-rock-thrown-at-noise` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-sleepwalking-into-river` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-smoke-filled-shelter` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-startled-over-edge` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-accidental-wrong-tree` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-becoming-lost` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-comfortable-bush` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-cooking-provisions` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-crying-to-sleep` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-defending-fire` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-discussing-morning` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-discussing-survivors` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-betrayal-on-watch` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-chopped-from-tree` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-collapsing-cave-entrance` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-cry-from-ravine` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-cut-loose-from-tree` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-drowned-at-river` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-fake-emergency` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-fake-emergency-bow` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-firelight-ambush` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-poisoned-shared-meal` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-rock-from-darkness` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-rolled-into-fire` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-sent-to-check-noise` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-sleeping-bag-canoe` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-smothered-beneath-blanket` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-fatal-snoring-problem` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-ghost-stories` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-holding-hands` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-huddling-for-warmth` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-looking-at-sky` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-natural-wound-treatment` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-nightmares` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-passing-out-exhausted` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-quiet-humming` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-screaming-for-help` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-seeing-distant-fire` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-setting-up-camp` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sharing-shelter` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-simply-sleeping` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-singing-to-sleep` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-singing-together` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sleeping-in-tree` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sleeping-shifts-four` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sleeping-shifts-three` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sleeping-shifts-two` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sleeping-without-fire` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-snuggling` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-sparing-opponent` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-starting-fire` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-staying-awake` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-telling-stories` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-thinking-about-victory` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `night-truce` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `poisonous-berries-joint-victory` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `romantic-night-truce-formation` | Pair | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `shield-used-for-everything-else` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `trap-kit-rabbit-hunt` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `travel-together-truce-3` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `travel-together-truce-4` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `travel-together-truce-5` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `travel-together-truce-6` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `tripwire-attack` | Pair | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1380) |
| `truce-betrayal-3` | Trio | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `truce-betrayal-4` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `truce-betrayal-5` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `truce-betrayal-6` | Four-plus | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |
| `upside-down-map` | Solo | 1562 | 1562 | 0 | 0 | 0.0% | participant-or-item-infeasible (1381) |
| `uses-shelter-supplies` | Solo | 1562 | 0 | 0 | 0 | 0.0% | definition-ineligible (1562) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| day-authored-16-33 | 388 | 182 | 91.0% | 24.8% |
| environmental | 382 | 184 | 92.0% | 24.5% |
| day-authored-01-15 | 226 | 144 | 72.0% | 14.5% |
| deprivation | 116 | 100 | 50.0% | 7.4% |
| day-weapon-crafting | 115 | 97 | 48.5% | 7.4% |
| combat | 109 | 88 | 44.0% | 7.0% |
| foraging | 56 | 55 | 27.5% | 3.6% |
| cornucopia-provisions | 51 | 48 | 24.0% | 3.3% |
| survival | 39 | 39 | 19.5% | 2.5% |
| hunting | 26 | 26 | 13.0% | 1.7% |
| theft | 19 | 19 | 9.5% | 1.2% |
| water-theft | 16 | 16 | 8.0% | 1.0% |
| food-theft | 15 | 15 | 7.5% | 1.0% |
| item-use | 3 | 3 | 1.5% | 0.2% |
| romantic | 1 | 1 | 0.5% | 0.1% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `river-current` | environmental | 156 | 143 | 71.5% | 10.0% | 0.78 | 156 | 156 | 156 | 0 | 0 | 0 |
| `fallen-cliff` | environmental | 95 | 93 | 46.5% | 6.1% | 0.47 | 95 | 95 | 95 | 0 | 0 | 0 |
| `becomes-thirsty` | deprivation | 61 | 61 | 30.5% | 3.9% | 0.30 | 0 | 0 | 61 | 0 | 0 | 0 |
| `becomes-hungry` | deprivation | 55 | 55 | 27.5% | 3.5% | 0.28 | 0 | 0 | 55 | 0 | 0 | 0 |
| `day-defeating-but-sparing` | day-authored-16-33 | 46 | 45 | 22.5% | 2.9% | 0.23 | 0 | 0 | 0 | 46 | 0 | 0 |
| `day-stalking-another-tribute` | day-authored-16-33 | 45 | 45 | 22.5% | 2.9% | 0.23 | 0 | 0 | 0 | 45 | 0 | 0 |
| `day-theft-while-distracted` | day-authored-16-33 | 45 | 45 | 22.5% | 2.9% | 0.23 | 0 | 0 | 0 | 45 | 0 | 0 |
| `day-creating-diversion-and-escaping` | day-authored-16-33 | 44 | 44 | 22.0% | 2.8% | 0.22 | 0 | 0 | 0 | 44 | 0 | 0 |
| `day-chasing-another-tribute` | day-authored-16-33 | 43 | 43 | 21.5% | 2.8% | 0.21 | 0 | 0 | 0 | 43 | 0 | 0 |
| `day-collecting-fruit` | day-authored-01-15 | 43 | 43 | 21.5% | 2.8% | 0.21 | 0 | 0 | 43 | 0 | 0 | 0 |
| `day-searching-for-water` | day-authored-16-33 | 43 | 42 | 21.0% | 2.8% | 0.21 | 0 | 0 | 43 | 0 | 0 | 0 |
| `forages-for-resources` | survival | 39 | 39 | 19.5% | 2.5% | 0.20 | 0 | 0 | 39 | 0 | 0 | 0 |
| `day-attacking-someone-who-escapes` | day-authored-16-33 | 37 | 37 | 18.5% | 2.4% | 0.18 | 0 | 0 | 0 | 37 | 0 | 0 |
| `day-carve-wooden-club` | day-weapon-crafting | 37 | 37 | 18.5% | 2.4% | 0.18 | 0 | 0 | 37 | 0 | 0 | 0 |
| `day-make-knife` | day-weapon-crafting | 37 | 37 | 18.5% | 2.4% | 0.18 | 0 | 0 | 37 | 0 | 0 | 0 |
| `identifies-wild-berries` | foraging | 36 | 36 | 18.0% | 2.3% | 0.18 | 0 | 0 | 36 | 0 | 0 | 0 |
| `rough-terrain` | environmental | 36 | 36 | 18.0% | 2.3% | 0.18 | 0 | 0 | 36 | 0 | 0 | 0 |
| `day-exploring-arena` | day-authored-01-15 | 30 | 30 | 15.0% | 1.9% | 0.15 | 0 | 0 | 30 | 0 | 0 | 0 |
| `uses-cornucopia-provisions-food` | cornucopia-provisions | 28 | 28 | 14.0% | 1.8% | 0.14 | 0 | 0 | 28 | 0 | 0 | 0 |
| `arena-goose` | environmental | 27 | 27 | 13.5% | 1.7% | 0.14 | 0 | 0 | 27 | 0 | 0 | 0 |
| `day-reaching-higher-ground` | day-authored-01-15 | 27 | 27 | 13.5% | 1.7% | 0.14 | 0 | 0 | 27 | 0 | 0 | 0 |
| `contaminated-water` | environmental | 26 | 26 | 13.0% | 1.7% | 0.13 | 0 | 0 | 26 | 0 | 0 | 0 |
| `day-make-stone-hand-axe` | day-weapon-crafting | 26 | 26 | 13.0% | 1.7% | 0.13 | 0 | 0 | 26 | 0 | 0 | 0 |
| `raids-nest-for-eggs` | hunting | 26 | 26 | 13.0% | 1.7% | 0.13 | 0 | 0 | 26 | 0 | 0 | 0 |
| `knife-ambush` | combat | 25 | 25 | 12.5% | 1.6% | 0.13 | 14 | 14 | 0 | 25 | 0 | 0 |
| `uses-cornucopia-provisions-water` | cornucopia-provisions | 23 | 23 | 11.5% | 1.5% | 0.12 | 0 | 0 | 23 | 0 | 0 | 0 |
| `brushfire-supply-run` | environmental | 22 | 22 | 11.0% | 1.4% | 0.11 | 0 | 0 | 22 | 0 | 0 | 0 |
| `day-searching-for-firewood` | day-authored-01-15 | 22 | 22 | 11.0% | 1.4% | 0.11 | 0 | 0 | 22 | 0 | 0 | 0 |
| `day-sneaking-a-nap` | day-authored-16-33 | 21 | 21 | 10.5% | 1.3% | 0.10 | 0 | 0 | 21 | 0 | 0 | 0 |
| `deep-cut` | environmental | 20 | 20 | 10.0% | 1.3% | 0.10 | 0 | 0 | 20 | 0 | 0 | 0 |
| `identifies-wild-mushrooms` | foraging | 20 | 20 | 10.0% | 1.3% | 0.10 | 0 | 0 | 20 | 0 | 0 | 0 |
| `steal-from-stronger-tribute` | theft | 19 | 19 | 9.5% | 1.2% | 0.10 | 4 | 4 | 0 | 19 | 0 | 0 |
| `day-discovering-river` | day-authored-01-15 | 18 | 18 | 9.0% | 1.2% | 0.09 | 0 | 0 | 18 | 0 | 0 | 0 |
| `day-pricked-by-thorns` | day-authored-01-15 | 17 | 17 | 8.5% | 1.1% | 0.09 | 0 | 0 | 17 | 0 | 0 | 0 |
| `day-practising-weaponry` | day-authored-01-15 | 16 | 16 | 8.0% | 1.0% | 0.08 | 0 | 0 | 16 | 0 | 0 | 0 |
| `day-sleeping-through-day` | day-authored-16-33 | 16 | 16 | 8.0% | 1.0% | 0.08 | 0 | 0 | 16 | 0 | 0 | 0 |
| `steals-drink-at-water-source` | water-theft | 16 | 16 | 8.0% | 1.0% | 0.08 | 1 | 1 | 0 | 16 | 0 | 0 |
| `day-build-bow` | day-weapon-crafting | 15 | 15 | 7.5% | 1.0% | 0.07 | 0 | 0 | 15 | 0 | 0 | 0 |
| `day-scaring-off-another-tribute` | day-authored-16-33 | 15 | 15 | 7.5% | 1.0% | 0.07 | 0 | 0 | 15 | 0 | 0 | 0 |
| `steals-fresh-meal` | food-theft | 15 | 15 | 7.5% | 1.0% | 0.07 | 0 | 0 | 0 | 15 | 0 | 0 |
| `bow-shot` | combat | 14 | 14 | 7.0% | 0.9% | 0.07 | 10 | 10 | 0 | 14 | 0 | 0 |
| `club-attack` | combat | 14 | 14 | 7.0% | 0.9% | 0.07 | 12 | 12 | 0 | 14 | 0 | 0 |
| `day-ignoring-distant-smoke` | day-authored-01-15 | 13 | 13 | 6.5% | 0.8% | 0.07 | 0 | 0 | 13 | 0 | 0 | 0 |
| `day-discovering-cave-failure` | day-authored-16-33 | 12 | 12 | 6.0% | 0.8% | 0.06 | 0 | 0 | 12 | 0 | 0 | 0 |
| `day-thinking-about-home` | day-authored-01-15 | 11 | 11 | 5.5% | 0.7% | 0.06 | 0 | 0 | 11 | 0 | 0 | 0 |
| `spear-attack` | combat | 11 | 11 | 5.5% | 0.7% | 0.06 | 7 | 7 | 0 | 11 | 0 | 0 |
| `day-picking-flowers` | day-authored-01-15 | 10 | 10 | 5.0% | 0.6% | 0.05 | 0 | 0 | 10 | 0 | 0 | 0 |
| `hand-axe-attack` | combat | 10 | 10 | 5.0% | 0.6% | 0.05 | 6 | 6 | 0 | 10 | 0 | 0 |
| `day-questioning-sanity` | day-authored-01-15 | 9 | 9 | 4.5% | 0.6% | 0.04 | 0 | 0 | 9 | 0 | 0 | 0 |
| `day-camouflaging-in-bushes` | day-authored-16-33 | 8 | 8 | 4.0% | 0.5% | 0.04 | 0 | 0 | 8 | 0 | 0 | 0 |
| `day-discovering-cave-shelter` | day-authored-16-33 | 8 | 8 | 4.0% | 0.5% | 0.04 | 0 | 0 | 8 | 0 | 0 | 0 |
| `axe-attack` | combat | 7 | 7 | 3.5% | 0.4% | 0.04 | 5 | 5 | 0 | 7 | 0 | 0 |
| `short-sword-duel` | combat | 7 | 7 | 3.5% | 0.4% | 0.04 | 5 | 5 | 0 | 7 | 0 | 0 |
| `rapier-lunge` | combat | 6 | 6 | 3.0% | 0.4% | 0.03 | 6 | 6 | 0 | 6 | 0 | 0 |
| `day-accidental-self-injury` | day-authored-01-15 | 5 | 5 | 2.5% | 0.3% | 0.03 | 0 | 0 | 5 | 0 | 0 | 0 |
| `day-hunting-for-food` | day-authored-01-15 | 5 | 5 | 2.5% | 0.3% | 0.03 | 0 | 0 | 5 | 0 | 0 | 0 |
| `day-spearfishing` | day-authored-16-33 | 4 | 4 | 2.0% | 0.3% | 0.02 | 0 | 0 | 4 | 0 | 0 | 0 |
| `longsword-attack` | combat | 4 | 4 | 2.0% | 0.3% | 0.02 | 2 | 2 | 0 | 4 | 0 | 0 |
| `axe-based-shelter-renovation` | item-use | 3 | 3 | 1.5% | 0.2% | 0.01 | 0 | 0 | 3 | 0 | 0 | 0 |
| `longbow-shot` | combat | 3 | 3 | 1.5% | 0.2% | 0.01 | 1 | 1 | 0 | 3 | 0 | 0 |
| `trident-attack` | combat | 3 | 3 | 1.5% | 0.2% | 0.01 | 2 | 2 | 0 | 3 | 0 | 0 |
| `crossbow-attack` | combat | 2 | 2 | 1.0% | 0.1% | 0.01 | 2 | 2 | 0 | 2 | 0 | 0 |
| `pike-charge` | combat | 2 | 2 | 1.0% | 0.1% | 0.01 | 1 | 1 | 0 | 2 | 0 | 0 |
| `day-raiding-unattended-camp` | day-authored-16-33 | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `greatsword-charge` | combat | 1 | 1 | 0.5% | 0.1% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `romantic-truce-formation` | romantic | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- `river-current`

Appearing in at least 25% of games:

- `becomes-hungry`
- `becomes-thirsty`
- `fallen-cliff`
- `river-current`

#### Never selected

- `amicable-truce-separation-2`
- `amicable-truce-separation-3`
- `amicable-truce-separation-4`
- `amicable-truce-separation-5`
- `amicable-truce-separation-6`
- `bear-trap-attack`
- `bird-whistle-nest-search`
- `blowgun-poison-attack`
- `day-fishing`
- `day-hallucinate-a-tribute`
- `day-overhearing-conversation`
- `day-poison-a-tribute`
- `day-splitting-up-to-search`
- `day-working-together`
- `firebomb-attack`
- `fishing-gear-catch`
- `poison-vial-attack`
- `poisonous-berries-joint-victory`
- `protects-truce-partner`
- `romantic-partner-protection`
- `shield-used-for-everything-else`
- `slingshot-chicken-hunt`
- `slingshot-trick-shot`
- `trap-kit-rabbit-hunt`
- `travel-together-truce-2`
- `travel-together-truce-3`
- `travel-together-truce-4`
- `travel-together-truce-5`
- `travel-together-truce-6`
- `tripwire-attack`
- `truce-betrayal-2`
- `truce-betrayal-3`
- `truce-betrayal-4`
- `truce-betrayal-5`
- `truce-betrayal-6`
- `unexpected-pep-talk`
- `upside-down-map`
- `warhammer-attack`

### Night

- Total selections: 1790
- Average selections per game: 8.95
- Non-solo share: 25.1%
- Consecutive-game overlap: average 2.43, median 2.00, P90 4.00, maximum 6.00 across 199 comparisons
- Top five event share: 27.6%
- Top ten event share: 44.4%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 1341 | 74.9% |
| Pair | 433 | 24.2% |
| Trio | 16 | 0.9% |
| Four-plus | 0 | 0.0% |

#### Selection diagnostics

- Games captured: 200
- Selection opportunities: 1705
- Solo selected while a non-solo candidate was feasible: 1336
- Opportunities with no feasible non-solo candidate: 0
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 42211 | 1336 |
| Pair | 17118 | 369 |
| Trio | 0 | 0 |
| Four-plus | 0 | 0 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| ordinary | 1705 | 1336 | 0 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `cave-shelter-collapse` | Solo | 1705 | 1705 | 1526 | 61 | 4.0% | weighted-not-selected (1317) |
| `fallen-cliff` | Solo | 1705 | 1705 | 1526 | 61 | 4.0% | weighted-not-selected (1062) |
| `night-fatal-drowned-at-river` | Pair | 1705 | 1705 | 1526 | 35 | 2.3% | weighted-not-selected (1434) |
| `night-accidental-fatal-tree-fall` | Solo | 1705 | 1705 | 1526 | 29 | 1.9% | weighted-not-selected (1446) |
| `night-accidental-startled-over-edge` | Pair | 1705 | 1705 | 1526 | 27 | 1.8% | weighted-not-selected (1454) |
| `night-fatal-rock-from-darkness` | Pair | 1705 | 1705 | 1526 | 22 | 1.4% | weighted-not-selected (1480) |
| `night-accidental-wrong-tree` | Solo | 1705 | 1705 | 1526 | 21 | 1.4% | weighted-not-selected (1442) |
| `night-accidental-rock-thrown-at-noise` | Pair | 1705 | 1705 | 1524 | 21 | 1.4% | weighted-not-selected (1461) |
| `freezing-night` | Solo | 1705 | 1705 | 1513 | 141 | 9.3% | weighted-not-selected (1009) |
| `night-fatal-cry-from-ravine` | Pair | 1705 | 1705 | 1487 | 37 | 2.5% | weighted-not-selected (1353) |
| `night-fatal-collapsing-cave-entrance` | Pair | 1705 | 1705 | 1487 | 26 | 1.7% | weighted-not-selected (1408) |
| `cold-rain` | Solo | 1705 | 1705 | 1442 | 88 | 6.1% | weighted-not-selected (995) |
| `finds-hiding-place` | Solo | 1705 | 1705 | 1442 | 82 | 5.7% | weighted-not-selected (1022) |
| `deep-cut` | Solo | 1705 | 1705 | 1442 | 60 | 4.2% | weighted-not-selected (1074) |
| `night-setting-up-camp` | Solo | 1705 | 1705 | 1442 | 55 | 3.8% | weighted-not-selected (1151) |
| `finds-dry-rock-overhang` | Solo | 1705 | 1705 | 1442 | 49 | 3.4% | weighted-not-selected (1211) |
| `night-starting-fire` | Solo | 1705 | 1705 | 1442 | 46 | 3.2% | weighted-not-selected (1236) |
| `night-sleeping-in-tree` | Solo | 1705 | 1705 | 1442 | 40 | 2.8% | weighted-not-selected (1229) |
| `night-simply-sleeping` | Solo | 1705 | 1705 | 1442 | 33 | 2.3% | weighted-not-selected (1271) |
| `night-sleeping-without-fire` | Solo | 1705 | 1705 | 1442 | 30 | 2.1% | weighted-not-selected (1309) |
| `night-comfortable-bush` | Solo | 1705 | 1705 | 1442 | 28 | 1.9% | weighted-not-selected (1302) |
| `night-nightmares` | Solo | 1705 | 1705 | 1442 | 28 | 1.9% | weighted-not-selected (1295) |
| `night-thinking-about-victory` | Solo | 1705 | 1705 | 1442 | 28 | 1.9% | weighted-not-selected (1303) |
| `cannot-find-shelter` | Solo | 1705 | 1705 | 1442 | 24 | 1.7% | weighted-not-selected (1318) |
| `night-sparing-opponent` | Pair | 1705 | 1705 | 1442 | 24 | 1.7% | weighted-not-selected (1327) |
| `night-singing-to-sleep` | Solo | 1705 | 1705 | 1442 | 23 | 1.6% | weighted-not-selected (1315) |
| `night-staying-awake` | Solo | 1705 | 1705 | 1442 | 22 | 1.5% | weighted-not-selected (1344) |
| `night-seeing-distant-fire` | Solo | 1705 | 1705 | 1442 | 21 | 1.5% | weighted-not-selected (1345) |
| `night-quiet-humming` | Solo | 1705 | 1705 | 1442 | 13 | 0.9% | weighted-not-selected (1362) |
| `night-screaming-for-help` | Solo | 1705 | 1705 | 1442 | 13 | 0.9% | weighted-not-selected (1389) |
| `night-crying-to-sleep` | Solo | 1705 | 1705 | 1442 | 11 | 0.8% | weighted-not-selected (1387) |
| `night-huddling-for-warmth` | Pair | 1705 | 1705 | 1441 | 27 | 1.9% | weighted-not-selected (1312) |
| `night-becoming-lost` | Solo | 1705 | 1705 | 1340 | 25 | 1.9% | weighted-not-selected (1244) |
| `steal-from-stronger-tribute` | Pair | 1705 | 1705 | 1240 | 56 | 4.5% | weighted-not-selected (954) |
| `night-passing-out-exhausted` | Solo | 1705 | 1705 | 1208 | 32 | 2.6% | weighted-not-selected (1065) |
| `romantic-night-truce-formation` | Pair | 1705 | 1338 | 1140 | 4 | 0.4% | weighted-not-selected (1122) |
| `night-looking-at-sky` | Solo | 1705 | 1705 | 950 | 14 | 1.5% | weighted-not-selected (883) |
| `night-accidental-sleepwalking-into-river` | Solo | 1705 | 1705 | 772 | 13 | 1.7% | weighted-not-selected (738) |
| `becomes-hungry` | Solo | 1705 | 1705 | 656 | 12 | 1.8% | participant-or-item-infeasible (762) |
| `becomes-thirsty` | Solo | 1705 | 1705 | 637 | 12 | 1.9% | participant-or-item-infeasible (769) |
| `night-fatal-cut-loose-from-tree` | Pair | 1705 | 1705 | 621 | 13 | 2.1% | participant-or-item-infeasible (852) |
| `uses-cornucopia-provisions-water` | Solo | 1705 | 752 | 616 | 94 | 15.3% | definition-ineligible (953) |
| `uses-cornucopia-provisions-food` | Solo | 1705 | 737 | 593 | 89 | 15.0% | definition-ineligible (968) |
| `night-accidental-mistaken-for-dinner` | Pair | 1705 | 1705 | 416 | 12 | 2.9% | participant-or-item-infeasible (1074) |
| `night-natural-wound-treatment` | Solo | 1705 | 1705 | 338 | 33 | 9.8% | participant-or-item-infeasible (1048) |
| `knife-ambush` | Pair | 1705 | 1705 | 289 | 18 | 6.2% | participant-or-item-infeasible (1205) |
| `night-accidental-both-swing-at-once` | Pair | 1705 | 1705 | 284 | 7 | 2.5% | participant-or-item-infeasible (1188) |
| `bow-shot` | Pair | 1705 | 1705 | 172 | 4 | 2.3% | participant-or-item-infeasible (1340) |
| `night-fatal-chopped-from-tree` | Pair | 1705 | 1705 | 136 | 5 | 3.7% | participant-or-item-infeasible (1374) |
| `club-attack` | Pair | 1705 | 1705 | 130 | 4 | 3.1% | participant-or-item-infeasible (1382) |
| `night-fatal-fake-emergency` | Pair | 1705 | 1705 | 119 | 5 | 4.2% | participant-or-item-infeasible (1390) |
| `longsword-attack` | Pair | 1705 | 1705 | 91 | 6 | 6.6% | participant-or-item-infeasible (1422) |
| `rapier-lunge` | Pair | 1705 | 1705 | 78 | 4 | 5.1% | participant-or-item-infeasible (1442) |
| `short-sword-duel` | Pair | 1705 | 1705 | 76 | 2 | 2.6% | participant-or-item-infeasible (1446) |
| `hand-axe-attack` | Pair | 1705 | 1705 | 66 | 2 | 3.0% | participant-or-item-infeasible (1454) |
| `trident-attack` | Pair | 1705 | 1705 | 56 | 3 | 5.4% | participant-or-item-infeasible (1460) |
| `crossbow-attack` | Pair | 1705 | 1705 | 55 | 3 | 5.5% | participant-or-item-infeasible (1466) |
| `uses-shelter-supplies` | Solo | 1705 | 1705 | 44 | 4 | 9.1% | participant-or-item-infeasible (1386) |
| `night-cooking-provisions` | Solo | 1705 | 1705 | 37 | 1 | 2.7% | participant-or-item-infeasible (1398) |
| `firebomb-attack` | Pair | 1705 | 1705 | 20 | 1 | 5.0% | participant-or-item-infeasible (1417) |
| `night-accidental-overloaded-shelter` | Pair | 1705 | 1705 | 20 | 0 | 0.0% | participant-or-item-infeasible (1502) |
| `night-fatal-fake-emergency-bow` | Pair | 1705 | 1705 | 18 | 0 | 0.0% | participant-or-item-infeasible (1506) |
| `night-discussing-survivors` | Pair | 1705 | 1508 | 15 | 0 | 0.0% | participant-or-item-infeasible (1195) |
| `night-holding-hands` | Pair | 1705 | 1705 | 15 | 0 | 0.0% | participant-or-item-infeasible (1358) |
| `night-sleeping-shifts-two` | Pair | 1705 | 1705 | 15 | 0 | 0.0% | participant-or-item-infeasible (1358) |
| `night-telling-stories` | Pair | 1705 | 1705 | 15 | 0 | 0.0% | participant-or-item-infeasible (1358) |
| `romantic-partner-protection` | Pair | 1705 | 26 | 15 | 0 | 0.0% | definition-ineligible (1679) |
| `poison-vial-attack` | Pair | 1705 | 1705 | 13 | 1 | 7.7% | participant-or-item-infeasible (1427) |
| `blowgun-poison-attack` | Pair | 1705 | 1705 | 12 | 0 | 0.0% | participant-or-item-infeasible (1427) |
| `night-fatal-firelight-ambush` | Pair | 1705 | 1705 | 11 | 0 | 0.0% | participant-or-item-infeasible (1513) |
| `bear-trap-attack` | Pair | 1705 | 1705 | 9 | 0 | 0.0% | participant-or-item-infeasible (1432) |
| `night-fatal-sleeping-bag-canoe` | Pair | 1705 | 1705 | 6 | 0 | 0.0% | participant-or-item-infeasible (1518) |
| `keep-watch-truce-2` | Pair | 1705 | 3 | 3 | 0 | 0.0% | definition-ineligible (1702) |
| `night-accidental-smoke-filled-shelter` | Solo | 1705 | 1705 | 3 | 0 | 0.0% | participant-or-item-infeasible (1522) |
| `night-truce` | Pair | 1705 | 3 | 3 | 0 | 0.0% | definition-ineligible (1702) |
| `unexpected-pep-talk` | Solo | 1705 | 1705 | 2 | 0 | 0.0% | participant-or-item-infeasible (1403) |
| `amicable-truce-separation-2` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `amicable-truce-separation-3` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `amicable-truce-separation-4` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `amicable-truce-separation-5` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `amicable-truce-separation-6` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `arena-goose` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `axe-attack` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `axe-based-shelter-renovation` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `bird-whistle-nest-search` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `brushfire-supply-run` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `contaminated-water` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-accidental-self-injury` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-attacking-someone-who-escapes` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-build-bow` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-camouflaging-in-bushes` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-carve-wooden-club` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-chasing-another-tribute` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-collecting-fruit` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-creating-diversion-and-escaping` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-defeating-but-sparing` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-discovering-cave-failure` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-discovering-cave-shelter` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-discovering-river` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-exploring-arena` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-fishing` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-hallucinate-a-tribute` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-hunting-for-food` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-ignoring-distant-smoke` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-make-knife` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-make-stone-hand-axe` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-overhearing-conversation` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-picking-flowers` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-poison-a-tribute` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-practising-weaponry` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-pricked-by-thorns` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-questioning-sanity` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-raiding-unattended-camp` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-reaching-higher-ground` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-scaring-off-another-tribute` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-searching-for-firewood` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-searching-for-water` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-sleeping-through-day` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-sneaking-a-nap` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-spearfishing` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-splitting-up-to-search` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-stalking-another-tribute` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-theft-while-distracted` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-thinking-about-home` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `day-working-together` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `fishing-gear-catch` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `forages-for-resources` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `greatsword-charge` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `identifies-wild-berries` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `identifies-wild-mushrooms` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `keep-watch-truce-3` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `keep-watch-truce-4` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `keep-watch-truce-5` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `keep-watch-truce-6` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `longbow-shot` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `night-accidental-burning-blanket-panic` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1526) |
| `night-accidental-falling-tree-firewood` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1524) |
| `night-accidental-kicked-burning-log` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1463) |
| `night-accidental-overengineered-alarm` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1463) |
| `night-accidental-pushed-while-dreaming` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1463) |
| `night-accidental-returning-watchkeeper` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1522) |
| `night-defending-fire` | Four-plus | 1705 | 15 | 0 | 0 | 0.0% | definition-ineligible (1690) |
| `night-discussing-morning` | Trio | 1705 | 1508 | 0 | 0 | 0.0% | participant-or-item-infeasible (1217) |
| `night-fatal-betrayal-on-watch` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1522) |
| `night-fatal-poisoned-shared-meal` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1526) |
| `night-fatal-rolled-into-fire` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1463) |
| `night-fatal-sent-to-check-noise` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1522) |
| `night-fatal-smothered-beneath-blanket` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1526) |
| `night-fatal-snoring-problem` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1463) |
| `night-ghost-stories` | Four-plus | 1705 | 1338 | 0 | 0 | 0.0% | participant-or-item-infeasible (920) |
| `night-sharing-shelter` | Pair | 1705 | 3 | 0 | 0 | 0.0% | definition-ineligible (1702) |
| `night-singing-together` | Trio | 1705 | 1508 | 0 | 0 | 0.0% | participant-or-item-infeasible (1217) |
| `night-sleeping-shifts-four` | Four-plus | 1705 | 1338 | 0 | 0 | 0.0% | participant-or-item-infeasible (920) |
| `night-sleeping-shifts-three` | Trio | 1705 | 1508 | 0 | 0 | 0.0% | participant-or-item-infeasible (1217) |
| `night-snuggling` | Pair | 1705 | 48 | 0 | 0 | 0.0% | definition-ineligible (1657) |
| `pike-charge` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `poisonous-berries-joint-victory` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `protects-truce-partner` | Pair | 1705 | 63 | 0 | 0 | 0.0% | definition-ineligible (1642) |
| `raids-nest-for-eggs` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `river-current` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `romantic-truce-formation` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `rough-terrain` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `shield-used-for-everything-else` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `slingshot-chicken-hunt` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `slingshot-trick-shot` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `spear-attack` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `steals-drink-at-water-source` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `steals-fresh-meal` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `trap-kit-rabbit-hunt` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `travel-together-truce-2` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `travel-together-truce-3` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `travel-together-truce-4` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `travel-together-truce-5` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `travel-together-truce-6` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `tripwire-attack` | Pair | 1705 | 1705 | 0 | 0 | 0.0% | participant-or-item-infeasible (1442) |
| `truce-betrayal-2` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `truce-betrayal-3` | Trio | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `truce-betrayal-4` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `truce-betrayal-5` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `truce-betrayal-6` | Four-plus | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `upside-down-map` | Solo | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |
| `warhammer-attack` | Pair | 1705 | 0 | 0 | 0 | 0.0% | definition-ineligible (1705) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| night | 547 | 193 | 96.5% | 30.6% |
| environmental | 350 | 191 | 95.5% | 19.6% |
| survival | 220 | 145 | 72.5% | 12.3% |
| cornucopia-provisions | 183 | 136 | 68.0% | 10.2% |
| night-fatal | 143 | 108 | 54.0% | 8.0% |
| night-accidental-fatal | 130 | 106 | 53.0% | 7.3% |
| standard-dissolution | 78 | 68 | 34.0% | 4.4% |
| theft | 56 | 56 | 28.0% | 3.1% |
| combat | 46 | 42 | 21.0% | 2.6% |
| deprivation | 24 | 23 | 11.5% | 1.3% |
| romantic | 6 | 6 | 3.0% | 0.3% |
| Uncatalogued | 5 | 5 | 2.5% | 0.3% |
| tactical | 2 | 2 | 1.0% | 0.1% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `freezing-night` | environmental | 141 | 140 | 70.0% | 7.9% | 0.70 | 141 | 141 | 141 | 0 | 0 | 0 |
| `uses-cornucopia-provisions-water` | cornucopia-provisions | 94 | 93 | 46.5% | 5.3% | 0.47 | 0 | 0 | 94 | 0 | 0 | 0 |
| `uses-cornucopia-provisions-food` | cornucopia-provisions | 89 | 89 | 44.5% | 5.0% | 0.45 | 0 | 0 | 89 | 0 | 0 | 0 |
| `cold-rain` | environmental | 88 | 88 | 44.0% | 4.9% | 0.44 | 0 | 0 | 88 | 0 | 0 | 0 |
| `finds-hiding-place` | survival | 82 | 82 | 41.0% | 4.6% | 0.41 | 0 | 0 | 82 | 0 | 0 | 0 |
| `amicable-truce-separation-2` | standard-dissolution | 62 | 54 | 27.0% | 3.5% | 0.31 | 0 | 0 | 0 | 62 | 0 | 0 |
| `cave-shelter-collapse` | survival | 61 | 60 | 30.0% | 3.4% | 0.30 | 5 | 5 | 61 | 0 | 0 | 0 |
| `fallen-cliff` | environmental | 61 | 60 | 30.0% | 3.4% | 0.30 | 61 | 61 | 61 | 0 | 0 | 0 |
| `deep-cut` | environmental | 60 | 60 | 30.0% | 3.4% | 0.30 | 0 | 0 | 60 | 0 | 0 | 0 |
| `steal-from-stronger-tribute` | theft | 56 | 56 | 28.0% | 3.1% | 0.28 | 8 | 8 | 0 | 56 | 0 | 0 |
| `night-setting-up-camp` | night | 55 | 55 | 27.5% | 3.1% | 0.28 | 0 | 0 | 55 | 0 | 0 | 0 |
| `finds-dry-rock-overhang` | survival | 49 | 49 | 24.5% | 2.7% | 0.24 | 0 | 0 | 49 | 0 | 0 | 0 |
| `night-starting-fire` | night | 46 | 46 | 23.0% | 2.6% | 0.23 | 0 | 0 | 46 | 0 | 0 | 0 |
| `night-sleeping-in-tree` | night | 40 | 40 | 20.0% | 2.2% | 0.20 | 0 | 0 | 40 | 0 | 0 | 0 |
| `night-fatal-cry-from-ravine` | night-fatal | 37 | 37 | 18.5% | 2.1% | 0.18 | 37 | 37 | 0 | 37 | 0 | 0 |
| `night-fatal-drowned-at-river` | night-fatal | 35 | 35 | 17.5% | 2.0% | 0.17 | 35 | 35 | 0 | 35 | 0 | 0 |
| `night-natural-wound-treatment` | night | 33 | 33 | 16.5% | 1.8% | 0.17 | 0 | 0 | 33 | 0 | 0 | 0 |
| `night-simply-sleeping` | night | 33 | 33 | 16.5% | 1.8% | 0.17 | 0 | 0 | 33 | 0 | 0 | 0 |
| `night-passing-out-exhausted` | night | 32 | 32 | 16.0% | 1.8% | 0.16 | 0 | 0 | 32 | 0 | 0 | 0 |
| `night-sleeping-without-fire` | night | 30 | 30 | 15.0% | 1.7% | 0.15 | 0 | 0 | 30 | 0 | 0 | 0 |
| `night-accidental-fatal-tree-fall` | night-accidental-fatal | 29 | 29 | 14.5% | 1.6% | 0.14 | 29 | 29 | 29 | 0 | 0 | 0 |
| `night-comfortable-bush` | night | 28 | 28 | 14.0% | 1.6% | 0.14 | 0 | 0 | 28 | 0 | 0 | 0 |
| `night-nightmares` | night | 28 | 28 | 14.0% | 1.6% | 0.14 | 0 | 0 | 28 | 0 | 0 | 0 |
| `night-thinking-about-victory` | night | 28 | 28 | 14.0% | 1.6% | 0.14 | 0 | 0 | 28 | 0 | 0 | 0 |
| `night-accidental-startled-over-edge` | night-accidental-fatal | 27 | 27 | 13.5% | 1.5% | 0.14 | 27 | 27 | 0 | 27 | 0 | 0 |
| `night-huddling-for-warmth` | night | 27 | 27 | 13.5% | 1.5% | 0.14 | 0 | 0 | 0 | 27 | 0 | 0 |
| `night-fatal-collapsing-cave-entrance` | night-fatal | 26 | 26 | 13.0% | 1.5% | 0.13 | 26 | 26 | 0 | 26 | 0 | 0 |
| `night-becoming-lost` | night | 25 | 25 | 12.5% | 1.4% | 0.13 | 0 | 0 | 25 | 0 | 0 | 0 |
| `cannot-find-shelter` | survival | 24 | 24 | 12.0% | 1.3% | 0.12 | 0 | 0 | 24 | 0 | 0 | 0 |
| `night-sparing-opponent` | night | 24 | 24 | 12.0% | 1.3% | 0.12 | 0 | 0 | 0 | 24 | 0 | 0 |
| `night-singing-to-sleep` | night | 23 | 23 | 11.5% | 1.3% | 0.12 | 0 | 0 | 23 | 0 | 0 | 0 |
| `night-fatal-rock-from-darkness` | night-fatal | 22 | 22 | 11.0% | 1.2% | 0.11 | 22 | 22 | 0 | 22 | 0 | 0 |
| `night-staying-awake` | night | 22 | 22 | 11.0% | 1.2% | 0.11 | 0 | 0 | 22 | 0 | 0 | 0 |
| `night-accidental-rock-thrown-at-noise` | night-accidental-fatal | 21 | 21 | 10.5% | 1.2% | 0.10 | 21 | 21 | 0 | 21 | 0 | 0 |
| `night-accidental-wrong-tree` | night-accidental-fatal | 21 | 21 | 10.5% | 1.2% | 0.10 | 21 | 21 | 21 | 0 | 0 | 0 |
| `night-seeing-distant-fire` | night | 21 | 21 | 10.5% | 1.2% | 0.10 | 0 | 0 | 21 | 0 | 0 | 0 |
| `knife-ambush` | combat | 18 | 18 | 9.0% | 1.0% | 0.09 | 16 | 16 | 0 | 18 | 0 | 0 |
| `amicable-truce-separation-3` | standard-dissolution | 16 | 16 | 8.0% | 0.9% | 0.08 | 0 | 0 | 0 | 0 | 16 | 0 |
| `night-looking-at-sky` | night | 14 | 14 | 7.0% | 0.8% | 0.07 | 0 | 0 | 14 | 0 | 0 | 0 |
| `night-accidental-sleepwalking-into-river` | night-accidental-fatal | 13 | 13 | 6.5% | 0.7% | 0.07 | 13 | 13 | 13 | 0 | 0 | 0 |
| `night-fatal-cut-loose-from-tree` | night-fatal | 13 | 12 | 6.0% | 0.7% | 0.07 | 13 | 13 | 0 | 13 | 0 | 0 |
| `night-quiet-humming` | night | 13 | 13 | 6.5% | 0.7% | 0.07 | 0 | 0 | 13 | 0 | 0 | 0 |
| `night-screaming-for-help` | night | 13 | 13 | 6.5% | 0.7% | 0.07 | 0 | 0 | 13 | 0 | 0 | 0 |
| `becomes-hungry` | deprivation | 12 | 12 | 6.0% | 0.7% | 0.06 | 0 | 0 | 12 | 0 | 0 | 0 |
| `becomes-thirsty` | deprivation | 12 | 12 | 6.0% | 0.7% | 0.06 | 0 | 0 | 12 | 0 | 0 | 0 |
| `night-accidental-mistaken-for-dinner` | night-accidental-fatal | 12 | 12 | 6.0% | 0.7% | 0.06 | 12 | 12 | 0 | 12 | 0 | 0 |
| `night-crying-to-sleep` | night | 11 | 11 | 5.5% | 0.6% | 0.06 | 0 | 0 | 11 | 0 | 0 | 0 |
| `night-accidental-both-swing-at-once` | night-accidental-fatal | 7 | 7 | 3.5% | 0.4% | 0.04 | 7 | 7 | 0 | 7 | 0 | 0 |
| `longsword-attack` | combat | 6 | 6 | 3.0% | 0.3% | 0.03 | 6 | 6 | 0 | 6 | 0 | 0 |
| `night-fatal-chopped-from-tree` | night-fatal | 5 | 5 | 2.5% | 0.3% | 0.03 | 2 | 2 | 0 | 5 | 0 | 0 |
| `night-fatal-fake-emergency` | night-fatal | 5 | 5 | 2.5% | 0.3% | 0.03 | 5 | 5 | 0 | 5 | 0 | 0 |
| `night-prepared-cave-shelter` | Uncatalogued | 5 | 5 | 2.5% | 0.3% | 0.03 | 0 | 0 | 5 | 0 | 0 | 0 |
| `bow-shot` | combat | 4 | 4 | 2.0% | 0.2% | 0.02 | 4 | 4 | 0 | 4 | 0 | 0 |
| `club-attack` | combat | 4 | 4 | 2.0% | 0.2% | 0.02 | 3 | 3 | 0 | 4 | 0 | 0 |
| `rapier-lunge` | combat | 4 | 4 | 2.0% | 0.2% | 0.02 | 4 | 4 | 0 | 4 | 0 | 0 |
| `romantic-night-truce-formation` | romantic | 4 | 4 | 2.0% | 0.2% | 0.02 | 0 | 0 | 0 | 4 | 0 | 0 |
| `uses-shelter-supplies` | survival | 4 | 4 | 2.0% | 0.2% | 0.02 | 0 | 0 | 4 | 0 | 0 | 0 |
| `crossbow-attack` | combat | 3 | 3 | 1.5% | 0.2% | 0.01 | 2 | 2 | 0 | 3 | 0 | 0 |
| `trident-attack` | combat | 3 | 3 | 1.5% | 0.2% | 0.01 | 3 | 3 | 0 | 3 | 0 | 0 |
| `hand-axe-attack` | combat | 2 | 2 | 1.0% | 0.1% | 0.01 | 2 | 2 | 0 | 2 | 0 | 0 |
| `poisonous-berries-joint-victory` | romantic | 2 | 2 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 2 | 0 | 0 |
| `short-sword-duel` | combat | 2 | 2 | 1.0% | 0.1% | 0.01 | 2 | 2 | 0 | 2 | 0 | 0 |
| `firebomb-attack` | tactical | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `night-cooking-provisions` | night | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 1 | 0 | 0 | 0 |
| `poison-vial-attack` | tactical | 1 | 1 | 0.5% | 0.1% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- `freezing-night`

Appearing in at least 25% of games:

- `amicable-truce-separation-2`
- `cave-shelter-collapse`
- `cold-rain`
- `deep-cut`
- `fallen-cliff`
- `finds-hiding-place`
- `freezing-night`
- `night-setting-up-camp`
- `steal-from-stronger-tribute`
- `uses-cornucopia-provisions-food`
- `uses-cornucopia-provisions-water`

#### Never selected

- `amicable-truce-separation-4`
- `amicable-truce-separation-5`
- `amicable-truce-separation-6`
- `bear-trap-attack`
- `blowgun-poison-attack`
- `keep-watch-truce-2`
- `keep-watch-truce-3`
- `keep-watch-truce-4`
- `keep-watch-truce-5`
- `keep-watch-truce-6`
- `night-accidental-burning-blanket-panic`
- `night-accidental-falling-tree-firewood`
- `night-accidental-kicked-burning-log`
- `night-accidental-overengineered-alarm`
- `night-accidental-overloaded-shelter`
- `night-accidental-pushed-while-dreaming`
- `night-accidental-returning-watchkeeper`
- `night-accidental-smoke-filled-shelter`
- `night-defending-fire`
- `night-discussing-morning`
- `night-discussing-survivors`
- `night-fatal-betrayal-on-watch`
- `night-fatal-fake-emergency-bow`
- `night-fatal-firelight-ambush`
- `night-fatal-poisoned-shared-meal`
- `night-fatal-rolled-into-fire`
- `night-fatal-sent-to-check-noise`
- `night-fatal-sleeping-bag-canoe`
- `night-fatal-smothered-beneath-blanket`
- `night-fatal-snoring-problem`
- `night-ghost-stories`
- `night-holding-hands`
- `night-sharing-shelter`
- `night-singing-together`
- `night-sleeping-shifts-four`
- `night-sleeping-shifts-three`
- `night-sleeping-shifts-two`
- `night-snuggling`
- `night-telling-stories`
- `night-truce`
- `protects-truce-partner`
- `romantic-partner-protection`
- `tripwire-attack`
- `truce-betrayal-2`
- `truce-betrayal-3`
- `truce-betrayal-4`
- `truce-betrayal-5`
- `truce-betrayal-6`
- `unexpected-pep-talk`

## Full Game

Games: 100

### Bloodbath — Cornucopia

- Total selections: 1072
- Average selections per game: 10.72
- Non-solo share: 86.3%
- Consecutive-game overlap: average 3.28, median 3.00, P90 5.00, maximum 8.00 across 99 comparisons
- Top five event share: 21.3%
- Top ten event share: 40.9%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 147 | 13.7% |
| Pair | 674 | 62.9% |
| Trio | 224 | 20.9% |
| Four-plus | 27 | 2.5% |

#### Selection diagnostics

- Games captured: 100
- Selection opportunities: 1119
- Solo selected while a non-solo candidate was feasible: 30
- Opportunities with no feasible non-solo candidate: 164
- Opportunities with no feasible candidate: 47

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 1293 | 147 |
| Pair | 13671 | 674 |
| Trio | 3601 | 224 |
| Four-plus | 507 | 27 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| cornucopia-fatal | 810 | 30 | 115 |
| cornucopia-post-target | 77 | 0 | 49 |
| cornucopia-repeat-fatal | 232 | 0 | 0 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `cornucopia-fatal-silent-neck-break` | Pair | 997 | 963 | 740 | 36 | 4.9% | weighted-not-selected (704) |
| `cornucopia-fatal-head-against-rock` | Pair | 995 | 961 | 737 | 41 | 5.6% | weighted-not-selected (696) |
| `cornucopia-fatal-thrown-knife-head` | Pair | 989 | 955 | 733 | 46 | 6.3% | weighted-not-selected (687) |
| `cornucopia-fatal-improvised-branch-stabbing` | Pair | 982 | 951 | 724 | 45 | 6.2% | weighted-not-selected (679) |
| `cornucopia-fatal-fistfight-strangulation` | Pair | 982 | 950 | 723 | 43 | 5.9% | weighted-not-selected (680) |
| `cornucopia-fatal-killed-while-fleeing` | Pair | 982 | 949 | 720 | 43 | 6.0% | weighted-not-selected (677) |
| `cornucopia-fatal-cherry-bomb-attack` | Pair | 977 | 947 | 713 | 50 | 7.0% | weighted-not-selected (663) |
| `cornucopia-fatal-thrown-knife-chest` | Pair | 979 | 945 | 703 | 44 | 6.3% | weighted-not-selected (659) |
| `cornucopia-fatal-discovering-hidden-tribute` | Pair | 987 | 956 | 700 | 40 | 5.7% | weighted-not-selected (660) |
| `cornucopia-fatal-mercy-killing` | Pair | 810 | 776 | 549 | 17 | 3.1% | weighted-not-selected (532) |
| `cornucopia-fatal-cliffside-knife-fight` | Pair | 811 | 783 | 548 | 18 | 3.3% | weighted-not-selected (530) |
| `cornucopia-fatal-arrow-through-head` | Pair | 811 | 781 | 547 | 20 | 3.7% | weighted-not-selected (527) |
| `cornucopia-fatal-own-weapon-reversal` | Pair | 811 | 781 | 531 | 21 | 4.0% | weighted-not-selected (510) |
| `cornucopia-fatal-bag-strap-strangulation` | Pair | 811 | 779 | 525 | 22 | 4.2% | weighted-not-selected (503) |
| `cornucopia-fatal-stabbed-while-distracted` | Pair | 811 | 784 | 524 | 32 | 6.1% | weighted-not-selected (492) |
| `cornucopia-fatal-sword-decapitation` | Pair | 814 | 784 | 522 | 27 | 5.2% | weighted-not-selected (495) |
| `cornucopia-fatal-killing-for-supplies` | Pair | 812 | 782 | 508 | 23 | 4.5% | weighted-not-selected (485) |
| `cornucopia-fatal-sword-body-strike` | Pair | 813 | 785 | 502 | 35 | 7.0% | weighted-not-selected (467) |
| `cornucopia-fatal-protective-spear-intervention` | Trio | 810 | 746 | 497 | 8 | 1.6% | weighted-not-selected (489) |
| `cornucopia-fatal-spear-abdomen` | Pair | 811 | 786 | 493 | 31 | 6.3% | weighted-not-selected (462) |
| `cornucopia-fatal-two-against-two` | Four-plus | 810 | 735 | 486 | 26 | 5.3% | weighted-not-selected (460) |
| `cornucopia-fatal-protective-cherry-bomb-intervention` | Trio | 810 | 747 | 486 | 10 | 2.1% | weighted-not-selected (476) |
| `cornucopia-fatal-team-drowning` | Trio | 810 | 752 | 472 | 19 | 4.0% | weighted-not-selected (453) |
| `cornucopia-fatal-poisoned-blow-dart` | Pair | 810 | 772 | 458 | 1 | 0.2% | weighted-not-selected (457) |
| `cornucopia-fatal-left-bleeding` | Pair | 810 | 772 | 458 | 0 | 0.0% | weighted-not-selected (458) |
| `cornucopia-pack-ambush` | Pair | 810 | 774 | 444 | 5 | 1.1% | weighted-not-selected (439) |
| `cornucopia-contested-weapon` | Pair | 810 | 773 | 430 | 10 | 2.3% | weighted-not-selected (420) |
| `cornucopia-fatal-accidental-arrow` | Trio | 810 | 743 | 415 | 7 | 1.7% | weighted-not-selected (408) |
| `cornucopia-fatal-three-way-fight` | Trio | 811 | 460 | 339 | 43 | 12.7% | definition-ineligible (351) |
| `cornucopia-fatal-weapon-rack-chain-reaction` | Trio | 811 | 407 | 306 | 39 | 12.7% | definition-ineligible (404) |
| `cornucopia-fatal-double-cherry-bomb` | Trio | 811 | 400 | 269 | 43 | 16.0% | definition-ineligible (411) |
| `cornucopia-entrance-collision` | Trio | 810 | 742 | 266 | 4 | 1.5% | weighted-not-selected (262) |
| `cornucopia-three-way-weapon-melee` | Trio | 810 | 742 | 257 | 9 | 3.5% | weighted-not-selected (248) |
| `cornucopia-fatal-supply-net-counterweight` | Trio | 811 | 344 | 252 | 39 | 15.5% | definition-ineligible (467) |
| `cornucopia-fatal-armful-of-knives` | Solo | 810 | 185 | 154 | 22 | 14.3% | definition-ineligible (625) |
| `cornucopia-fatal-shield-sled` | Solo | 810 | 149 | 133 | 18 | 13.5% | definition-ineligible (661) |
| `cornucopia-fatal-crate-avalanche` | Solo | 810 | 112 | 100 | 13 | 13.0% | definition-ineligible (698) |
| `cornucopia-fatal-loaded-crossbow-inspection` | Solo | 810 | 111 | 95 | 10 | 10.5% | definition-ineligible (699) |
| `cornucopia-fatal-spiked-pit` | Solo | 810 | 96 | 83 | 11 | 13.3% | definition-ineligible (714) |
| `cornucopia-edge-weapon` | Solo | 77 | 77 | 77 | 16 | 20.8% | weighted-not-selected (61) |
| `cornucopia-heavy-weapon` | Solo | 77 | 77 | 77 | 7 | 9.1% | weighted-not-selected (70) |
| `cornucopia-flavour-bow` | Solo | 77 | 77 | 77 | 5 | 6.5% | weighted-not-selected (72) |
| `cornucopia-flavour-sword` | Solo | 77 | 77 | 67 | 6 | 9.0% | weighted-not-selected (61) |
| `cornucopia-flavour-spear` | Solo | 77 | 77 | 67 | 3 | 4.5% | weighted-not-selected (64) |
| `cornucopia-flavour-trident` | Solo | 77 | 77 | 67 | 2 | 3.0% | weighted-not-selected (65) |
| `cornucopia-fatal-backpack-weapon-rack-snare` | Solo | 810 | 85 | 59 | 11 | 18.6% | definition-ineligible (725) |
| `cornucopia-tactical-cache` | Solo | 77 | 77 | 57 | 8 | 14.0% | weighted-not-selected (49) |
| `cornucopia-flavour-firebomb` | Solo | 77 | 77 | 57 | 2 | 3.5% | weighted-not-selected (55) |
| `cornucopia-fatal-cast-iron-cookware` | Solo | 810 | 72 | 55 | 7 | 12.7% | definition-ineligible (738) |
| `cornucopia-fatal-podium-detonation-bits` | Solo | 810 | 39 | 38 | 3 | 7.9% | definition-ineligible (771) |
| `cornucopia-fatal-podium-detonation-balloon` | Solo | 810 | 33 | 30 | 3 | 10.0% | definition-ineligible (777) |
| `cornucopia-nonfatal-weapon-tug-of-war` | Pair | 77 | 28 | 28 | 8 | 28.6% | definition-ineligible (49) |
| `cornucopia-nonfatal-breadstick-contest` | Pair | 77 | 29 | 28 | 4 | 14.3% | definition-ineligible (48) |
| `cornucopia-nonfatal-supply-bag-contest` | Pair | 77 | 28 | 28 | 3 | 10.7% | definition-ineligible (49) |
| `cornucopia-nonfatal-split-fishing-supplies` | Pair | 77 | 28 | 28 | 2 | 7.1% | definition-ineligible (49) |
| `cornucopia-nonfatal-scare-away` | Pair | 77 | 28 | 27 | 7 | 25.9% | definition-ineligible (49) |
| `cornucopia-nonfatal-three-person-supply-team` | Trio | 77 | 6 | 6 | 1 | 16.7% | definition-ineligible (71) |
| `cornucopia-nonfatal-trio-crate-battering-ram` | Trio | 77 | 7 | 6 | 1 | 16.7% | definition-ineligible (70) |
| `cornucopia-nonfatal-trio-supply-net-pinata` | Trio | 77 | 6 | 6 | 1 | 16.7% | definition-ineligible (71) |
| `cornucopia-nonfatal-trio-backpack-tear` | Trio | 77 | 6 | 6 | 0 | 0.0% | definition-ineligible (71) |
| `cornucopia-nonfatal-trio-canned-peaches-ceasefire` | Trio | 77 | 6 | 6 | 0 | 0.0% | definition-ineligible (71) |
| `cornucopia-nonfatal-trio-distraction-circle` | Trio | 77 | 6 | 6 | 0 | 0.0% | definition-ineligible (71) |
| `cornucopia-nonfatal-trio-weapon-rack-domino` | Trio | 77 | 6 | 6 | 0 | 0.0% | definition-ineligible (71) |
| `cornucopia-nonfatal-quartet-tarp-sail` | Four-plus | 77 | 3 | 3 | 1 | 33.3% | definition-ineligible (74) |
| `cornucopia-nonfatal-four-person-shared-haul` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |
| `cornucopia-nonfatal-quartet-alliance-name` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |
| `cornucopia-nonfatal-quartet-backpack-musical-chairs` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |
| `cornucopia-nonfatal-quartet-circular-theft` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |
| `cornucopia-nonfatal-quartet-crate-pyramid` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |
| `cornucopia-nonfatal-quartet-moving-barricade` | Four-plus | 77 | 3 | 3 | 0 | 0.0% | definition-ineligible (74) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| Bloodbath — cornucopia-fatal-authored | 967 | 100 | 100.0% | 90.2% |
| Bloodbath — cornucopia-acquisition | 31 | 31 | 31.0% | 2.9% |
| Bloodbath — cornucopia-nonfatal-interaction | 28 | 27 | 27.0% | 2.6% |
| Bloodbath — cornucopia-flavour-acquisition | 18 | 18 | 18.0% | 1.7% |
| Bloodbath — cornucopia-pair-conflict | 15 | 15 | 15.0% | 1.4% |
| Bloodbath — cornucopia-group-conflict | 13 | 13 | 13.0% | 1.2% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `cornucopia-fatal-cherry-bomb-attack` | Bloodbath — cornucopia-fatal-authored | 50 | 50 | 50.0% | 4.7% | 0.50 | 50 | 50 | 0 | 50 | 0 | 0 |
| `cornucopia-fatal-thrown-knife-head` | Bloodbath — cornucopia-fatal-authored | 46 | 46 | 46.0% | 4.3% | 0.46 | 46 | 46 | 0 | 46 | 0 | 0 |
| `cornucopia-fatal-improvised-branch-stabbing` | Bloodbath — cornucopia-fatal-authored | 45 | 45 | 45.0% | 4.2% | 0.45 | 45 | 45 | 0 | 45 | 0 | 0 |
| `cornucopia-fatal-thrown-knife-chest` | Bloodbath — cornucopia-fatal-authored | 44 | 44 | 44.0% | 4.1% | 0.44 | 44 | 44 | 0 | 44 | 0 | 0 |
| `cornucopia-fatal-double-cherry-bomb` | Bloodbath — cornucopia-fatal-authored | 43 | 43 | 43.0% | 4.0% | 0.43 | 43 | 86 | 0 | 0 | 43 | 0 |
| `cornucopia-fatal-fistfight-strangulation` | Bloodbath — cornucopia-fatal-authored | 43 | 43 | 43.0% | 4.0% | 0.43 | 43 | 43 | 0 | 43 | 0 | 0 |
| `cornucopia-fatal-killed-while-fleeing` | Bloodbath — cornucopia-fatal-authored | 43 | 43 | 43.0% | 4.0% | 0.43 | 43 | 43 | 0 | 43 | 0 | 0 |
| `cornucopia-fatal-three-way-fight` | Bloodbath — cornucopia-fatal-authored | 43 | 43 | 43.0% | 4.0% | 0.43 | 43 | 86 | 0 | 0 | 43 | 0 |
| `cornucopia-fatal-head-against-rock` | Bloodbath — cornucopia-fatal-authored | 41 | 41 | 41.0% | 3.8% | 0.41 | 41 | 41 | 0 | 41 | 0 | 0 |
| `cornucopia-fatal-discovering-hidden-tribute` | Bloodbath — cornucopia-fatal-authored | 40 | 40 | 40.0% | 3.7% | 0.40 | 40 | 40 | 0 | 40 | 0 | 0 |
| `cornucopia-fatal-supply-net-counterweight` | Bloodbath — cornucopia-fatal-authored | 39 | 39 | 39.0% | 3.6% | 0.39 | 39 | 78 | 0 | 0 | 39 | 0 |
| `cornucopia-fatal-weapon-rack-chain-reaction` | Bloodbath — cornucopia-fatal-authored | 39 | 39 | 39.0% | 3.6% | 0.39 | 39 | 78 | 0 | 0 | 39 | 0 |
| `cornucopia-fatal-silent-neck-break` | Bloodbath — cornucopia-fatal-authored | 36 | 36 | 36.0% | 3.4% | 0.36 | 36 | 36 | 0 | 36 | 0 | 0 |
| `cornucopia-fatal-sword-body-strike` | Bloodbath — cornucopia-fatal-authored | 35 | 35 | 35.0% | 3.3% | 0.35 | 35 | 35 | 0 | 35 | 0 | 0 |
| `cornucopia-fatal-stabbed-while-distracted` | Bloodbath — cornucopia-fatal-authored | 32 | 32 | 32.0% | 3.0% | 0.32 | 32 | 32 | 0 | 32 | 0 | 0 |
| `cornucopia-fatal-spear-abdomen` | Bloodbath — cornucopia-fatal-authored | 31 | 31 | 31.0% | 2.9% | 0.31 | 31 | 31 | 0 | 31 | 0 | 0 |
| `cornucopia-fatal-sword-decapitation` | Bloodbath — cornucopia-fatal-authored | 27 | 27 | 27.0% | 2.5% | 0.27 | 27 | 27 | 0 | 27 | 0 | 0 |
| `cornucopia-fatal-two-against-two` | Bloodbath — cornucopia-fatal-authored | 26 | 26 | 26.0% | 2.4% | 0.26 | 26 | 52 | 0 | 0 | 0 | 26 |
| `cornucopia-fatal-killing-for-supplies` | Bloodbath — cornucopia-fatal-authored | 23 | 23 | 23.0% | 2.1% | 0.23 | 23 | 23 | 0 | 23 | 0 | 0 |
| `cornucopia-fatal-armful-of-knives` | Bloodbath — cornucopia-fatal-authored | 22 | 22 | 22.0% | 2.1% | 0.22 | 22 | 22 | 22 | 0 | 0 | 0 |
| `cornucopia-fatal-bag-strap-strangulation` | Bloodbath — cornucopia-fatal-authored | 22 | 22 | 22.0% | 2.1% | 0.22 | 22 | 22 | 0 | 22 | 0 | 0 |
| `cornucopia-fatal-own-weapon-reversal` | Bloodbath — cornucopia-fatal-authored | 21 | 21 | 21.0% | 2.0% | 0.21 | 21 | 21 | 0 | 21 | 0 | 0 |
| `cornucopia-fatal-arrow-through-head` | Bloodbath — cornucopia-fatal-authored | 20 | 20 | 20.0% | 1.9% | 0.20 | 20 | 20 | 0 | 20 | 0 | 0 |
| `cornucopia-fatal-team-drowning` | Bloodbath — cornucopia-fatal-authored | 19 | 19 | 19.0% | 1.8% | 0.19 | 19 | 19 | 0 | 0 | 19 | 0 |
| `cornucopia-fatal-cliffside-knife-fight` | Bloodbath — cornucopia-fatal-authored | 18 | 18 | 18.0% | 1.7% | 0.18 | 18 | 18 | 0 | 18 | 0 | 0 |
| `cornucopia-fatal-shield-sled` | Bloodbath — cornucopia-fatal-authored | 18 | 18 | 18.0% | 1.7% | 0.18 | 18 | 18 | 18 | 0 | 0 | 0 |
| `cornucopia-fatal-mercy-killing` | Bloodbath — cornucopia-fatal-authored | 17 | 17 | 17.0% | 1.6% | 0.17 | 17 | 17 | 0 | 17 | 0 | 0 |
| `cornucopia-edge-weapon` | Bloodbath — cornucopia-acquisition | 16 | 16 | 16.0% | 1.5% | 0.16 | 0 | 0 | 16 | 0 | 0 | 0 |
| `cornucopia-fatal-crate-avalanche` | Bloodbath — cornucopia-fatal-authored | 13 | 13 | 13.0% | 1.2% | 0.13 | 13 | 13 | 13 | 0 | 0 | 0 |
| `cornucopia-fatal-backpack-weapon-rack-snare` | Bloodbath — cornucopia-fatal-authored | 11 | 11 | 11.0% | 1.0% | 0.11 | 11 | 11 | 11 | 0 | 0 | 0 |
| `cornucopia-fatal-spiked-pit` | Bloodbath — cornucopia-fatal-authored | 11 | 11 | 11.0% | 1.0% | 0.11 | 11 | 11 | 11 | 0 | 0 | 0 |
| `cornucopia-contested-weapon` | Bloodbath — cornucopia-pair-conflict | 10 | 10 | 10.0% | 0.9% | 0.10 | 9 | 9 | 0 | 10 | 0 | 0 |
| `cornucopia-fatal-loaded-crossbow-inspection` | Bloodbath — cornucopia-fatal-authored | 10 | 10 | 10.0% | 0.9% | 0.10 | 10 | 10 | 10 | 0 | 0 | 0 |
| `cornucopia-fatal-protective-cherry-bomb-intervention` | Bloodbath — cornucopia-fatal-authored | 10 | 10 | 10.0% | 0.9% | 0.10 | 10 | 10 | 0 | 0 | 10 | 0 |
| `cornucopia-three-way-weapon-melee` | Bloodbath — cornucopia-group-conflict | 9 | 9 | 9.0% | 0.8% | 0.09 | 9 | 20 | 0 | 0 | 9 | 0 |
| `cornucopia-fatal-protective-spear-intervention` | Bloodbath — cornucopia-fatal-authored | 8 | 8 | 8.0% | 0.7% | 0.08 | 8 | 8 | 0 | 0 | 8 | 0 |
| `cornucopia-nonfatal-weapon-tug-of-war` | Bloodbath — cornucopia-nonfatal-interaction | 8 | 8 | 8.0% | 0.7% | 0.08 | 0 | 0 | 0 | 8 | 0 | 0 |
| `cornucopia-tactical-cache` | Bloodbath — cornucopia-acquisition | 8 | 8 | 8.0% | 0.7% | 0.08 | 0 | 0 | 8 | 0 | 0 | 0 |
| `cornucopia-fatal-accidental-arrow` | Bloodbath — cornucopia-fatal-authored | 7 | 7 | 7.0% | 0.7% | 0.07 | 6 | 7 | 0 | 0 | 7 | 0 |
| `cornucopia-fatal-cast-iron-cookware` | Bloodbath — cornucopia-fatal-authored | 7 | 7 | 7.0% | 0.7% | 0.07 | 7 | 7 | 7 | 0 | 0 | 0 |
| `cornucopia-heavy-weapon` | Bloodbath — cornucopia-acquisition | 7 | 7 | 7.0% | 0.7% | 0.07 | 0 | 0 | 7 | 0 | 0 | 0 |
| `cornucopia-nonfatal-scare-away` | Bloodbath — cornucopia-nonfatal-interaction | 7 | 7 | 7.0% | 0.7% | 0.07 | 0 | 0 | 0 | 7 | 0 | 0 |
| `cornucopia-flavour-sword` | Bloodbath — cornucopia-flavour-acquisition | 6 | 6 | 6.0% | 0.6% | 0.06 | 0 | 0 | 6 | 0 | 0 | 0 |
| `cornucopia-flavour-bow` | Bloodbath — cornucopia-flavour-acquisition | 5 | 5 | 5.0% | 0.5% | 0.05 | 0 | 0 | 5 | 0 | 0 | 0 |
| `cornucopia-pack-ambush` | Bloodbath — cornucopia-pair-conflict | 5 | 5 | 5.0% | 0.5% | 0.05 | 5 | 5 | 0 | 5 | 0 | 0 |
| `cornucopia-entrance-collision` | Bloodbath — cornucopia-group-conflict | 4 | 4 | 4.0% | 0.4% | 0.04 | 4 | 9 | 0 | 0 | 4 | 0 |
| `cornucopia-nonfatal-breadstick-contest` | Bloodbath — cornucopia-nonfatal-interaction | 4 | 4 | 4.0% | 0.4% | 0.04 | 0 | 0 | 0 | 4 | 0 | 0 |
| `cornucopia-fatal-podium-detonation-balloon` | Bloodbath — cornucopia-fatal-authored | 3 | 3 | 3.0% | 0.3% | 0.03 | 3 | 3 | 3 | 0 | 0 | 0 |
| `cornucopia-fatal-podium-detonation-bits` | Bloodbath — cornucopia-fatal-authored | 3 | 3 | 3.0% | 0.3% | 0.03 | 3 | 3 | 3 | 0 | 0 | 0 |
| `cornucopia-flavour-spear` | Bloodbath — cornucopia-flavour-acquisition | 3 | 3 | 3.0% | 0.3% | 0.03 | 0 | 0 | 3 | 0 | 0 | 0 |
| `cornucopia-nonfatal-supply-bag-contest` | Bloodbath — cornucopia-nonfatal-interaction | 3 | 3 | 3.0% | 0.3% | 0.03 | 0 | 0 | 0 | 3 | 0 | 0 |
| `cornucopia-flavour-firebomb` | Bloodbath — cornucopia-flavour-acquisition | 2 | 2 | 2.0% | 0.2% | 0.02 | 0 | 0 | 2 | 0 | 0 | 0 |
| `cornucopia-flavour-trident` | Bloodbath — cornucopia-flavour-acquisition | 2 | 2 | 2.0% | 0.2% | 0.02 | 0 | 0 | 2 | 0 | 0 | 0 |
| `cornucopia-nonfatal-split-fishing-supplies` | Bloodbath — cornucopia-nonfatal-interaction | 2 | 2 | 2.0% | 0.2% | 0.02 | 0 | 0 | 0 | 2 | 0 | 0 |
| `cornucopia-fatal-poisoned-blow-dart` | Bloodbath — cornucopia-fatal-authored | 1 | 1 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `cornucopia-nonfatal-quartet-tarp-sail` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 0 | 1 |
| `cornucopia-nonfatal-three-person-supply-team` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `cornucopia-nonfatal-trio-crate-battering-ram` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |
| `cornucopia-nonfatal-trio-supply-net-pinata` | Bloodbath — cornucopia-nonfatal-interaction | 1 | 1 | 1.0% | 0.1% | 0.01 | 0 | 0 | 0 | 0 | 1 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- `cornucopia-fatal-cherry-bomb-attack`

Appearing in at least 25% of games:

- `cornucopia-fatal-cherry-bomb-attack`
- `cornucopia-fatal-discovering-hidden-tribute`
- `cornucopia-fatal-double-cherry-bomb`
- `cornucopia-fatal-fistfight-strangulation`
- `cornucopia-fatal-head-against-rock`
- `cornucopia-fatal-improvised-branch-stabbing`
- `cornucopia-fatal-killed-while-fleeing`
- `cornucopia-fatal-silent-neck-break`
- `cornucopia-fatal-spear-abdomen`
- `cornucopia-fatal-stabbed-while-distracted`
- `cornucopia-fatal-supply-net-counterweight`
- `cornucopia-fatal-sword-body-strike`
- `cornucopia-fatal-sword-decapitation`
- `cornucopia-fatal-three-way-fight`
- `cornucopia-fatal-thrown-knife-chest`
- `cornucopia-fatal-thrown-knife-head`
- `cornucopia-fatal-two-against-two`
- `cornucopia-fatal-weapon-rack-chain-reaction`

#### Never selected

- `cornucopia-empty-fjallraven-pack`
- `cornucopia-fatal-left-bleeding`
- `cornucopia-flavour-camping-equipment`
- `cornucopia-flavour-med-kit`
- `cornucopia-flavour-shield`
- `cornucopia-gather-food`
- `cornucopia-hide-inside`
- `cornucopia-nearby-pack`
- `cornucopia-nonfatal-four-person-shared-haul`
- `cornucopia-nonfatal-quartet-alliance-name`
- `cornucopia-nonfatal-quartet-backpack-musical-chairs`
- `cornucopia-nonfatal-quartet-circular-theft`
- `cornucopia-nonfatal-quartet-crate-pyramid`
- `cornucopia-nonfatal-quartet-moving-barricade`
- `cornucopia-nonfatal-trio-backpack-tear`
- `cornucopia-nonfatal-trio-canned-peaches-ceasefire`
- `cornucopia-nonfatal-trio-distraction-circle`
- `cornucopia-nonfatal-trio-weapon-rack-domino`
- `cornucopia-stay-for-more-resources`

### Bloodbath — Fleeing

- Total selections: 290
- Average selections per game: 2.90
- Non-solo share: 72.8%
- Consecutive-game overlap: average 0.30, median 0.00, P90 1.00, maximum 2.00 across 99 comparisons
- Top five event share: 32.1%
- Top ten event share: 55.9%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 79 | 27.2% |
| Pair | 138 | 47.6% |
| Trio | 58 | 20.0% |
| Four-plus | 15 | 5.2% |

#### Selection diagnostics

- Games captured: 100
- Selection opportunities: 290
- Solo selected while a non-solo candidate was feasible: 35
- Opportunities with no feasible non-solo candidate: 44
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 3714 | 79 |
| Pair | 2083 | 138 |
| Trio | 1160 | 58 |
| Four-plus | 455 | 15 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| flee | 290 | 35 | 44 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `bloodbath-flee-mud-camouflage` | Solo | 290 | 290 | 290 | 4 | 1.4% | weighted-not-selected (286) |
| `bloodbath-flee-escape-stampede` | Solo | 290 | 290 | 290 | 2 | 0.7% | weighted-not-selected (288) |
| `bloodbath-flee-emergency-foraging` | Solo | 290 | 290 | 289 | 5 | 1.7% | weighted-not-selected (284) |
| `bloodbath-flee-cross-fallen-tree` | Solo | 290 | 290 | 289 | 3 | 1.0% | weighted-not-selected (286) |
| `bloodbath-flee-leap-across-creek` | Solo | 290 | 290 | 289 | 1 | 0.3% | weighted-not-selected (288) |
| `bloodbath-flee-follow-insects-water` | Solo | 290 | 290 | 288 | 4 | 1.4% | weighted-not-selected (284) |
| `bloodbath-flee-cover-tracks` | Solo | 290 | 290 | 286 | 6 | 2.1% | weighted-not-selected (280) |
| `bloodbath-flee-hollow-log` | Solo | 290 | 290 | 285 | 7 | 2.5% | weighted-not-selected (278) |
| `bloodbath-flee-run-from-cornucopia` | Solo | 290 | 290 | 284 | 10 | 3.5% | weighted-not-selected (274) |
| `bloodbath-flee-bramble-shortcut` | Solo | 290 | 290 | 284 | 9 | 3.2% | weighted-not-selected (275) |
| `bloodbath-flee-territorial-goose` | Solo | 290 | 290 | 282 | 8 | 2.8% | weighted-not-selected (274) |
| `bloodbath-flee-climb-above-chaos` | Solo | 290 | 290 | 281 | 12 | 4.3% | weighted-not-selected (269) |
| `bloodbath-flee-tall-grass` | Solo | 290 | 290 | 277 | 8 | 2.9% | weighted-not-selected (269) |
| `bloodbath-flee-pair-abandoned-at-creek` | Pair | 290 | 247 | 243 | 2 | 0.8% | weighted-not-selected (241) |
| `bloodbath-flee-pair-same-hollow-tree` | Pair | 290 | 250 | 236 | 11 | 4.7% | weighted-not-selected (225) |
| `bloodbath-flee-pair-decoy-shout` | Pair | 290 | 252 | 235 | 16 | 6.8% | weighted-not-selected (219) |
| `bloodbath-flee-pair-ravine-route-argument` | Pair | 290 | 249 | 235 | 16 | 6.8% | weighted-not-selected (219) |
| `bloodbath-flee-pair-ankle-hook` | Pair | 290 | 255 | 234 | 17 | 7.3% | weighted-not-selected (217) |
| `bloodbath-flee-pair-fallen-log-cooperation` | Pair | 290 | 253 | 230 | 17 | 7.4% | weighted-not-selected (213) |
| `bloodbath-flee-break-away-crowd` | Pair | 290 | 249 | 228 | 16 | 7.0% | weighted-not-selected (212) |
| `bloodbath-flee-pair-follow-escape-route` | Pair | 290 | 250 | 224 | 21 | 9.4% | weighted-not-selected (203) |
| `bloodbath-flee-pair-shoulder-collision` | Pair | 290 | 255 | 218 | 22 | 10.1% | weighted-not-selected (196) |
| `bloodbath-flee-trio-ravine-betrayal` | Trio | 290 | 199 | 198 | 2 | 1.0% | weighted-not-selected (196) |
| `bloodbath-flee-trio-bramble-hideout` | Trio | 290 | 209 | 194 | 11 | 5.7% | weighted-not-selected (183) |
| `bloodbath-flee-trio-escape-group-fractures` | Trio | 290 | 209 | 193 | 13 | 6.7% | weighted-not-selected (180) |
| `bloodbath-flee-trio-redirect-pursuit` | Trio | 290 | 207 | 192 | 12 | 6.3% | weighted-not-selected (180) |
| `bloodbath-flee-trio-use-third-as-decoy` | Trio | 290 | 207 | 192 | 10 | 5.2% | weighted-not-selected (182) |
| `bloodbath-flee-trio-narrow-deer-path` | Trio | 290 | 208 | 191 | 10 | 5.2% | weighted-not-selected (181) |
| `bloodbath-flee-quartet-competing-pairs` | Four-plus | 290 | 157 | 152 | 9 | 5.9% | weighted-not-selected (143) |
| `bloodbath-flee-quartet-rope-bridge-chain-reaction` | Four-plus | 290 | 157 | 152 | 3 | 2.0% | weighted-not-selected (149) |
| `bloodbath-flee-quartet-scree-slope-stampede` | Four-plus | 290 | 154 | 151 | 3 | 2.0% | weighted-not-selected (148) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| Bloodbath — flee | 290 | 100 | 100.0% | 100.0% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `bloodbath-flee-pair-shoulder-collision` | Bloodbath — flee | 22 | 22 | 22.0% | 7.6% | 0.22 | 0 | 0 | 0 | 22 | 0 | 0 |
| `bloodbath-flee-pair-follow-escape-route` | Bloodbath — flee | 21 | 21 | 21.0% | 7.2% | 0.21 | 0 | 0 | 0 | 21 | 0 | 0 |
| `bloodbath-flee-pair-ankle-hook` | Bloodbath — flee | 17 | 17 | 17.0% | 5.9% | 0.17 | 0 | 0 | 0 | 17 | 0 | 0 |
| `bloodbath-flee-pair-fallen-log-cooperation` | Bloodbath — flee | 17 | 17 | 17.0% | 5.9% | 0.17 | 3 | 3 | 0 | 17 | 0 | 0 |
| `bloodbath-flee-break-away-crowd` | Bloodbath — flee | 16 | 16 | 16.0% | 5.5% | 0.16 | 0 | 0 | 0 | 16 | 0 | 0 |
| `bloodbath-flee-pair-decoy-shout` | Bloodbath — flee | 16 | 16 | 16.0% | 5.5% | 0.16 | 0 | 0 | 0 | 16 | 0 | 0 |
| `bloodbath-flee-pair-ravine-route-argument` | Bloodbath — flee | 16 | 16 | 16.0% | 5.5% | 0.16 | 0 | 0 | 0 | 16 | 0 | 0 |
| `bloodbath-flee-trio-escape-group-fractures` | Bloodbath — flee | 13 | 13 | 13.0% | 4.5% | 0.13 | 0 | 0 | 0 | 0 | 13 | 0 |
| `bloodbath-flee-climb-above-chaos` | Bloodbath — flee | 12 | 12 | 12.0% | 4.1% | 0.12 | 0 | 0 | 12 | 0 | 0 | 0 |
| `bloodbath-flee-trio-redirect-pursuit` | Bloodbath — flee | 12 | 12 | 12.0% | 4.1% | 0.12 | 0 | 0 | 0 | 0 | 12 | 0 |
| `bloodbath-flee-pair-same-hollow-tree` | Bloodbath — flee | 11 | 11 | 11.0% | 3.8% | 0.11 | 0 | 0 | 0 | 11 | 0 | 0 |
| `bloodbath-flee-trio-bramble-hideout` | Bloodbath — flee | 11 | 11 | 11.0% | 3.8% | 0.11 | 0 | 0 | 0 | 0 | 11 | 0 |
| `bloodbath-flee-run-from-cornucopia` | Bloodbath — flee | 10 | 10 | 10.0% | 3.4% | 0.10 | 0 | 0 | 10 | 0 | 0 | 0 |
| `bloodbath-flee-trio-narrow-deer-path` | Bloodbath — flee | 10 | 10 | 10.0% | 3.4% | 0.10 | 2 | 2 | 0 | 0 | 10 | 0 |
| `bloodbath-flee-trio-use-third-as-decoy` | Bloodbath — flee | 10 | 10 | 10.0% | 3.4% | 0.10 | 5 | 5 | 0 | 0 | 10 | 0 |
| `bloodbath-flee-bramble-shortcut` | Bloodbath — flee | 9 | 9 | 9.0% | 3.1% | 0.09 | 0 | 0 | 9 | 0 | 0 | 0 |
| `bloodbath-flee-quartet-competing-pairs` | Bloodbath — flee | 9 | 9 | 9.0% | 3.1% | 0.09 | 0 | 0 | 0 | 0 | 0 | 9 |
| `bloodbath-flee-tall-grass` | Bloodbath — flee | 8 | 8 | 8.0% | 2.8% | 0.08 | 0 | 0 | 8 | 0 | 0 | 0 |
| `bloodbath-flee-territorial-goose` | Bloodbath — flee | 8 | 8 | 8.0% | 2.8% | 0.08 | 0 | 0 | 8 | 0 | 0 | 0 |
| `bloodbath-flee-hollow-log` | Bloodbath — flee | 7 | 7 | 7.0% | 2.4% | 0.07 | 0 | 0 | 7 | 0 | 0 | 0 |
| `bloodbath-flee-cover-tracks` | Bloodbath — flee | 6 | 6 | 6.0% | 2.1% | 0.06 | 0 | 0 | 6 | 0 | 0 | 0 |
| `bloodbath-flee-emergency-foraging` | Bloodbath — flee | 5 | 5 | 5.0% | 1.7% | 0.05 | 0 | 0 | 5 | 0 | 0 | 0 |
| `bloodbath-flee-follow-insects-water` | Bloodbath — flee | 4 | 4 | 4.0% | 1.4% | 0.04 | 0 | 0 | 4 | 0 | 0 | 0 |
| `bloodbath-flee-mud-camouflage` | Bloodbath — flee | 4 | 4 | 4.0% | 1.4% | 0.04 | 0 | 0 | 4 | 0 | 0 | 0 |
| `bloodbath-flee-cross-fallen-tree` | Bloodbath — flee | 3 | 3 | 3.0% | 1.0% | 0.03 | 1 | 1 | 3 | 0 | 0 | 0 |
| `bloodbath-flee-quartet-rope-bridge-chain-reaction` | Bloodbath — flee | 3 | 3 | 3.0% | 1.0% | 0.03 | 1 | 1 | 0 | 0 | 0 | 3 |
| `bloodbath-flee-quartet-scree-slope-stampede` | Bloodbath — flee | 3 | 3 | 3.0% | 1.0% | 0.03 | 0 | 0 | 0 | 0 | 0 | 3 |
| `bloodbath-flee-escape-stampede` | Bloodbath — flee | 2 | 2 | 2.0% | 0.7% | 0.02 | 0 | 0 | 2 | 0 | 0 | 0 |
| `bloodbath-flee-pair-abandoned-at-creek` | Bloodbath — flee | 2 | 2 | 2.0% | 0.7% | 0.02 | 0 | 0 | 0 | 2 | 0 | 0 |
| `bloodbath-flee-trio-ravine-betrayal` | Bloodbath — flee | 2 | 2 | 2.0% | 0.7% | 0.02 | 2 | 2 | 0 | 0 | 2 | 0 |
| `bloodbath-flee-leap-across-creek` | Bloodbath — flee | 1 | 1 | 1.0% | 0.3% | 0.01 | 0 | 0 | 1 | 0 | 0 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- None

Appearing in at least 50% of games:

- None

Appearing in at least 25% of games:

- None

#### Never selected

- None

### Day 2+

- Total selections: 2018
- Average selections per game: 20.18
- Non-solo share: 36.9%
- Consecutive-game overlap: average 6.71, median 7.00, P90 9.00, maximum 11.00 across 99 comparisons
- Top five event share: 17.3%
- Top ten event share: 29.7%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 1274 | 63.1% |
| Pair | 691 | 34.2% |
| Trio | 53 | 2.6% |
| Four-plus | 0 | 0.0% |

#### Selection diagnostics

- Games captured: 100
- Selection opportunities: 1973
- Solo selected while a non-solo candidate was feasible: 1263
- Opportunities with no feasible non-solo candidate: 11
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 69253 | 1274 |
| Pair | 28292 | 656 |
| Trio | 2903 | 43 |
| Four-plus | 0 | 0 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| ordinary | 1973 | 1263 | 11 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `fallen-cliff` | Solo | 1973 | 1973 | 1968 | 58 | 2.9% | weighted-not-selected (1214) |
| `river-current` | Solo | 1973 | 1973 | 1956 | 120 | 6.1% | weighted-not-selected (1248) |
| `day-collecting-fruit` | Solo | 1973 | 1973 | 1878 | 57 | 3.0% | weighted-not-selected (1332) |
| `forages-for-resources` | Solo | 1973 | 1973 | 1878 | 55 | 2.9% | weighted-not-selected (1349) |
| `brushfire-supply-run` | Solo | 1973 | 1973 | 1878 | 40 | 2.1% | weighted-not-selected (1509) |
| `arena-goose` | Solo | 1973 | 1973 | 1878 | 36 | 1.9% | weighted-not-selected (1514) |
| `day-reaching-higher-ground` | Solo | 1973 | 1973 | 1878 | 35 | 1.9% | weighted-not-selected (1526) |
| `identifies-wild-berries` | Solo | 1973 | 1973 | 1878 | 33 | 1.8% | weighted-not-selected (1528) |
| `rough-terrain` | Solo | 1973 | 1973 | 1878 | 33 | 1.8% | weighted-not-selected (1589) |
| `day-exploring-arena` | Solo | 1973 | 1973 | 1878 | 32 | 1.7% | weighted-not-selected (1603) |
| `day-discovering-cave-failure` | Solo | 1973 | 1973 | 1878 | 29 | 1.5% | weighted-not-selected (1607) |
| `day-discovering-river` | Solo | 1973 | 1973 | 1878 | 29 | 1.5% | weighted-not-selected (1589) |
| `day-scaring-off-another-tribute` | Solo | 1973 | 1973 | 1878 | 28 | 1.5% | weighted-not-selected (1622) |
| `day-searching-for-firewood` | Solo | 1973 | 1973 | 1878 | 28 | 1.5% | weighted-not-selected (1646) |
| `contaminated-water` | Solo | 1973 | 1973 | 1878 | 27 | 1.4% | weighted-not-selected (1641) |
| `identifies-wild-mushrooms` | Solo | 1973 | 1973 | 1878 | 27 | 1.4% | weighted-not-selected (1632) |
| `raids-nest-for-eggs` | Solo | 1973 | 1973 | 1878 | 27 | 1.4% | weighted-not-selected (1649) |
| `day-questioning-sanity` | Solo | 1973 | 1973 | 1878 | 23 | 1.2% | weighted-not-selected (1663) |
| `deep-cut` | Solo | 1973 | 1973 | 1878 | 20 | 1.1% | weighted-not-selected (1211) |
| `day-discovering-cave-shelter` | Solo | 1973 | 1973 | 1878 | 19 | 1.0% | weighted-not-selected (1729) |
| `day-ignoring-distant-smoke` | Solo | 1973 | 1973 | 1878 | 18 | 1.0% | weighted-not-selected (1688) |
| `day-pricked-by-thorns` | Solo | 1973 | 1973 | 1878 | 16 | 0.9% | weighted-not-selected (1741) |
| `day-sleeping-through-day` | Solo | 1973 | 1973 | 1878 | 16 | 0.9% | weighted-not-selected (1720) |
| `day-thinking-about-home` | Solo | 1973 | 1973 | 1878 | 16 | 0.9% | weighted-not-selected (1718) |
| `day-accidental-self-injury` | Solo | 1973 | 1973 | 1878 | 15 | 0.8% | weighted-not-selected (1720) |
| `day-camouflaging-in-bushes` | Solo | 1973 | 1973 | 1878 | 15 | 0.8% | weighted-not-selected (1704) |
| `day-picking-flowers` | Solo | 1973 | 1973 | 1878 | 10 | 0.5% | weighted-not-selected (1783) |
| `day-chasing-another-tribute` | Pair | 1973 | 1973 | 1877 | 47 | 2.5% | weighted-not-selected (1434) |
| `day-stalking-another-tribute` | Pair | 1973 | 1973 | 1877 | 40 | 2.1% | weighted-not-selected (1502) |
| `day-attacking-someone-who-escapes` | Pair | 1973 | 1973 | 1877 | 30 | 1.6% | weighted-not-selected (1615) |
| `day-theft-while-distracted` | Pair | 1973 | 1973 | 1866 | 49 | 2.6% | weighted-not-selected (1383) |
| `day-make-knife` | Solo | 1973 | 1973 | 1843 | 42 | 2.3% | weighted-not-selected (1352) |
| `day-carve-wooden-club` | Solo | 1973 | 1973 | 1843 | 38 | 2.1% | weighted-not-selected (1513) |
| `day-make-stone-hand-axe` | Solo | 1973 | 1973 | 1843 | 29 | 1.6% | weighted-not-selected (1561) |
| `day-build-bow` | Solo | 1973 | 1973 | 1843 | 15 | 0.8% | weighted-not-selected (1666) |
| `day-creating-diversion-and-escaping` | Pair | 1973 | 1973 | 1842 | 57 | 3.1% | weighted-not-selected (1324) |
| `steal-from-stronger-tribute` | Pair | 1973 | 1973 | 1808 | 26 | 1.4% | weighted-not-selected (1134) |
| `steals-drink-at-water-source` | Pair | 1973 | 1973 | 1800 | 28 | 1.6% | weighted-not-selected (1610) |
| `steals-fresh-meal` | Pair | 1973 | 1973 | 1793 | 27 | 1.5% | weighted-not-selected (1586) |
| `day-searching-for-water` | Solo | 1973 | 1973 | 1731 | 40 | 2.3% | weighted-not-selected (1367) |
| `day-defeating-but-sparing` | Pair | 1973 | 1973 | 1729 | 34 | 2.0% | weighted-not-selected (1443) |
| `romantic-truce-formation` | Pair | 1973 | 1760 | 1650 | 1 | 0.1% | weighted-not-selected (1645) |
| `day-practising-weaponry` | Solo | 1973 | 1973 | 1636 | 36 | 2.2% | weighted-not-selected (1281) |
| `day-sneaking-a-nap` | Solo | 1973 | 1973 | 1380 | 25 | 1.8% | weighted-not-selected (1210) |
| `day-working-together` | Pair | 1973 | 1423 | 1302 | 30 | 2.3% | weighted-not-selected (1096) |
| `travel-together-truce-2` | Pair | 1973 | 1388 | 1302 | 20 | 1.5% | weighted-not-selected (1126) |
| `becomes-hungry` | Solo | 1973 | 1973 | 1259 | 53 | 4.2% | weighted-not-selected (755) |
| `becomes-thirsty` | Solo | 1973 | 1973 | 1253 | 58 | 4.6% | weighted-not-selected (674) |
| `day-overhearing-conversation` | Trio | 1973 | 1876 | 1042 | 19 | 1.8% | weighted-not-selected (913) |
| `day-splitting-up-to-search` | Pair | 1973 | 1973 | 1042 | 18 | 1.7% | weighted-not-selected (906) |
| `protects-truce-partner` | Pair | 1973 | 1201 | 965 | 10 | 1.0% | definition-ineligible (772) |
| `uses-cornucopia-provisions-water` | Solo | 1973 | 1044 | 933 | 14 | 1.5% | definition-ineligible (929) |
| `uses-cornucopia-provisions-food` | Solo | 1973 | 1038 | 925 | 19 | 2.1% | definition-ineligible (935) |
| `amicable-truce-separation-2` | Pair | 1973 | 1110 | 861 | 5 | 0.6% | definition-ineligible (863) |
| `unexpected-pep-talk` | Solo | 1973 | 1973 | 835 | 9 | 1.1% | participant-or-item-infeasible (900) |
| `travel-together-truce-3` | Trio | 1973 | 891 | 807 | 10 | 1.2% | definition-ineligible (1082) |
| `day-raiding-unattended-camp` | Trio | 1973 | 1876 | 780 | 13 | 1.7% | weighted-not-selected (728) |
| `truce-betrayal-2` | Pair | 1973 | 950 | 671 | 2 | 0.3% | definition-ineligible (1023) |
| `knife-ambush` | Pair | 1973 | 1973 | 662 | 46 | 6.9% | participant-or-item-infeasible (1147) |
| `bow-shot` | Pair | 1973 | 1973 | 528 | 26 | 4.9% | participant-or-item-infeasible (1322) |
| `day-spearfishing` | Solo | 1973 | 1973 | 496 | 11 | 2.2% | participant-or-item-infeasible (1255) |
| `spear-attack` | Pair | 1973 | 1973 | 420 | 30 | 7.1% | participant-or-item-infeasible (1433) |
| `rapier-lunge` | Pair | 1973 | 1973 | 371 | 15 | 4.0% | participant-or-item-infeasible (1505) |
| `day-hunting-for-food` | Solo | 1973 | 1973 | 367 | 18 | 4.9% | participant-or-item-infeasible (1407) |
| `club-attack` | Pair | 1973 | 1973 | 321 | 19 | 5.9% | participant-or-item-infeasible (1558) |
| `short-sword-duel` | Pair | 1973 | 1973 | 285 | 18 | 6.3% | participant-or-item-infeasible (1589) |
| `longsword-attack` | Pair | 1973 | 1973 | 231 | 10 | 4.3% | participant-or-item-infeasible (1678) |
| `crossbow-attack` | Pair | 1973 | 1973 | 199 | 13 | 6.5% | participant-or-item-infeasible (1729) |
| `amicable-truce-separation-3` | Trio | 1973 | 340 | 187 | 1 | 0.5% | definition-ineligible (1633) |
| `hand-axe-attack` | Pair | 1973 | 1973 | 177 | 19 | 10.7% | participant-or-item-infeasible (1737) |
| `pike-charge` | Pair | 1973 | 1973 | 169 | 9 | 5.3% | participant-or-item-infeasible (1760) |
| `romantic-partner-protection` | Pair | 1973 | 217 | 144 | 2 | 1.4% | definition-ineligible (1756) |
| `axe-attack` | Pair | 1973 | 1973 | 124 | 7 | 5.6% | participant-or-item-infeasible (1816) |
| `axe-based-shelter-renovation` | Solo | 1973 | 1973 | 119 | 3 | 2.5% | participant-or-item-infeasible (1732) |
| `trident-attack` | Pair | 1973 | 1973 | 110 | 5 | 4.5% | participant-or-item-infeasible (1835) |
| `longbow-shot` | Pair | 1973 | 1973 | 97 | 6 | 6.2% | participant-or-item-infeasible (1832) |
| `truce-betrayal-3` | Trio | 1973 | 177 | 87 | 0 | 0.0% | definition-ineligible (1796) |
| `greatsword-charge` | Pair | 1973 | 1973 | 45 | 4 | 8.9% | participant-or-item-infeasible (1911) |
| `warhammer-attack` | Pair | 1973 | 1973 | 33 | 2 | 6.1% | participant-or-item-infeasible (1933) |
| `day-hallucinate-a-tribute` | Pair | 1973 | 1973 | 29 | 0 | 0.0% | participant-or-item-infeasible (1843) |
| `firebomb-attack` | Pair | 1973 | 1973 | 23 | 1 | 4.3% | participant-or-item-infeasible (1847) |
| `blowgun-poison-attack` | Pair | 1973 | 1973 | 18 | 0 | 0.0% | participant-or-item-infeasible (1854) |
| `bear-trap-attack` | Pair | 1973 | 1973 | 17 | 0 | 0.0% | participant-or-item-infeasible (1856) |
| `shield-used-for-everything-else` | Solo | 1973 | 1973 | 17 | 0 | 0.0% | participant-or-item-infeasible (1860) |
| `bird-whistle-nest-search` | Solo | 1973 | 1973 | 14 | 0 | 0.0% | participant-or-item-infeasible (1862) |
| `day-poison-a-tribute` | Pair | 1973 | 1973 | 14 | 0 | 0.0% | participant-or-item-infeasible (1863) |
| `upside-down-map` | Solo | 1973 | 1973 | 14 | 0 | 0.0% | participant-or-item-infeasible (1863) |
| `tripwire-attack` | Pair | 1973 | 1973 | 13 | 0 | 0.0% | participant-or-item-infeasible (1860) |
| `slingshot-chicken-hunt` | Solo | 1973 | 1973 | 11 | 1 | 9.1% | participant-or-item-infeasible (1863) |
| `slingshot-trick-shot` | Solo | 1973 | 1973 | 11 | 0 | 0.0% | participant-or-item-infeasible (1863) |
| `day-fishing` | Solo | 1973 | 1973 | 3 | 1 | 33.3% | participant-or-item-infeasible (1873) |
| `fishing-gear-catch` | Solo | 1973 | 1973 | 3 | 0 | 0.0% | participant-or-item-infeasible (1873) |
| `amicable-truce-separation-4` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `amicable-truce-separation-5` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `amicable-truce-separation-6` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `cannot-find-shelter` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `cave-shelter-collapse` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `cold-rain` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `finds-dry-rock-overhang` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `finds-hiding-place` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `freezing-night` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `keep-watch-truce-2` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `keep-watch-truce-3` | Trio | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `keep-watch-truce-4` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `keep-watch-truce-5` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `keep-watch-truce-6` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-both-swing-at-once` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-burning-blanket-panic` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-falling-tree-firewood` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-fatal-tree-fall` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-kicked-burning-log` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-mistaken-for-dinner` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-overengineered-alarm` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-overloaded-shelter` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-pushed-while-dreaming` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-returning-watchkeeper` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-rock-thrown-at-noise` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-sleepwalking-into-river` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-smoke-filled-shelter` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-startled-over-edge` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-accidental-wrong-tree` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-becoming-lost` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-comfortable-bush` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-cooking-provisions` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-crying-to-sleep` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-defending-fire` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-discussing-morning` | Trio | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-discussing-survivors` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-betrayal-on-watch` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-chopped-from-tree` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-collapsing-cave-entrance` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-cry-from-ravine` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-cut-loose-from-tree` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-drowned-at-river` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-fake-emergency` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-fake-emergency-bow` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-firelight-ambush` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-poisoned-shared-meal` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-rock-from-darkness` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-rolled-into-fire` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-sent-to-check-noise` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-sleeping-bag-canoe` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-smothered-beneath-blanket` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-fatal-snoring-problem` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-ghost-stories` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-holding-hands` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-huddling-for-warmth` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-looking-at-sky` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-natural-wound-treatment` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-nightmares` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-passing-out-exhausted` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-quiet-humming` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-screaming-for-help` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-seeing-distant-fire` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-setting-up-camp` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sharing-shelter` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-simply-sleeping` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-singing-to-sleep` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-singing-together` | Trio | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sleeping-in-tree` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sleeping-shifts-four` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sleeping-shifts-three` | Trio | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sleeping-shifts-two` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sleeping-without-fire` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-snuggling` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-sparing-opponent` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-starting-fire` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-staying-awake` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-telling-stories` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-thinking-about-victory` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `night-truce` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `poison-vial-attack` | Pair | 1973 | 1973 | 0 | 0 | 0.0% | participant-or-item-infeasible (1877) |
| `poisonous-berries-joint-victory` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `romantic-night-truce-formation` | Pair | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `trap-kit-rabbit-hunt` | Solo | 1973 | 1973 | 0 | 0 | 0.0% | participant-or-item-infeasible (1878) |
| `travel-together-truce-4` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `travel-together-truce-5` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `travel-together-truce-6` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `truce-betrayal-4` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `truce-betrayal-5` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `truce-betrayal-6` | Four-plus | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |
| `uses-shelter-supplies` | Solo | 1973 | 0 | 0 | 0 | 0.0% | definition-ineligible (1973) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| day-authored-16-33 | 472 | 100 | 100.0% | 23.4% |
| day-authored-01-15 | 382 | 98 | 98.0% | 18.9% |
| environmental | 334 | 99 | 99.0% | 16.6% |
| combat | 229 | 95 | 95.0% | 11.3% |
| day-weapon-crafting | 124 | 79 | 79.0% | 6.1% |
| deprivation | 111 | 80 | 80.0% | 5.5% |
| foraging | 60 | 50 | 50.0% | 3.0% |
| survival | 55 | 51 | 51.0% | 2.7% |
| standard-dissolution | 50 | 41 | 41.0% | 2.5% |
| cornucopia-provisions | 33 | 31 | 31.0% | 1.6% |
| standard-formation | 30 | 29 | 29.0% | 1.5% |
| hunting | 28 | 26 | 26.0% | 1.4% |
| water-theft | 28 | 28 | 28.0% | 1.4% |
| food-theft | 27 | 27 | 27.0% | 1.3% |
| theft | 26 | 26 | 26.0% | 1.3% |
| standard-interaction | 12 | 12 | 12.0% | 0.6% |
| high-luck | 9 | 9 | 9.0% | 0.4% |
| romantic | 4 | 4 | 4.0% | 0.2% |
| item-use | 3 | 3 | 3.0% | 0.1% |
| tactical | 1 | 1 | 1.0% | 0.0% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `river-current` | environmental | 120 | 96 | 96.0% | 5.9% | 1.20 | 120 | 120 | 120 | 0 | 0 | 0 |
| `becomes-thirsty` | deprivation | 58 | 56 | 56.0% | 2.9% | 0.58 | 0 | 0 | 58 | 0 | 0 | 0 |
| `fallen-cliff` | environmental | 58 | 56 | 56.0% | 2.9% | 0.58 | 58 | 58 | 58 | 0 | 0 | 0 |
| `day-collecting-fruit` | day-authored-01-15 | 57 | 57 | 57.0% | 2.8% | 0.57 | 0 | 0 | 57 | 0 | 0 | 0 |
| `day-creating-diversion-and-escaping` | day-authored-16-33 | 57 | 56 | 56.0% | 2.8% | 0.57 | 0 | 0 | 0 | 57 | 0 | 0 |
| `forages-for-resources` | survival | 55 | 51 | 51.0% | 2.7% | 0.55 | 0 | 0 | 55 | 0 | 0 | 0 |
| `becomes-hungry` | deprivation | 53 | 51 | 51.0% | 2.6% | 0.53 | 0 | 0 | 53 | 0 | 0 | 0 |
| `day-theft-while-distracted` | day-authored-16-33 | 49 | 49 | 49.0% | 2.4% | 0.49 | 0 | 0 | 0 | 49 | 0 | 0 |
| `day-chasing-another-tribute` | day-authored-16-33 | 47 | 45 | 45.0% | 2.3% | 0.47 | 0 | 0 | 0 | 47 | 0 | 0 |
| `knife-ambush` | combat | 46 | 40 | 40.0% | 2.3% | 0.46 | 28 | 28 | 0 | 46 | 0 | 0 |
| `day-make-knife` | day-weapon-crafting | 42 | 42 | 42.0% | 2.1% | 0.42 | 0 | 0 | 42 | 0 | 0 | 0 |
| `brushfire-supply-run` | environmental | 40 | 39 | 39.0% | 2.0% | 0.40 | 0 | 0 | 40 | 0 | 0 | 0 |
| `day-searching-for-water` | day-authored-16-33 | 40 | 40 | 40.0% | 2.0% | 0.40 | 0 | 0 | 40 | 0 | 0 | 0 |
| `day-stalking-another-tribute` | day-authored-16-33 | 40 | 39 | 39.0% | 2.0% | 0.40 | 0 | 0 | 0 | 40 | 0 | 0 |
| `amicable-truce-separation-2` | standard-dissolution | 39 | 31 | 31.0% | 1.9% | 0.39 | 0 | 0 | 0 | 39 | 0 | 0 |
| `day-carve-wooden-club` | day-weapon-crafting | 38 | 38 | 38.0% | 1.9% | 0.38 | 0 | 0 | 38 | 0 | 0 | 0 |
| `arena-goose` | environmental | 36 | 36 | 36.0% | 1.8% | 0.36 | 0 | 0 | 36 | 0 | 0 | 0 |
| `day-practising-weaponry` | day-authored-01-15 | 36 | 36 | 36.0% | 1.8% | 0.36 | 0 | 0 | 36 | 0 | 0 | 0 |
| `day-reaching-higher-ground` | day-authored-01-15 | 35 | 35 | 35.0% | 1.7% | 0.35 | 0 | 0 | 35 | 0 | 0 | 0 |
| `day-defeating-but-sparing` | day-authored-16-33 | 34 | 34 | 34.0% | 1.7% | 0.34 | 0 | 0 | 0 | 34 | 0 | 0 |
| `identifies-wild-berries` | foraging | 33 | 32 | 32.0% | 1.6% | 0.33 | 0 | 0 | 33 | 0 | 0 | 0 |
| `rough-terrain` | environmental | 33 | 33 | 33.0% | 1.6% | 0.33 | 0 | 0 | 33 | 0 | 0 | 0 |
| `day-exploring-arena` | day-authored-01-15 | 32 | 32 | 32.0% | 1.6% | 0.32 | 0 | 0 | 32 | 0 | 0 | 0 |
| `day-attacking-someone-who-escapes` | day-authored-16-33 | 30 | 30 | 30.0% | 1.5% | 0.30 | 0 | 0 | 0 | 30 | 0 | 0 |
| `day-working-together` | day-authored-01-15 | 30 | 30 | 30.0% | 1.5% | 0.30 | 0 | 0 | 0 | 30 | 0 | 0 |
| `spear-attack` | combat | 30 | 28 | 28.0% | 1.5% | 0.30 | 19 | 19 | 0 | 30 | 0 | 0 |
| `day-discovering-cave-failure` | day-authored-16-33 | 29 | 29 | 29.0% | 1.4% | 0.29 | 0 | 0 | 29 | 0 | 0 | 0 |
| `day-discovering-river` | day-authored-01-15 | 29 | 29 | 29.0% | 1.4% | 0.29 | 0 | 0 | 29 | 0 | 0 | 0 |
| `day-make-stone-hand-axe` | day-weapon-crafting | 29 | 29 | 29.0% | 1.4% | 0.29 | 0 | 0 | 29 | 0 | 0 | 0 |
| `day-scaring-off-another-tribute` | day-authored-16-33 | 28 | 27 | 27.0% | 1.4% | 0.28 | 0 | 0 | 28 | 0 | 0 | 0 |
| `day-searching-for-firewood` | day-authored-01-15 | 28 | 28 | 28.0% | 1.4% | 0.28 | 0 | 0 | 28 | 0 | 0 | 0 |
| `steals-drink-at-water-source` | water-theft | 28 | 28 | 28.0% | 1.4% | 0.28 | 2 | 2 | 0 | 28 | 0 | 0 |
| `contaminated-water` | environmental | 27 | 27 | 27.0% | 1.3% | 0.27 | 0 | 0 | 27 | 0 | 0 | 0 |
| `identifies-wild-mushrooms` | foraging | 27 | 27 | 27.0% | 1.3% | 0.27 | 0 | 0 | 27 | 0 | 0 | 0 |
| `raids-nest-for-eggs` | hunting | 27 | 25 | 25.0% | 1.3% | 0.27 | 0 | 0 | 27 | 0 | 0 | 0 |
| `steals-fresh-meal` | food-theft | 27 | 27 | 27.0% | 1.3% | 0.27 | 4 | 4 | 0 | 27 | 0 | 0 |
| `bow-shot` | combat | 26 | 24 | 24.0% | 1.3% | 0.26 | 17 | 17 | 0 | 26 | 0 | 0 |
| `steal-from-stronger-tribute` | theft | 26 | 26 | 26.0% | 1.3% | 0.26 | 4 | 4 | 0 | 26 | 0 | 0 |
| `day-sneaking-a-nap` | day-authored-16-33 | 25 | 25 | 25.0% | 1.2% | 0.25 | 0 | 0 | 25 | 0 | 0 | 0 |
| `day-questioning-sanity` | day-authored-01-15 | 23 | 22 | 22.0% | 1.1% | 0.23 | 0 | 0 | 23 | 0 | 0 | 0 |
| `deep-cut` | environmental | 20 | 20 | 20.0% | 1.0% | 0.20 | 0 | 0 | 20 | 0 | 0 | 0 |
| `travel-together-truce-2` | standard-formation | 20 | 20 | 20.0% | 1.0% | 0.20 | 0 | 0 | 0 | 20 | 0 | 0 |
| `club-attack` | combat | 19 | 17 | 17.0% | 0.9% | 0.19 | 9 | 9 | 0 | 19 | 0 | 0 |
| `day-discovering-cave-shelter` | day-authored-16-33 | 19 | 19 | 19.0% | 0.9% | 0.19 | 0 | 0 | 19 | 0 | 0 | 0 |
| `day-overhearing-conversation` | day-authored-01-15 | 19 | 19 | 19.0% | 0.9% | 0.19 | 0 | 0 | 0 | 0 | 19 | 0 |
| `hand-axe-attack` | combat | 19 | 17 | 17.0% | 0.9% | 0.19 | 9 | 9 | 0 | 19 | 0 | 0 |
| `uses-cornucopia-provisions-food` | cornucopia-provisions | 19 | 18 | 18.0% | 0.9% | 0.19 | 0 | 0 | 19 | 0 | 0 | 0 |
| `day-hunting-for-food` | day-authored-01-15 | 18 | 18 | 18.0% | 0.9% | 0.18 | 0 | 0 | 18 | 0 | 0 | 0 |
| `day-ignoring-distant-smoke` | day-authored-01-15 | 18 | 18 | 18.0% | 0.9% | 0.18 | 0 | 0 | 18 | 0 | 0 | 0 |
| `day-splitting-up-to-search` | day-authored-16-33 | 18 | 18 | 18.0% | 0.9% | 0.18 | 0 | 0 | 0 | 18 | 0 | 0 |
| `short-sword-duel` | combat | 18 | 15 | 15.0% | 0.9% | 0.18 | 16 | 16 | 0 | 18 | 0 | 0 |
| `day-pricked-by-thorns` | day-authored-01-15 | 16 | 16 | 16.0% | 0.8% | 0.16 | 0 | 0 | 16 | 0 | 0 | 0 |
| `day-sleeping-through-day` | day-authored-16-33 | 16 | 16 | 16.0% | 0.8% | 0.16 | 0 | 0 | 16 | 0 | 0 | 0 |
| `day-thinking-about-home` | day-authored-01-15 | 16 | 16 | 16.0% | 0.8% | 0.16 | 0 | 0 | 16 | 0 | 0 | 0 |
| `day-accidental-self-injury` | day-authored-01-15 | 15 | 15 | 15.0% | 0.7% | 0.15 | 0 | 0 | 15 | 0 | 0 | 0 |
| `day-build-bow` | day-weapon-crafting | 15 | 15 | 15.0% | 0.7% | 0.15 | 0 | 0 | 15 | 0 | 0 | 0 |
| `day-camouflaging-in-bushes` | day-authored-16-33 | 15 | 15 | 15.0% | 0.7% | 0.15 | 0 | 0 | 15 | 0 | 0 | 0 |
| `rapier-lunge` | combat | 15 | 14 | 14.0% | 0.7% | 0.15 | 10 | 10 | 0 | 15 | 0 | 0 |
| `uses-cornucopia-provisions-water` | cornucopia-provisions | 14 | 14 | 14.0% | 0.7% | 0.14 | 0 | 0 | 14 | 0 | 0 | 0 |
| `crossbow-attack` | combat | 13 | 12 | 12.0% | 0.6% | 0.13 | 11 | 11 | 0 | 13 | 0 | 0 |
| `day-raiding-unattended-camp` | day-authored-16-33 | 13 | 13 | 13.0% | 0.6% | 0.13 | 0 | 0 | 0 | 0 | 13 | 0 |
| `amicable-truce-separation-3` | standard-dissolution | 11 | 11 | 11.0% | 0.5% | 0.11 | 0 | 0 | 0 | 0 | 11 | 0 |
| `day-spearfishing` | day-authored-16-33 | 11 | 10 | 10.0% | 0.5% | 0.11 | 0 | 0 | 11 | 0 | 0 | 0 |
| `day-picking-flowers` | day-authored-01-15 | 10 | 10 | 10.0% | 0.5% | 0.10 | 0 | 0 | 10 | 0 | 0 | 0 |
| `longsword-attack` | combat | 10 | 10 | 10.0% | 0.5% | 0.10 | 6 | 6 | 0 | 10 | 0 | 0 |
| `protects-truce-partner` | standard-interaction | 10 | 10 | 10.0% | 0.5% | 0.10 | 2 | 2 | 0 | 10 | 0 | 0 |
| `travel-together-truce-3` | standard-formation | 10 | 10 | 10.0% | 0.5% | 0.10 | 0 | 0 | 0 | 0 | 10 | 0 |
| `pike-charge` | combat | 9 | 8 | 8.0% | 0.4% | 0.09 | 5 | 5 | 0 | 9 | 0 | 0 |
| `unexpected-pep-talk` | high-luck | 9 | 9 | 9.0% | 0.4% | 0.09 | 0 | 0 | 9 | 0 | 0 | 0 |
| `axe-attack` | combat | 7 | 6 | 6.0% | 0.3% | 0.07 | 7 | 7 | 0 | 7 | 0 | 0 |
| `longbow-shot` | combat | 6 | 5 | 5.0% | 0.3% | 0.06 | 5 | 5 | 0 | 6 | 0 | 0 |
| `trident-attack` | combat | 5 | 5 | 5.0% | 0.2% | 0.05 | 3 | 3 | 0 | 5 | 0 | 0 |
| `greatsword-charge` | combat | 4 | 4 | 4.0% | 0.2% | 0.04 | 3 | 3 | 0 | 4 | 0 | 0 |
| `axe-based-shelter-renovation` | item-use | 3 | 3 | 3.0% | 0.1% | 0.03 | 0 | 0 | 3 | 0 | 0 | 0 |
| `romantic-partner-protection` | romantic | 2 | 2 | 2.0% | 0.1% | 0.02 | 0 | 0 | 0 | 2 | 0 | 0 |
| `truce-betrayal-2` | standard-interaction | 2 | 2 | 2.0% | 0.1% | 0.02 | 0 | 0 | 0 | 2 | 0 | 0 |
| `warhammer-attack` | combat | 2 | 2 | 2.0% | 0.1% | 0.02 | 2 | 2 | 0 | 2 | 0 | 0 |
| `day-fishing` | day-authored-16-33 | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 1 | 0 | 0 | 0 |
| `firebomb-attack` | tactical | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `poisonous-berries-joint-victory` | romantic | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `romantic-truce-formation` | romantic | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `slingshot-chicken-hunt` | hunting | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 1 | 0 | 0 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- `river-current`

Appearing in at least 50% of games:

- `becomes-hungry`
- `becomes-thirsty`
- `day-collecting-fruit`
- `day-creating-diversion-and-escaping`
- `fallen-cliff`
- `forages-for-resources`
- `river-current`

Appearing in at least 25% of games:

- `amicable-truce-separation-2`
- `arena-goose`
- `becomes-hungry`
- `becomes-thirsty`
- `brushfire-supply-run`
- `contaminated-water`
- `day-attacking-someone-who-escapes`
- `day-carve-wooden-club`
- `day-chasing-another-tribute`
- `day-collecting-fruit`
- `day-creating-diversion-and-escaping`
- `day-defeating-but-sparing`
- `day-discovering-cave-failure`
- `day-discovering-river`
- `day-exploring-arena`
- `day-make-knife`
- `day-make-stone-hand-axe`
- `day-practising-weaponry`
- `day-reaching-higher-ground`
- `day-scaring-off-another-tribute`
- `day-searching-for-firewood`
- `day-searching-for-water`
- `day-sneaking-a-nap`
- `day-stalking-another-tribute`
- `day-theft-while-distracted`
- `day-working-together`
- `fallen-cliff`
- `forages-for-resources`
- `identifies-wild-berries`
- `identifies-wild-mushrooms`
- `knife-ambush`
- `raids-nest-for-eggs`
- `river-current`
- `rough-terrain`
- `spear-attack`
- `steal-from-stronger-tribute`
- `steals-drink-at-water-source`
- `steals-fresh-meal`

#### Never selected

- `amicable-truce-separation-4`
- `amicable-truce-separation-5`
- `amicable-truce-separation-6`
- `bear-trap-attack`
- `bird-whistle-nest-search`
- `blowgun-poison-attack`
- `day-hallucinate-a-tribute`
- `day-poison-a-tribute`
- `fishing-gear-catch`
- `poison-vial-attack`
- `shield-used-for-everything-else`
- `slingshot-trick-shot`
- `trap-kit-rabbit-hunt`
- `travel-together-truce-4`
- `travel-together-truce-5`
- `travel-together-truce-6`
- `tripwire-attack`
- `truce-betrayal-3`
- `truce-betrayal-4`
- `truce-betrayal-5`
- `truce-betrayal-6`
- `upside-down-map`

### Night

- Total selections: 2282
- Average selections per game: 22.82
- Non-solo share: 35.7%
- Consecutive-game overlap: average 9.60, median 9.00, P90 13.00, maximum 15.00 across 99 comparisons
- Top five event share: 19.9%
- Top ten event share: 32.1%

#### Participant shape

| Shape | Selections | Share |
| --- | ---: | ---: |
| Solo | 1467 | 64.3% |
| Pair | 776 | 34.0% |
| Trio | 37 | 1.6% |
| Four-plus | 2 | 0.1% |

#### Selection diagnostics

- Games captured: 100
- Selection opportunities: 2243
- Solo selected while a non-solo candidate was feasible: 1458
- Opportunities with no feasible non-solo candidate: 0
- Opportunities with no feasible candidate: 0

| Shape | Feasible appearances | Selected |
| --- | ---: | ---: |
| Solo | 63254 | 1458 |
| Pair | 44454 | 755 |
| Trio | 1891 | 28 |
| Four-plus | 198 | 2 |

| Stage | Opportunities | Solo over non-solo | No non-solo feasible |
| --- | ---: | ---: | ---: |
| ordinary | 2243 | 1458 | 0 |

| Event | Shape | Considered | Eligible | Feasible | Selected | Selected when feasible | Top rejection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `finds-hiding-place` | Solo | 2243 | 2243 | 2118 | 91 | 4.3% | already-used-definition (1108) |
| `cold-rain` | Solo | 2243 | 2243 | 2118 | 78 | 3.7% | weighted-not-selected (1203) |
| `night-starting-fire` | Solo | 2243 | 2243 | 2118 | 62 | 2.9% | weighted-not-selected (1382) |
| `night-setting-up-camp` | Solo | 2243 | 2243 | 2118 | 52 | 2.5% | weighted-not-selected (1449) |
| `night-sleeping-in-tree` | Solo | 2243 | 2243 | 2118 | 52 | 2.5% | weighted-not-selected (1471) |
| `deep-cut` | Solo | 2243 | 2243 | 2118 | 50 | 2.4% | weighted-not-selected (1393) |
| `finds-dry-rock-overhang` | Solo | 2243 | 2243 | 2118 | 43 | 2.0% | weighted-not-selected (1622) |
| `night-comfortable-bush` | Solo | 2243 | 2243 | 2118 | 43 | 2.0% | weighted-not-selected (1516) |
| `night-simply-sleeping` | Solo | 2243 | 2243 | 2118 | 40 | 1.9% | weighted-not-selected (1676) |
| `cannot-find-shelter` | Solo | 2243 | 2243 | 2118 | 35 | 1.7% | weighted-not-selected (1687) |
| `night-seeing-distant-fire` | Solo | 2243 | 2243 | 2118 | 34 | 1.6% | weighted-not-selected (1805) |
| `night-sleeping-without-fire` | Solo | 2243 | 2243 | 2118 | 32 | 1.5% | weighted-not-selected (1712) |
| `night-singing-to-sleep` | Solo | 2243 | 2243 | 2118 | 27 | 1.3% | weighted-not-selected (1760) |
| `night-crying-to-sleep` | Solo | 2243 | 2243 | 2118 | 24 | 1.1% | weighted-not-selected (1841) |
| `night-nightmares` | Solo | 2243 | 2243 | 2118 | 24 | 1.1% | weighted-not-selected (1853) |
| `night-staying-awake` | Solo | 2243 | 2243 | 2118 | 22 | 1.0% | weighted-not-selected (1793) |
| `night-thinking-about-victory` | Solo | 2243 | 2243 | 2118 | 21 | 1.0% | weighted-not-selected (1886) |
| `night-screaming-for-help` | Solo | 2243 | 2243 | 2118 | 18 | 0.8% | weighted-not-selected (1932) |
| `night-quiet-humming` | Solo | 2243 | 2243 | 2118 | 13 | 0.6% | weighted-not-selected (1931) |
| `night-huddling-for-warmth` | Pair | 2243 | 2243 | 2117 | 38 | 1.8% | weighted-not-selected (1697) |
| `night-sparing-opponent` | Pair | 2243 | 2243 | 2114 | 19 | 0.9% | weighted-not-selected (1910) |
| `night-becoming-lost` | Solo | 2243 | 2243 | 2070 | 31 | 1.5% | weighted-not-selected (1672) |
| `steal-from-stronger-tribute` | Pair | 2243 | 2243 | 2049 | 45 | 2.2% | weighted-not-selected (1319) |
| `fallen-cliff` | Solo | 2243 | 2243 | 1987 | 59 | 3.0% | weighted-not-selected (1193) |
| `cave-shelter-collapse` | Solo | 2243 | 2243 | 1987 | 55 | 2.8% | weighted-not-selected (1603) |
| `night-accidental-wrong-tree` | Solo | 2243 | 2243 | 1987 | 28 | 1.4% | weighted-not-selected (1802) |
| `night-accidental-fatal-tree-fall` | Solo | 2243 | 2243 | 1987 | 21 | 1.1% | weighted-not-selected (1895) |
| `night-fatal-drowned-at-river` | Pair | 2243 | 2243 | 1983 | 45 | 2.3% | weighted-not-selected (1810) |
| `night-fatal-rock-from-darkness` | Pair | 2243 | 2243 | 1983 | 34 | 1.7% | weighted-not-selected (1840) |
| `night-accidental-startled-over-edge` | Pair | 2243 | 2243 | 1983 | 33 | 1.7% | weighted-not-selected (1843) |
| `night-accidental-rock-thrown-at-noise` | Pair | 2243 | 2243 | 1981 | 26 | 1.3% | weighted-not-selected (1811) |
| `freezing-night` | Solo | 2243 | 2243 | 1975 | 105 | 5.3% | weighted-not-selected (1230) |
| `night-fatal-cry-from-ravine` | Pair | 2243 | 2243 | 1938 | 41 | 2.1% | weighted-not-selected (1739) |
| `night-fatal-collapsing-cave-entrance` | Pair | 2243 | 2243 | 1938 | 26 | 1.3% | weighted-not-selected (1831) |
| `romantic-night-truce-formation` | Pair | 2243 | 2031 | 1890 | 4 | 0.2% | weighted-not-selected (1839) |
| `night-passing-out-exhausted` | Solo | 2243 | 2243 | 1866 | 46 | 2.5% | weighted-not-selected (1404) |
| `night-looking-at-sky` | Solo | 2243 | 2243 | 1571 | 23 | 1.5% | weighted-not-selected (1324) |
| `night-fatal-cut-loose-from-tree` | Pair | 2243 | 2243 | 1529 | 32 | 2.1% | weighted-not-selected (1315) |
| `keep-watch-truce-2` | Pair | 2243 | 1635 | 1518 | 45 | 3.0% | weighted-not-selected (1028) |
| `night-truce` | Pair | 2243 | 1635 | 1518 | 39 | 2.6% | weighted-not-selected (1141) |
| `night-accidental-sleepwalking-into-river` | Solo | 2243 | 2243 | 1224 | 18 | 1.5% | weighted-not-selected (1137) |
| `uses-cornucopia-provisions-water` | Solo | 2243 | 1318 | 1200 | 92 | 7.7% | definition-ineligible (925) |
| `uses-cornucopia-provisions-food` | Solo | 2243 | 1304 | 1178 | 87 | 7.4% | definition-ineligible (939) |
| `becomes-thirsty` | Solo | 2243 | 2243 | 1121 | 22 | 2.0% | participant-or-item-infeasible (930) |
| `becomes-hungry` | Solo | 2243 | 2243 | 1121 | 21 | 1.9% | participant-or-item-infeasible (945) |
| `night-sleeping-shifts-two` | Pair | 2243 | 2243 | 1116 | 29 | 2.6% | weighted-not-selected (921) |
| `night-telling-stories` | Pair | 2243 | 2243 | 1116 | 24 | 2.2% | weighted-not-selected (955) |
| `night-discussing-survivors` | Pair | 2243 | 2149 | 1116 | 21 | 1.9% | weighted-not-selected (937) |
| `night-holding-hands` | Pair | 2243 | 2243 | 1116 | 15 | 1.3% | weighted-not-selected (969) |
| `night-accidental-mistaken-for-dinner` | Pair | 2243 | 2243 | 1104 | 18 | 1.6% | weighted-not-selected (1027) |
| `protects-truce-partner` | Pair | 2243 | 1410 | 1036 | 25 | 2.4% | definition-ineligible (833) |
| `keep-watch-truce-3` | Trio | 2243 | 1129 | 1002 | 19 | 1.9% | definition-ineligible (1114) |
| `night-accidental-both-swing-at-once` | Pair | 2243 | 2243 | 942 | 22 | 2.3% | weighted-not-selected (897) |
| `night-accidental-pushed-while-dreaming` | Pair | 2243 | 2243 | 934 | 6 | 0.6% | weighted-not-selected (907) |
| `night-accidental-overengineered-alarm` | Pair | 2243 | 2243 | 934 | 5 | 0.5% | weighted-not-selected (915) |
| `night-fatal-snoring-problem` | Pair | 2243 | 2243 | 934 | 5 | 0.5% | weighted-not-selected (917) |
| `night-accidental-kicked-burning-log` | Pair | 2243 | 2243 | 934 | 3 | 0.3% | weighted-not-selected (931) |
| `night-fatal-rolled-into-fire` | Pair | 2243 | 2243 | 934 | 3 | 0.3% | weighted-not-selected (926) |
| `night-snuggling` | Pair | 2243 | 1286 | 912 | 14 | 1.5% | definition-ineligible (957) |
| `amicable-truce-separation-2` | Pair | 2243 | 1272 | 912 | 7 | 0.8% | definition-ineligible (971) |
| `unexpected-pep-talk` | Solo | 2243 | 2243 | 858 | 32 | 3.7% | participant-or-item-infeasible (1064) |
| `truce-betrayal-2` | Pair | 2243 | 1040 | 720 | 10 | 1.4% | definition-ineligible (1203) |
| `knife-ambush` | Pair | 2243 | 2243 | 699 | 16 | 2.3% | participant-or-item-infeasible (1144) |
| `night-natural-wound-treatment` | Solo | 2243 | 2243 | 666 | 42 | 6.3% | participant-or-item-infeasible (1326) |
| `bow-shot` | Pair | 2243 | 2243 | 569 | 16 | 2.8% | participant-or-item-infeasible (1326) |
| `rapier-lunge` | Pair | 2243 | 2243 | 393 | 11 | 2.8% | participant-or-item-infeasible (1518) |
| `club-attack` | Pair | 2243 | 2243 | 379 | 9 | 2.4% | participant-or-item-infeasible (1553) |
| `night-accidental-returning-watchkeeper` | Pair | 2243 | 2243 | 357 | 3 | 0.8% | participant-or-item-infeasible (1493) |
| `night-fatal-chopped-from-tree` | Pair | 2243 | 2243 | 320 | 6 | 1.9% | participant-or-item-infeasible (1590) |
| `night-fatal-betrayal-on-watch` | Pair | 2243 | 2243 | 303 | 5 | 1.7% | participant-or-item-infeasible (1570) |
| `night-fatal-sent-to-check-noise` | Pair | 2243 | 2243 | 303 | 4 | 1.3% | participant-or-item-infeasible (1570) |
| `short-sword-duel` | Pair | 2243 | 2243 | 297 | 8 | 2.7% | participant-or-item-infeasible (1620) |
| `night-fatal-fake-emergency` | Pair | 2243 | 2243 | 289 | 12 | 4.2% | participant-or-item-infeasible (1625) |
| `longsword-attack` | Pair | 2243 | 2243 | 233 | 8 | 3.4% | participant-or-item-infeasible (1700) |
| `crossbow-attack` | Pair | 2243 | 2243 | 220 | 4 | 1.8% | participant-or-item-infeasible (1739) |
| `hand-axe-attack` | Pair | 2243 | 2243 | 219 | 4 | 1.8% | participant-or-item-infeasible (1728) |
| `night-singing-together` | Trio | 2243 | 2149 | 204 | 4 | 2.0% | participant-or-item-infeasible (1609) |
| `night-sleeping-shifts-three` | Trio | 2243 | 2149 | 204 | 3 | 1.5% | participant-or-item-infeasible (1609) |
| `night-discussing-morning` | Trio | 2243 | 2149 | 204 | 2 | 1.0% | participant-or-item-infeasible (1609) |
| `amicable-truce-separation-3` | Trio | 2243 | 400 | 204 | 0 | 0.0% | definition-ineligible (1843) |
| `night-defending-fire` | Four-plus | 2243 | 418 | 198 | 2 | 1.0% | definition-ineligible (1825) |
| `romantic-partner-protection` | Pair | 2243 | 193 | 134 | 3 | 2.2% | definition-ineligible (2050) |
| `night-cooking-provisions` | Solo | 2243 | 2243 | 115 | 5 | 4.3% | participant-or-item-infeasible (1965) |
| `trident-attack` | Pair | 2243 | 2243 | 114 | 2 | 1.8% | participant-or-item-infeasible (1857) |
| `uses-shelter-supplies` | Solo | 2243 | 2243 | 99 | 10 | 10.1% | participant-or-item-infeasible (1971) |
| `truce-betrayal-3` | Trio | 2243 | 168 | 73 | 0 | 0.0% | definition-ineligible (2075) |
| `night-fatal-fake-emergency-bow` | Pair | 2243 | 2243 | 71 | 2 | 2.8% | participant-or-item-infeasible (1889) |
| `night-accidental-falling-tree-firewood` | Pair | 2243 | 2243 | 56 | 1 | 1.8% | participant-or-item-infeasible (1902) |
| `night-fatal-firelight-ambush` | Pair | 2243 | 2243 | 40 | 1 | 2.5% | participant-or-item-infeasible (1928) |
| `night-sharing-shelter` | Pair | 2243 | 1635 | 32 | 2 | 6.3% | participant-or-item-infeasible (1497) |
| `firebomb-attack` | Pair | 2243 | 2243 | 30 | 1 | 3.3% | participant-or-item-infeasible (2088) |
| `night-accidental-overloaded-shelter` | Pair | 2243 | 2243 | 27 | 1 | 3.7% | participant-or-item-infeasible (1951) |
| `bear-trap-attack` | Pair | 2243 | 2243 | 23 | 0 | 0.0% | participant-or-item-infeasible (2094) |
| `tripwire-attack` | Pair | 2243 | 2243 | 19 | 1 | 5.3% | participant-or-item-infeasible (2098) |
| `blowgun-poison-attack` | Pair | 2243 | 2243 | 15 | 0 | 0.0% | participant-or-item-infeasible (2096) |
| `night-fatal-smothered-beneath-blanket` | Pair | 2243 | 2243 | 7 | 1 | 14.3% | participant-or-item-infeasible (1976) |
| `night-fatal-sleeping-bag-canoe` | Pair | 2243 | 2243 | 4 | 0 | 0.0% | participant-or-item-infeasible (1978) |
| `amicable-truce-separation-4` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `amicable-truce-separation-5` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `amicable-truce-separation-6` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `arena-goose` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `axe-attack` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `axe-based-shelter-renovation` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `bird-whistle-nest-search` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `brushfire-supply-run` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `contaminated-water` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-accidental-self-injury` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-attacking-someone-who-escapes` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-build-bow` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-camouflaging-in-bushes` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-carve-wooden-club` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-chasing-another-tribute` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-collecting-fruit` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-creating-diversion-and-escaping` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-defeating-but-sparing` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-discovering-cave-failure` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-discovering-cave-shelter` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-discovering-river` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-exploring-arena` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-fishing` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-hallucinate-a-tribute` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-hunting-for-food` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-ignoring-distant-smoke` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-make-knife` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-make-stone-hand-axe` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-overhearing-conversation` | Trio | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-picking-flowers` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-poison-a-tribute` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-practising-weaponry` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-pricked-by-thorns` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-questioning-sanity` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-raiding-unattended-camp` | Trio | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-reaching-higher-ground` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-scaring-off-another-tribute` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-searching-for-firewood` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-searching-for-water` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-sleeping-through-day` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-sneaking-a-nap` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-spearfishing` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-splitting-up-to-search` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-stalking-another-tribute` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-theft-while-distracted` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-thinking-about-home` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `day-working-together` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `fishing-gear-catch` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `forages-for-resources` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `greatsword-charge` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `identifies-wild-berries` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `identifies-wild-mushrooms` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `keep-watch-truce-4` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `keep-watch-truce-5` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `keep-watch-truce-6` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `longbow-shot` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `night-accidental-burning-blanket-panic` | Pair | 2243 | 2243 | 0 | 0 | 0.0% | participant-or-item-infeasible (1987) |
| `night-accidental-smoke-filled-shelter` | Solo | 2243 | 2243 | 0 | 0 | 0.0% | participant-or-item-infeasible (1987) |
| `night-fatal-poisoned-shared-meal` | Pair | 2243 | 2243 | 0 | 0 | 0.0% | participant-or-item-infeasible (1987) |
| `night-ghost-stories` | Four-plus | 2243 | 2076 | 0 | 0 | 0.0% | participant-or-item-infeasible (1861) |
| `night-sleeping-shifts-four` | Four-plus | 2243 | 2076 | 0 | 0 | 0.0% | participant-or-item-infeasible (1861) |
| `pike-charge` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `poison-vial-attack` | Pair | 2243 | 2243 | 0 | 0 | 0.0% | participant-or-item-infeasible (2118) |
| `poisonous-berries-joint-victory` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `raids-nest-for-eggs` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `river-current` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `romantic-truce-formation` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `rough-terrain` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `shield-used-for-everything-else` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `slingshot-chicken-hunt` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `slingshot-trick-shot` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `spear-attack` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `steals-drink-at-water-source` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `steals-fresh-meal` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `trap-kit-rabbit-hunt` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `travel-together-truce-2` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `travel-together-truce-3` | Trio | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `travel-together-truce-4` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `travel-together-truce-5` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `travel-together-truce-6` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `truce-betrayal-4` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `truce-betrayal-5` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `truce-betrayal-6` | Four-plus | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `upside-down-map` | Solo | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |
| `warhammer-attack` | Pair | 2243 | 0 | 0 | 0 | 0.0% | definition-ineligible (2243) |

#### Catalogue family

| Family | Selections | Games containing | Appearance | Pool share |
| --- | ---: | ---: | ---: | ---: |
| night | 823 | 100 | 100.0% | 36.1% |
| environmental | 292 | 100 | 100.0% | 12.8% |
| survival | 234 | 99 | 99.0% | 10.3% |
| night-fatal | 217 | 92 | 92.0% | 9.5% |
| night-accidental-fatal | 185 | 87 | 87.0% | 8.1% |
| cornucopia-provisions | 179 | 98 | 98.0% | 7.8% |
| combat | 78 | 56 | 56.0% | 3.4% |
| standard-formation | 64 | 53 | 53.0% | 2.8% |
| theft | 45 | 42 | 42.0% | 2.0% |
| deprivation | 43 | 39 | 39.0% | 1.9% |
| standard-dissolution | 36 | 29 | 29.0% | 1.6% |
| standard-interaction | 35 | 30 | 30.0% | 1.5% |
| high-luck | 32 | 32 | 32.0% | 1.4% |
| Uncatalogued | 9 | 9 | 9.0% | 0.4% |
| romantic | 8 | 8 | 8.0% | 0.4% |
| tactical | 2 | 1 | 1.0% | 0.1% |

#### Event definitions

| Event | Family | Selections | Games containing | Appearance | Pool share | Avg/game | Fatal selections | Eliminations | Solo | Pair | Trio | Four-plus |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `freezing-night` | environmental | 105 | 95 | 95.0% | 4.6% | 1.05 | 105 | 105 | 105 | 0 | 0 | 0 |
| `uses-cornucopia-provisions-water` | cornucopia-provisions | 92 | 89 | 89.0% | 4.0% | 0.92 | 0 | 0 | 92 | 0 | 0 | 0 |
| `finds-hiding-place` | survival | 91 | 88 | 88.0% | 4.0% | 0.91 | 0 | 0 | 91 | 0 | 0 | 0 |
| `uses-cornucopia-provisions-food` | cornucopia-provisions | 87 | 83 | 83.0% | 3.8% | 0.87 | 0 | 0 | 87 | 0 | 0 | 0 |
| `cold-rain` | environmental | 78 | 77 | 77.0% | 3.4% | 0.78 | 0 | 0 | 78 | 0 | 0 | 0 |
| `night-starting-fire` | night | 62 | 61 | 61.0% | 2.7% | 0.62 | 0 | 0 | 62 | 0 | 0 | 0 |
| `fallen-cliff` | environmental | 59 | 53 | 53.0% | 2.6% | 0.59 | 59 | 59 | 59 | 0 | 0 | 0 |
| `cave-shelter-collapse` | survival | 55 | 54 | 54.0% | 2.4% | 0.55 | 6 | 6 | 55 | 0 | 0 | 0 |
| `night-setting-up-camp` | night | 52 | 52 | 52.0% | 2.3% | 0.52 | 0 | 0 | 52 | 0 | 0 | 0 |
| `night-sleeping-in-tree` | night | 52 | 52 | 52.0% | 2.3% | 0.52 | 0 | 0 | 52 | 0 | 0 | 0 |
| `deep-cut` | environmental | 50 | 49 | 49.0% | 2.2% | 0.50 | 0 | 0 | 50 | 0 | 0 | 0 |
| `night-passing-out-exhausted` | night | 46 | 45 | 45.0% | 2.0% | 0.46 | 0 | 0 | 46 | 0 | 0 | 0 |
| `keep-watch-truce-2` | standard-formation | 45 | 45 | 45.0% | 2.0% | 0.45 | 0 | 0 | 0 | 45 | 0 | 0 |
| `night-fatal-drowned-at-river` | night-fatal | 45 | 44 | 44.0% | 2.0% | 0.45 | 45 | 45 | 0 | 45 | 0 | 0 |
| `steal-from-stronger-tribute` | theft | 45 | 42 | 42.0% | 2.0% | 0.45 | 4 | 4 | 0 | 45 | 0 | 0 |
| `finds-dry-rock-overhang` | survival | 43 | 42 | 42.0% | 1.9% | 0.43 | 0 | 0 | 43 | 0 | 0 | 0 |
| `night-comfortable-bush` | night | 43 | 43 | 43.0% | 1.9% | 0.43 | 0 | 0 | 43 | 0 | 0 | 0 |
| `night-natural-wound-treatment` | night | 42 | 42 | 42.0% | 1.8% | 0.42 | 0 | 0 | 42 | 0 | 0 | 0 |
| `night-fatal-cry-from-ravine` | night-fatal | 41 | 40 | 40.0% | 1.8% | 0.41 | 41 | 41 | 0 | 41 | 0 | 0 |
| `night-simply-sleeping` | night | 40 | 39 | 39.0% | 1.8% | 0.40 | 0 | 0 | 40 | 0 | 0 | 0 |
| `night-truce` | night | 39 | 39 | 39.0% | 1.7% | 0.39 | 0 | 0 | 0 | 39 | 0 | 0 |
| `night-huddling-for-warmth` | night | 38 | 38 | 38.0% | 1.7% | 0.38 | 0 | 0 | 0 | 38 | 0 | 0 |
| `cannot-find-shelter` | survival | 35 | 35 | 35.0% | 1.5% | 0.35 | 0 | 0 | 35 | 0 | 0 | 0 |
| `night-fatal-rock-from-darkness` | night-fatal | 34 | 34 | 34.0% | 1.5% | 0.34 | 34 | 34 | 0 | 34 | 0 | 0 |
| `night-seeing-distant-fire` | night | 34 | 33 | 33.0% | 1.5% | 0.34 | 0 | 0 | 34 | 0 | 0 | 0 |
| `night-accidental-startled-over-edge` | night-accidental-fatal | 33 | 33 | 33.0% | 1.4% | 0.33 | 33 | 33 | 0 | 33 | 0 | 0 |
| `night-fatal-cut-loose-from-tree` | night-fatal | 32 | 31 | 31.0% | 1.4% | 0.32 | 32 | 32 | 0 | 32 | 0 | 0 |
| `night-sleeping-without-fire` | night | 32 | 32 | 32.0% | 1.4% | 0.32 | 0 | 0 | 32 | 0 | 0 | 0 |
| `unexpected-pep-talk` | high-luck | 32 | 32 | 32.0% | 1.4% | 0.32 | 0 | 0 | 32 | 0 | 0 | 0 |
| `night-becoming-lost` | night | 31 | 31 | 31.0% | 1.4% | 0.31 | 0 | 0 | 31 | 0 | 0 | 0 |
| `night-sleeping-shifts-two` | night | 29 | 29 | 29.0% | 1.3% | 0.29 | 0 | 0 | 0 | 29 | 0 | 0 |
| `night-accidental-wrong-tree` | night-accidental-fatal | 28 | 28 | 28.0% | 1.2% | 0.28 | 28 | 28 | 28 | 0 | 0 | 0 |
| `amicable-truce-separation-2` | standard-dissolution | 27 | 23 | 23.0% | 1.2% | 0.27 | 0 | 0 | 0 | 27 | 0 | 0 |
| `night-singing-to-sleep` | night | 27 | 27 | 27.0% | 1.2% | 0.27 | 0 | 0 | 27 | 0 | 0 | 0 |
| `night-accidental-rock-thrown-at-noise` | night-accidental-fatal | 26 | 25 | 25.0% | 1.1% | 0.26 | 26 | 26 | 0 | 26 | 0 | 0 |
| `night-fatal-collapsing-cave-entrance` | night-fatal | 26 | 25 | 25.0% | 1.1% | 0.26 | 26 | 26 | 0 | 26 | 0 | 0 |
| `protects-truce-partner` | standard-interaction | 25 | 25 | 25.0% | 1.1% | 0.25 | 3 | 3 | 0 | 25 | 0 | 0 |
| `night-crying-to-sleep` | night | 24 | 24 | 24.0% | 1.1% | 0.24 | 0 | 0 | 24 | 0 | 0 | 0 |
| `night-nightmares` | night | 24 | 23 | 23.0% | 1.1% | 0.24 | 0 | 0 | 24 | 0 | 0 | 0 |
| `night-telling-stories` | night | 24 | 24 | 24.0% | 1.1% | 0.24 | 0 | 0 | 0 | 24 | 0 | 0 |
| `night-looking-at-sky` | night | 23 | 23 | 23.0% | 1.0% | 0.23 | 0 | 0 | 23 | 0 | 0 | 0 |
| `becomes-thirsty` | deprivation | 22 | 22 | 22.0% | 1.0% | 0.22 | 0 | 0 | 22 | 0 | 0 | 0 |
| `night-accidental-both-swing-at-once` | night-accidental-fatal | 22 | 22 | 22.0% | 1.0% | 0.22 | 22 | 22 | 0 | 22 | 0 | 0 |
| `night-staying-awake` | night | 22 | 22 | 22.0% | 1.0% | 0.22 | 0 | 0 | 22 | 0 | 0 | 0 |
| `becomes-hungry` | deprivation | 21 | 21 | 21.0% | 0.9% | 0.21 | 0 | 0 | 21 | 0 | 0 | 0 |
| `night-accidental-fatal-tree-fall` | night-accidental-fatal | 21 | 20 | 20.0% | 0.9% | 0.21 | 21 | 21 | 21 | 0 | 0 | 0 |
| `night-discussing-survivors` | night | 21 | 21 | 21.0% | 0.9% | 0.21 | 0 | 0 | 0 | 21 | 0 | 0 |
| `night-thinking-about-victory` | night | 21 | 21 | 21.0% | 0.9% | 0.21 | 0 | 0 | 21 | 0 | 0 | 0 |
| `keep-watch-truce-3` | standard-formation | 19 | 19 | 19.0% | 0.8% | 0.19 | 0 | 0 | 0 | 0 | 19 | 0 |
| `night-sparing-opponent` | night | 19 | 19 | 19.0% | 0.8% | 0.19 | 0 | 0 | 0 | 19 | 0 | 0 |
| `night-accidental-mistaken-for-dinner` | night-accidental-fatal | 18 | 18 | 18.0% | 0.8% | 0.18 | 18 | 18 | 0 | 18 | 0 | 0 |
| `night-accidental-sleepwalking-into-river` | night-accidental-fatal | 18 | 18 | 18.0% | 0.8% | 0.18 | 18 | 18 | 18 | 0 | 0 | 0 |
| `night-screaming-for-help` | night | 18 | 18 | 18.0% | 0.8% | 0.18 | 0 | 0 | 18 | 0 | 0 | 0 |
| `bow-shot` | combat | 16 | 15 | 15.0% | 0.7% | 0.16 | 11 | 11 | 0 | 16 | 0 | 0 |
| `knife-ambush` | combat | 16 | 16 | 16.0% | 0.7% | 0.16 | 13 | 13 | 0 | 16 | 0 | 0 |
| `night-holding-hands` | night | 15 | 15 | 15.0% | 0.7% | 0.15 | 0 | 0 | 0 | 15 | 0 | 0 |
| `night-snuggling` | night | 14 | 14 | 14.0% | 0.6% | 0.14 | 0 | 0 | 0 | 14 | 0 | 0 |
| `night-quiet-humming` | night | 13 | 13 | 13.0% | 0.6% | 0.13 | 0 | 0 | 13 | 0 | 0 | 0 |
| `night-fatal-fake-emergency` | night-fatal | 12 | 12 | 12.0% | 0.5% | 0.12 | 12 | 12 | 0 | 12 | 0 | 0 |
| `rapier-lunge` | combat | 11 | 10 | 10.0% | 0.5% | 0.11 | 8 | 8 | 0 | 11 | 0 | 0 |
| `truce-betrayal-2` | standard-interaction | 10 | 10 | 10.0% | 0.4% | 0.10 | 2 | 2 | 0 | 10 | 0 | 0 |
| `uses-shelter-supplies` | survival | 10 | 9 | 9.0% | 0.4% | 0.10 | 0 | 0 | 10 | 0 | 0 | 0 |
| `amicable-truce-separation-3` | standard-dissolution | 9 | 9 | 9.0% | 0.4% | 0.09 | 0 | 0 | 0 | 0 | 9 | 0 |
| `club-attack` | combat | 9 | 9 | 9.0% | 0.4% | 0.09 | 7 | 7 | 0 | 9 | 0 | 0 |
| `night-prepared-cave-shelter` | Uncatalogued | 9 | 9 | 9.0% | 0.4% | 0.09 | 0 | 0 | 9 | 0 | 0 | 0 |
| `longsword-attack` | combat | 8 | 7 | 7.0% | 0.4% | 0.08 | 5 | 5 | 0 | 8 | 0 | 0 |
| `short-sword-duel` | combat | 8 | 8 | 8.0% | 0.4% | 0.08 | 3 | 3 | 0 | 8 | 0 | 0 |
| `night-accidental-pushed-while-dreaming` | night-accidental-fatal | 6 | 6 | 6.0% | 0.3% | 0.06 | 6 | 6 | 0 | 6 | 0 | 0 |
| `night-fatal-chopped-from-tree` | night-fatal | 6 | 6 | 6.0% | 0.3% | 0.06 | 3 | 3 | 0 | 6 | 0 | 0 |
| `night-accidental-overengineered-alarm` | night-accidental-fatal | 5 | 5 | 5.0% | 0.2% | 0.05 | 5 | 5 | 0 | 5 | 0 | 0 |
| `night-cooking-provisions` | night | 5 | 5 | 5.0% | 0.2% | 0.05 | 0 | 0 | 5 | 0 | 0 | 0 |
| `night-fatal-betrayal-on-watch` | night-fatal | 5 | 5 | 5.0% | 0.2% | 0.05 | 5 | 5 | 0 | 5 | 0 | 0 |
| `night-fatal-snoring-problem` | night-fatal | 5 | 5 | 5.0% | 0.2% | 0.05 | 5 | 5 | 0 | 5 | 0 | 0 |
| `crossbow-attack` | combat | 4 | 4 | 4.0% | 0.2% | 0.04 | 4 | 4 | 0 | 4 | 0 | 0 |
| `hand-axe-attack` | combat | 4 | 4 | 4.0% | 0.2% | 0.04 | 3 | 3 | 0 | 4 | 0 | 0 |
| `night-fatal-sent-to-check-noise` | night-fatal | 4 | 4 | 4.0% | 0.2% | 0.04 | 4 | 4 | 0 | 4 | 0 | 0 |
| `night-singing-together` | night | 4 | 4 | 4.0% | 0.2% | 0.04 | 0 | 0 | 0 | 0 | 4 | 0 |
| `romantic-night-truce-formation` | romantic | 4 | 4 | 4.0% | 0.2% | 0.04 | 0 | 0 | 0 | 4 | 0 | 0 |
| `night-accidental-kicked-burning-log` | night-accidental-fatal | 3 | 3 | 3.0% | 0.1% | 0.03 | 3 | 3 | 0 | 3 | 0 | 0 |
| `night-accidental-returning-watchkeeper` | night-accidental-fatal | 3 | 3 | 3.0% | 0.1% | 0.03 | 3 | 3 | 0 | 3 | 0 | 0 |
| `night-fatal-rolled-into-fire` | night-fatal | 3 | 3 | 3.0% | 0.1% | 0.03 | 3 | 3 | 0 | 3 | 0 | 0 |
| `night-sleeping-shifts-three` | night | 3 | 3 | 3.0% | 0.1% | 0.03 | 0 | 0 | 0 | 0 | 3 | 0 |
| `romantic-partner-protection` | romantic | 3 | 3 | 3.0% | 0.1% | 0.03 | 0 | 0 | 0 | 3 | 0 | 0 |
| `night-defending-fire` | night | 2 | 2 | 2.0% | 0.1% | 0.02 | 0 | 0 | 0 | 0 | 0 | 2 |
| `night-discussing-morning` | night | 2 | 2 | 2.0% | 0.1% | 0.02 | 0 | 0 | 0 | 0 | 2 | 0 |
| `night-fatal-fake-emergency-bow` | night-fatal | 2 | 2 | 2.0% | 0.1% | 0.02 | 2 | 2 | 0 | 2 | 0 | 0 |
| `night-sharing-shelter` | night | 2 | 2 | 2.0% | 0.1% | 0.02 | 0 | 0 | 0 | 2 | 0 | 0 |
| `trident-attack` | combat | 2 | 2 | 2.0% | 0.1% | 0.02 | 2 | 2 | 0 | 2 | 0 | 0 |
| `firebomb-attack` | tactical | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `night-accidental-falling-tree-firewood` | night-accidental-fatal | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `night-accidental-overloaded-shelter` | night-accidental-fatal | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `night-fatal-firelight-ambush` | night-fatal | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `night-fatal-smothered-beneath-blanket` | night-fatal | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |
| `poisonous-berries-joint-victory` | romantic | 1 | 1 | 1.0% | 0.0% | 0.01 | 0 | 0 | 0 | 1 | 0 | 0 |
| `tripwire-attack` | tactical | 1 | 1 | 1.0% | 0.0% | 0.01 | 1 | 1 | 0 | 1 | 0 | 0 |

#### High-frequency definitions

Appearing in at least 75% of games:

- `cold-rain`
- `finds-hiding-place`
- `freezing-night`
- `uses-cornucopia-provisions-food`
- `uses-cornucopia-provisions-water`

Appearing in at least 50% of games:

- `cave-shelter-collapse`
- `cold-rain`
- `fallen-cliff`
- `finds-hiding-place`
- `freezing-night`
- `night-setting-up-camp`
- `night-sleeping-in-tree`
- `night-starting-fire`
- `uses-cornucopia-provisions-food`
- `uses-cornucopia-provisions-water`

Appearing in at least 25% of games:

- `cannot-find-shelter`
- `cave-shelter-collapse`
- `cold-rain`
- `deep-cut`
- `fallen-cliff`
- `finds-dry-rock-overhang`
- `finds-hiding-place`
- `freezing-night`
- `keep-watch-truce-2`
- `night-accidental-rock-thrown-at-noise`
- `night-accidental-startled-over-edge`
- `night-accidental-wrong-tree`
- `night-becoming-lost`
- `night-comfortable-bush`
- `night-fatal-collapsing-cave-entrance`
- `night-fatal-cry-from-ravine`
- `night-fatal-cut-loose-from-tree`
- `night-fatal-drowned-at-river`
- `night-fatal-rock-from-darkness`
- `night-huddling-for-warmth`
- `night-natural-wound-treatment`
- `night-passing-out-exhausted`
- `night-seeing-distant-fire`
- `night-setting-up-camp`
- `night-simply-sleeping`
- `night-singing-to-sleep`
- `night-sleeping-in-tree`
- `night-sleeping-shifts-two`
- `night-sleeping-without-fire`
- `night-starting-fire`
- `night-truce`
- `protects-truce-partner`
- `steal-from-stronger-tribute`
- `unexpected-pep-talk`
- `uses-cornucopia-provisions-food`
- `uses-cornucopia-provisions-water`

#### Never selected

- `amicable-truce-separation-4`
- `amicable-truce-separation-5`
- `amicable-truce-separation-6`
- `bear-trap-attack`
- `blowgun-poison-attack`
- `keep-watch-truce-4`
- `keep-watch-truce-5`
- `keep-watch-truce-6`
- `night-accidental-burning-blanket-panic`
- `night-accidental-smoke-filled-shelter`
- `night-fatal-poisoned-shared-meal`
- `night-fatal-sleeping-bag-canoe`
- `night-ghost-stories`
- `night-sleeping-shifts-four`
- `poison-vial-attack`
- `truce-betrayal-3`
- `truce-betrayal-4`
- `truce-betrayal-5`
- `truce-betrayal-6`
