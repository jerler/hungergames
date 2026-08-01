# Phase 7 — Full Stress and Invariant Validation

Generated from 270 deterministic games across 3 seed groups.

**Result:** PASS

## Seed groups and performance

| Group | Games | Total time | Average per game | Invariant failures |
| ----- | ----: | ---------: | ---------------: | -----------------: |
| alpha |    90 |     4.66 s |          51.8 ms |                  0 |
| beta  |    90 |     4.51 s |          50.1 ms |                  0 |
| gamma |    90 |     4.41 s |          49.0 ms |                  0 |

Slowest/fastest ratio: **1.06×**.

## Phase 1 comparison

### half-game

| Metric                    | Phase 1 | Phase 7 |    Change |
| ------------------------- | ------: | ------: | --------: |
| Cornucopia non-solo       |   43.9% |   73.2% |  +29.3 pp |
| Fleeing non-solo          |    5.2% |   57.1% |  +51.9 pp |
| Day 2+ non-solo           |   22.6% |   40.8% |  +18.2 pp |
| Cornucopia top five       |   59.2% |   31.3% |  -27.9 pp |
| Cornucopia top ten        |   81.7% |   46.3% |  -35.4 pp |
| Cornucopia median overlap |    2.00 |    1.00 | -100.0 pp |

### full-game

| Metric                    | Phase 1 | Phase 7 |    Change |
| ------------------------- | ------: | ------: | --------: |
| Cornucopia non-solo       |   58.9% |   86.4% |  +27.5 pp |
| Fleeing non-solo          |    7.3% |   73.8% |  +66.5 pp |
| Day 2+ non-solo           |   29.5% |   47.1% |  +17.6 pp |
| Cornucopia top five       |   49.5% |   21.3% |  -28.2 pp |
| Cornucopia top ten        |   68.3% |   40.7% |  -27.6 pp |
| Cornucopia median overlap |    5.00 |    3.00 | -200.0 pp |

## Fatality and completion

- Games reaching victory: 270/270
- Average opening elimination rate: 50.2%
- Minimum opening elimination rate: 41.7%
- Maximum opening elimination rate: 54.2%
- Sole victories: 269
- Joint victories: 1

## Guardrails

- Balance guardrails: 59/59 passed
- Distribution guardrails: 36/36 passed

## Validated invariants

- Every simulation passes game-state invariants after every round.
- Every primary and preparation participant exists and is alive when the event begins.
- Primary definitions do not repeat within a prohibited round scope.
- Ordinary round participants are not reused across primary events.
- Bloodbath repeats obey the supplemental pair-fatality contract.
- Killer IDs exist, are unique, and are not self-attributed.
- Tribute deaths link to matching resolved-event eliminations.
- Inventory acquisitions, consumption, ownership, and transfers form a valid chain.
- Aftermath and status-resolution histories may reference dead tributes for narrative and attribution, but every referenced tribute exists.
- Final status, inventory, relationship, vendetta, and truce state passes game invariants.

## Failures

None.
