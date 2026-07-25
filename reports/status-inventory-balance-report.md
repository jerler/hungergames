# Status and Inventory Balance Report

This report is generated from deterministic complete-game simulations. It is a diagnostic baseline rather than a claim that the game is perfectly balanced.

## Sample

- Total games: 300
- Half Games: 200
- Full Games: 100

## Guardrails

Overall result: **PASS**

| Check                                               | Result |                     Actual | Expected                               |
| --------------------------------------------------- | ------ | -------------------------: | -------------------------------------- |
| Half Games complete                                 | PASS   |                     100.0% | 100%                                   |
| Full Games complete                                 | PASS   |                     100.0% | 100%                                   |
| Half Game average length                            | PASS   |                       4.21 | greater than 1 and less than 50 rounds |
| Full Game average length                            | PASS   |                       4.60 | greater than 1 and less than 50 rounds |
| Day 1 elimination share                             | PASS   |                      51.0% | greater than 50% and no more than 100% |
| Direct combat exercises success and failure         | PASS   | 74 successes / 36 failures | at least one of each                   |
| Tactical offense is exercised                       | PASS   |                          2 | at least one attempt                   |
| Items are acquired                                  | PASS   |                       1916 | at least one acquisition               |
| Limited-use items are consumed                      | PASS   |                        617 | at least one consumed use              |
| Theft transfers occur                               | PASS   |                         48 | at least one transfer                  |
| Death-loot transfers occur                          | PASS   |                         37 | at least one transfer                  |
| Unsupported sponsor acquisitions remain absent      | PASS   |                          0 | 0                                      |
| Status mechanics are exercised                      | PASS   |                       3945 | at least one application               |
| Night-rest preparation is exercised                 | PASS   |                       4640 | at least one event                     |
| Event family: combat                                | PASS   |                        110 | at least one event                     |
| Event family: tactical                              | PASS   |                          2 | at least one event                     |
| Event family: theft                                 | PASS   |                         93 | at least one event                     |
| Event family: environmental                         | PASS   |                       1351 | at least one event                     |
| Event family: survival                              | PASS   |                        595 | at least one event                     |
| Event family: hunting                               | PASS   |                         46 | at least one event                     |
| Event family: foraging                              | PASS   |                        128 | at least one event                     |
| Event family: item-use                              | PASS   |                         13 | at least one event                     |
| Event family: high-luck                             | PASS   |                        168 | at least one event                     |
| Event family: standard-formation                    | PASS   |                        123 | at least one event                     |
| Event family: standard-interaction                  | PASS   |                          6 | at least one event                     |
| Event family: romantic                              | PASS   |                          5 | at least one event                     |
| Event family: Bloodbath — cornucopia-acquisition    | PASS   |                        269 | at least one event                     |
| Event family: Bloodbath — cornucopia-pair-conflict  | PASS   |                        135 | at least one event                     |
| Event family: Bloodbath — cornucopia-group-conflict | PASS   |                       1018 | at least one event                     |
| Event family: Bloodbath — flee                      | PASS   |                       1207 | at least one event                     |

## Game length

| Size      | Games | Completion | Average | Median |  P90 | Minimum | Maximum | Avg. primary events | Avg. eliminations |
| --------- | ----: | ---------: | ------: | -----: | ---: | ------: | ------: | ------------------: | ----------------: |
| Half Game |   200 |     100.0% |    4.21 |   4.00 | 5.00 |       4 |       7 |               13.34 |             11.00 |
| Full Game |   100 |     100.0% |    4.60 |   4.00 | 5.00 |       4 |       8 |               26.04 |             23.00 |

## Victory and eliminations

- Sole victories: 300 (100.0%)
- Joint victories: 0 (0.0%)
- Total eliminations: 4500
- Day 1 eliminations: 2297 (51.0%)

| Elimination source | Count |
| ------------------ | ----: |
| bloodbath          |  2297 |
| survival-need      |  1475 |
| other              |   497 |
| status             |   156 |
| direct-combat      |    74 |
| tactical-immediate |     1 |

## Combat

- Direct attacks: 110
- Direct successes: 74
- Direct failures: 36
- Direct success rate: 67.3%
- Tactical attempts: 2
- Tactical connections: 2
- Tactical connection rate: 100.0%
- Low-Brawn tactical attempts: 0
- Delayed attributed fatalities: 0
- Safety resolutions: 65

## Preparation

- Total preparation events: 7691
- Borrowed-item preparation events: 45

| Mechanic                | Events |
| ----------------------- | -----: |
| night-rest-preparation  |   4640 |
| morning-rest-resolution |   2489 |
| hydration-consumption   |    466 |
| food-consumption        |     60 |
| camouflage-preparation  |     34 |
| medical-treatment       |      2 |

### Rest quality

- Comfortable: 151
- Sheltered: 2340
- Unsheltered: 2149

### Camouflage

- Successful: 19
- Unsuccessful: 15
- Harmful failures: 3

## Statuses

- Total applications: 3945
- Dehydration deaths: 1475
- Starvation deaths: 0

### Applications

| Status      | Applications |
| ----------- | -----------: |
| Exhausted   |         2055 |
| Hidden      |          604 |
| Bleeding    |          269 |
| Injured     |          215 |
| Inspired    |          187 |
| Disoriented |          170 |
| Poisoned    |          142 |
| Well Rested |           79 |
| Dehydrated  |           73 |
| Burned      |           45 |
| Alert       |           43 |
| Hunted      |           41 |
| Lucky       |           15 |
| Well Fed    |            7 |

### Status fatalities

| Status   | Fatalities |
| -------- | ---------: |
| Poisoned |         81 |
| Bleeding |         75 |

## Inventory

- Total acquisitions: 1916
- Average acquisitions per game: 6.39
- Total consumed uses: 617
- Average consumed uses per game: 2.06
- Total transfers: 192
- Average transfers per game: 0.64
- Distinct item definitions acquired: 66
- Never acquired: chicken, fish, kindling

### Acquisition sources

| Source           | Acquisitions |
| ---------------- | -----------: |
| cornucopia       |         1072 |
| natural-foraging |          844 |

### Transfer sources

| Source     | Transfers |
| ---------- | --------: |
| other      |       107 |
| theft      |        48 |
| death-loot |        37 |

### Most acquired items

| Item           | Acquisitions |
| -------------- | -----------: |
| Wild fruit     |          409 |
| Fresh water    |          361 |
| Knife          |           47 |
| Rapier         |           46 |
| Crossbow       |           44 |
| Longbow        |           41 |
| Spear          |           40 |
| Short sword    |           38 |
| Trident        |           38 |
| Bow and arrows |           36 |
| Pike           |           36 |
| Warhammer      |           35 |
| Club           |           33 |
| Axe            |           30 |
| Eggs           |           30 |

### Most consumed items

| Item             | Uses consumed |
| ---------------- | ------------: |
| Fresh water      |           323 |
| Wild fruit       |            56 |
| Lighter          |            54 |
| Bottled water    |            52 |
| Soup             |            20 |
| Camouflage paint |            19 |
| Energy drink     |            15 |
| Hot chocolate    |            15 |
| Coca-Cola        |            14 |
| Coffee           |            14 |
| Herbal tea       |            13 |
| Matches          |            11 |
| Eggs             |             3 |
| Arena map        |             2 |
| Trap kit         |             2 |

## Event-family coverage

| Family                                | Events | Games represented | Events per game |
| ------------------------------------- | -----: | ----------------: | --------------: |
| combat                                |    110 |                87 |            0.37 |
| tactical                              |      2 |                 2 |            0.01 |
| theft                                 |     93 |                80 |            0.31 |
| environmental                         |   1351 |               300 |            4.50 |
| survival                              |    595 |               261 |            1.98 |
| hunting                               |     46 |                44 |            0.15 |
| foraging                              |    128 |               109 |            0.43 |
| item-use                              |     13 |                13 |            0.04 |
| high-luck                             |    168 |               129 |            0.56 |
| standard-formation                    |    123 |                95 |            0.41 |
| standard-interaction                  |      6 |                 6 |            0.02 |
| standard-dissolution                  |      3 |                 3 |            0.01 |
| romantic                              |      5 |                 5 |            0.02 |
| Bloodbath — cornucopia-acquisition    |    269 |               166 |            0.90 |
| Bloodbath — cornucopia-pair-conflict  |    135 |               130 |            0.45 |
| Bloodbath — cornucopia-group-conflict |   1018 |               300 |            3.39 |
| Bloodbath — flee                      |   1207 |               300 |            4.02 |

## Victor stat balance

- Average victor Brains: 3.11
- Average victor Brawn: 2.88
- Average victor Luck: 3.59

### Brains

| Value | Appearances | Victories | Victory rate |
| ----: | ----------: | --------: | -----------: |
|     1 |         604 |        46 |         7.6% |
|     2 |         778 |        50 |         6.4% |
|     3 |        1554 |        77 |         5.0% |
|     4 |        1267 |        79 |         6.2% |
|     5 |         597 |        48 |         8.0% |

### Brawn

| Value | Appearances | Victories | Victory rate |
| ----: | ----------: | --------: | -----------: |
|     1 |         929 |        64 |         6.9% |
|     2 |        1154 |        71 |         6.2% |
|     3 |         878 |        55 |         6.3% |
|     4 |        1062 |        56 |         5.3% |
|     5 |         777 |        54 |         6.9% |

### Luck

| Value | Appearances | Victories | Victory rate |
| ----: | ----------: | --------: | -----------: |
|     1 |         685 |        27 |         3.9% |
|     2 |        1110 |        41 |         3.7% |
|     3 |        1355 |        69 |         5.1% |
|     4 |         688 |        54 |         7.8% |
|     5 |         962 |       109 |        11.3% |
