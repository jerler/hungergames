# Food, Water, Rest, and Deprivation Architecture

## Current contract

Food and water are immediate authored outcomes. They are not ordinary inventory.

A successful authored event uses:

```ts
satisfySurvivalNeed(roleId, "food");
satisfySurvivalNeed(roleId, "water");
```

The resulting game change records the current round in the tribute's survival history and removes the matching persistent deprivation status.

## Timeline

A tribute becomes eligible for an authored deprivation-status event only after four complete arena rounds have elapsed since the matching need was last satisfied.

Eligibility is optional. It allows the event family to select the tribute; it does not automatically apply a status and does not guarantee that the event is rolled.

The authoritative helper is:

```ts
isEligibleForDeprivationStatusEvent(round, tribute, need);
```

## Hunger and thirst

`hungry` and `thirsty` are persistent, non-fatal statuses.

They:

- require an authored event;
- never cause automatic starvation or dehydration;
- remain until the matching need is satisfied;
- can coexist with timed rest statuses such as `exhausted` or `well-rested`;
- remain visible through the Phase 9 active-status selector and sidebar.

## Cornucopia provisions

Every living tribute who entered the Cornucopia receives one `cornucopia-provisions` item and immediate Day 1 food and water satisfaction.

Fatal Cornucopia participants and fleeing tributes do not receive the pack automatically.

The pack is a real manufactured item because it can be stolen, transferred through death loot, and consumed through its authored provision-use events. Protection follows current ownership:

- the current owner cannot receive `hungry` or `thirsty`;
- a thief who takes the pack receives both immediate resets and protection;
- a former owner who loses the pack can become eligible again after four later completed rounds without food or water.

This is the sole intentional food/water-related inventory exception.

## Resource theft

Authored food and water theft creates the meal, stream, spring, or other immediate source inside the scene.

It never:

- creates an inventory item;
- reserves a food or water item;
- transfers an abstract resource;
- implies that the thief stores the resource for later.

Only successful outcomes satisfy the thief's matching need. Generic item theft remains responsible for stealing real inventory, including `cornucopia-provisions`.

## Rest lifecycle

Every surviving tribute receives exactly one nighttime rest outcome.

Night events that do not define shelter receive the ordinary unsheltered fallback. Morning preparation converts the prior night's quality into `well-rested` or `exhausted`.

Rest and deprivation are independent:

- morning rest does not clear `hungry` or `thirsty`;
- food and water satisfaction does not clear `exhausted`;
- all active statuses remain visible together.

## Simulation and balance metrics

The deterministic simulation runner records pre-round snapshots so balance analysis can measure exact tribute-round eligibility opportunities.

The balance report tracks:

- food and water satisfaction events;
- hunger and thirst eligibility opportunities;
- `hungry` and `thirsty` applications;
- hunger and thirst resolutions;
- authored resource-theft attempts and successes;
- premature deprivation applications;
- deprivation share of primary events;
- legacy resource acquisitions;
- automatic starvation or dehydration fatalities;
- all existing night-rest and morning-rest metrics.

Guardrails intentionally apply across deterministic batches, not to every individual game.

## Saved-state schema

The current `GameState` schema is version 8.

The loader retains compatibility normalization for obsolete survival counters and legacy food/water inventory. This migration code is intentionally preserved even though new games never create those values.

Supported current state stores:

- `lastFoundFoodRound`;
- `lastFoundWaterRound`;
- `lastNightRest`;
- persistent `hungry` and `thirsty` status instances;
- manufactured `cornucopia-provisions`.

New persistence code must not reintroduce deprivation counters or legacy resource items.
