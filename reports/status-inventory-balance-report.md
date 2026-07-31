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
| Half Game average length | PASS | 11.30 | greater than 1 and less than 50 rounds |
| Full Game average length | PASS | 17.05 | greater than 1 and less than 50 rounds |
| Day 1 elimination share | PASS | 53.4% | at least 45% and no more than 60% |
| Direct combat exercises success and failure | PASS | 328 successes / 128 failures | at least one of each |
| Tactical offense is exercised | PASS | 3 | at least one attempt |
| Items are acquired | PASS | 2616 | at least one acquisition |
| Remaining limited-use items are consumed | PASS | 20 | at least one consumed use |
| Theft transfers occur | PASS | 153 | at least one transfer |
| Death-loot transfers occur | PASS | 928 | at least one transfer |
| Unsupported sponsor acquisitions remain absent | PASS | 0 | 0 |
| Status mechanics are exercised | PASS | 12487 | at least one application |
| Event-driven night rest is exercised | PASS | 9821 | at least one recorded rest outcome |
| All night-rest qualities are exercised | PASS | 75 comfortable / 1899 sheltered / 7847 unsheltered | at least one of each |
| Morning rest resolution is exercised | PASS | 9310 | at least one resolution |
| Both morning rest consequences are exercised | PASS | 7687 exhausted / 1882 well-rested | at least one of each |
| Protected and unsheltered rest both remain meaningful | PASS | 20.1% | protected rest between 10% and 95% |
| Hunger and thirst occur sometimes | PASS | 144 hungry / 159 thirsty | at least one application of each across the deterministic batch |
| Deprivation statuses never occur before eligibility | PASS | 0 premature hungry / 0 premature thirsty | 0 premature applications |
| Eligibility does not guarantee a deprivation event | PASS | 144/4699 hunger; 159/4744 thirst | applications lower than tribute-round eligibility opportunities |
| Hunger and thirst do not dominate later play | PASS | 2.9% | greater than 0% and no more than 20% of primary events |
| Hunger and thirst can both be resolved | PASS | 35 hunger / 33 thirst | at least one resolution of each |
| Authored resource theft exercises attempts and successes | PASS | 26/48 food; 20/43 water | at least one attempt and success for each need |
| Legacy food and water inventory remains absent | PASS | 0 | 0 acquisitions |
| No automatic starvation or dehydration deaths occur | PASS | 0 | 0 fatalities |
| Event family: cornucopia-provisions | PASS | 432 | at least one event |
| Event family: deprivation | PASS | 303 | at least one event |
| Event family: day-authored-01-15 | PASS | 588 | at least one event |
| Event family: day-authored-16-33 | PASS | 883 | at least one event |
| Event family: day-weapon-crafting | PASS | 259 | at least one event |
| Event family: food-theft | PASS | 48 | at least one event |
| Event family: water-theft | PASS | 43 | at least one event |
| Event family: combat | PASS | 456 | at least one event |
| Event family: tactical | PASS | 3 | at least one event |
| Event family: theft | PASS | 148 | at least one event |
| Event family: environmental | PASS | 1358 | at least one event |
| Event family: survival | PASS | 524 | at least one event |
| Event family: night-accidental-fatal | PASS | 273 | at least one event |
| Event family: night-fatal | PASS | 392 | at least one event |
| Event family: night | PASS | 1382 | at least one event |
| Event family: hunting | PASS | 38 | at least one event |
| Event family: foraging | PASS | 108 | at least one event |
| Event family: item-use | PASS | 11 | at least one event |
| Event family: high-luck | PASS | 31 | at least one event |
| Event family: standard-formation | PASS | 103 | at least one event |
| Event family: standard-interaction | PASS | 38 | at least one event |
| Event family: Bloodbath — cornucopia-acquisition | PASS | 101 | at least one event |
| Event family: Bloodbath — cornucopia-flavour-acquisition | PASS | 52 | at least one event |
| Event family: Bloodbath — cornucopia-fatal-authored | PASS | 1869 | at least one event |
| Event family: Bloodbath — cornucopia-pair-conflict | PASS | 18 | at least one event |
| Event family: Bloodbath — cornucopia-group-conflict | PASS | 8 | at least one event |
| Event family: Bloodbath — cornucopia-nonfatal-interaction | PASS | 125 | at least one event |
| Event family: Bloodbath — flee | PASS | 632 | at least one event |

## Game length

| Size | Games | Completion | Average | Median | P90 | Minimum | Maximum | Avg. primary events | Avg. eliminations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Half Game | 200 | 100.0% | 11.30 | 11.00 | 14.00 | 7 | 16 | 23.93 | 10.99 |
| Full Game | 100 | 100.0% | 17.05 | 17.00 | 20.00 | 12 | 22 | 56.53 | 22.97 |

## Victory and eliminations

- Sole victories: 296 (98.7%)
- Joint victories: 4 (1.3%)
- Total eliminations: 4496
- Day 1 eliminations: 2401 (53.4%)

| Elimination source | Count |
| --- | ---: |
| bloodbath | 2401 |
| other | 1502 |
| direct-combat | 328 |
| status | 264 |
| tactical-immediate | 1 |

## Combat

- Direct attacks: 456
- Direct successes: 328
- Direct failures: 128
- Direct success rate: 71.9%
- Tactical attempts: 3
- Tactical connections: 3
- Tactical connection rate: 100.0%
- Low-Brawn tactical attempts: 2
- Delayed attributed fatalities: 34
- Safety resolutions: 662

## Preparation

- Total preparation events: 15922
- Borrowed-item preparation events: 0

| Mechanic | Events |
| --- | ---: |
| morning-rest-resolution | 9310 |
| night-rest-preparation | 6607 |
| camouflage-preparation | 4 |
| medical-treatment | 1 |

### Rest quality

- Total recorded outcomes: 9821
- Comfortable: 75 (0.8%)
- Sheltered: 1899 (19.3%)
- Unsheltered: 7847 (79.9%)

### Camouflage

- Successful: 4
- Unsuccessful: 0
- Harmful failures: 0

## Food, water, and deprivation

- Food satisfaction events: 2068
- Water satisfaction events: 1934
- Hunger eligibility opportunities: 4699
- Thirst eligibility opportunities: 4744
- Hungry applications: 144
- Thirsty applications: 159
- Hunger resolutions: 35
- Thirst resolutions: 33
- Food theft: 26/48 successes
- Water theft: 20/43 successes
- Deprivation primary-event rate: 2.9%
- Legacy food/water acquisitions: 0
- Automatic deprivation fatalities: 0

## Statuses

- Total applications: 12487

### Applications

| Status | Applications |
| --- | ---: |
| Exhausted | 7687 |
| Well Rested | 1882 |
| Hidden | 724 |
| Injured | 484 |
| Alert | 283 |
| Bleeding | 247 |
| Hunted | 213 |
| Disoriented | 209 |
| Inspired | 203 |
| Thirsty | 159 |
| Hungry | 144 |
| Well Fed | 113 |
| Poisoned | 96 |
| Burned | 43 |

### Status fatalities

| Status | Fatalities |
| --- | ---: |
| Bleeding | 188 |
| Poisoned | 76 |

## Inventory

- Total acquisitions: 2616
- Average acquisitions per game: 8.72
- Total consumed uses: 20
- Average consumed uses per game: 0.07
- Total transfers: 1218
- Average transfers per game: 4.06
- Distinct item definitions acquired: 53
- Never acquired: poison-mushrooms, energy-drink, med-kit, antidote, matches, camouflage-net, reinforced-armour

### Acquisition sources

| Source | Acquisitions |
| --- | ---: |
| cornucopia | 2378 |
| crafted | 167 |
| natural-foraging | 71 |

### Transfer sources

| Source | Transfers |
| --- | ---: |
| death-loot | 928 |
| theft | 153 |
| other | 137 |

### Most acquired items

| Item | Acquisitions |
| --- | ---: |
| Cornucopia provisions | 1650 |
| Knife | 153 |
| Bow and arrows | 112 |
| Spear | 82 |
| Club | 78 |
| Hand axe | 68 |
| Rapier | 66 |
| Dry kindling | 58 |
| Short sword | 51 |
| Trident | 37 |
| Longsword | 34 |
| Axe | 31 |
| Pike | 29 |
| Crossbow | 27 |
| Greatsword | 25 |

### Most consumed items

| Item | Uses consumed |
| --- | ---: |
| Dry kindling | 10 |
| Camouflage paint | 4 |
| Fishing gear | 2 |
| Bandages | 1 |
| Firebomb | 1 |
| Lighter | 1 |
| Poison vial | 1 |

## Event-family coverage

| Family | Events | Games represented | Events per game |
| --- | ---: | ---: | ---: |
| cornucopia-provisions | 432 | 257 | 1.44 |
| deprivation | 303 | 206 | 1.01 |
| day-authored-01-15 | 588 | 245 | 1.96 |
| day-authored-16-33 | 883 | 286 | 2.94 |
| day-weapon-crafting | 259 | 186 | 0.86 |
| food-theft | 48 | 48 | 0.16 |
| water-theft | 43 | 43 | 0.14 |
| combat | 456 | 215 | 1.52 |
| tactical | 3 | 3 | 0.01 |
| theft | 148 | 146 | 0.49 |
| environmental | 1358 | 299 | 4.53 |
| survival | 524 | 255 | 1.75 |
| night-accidental-fatal | 273 | 177 | 0.91 |
| night-fatal | 392 | 217 | 1.31 |
| night | 1382 | 291 | 4.61 |
| hunting | 38 | 38 | 0.13 |
| foraging | 108 | 93 | 0.36 |
| item-use | 11 | 11 | 0.04 |
| high-luck | 31 | 31 | 0.10 |
| standard-formation | 103 | 76 | 0.34 |
| standard-interaction | 38 | 33 | 0.13 |
| standard-dissolution | 183 | 156 | 0.61 |
| romantic | 21 | 19 | 0.07 |
| Bloodbath — cornucopia-acquisition | 101 | 99 | 0.34 |
| Bloodbath — cornucopia-flavour-acquisition | 52 | 51 | 0.17 |
| Bloodbath — cornucopia-fatal-authored | 1869 | 300 | 6.23 |
| Bloodbath — cornucopia-pair-conflict | 18 | 17 | 0.06 |
| Bloodbath — cornucopia-group-conflict | 8 | 8 | 0.03 |
| Bloodbath — cornucopia-nonfatal-interaction | 125 | 124 | 0.42 |
| Bloodbath — flee | 632 | 300 | 2.11 |

## Victor stat balance

- Average victor Brains: 3.33
- Average victor Brawn: 3.30
- Average victor Luck: 3.19

### Brains

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 586 | 31 | 5.3% |
| 2 | 824 | 41 | 5.0% |
| 3 | 1517 | 78 | 5.1% |
| 4 | 1295 | 106 | 8.2% |
| 5 | 578 | 48 | 8.3% |

### Brawn

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 905 | 45 | 5.0% |
| 2 | 1118 | 58 | 5.2% |
| 3 | 879 | 52 | 5.9% |
| 4 | 1089 | 59 | 5.4% |
| 5 | 809 | 90 | 11.1% |

### Luck

| Value | Appearances | Victories | Victory rate |
| ---: | ---: | ---: | ---: |
| 1 | 664 | 35 | 5.3% |
| 2 | 1091 | 62 | 5.7% |
| 3 | 1416 | 89 | 6.3% |
| 4 | 720 | 47 | 6.5% |
| 5 | 909 | 71 | 7.8% |
