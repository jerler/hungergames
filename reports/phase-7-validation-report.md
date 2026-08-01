# Phase 7 — Full Stress and Invariant Validation

Generated from 270 deterministic games across 3 seed groups.

**Result:** PASS

## Seed groups and performance

| Group | Games | Total time | Average per game | Invariant failures |
| ----- | ----: | ---------: | ---------------: | -----------------: |
| alpha |    90 |     4.71 s |          52.3 ms |                  0 |
| beta  |    90 |     4.47 s |          49.7 ms |                  0 |
| gamma |    90 |     4.30 s |          47.8 ms |                  0 |

Slowest/fastest ratio: **1.09×**.

## Phase 1 comparison

### half-game

| Metric                    | Phase 1 | Phase 7 |    Change |
| ------------------------- | ------: | ------: | --------: |
| Cornucopia non-solo       |   43.9% |   73.1% |  +29.2 pp |
| Fleeing non-solo          |    5.2% |   58.3% |  +53.1 pp |
| Day 2+ non-solo           |   22.6% |   31.5% |   +8.9 pp |
| Cornucopia top five       |   59.2% |   32.2% |  -27.0 pp |
| Cornucopia top ten        |   81.7% |   47.1% |  -34.6 pp |
| Cornucopia median overlap |    2.00 |    1.00 | -100.0 pp |

### full-game

| Metric                    | Phase 1 | Phase 7 |    Change |
| ------------------------- | ------: | ------: | --------: |
| Cornucopia non-solo       |   58.9% |   86.5% |  +27.6 pp |
| Fleeing non-solo          |    7.3% |   73.2% |  +65.9 pp |
| Day 2+ non-solo           |   29.5% |   41.3% |  +11.8 pp |
| Cornucopia top five       |   49.5% |   22.1% |  -27.4 pp |
| Cornucopia top ten        |   68.3% |   41.5% |  -26.8 pp |
| Cornucopia median overlap |    5.00 |    3.00 | -200.0 pp |

## Fatality and completion

- Games reaching victory: 270/270
- Average opening elimination rate: 50.2%
- Minimum opening elimination rate: 45.8%
- Maximum opening elimination rate: 54.2%
- Sole victories: 269
- Joint victories: 1

## Guardrails

- Balance guardrails: 55/55 passed
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
