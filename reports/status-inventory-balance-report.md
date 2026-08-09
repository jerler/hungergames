# Status and Inventory Balance Report

This report is generated from deterministic complete-game simulations. It is a diagnostic baseline rather than a claim that the game is perfectly balanced.

## Sample

- Total games: 300
- Half Games: 200
- Full Games: 100

## Guardrails

Overall result: **PASS**

| Check | Result | Actual | Expected |
| --- | --- | ---: | --- |
| Half Games complete | PASS | 100.0% | 100% |
| Full Games complete | PASS | 100.0% | 100% |
| Half Game average length | PASS | 9.04 | greater than 1 and less than 50 rounds |
| Full Game average length | PASS | 12.30 | greater than 1 and less than 50 rounds |
| Day 1 elimination share | PASS | 53.4% | at least 45% and no more than 60% |
| Direct combat exercises success and failure | PASS | 87 successes / 56 failures | at least one of each |
| Items are acquired | PASS | 2562 | at least one acquisition |
| Remaining limited-use items are consumed | PASS | 30 | at least one consumed use |
| Theft transfers occur | PASS | 149 | at least one transfer |
| Death-loot transfers occur | PASS | 1456 | at least one transfer |
| Unsupported sponsor acquisitions remain absent | PASS | 0 | 0 |
| Status mechanics are exercised | PASS | 9366 | at least one application |
| Event-driven night rest is exercised | PASS | 7405 | at least one recorded rest outcome |
| All night-rest qualities are exercised | PASS | 177 comfortable / 1292 sheltered / 5936 unsheltered | at least one of each |
| Morning rest resolution is exercised | PASS | 7107 | at least one resolution |
| Both morning rest consequences are exercised | PASS | 5927 exhausted / 1449 well-rested | at least one of each |
| Protected and unsheltered rest both remain meaningful | PASS | 19.8% | protected rest between 10% and 95% |
| Hunger and thirst occur sometimes | PASS | 53 hungry / 50 thirsty | at least one application of each across the deterministic batch |
| Deprivation statuses never occur before eligibility | PASS | 0 premature hungry / 0 premature thirsty | 0 premature applications |
| Eligibility does not guarantee a deprivation event | PASS | 53/2835 hunger; 50/2857 thirst | applications lower than tribute-round eligibility opportunities |
| Hunger and thirst do not dominate later play | PASS | 1.2% | greater than 0% and no more than 20% of primary events |
| Hunger and thirst can both be resolved | PASS | 14 hunger / 22 thirst | at least one resolution of each |
| Authored resource theft exercises attempts and successes | PASS | 5/13 food; 3/17 water | at least one attempt and success for each need |
| Legacy food and water inventory remains absent | PASS | 0 | 0 acquisitions |
| No automatic starvation or dehydration deaths occur | PASS | 0 | 0 fatalities |
| Event family: cornucopia-provisions | PASS | 201 | at least one event |
| Event family: deprivation | PASS | 103 | at least one event |
| Event family: status-specific | PASS | 211 | at least one event |
| Event family: day-authored-01-15 | PASS | 192 | at least one event |
| Event family: day-authored-16-33 | PASS | 297 | at least one event |
| Event family: day-weapon-crafting | PASS | 64 | at least one event |
| Event family: food-theft | PASS | 13 | at least one event |
| Event family: water-theft | PASS | 17 | at least one event |
| Event family: combat | PASS | 143 | at least one event |
| Event family: theft | PASS | 74 | at least one event |
| Event family: environmental | PASS | 508 | at least one event |
| Event family: survival | PASS | 284 | at least one event |
| Event family: night-accidental-fatal | PASS | 72 | at least one event |
| Event family: night-fatal | PASS | 110 | at least one event |
| Event family: night | PASS | 738 | at least one event |
| Event family: hunting | PASS | 18 | at least one event |
| Event family: foraging | PASS | 28 | at least one event |
| Event family: item-use | PASS | 8 | at least one event |
| Event family: high-brains | PASS | 627 | at least one event |
| Event family: low-brains | PASS | 167 | at least one event |
| Event family: high-brawn | PASS | 610 | at least one event |
| Event family: low-brawn | PASS | 348 | at least one event |
| Event family: high-luck | PASS | 365 | at least one event |
| Event family: low-luck | PASS | 126 | at least one event |
| Event family: mixed-stats | PASS | 125 | at least one event |
| Event family: standard-formation | PASS | 59 | at least one event |
| Event family: standard-interaction | PASS | 16 | at least one event |
| Event family: Bloodbath — cornucopia-acquisition | PASS | 52 | at least one event |
| Event family: Bloodbath — cornucopia-flavour-acquisition | PASS | 97 | at least one event |
| Event family: Bloodbath — cornucopia-fatal-authored | PASS | 2072 | at least one event |
| Event family: Bloodbath — cornucopia-pair-conflict | PASS | 17 | at least one event |
| Event family: Bloodbath — cornucopia-group-conflict | PASS | 12 | at least one event |
| Event family: Bloodbath — cornucopia-nonfatal-interaction | PASS | 132 | at least one event |
| Event family: Bloodbath — flee | PASS | 642 | at least one event |

## Game length

| Size | Games | Completion | Average | Median | P90 | Minimum | Maximum | Avg. primary events | Avg. eliminations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Half Game | 200 | 100.0% | 9.04 | 9.00 | 11.00 | 6 | 13 | 21.18 | 11.00 |
| Full Game | 100 | 100.0% | 12.30 | 12.00 | 14.00 | 9 | 17 | 44.78 | 22.99 |

## Victory and eliminations

- Sole victories: 299 (99.7%)
- Joint victories: 1 (0.3%)
- Total eliminations: 4499
- Day 1 eliminations: 2401 (53.4%)

| Elimination source | Count |
| --- | ---: |
| bloodbath | 2401 |
| other | 1897 |
| status | 114 |
| direct-combat | 87 |

## Combat

- Direct attacks: 143
- Direct successes: 87
- Direct failures: 56
- Direct success rate: 60.8%
- Tactical attempts: 1
- Tactical connections: 1
- Tactical connection rate: 100.0%
- Low-Brawn tactical attempts: 0
- Delayed attributed fatalities: 10
- Safety resolutions: 224

## Preparation

- Total preparation events: 12318
- Borrowed-item preparation events: 0

| Mechanic | Events |
| --- | ---: |
| morning-rest-resolution | 7107 |
| night-rest-preparation | 5191 |
| camouflage-preparation | 15 |
| medical-treatment | 5 |

### Rest quality

- Total recorded outcomes: 7405
- Comfortable: 177 (2.4%)
- Sheltered: 1292 (17.4%)
- Unsheltered: 5936 (80.2%)

### Camouflage

- Successful: 11
- Unsuccessful: 4
- Harmful failures: 0

## Food, water, and deprivation

- Food satisfaction events: 1656
- Water satisfaction events: 1652
- Hunger eligibility opportunities: 2835
- Thirst eligibility opportunities: 2857
- Hungry applications: 53
- Thirsty applications: 50
- Hunger resolutions: 14
- Thirst resolutions: 22
- Food theft: 5/13 successes
- Water theft: 3/17 successes
- Deprivation primary-event rate: 1.2%
- Legacy food/water acquisitions: 0
- Automatic deprivation fatalities: 0

## Statuses

- Total applications: 9366

### Applications

| Status | Applications |
| --- | ---: |
| Exhausted | 5927 |
| Well Rested | 1449 |
| Injured | 659 |
| Hidden | 426 |
| Alert | 212 |
| Bleeding | 125 |
| Disoriented | 117 |
| Hunted | 111 |
| Poisoned | 77 |
| Inspired | 76 |
| Well Fed | 69 |
| Hungry | 53 |
| Thirsty | 50 |
| Burned | 11 |
| Lucky | 4 |

### Status fatalities

| Status | Fatalities |
| --- | ---: |
| Bleeding | 84 |
| Poisoned | 30 |

## Inventory

- Total acquisitions: 2562
- Average acquisitions per game: 8.54
- Total consumed uses: 30
- Average consumed uses per game: 0.10
- Total transfers: 1746
- Average transfers per game: 5.82
- Distinct item definitions acquired: 55
- Never acquired: hallucinogenic-berries, hallucinogenic-mushrooms, poison-mushrooms, antidote, night-vision-goggles

### Acquisition sources

| Source | Acquisitions |
| --- | ---: |
| cornucopia | 2514 |
| crafted | 27 |
| natural-foraging | 21 |

### Transfer sources

| Source | Transfers |
| --- | ---: |
| death-loot | 1456 |
| theft | 149 |
| other | 141 |

### Most acquired items

| Item | Acquisitions |
| --- | ---: |
| Cornucopia provisions | 1639 |
| Knife | 142 |
| Bow and arrows | 85 |
| Spear | 85 |
| Short sword | 64 |
| Rapier | 57 |
| Axe | 40 |
| Trident | 37 |
| Club | 35 |
| Hand axe | 35 |
| Crossbow | 34 |
| Pike | 33 |
| Longsword | 27 |
| Greatsword | 26 |
| Longbow | 25 |

### Most consumed items

| Item | Uses consumed |
| --- | ---: |
| Camouflage paint | 7 |
| Energy drink | 5 |
| Lighter | 4 |
| Med kit | 4 |
| Bandages | 2 |
| Matches | 2 |
| Firebomb | 1 |
| Herbal tea | 1 |
| Dry kindling | 1 |
| Arena map | 1 |
| Painkillers | 1 |
| Poison vial | 1 |

## Event-family coverage

| Family | Events | Games represented | Events per game |
| --- | ---: | ---: | ---: |
| cornucopia-provisions | 201 | 156 | 0.67 |
| deprivation | 103 | 96 | 0.34 |
| status-specific | 211 | 160 | 0.70 |
| day-authored-01-15 | 192 | 143 | 0.64 |
| day-authored-16-33 | 297 | 190 | 0.99 |
| day-weapon-crafting | 64 | 62 | 0.21 |
| food-theft | 13 | 13 | 0.04 |
| water-theft | 17 | 17 | 0.06 |
| combat | 143 | 105 | 0.48 |
| tactical | 1 | 1 | 0.00 |
| theft | 74 | 74 | 0.25 |
| environmental | 508 | 255 | 1.69 |
| survival | 284 | 196 | 0.95 |
| night-accidental-fatal | 72 | 65 | 0.24 |
| night-fatal | 110 | 92 | 0.37 |
| night | 738 | 271 | 2.46 |
| hunting | 18 | 18 | 0.06 |
| foraging | 28 | 28 | 0.09 |
| item-use | 8 | 8 | 0.03 |
| high-brains | 627 | 248 | 2.09 |
| low-brains | 167 | 120 | 0.56 |
| high-brawn | 610 | 247 | 2.03 |
| low-brawn | 348 | 198 | 1.16 |
| high-luck | 365 | 205 | 1.22 |
| low-luck | 126 | 111 | 0.42 |
| mixed-stats | 125 | 108 | 0.42 |
| standard-formation | 59 | 53 | 0.20 |
| standard-interaction | 16 | 15 | 0.05 |
| standard-dissolution | 1 | 1 | 0.00 |
| romantic | 5 | 5 | 0.02 |
| Bloodbath — cornucopia-acquisition | 52 | 52 | 0.17 |
| Bloodbath — cornucopia-flavour-acquisition | 97 | 92 | 0.32 |
| Bloodbath — cornucopia-fatal-authored | 2072 | 300 | 6.91 |
| Bloodbath — cornucopia-pair-conflict | 17 | 16 | 0.06 |
| Bloodbath — cornucopia-group-conflict | 12 | 12 | 0.04 |
| Bloodbath — cornucopia-nonfatal-interaction | 132 | 129 | 0.44 |
| Bloodbath — flee | 642 | 300 | 2.14 |

## Victor stat balance

- Average victor Brains: 3.19
- Average victor Brawn: 3.20
- Average victor Luck: 3.39

### Brains

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 586 | 24 | 4.1% |
| 2 | 824 | 56 | 6.8% |
| 3 | 1517 | 94 | 6.2% |
| 4 | 1295 | 94 | 7.3% |
| 5 | 578 | 33 | 5.7% |

### Brawn

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 905 | 46 | 5.1% |
| 2 | 1118 | 57 | 5.1% |
| 3 | 879 | 56 | 6.4% |
| 4 | 1089 | 74 | 6.8% |
| 5 | 809 | 68 | 8.4% |

### Luck

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 664 | 22 | 3.3% |
| 2 | 1091 | 50 | 4.6% |
| 3 | 1416 | 93 | 6.6% |
| 4 | 720 | 62 | 8.6% |
| 5 | 909 | 74 | 8.1% |
