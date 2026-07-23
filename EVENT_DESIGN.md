# Event Design Catalogue

This document records the design rules, implemented event families, notable event definitions, and future event concepts for the Hunger Games simulator.

Production event definitions remain the source of truth for exact weights, eligibility callbacks, outcome thresholds, and change payloads. This document explains the intended behaviour those definitions must preserve.

---

# Canonical Sources

## Ordinary rounds

Night 1 and all later rounds use the ordinary event catalogue:

```text
app/game/events/catalogue/index.ts
```

The ordinary catalogue contains:

```text
encounters
stat-gated events
relationship events
```

Encounter families are registered through:

```text
app/game/events/catalogue/encounters/index.ts
```

Relationship families are registered through:

```text
app/game/events/catalogue/relationships/index.ts
```

## Day 1 Bloodbath

Day 1 daytime does not use the ordinary catalogue. It uses:

```text
app/game/bloodbath/bloodbath-sequencer.ts
app/game/events/catalogue/bloodbath/index.ts
```

The Bloodbath catalogue contains:

```text
Cornucopia acquisition events
Cornucopia pair-conflict events
Cornucopia group-conflict events
flee events
```

The specialized sequencer applies only when:

```ts
round.day === 1 && round.period === "day";
```

Night 1 returns to ordinary sequencing.

## Status-resolution events

Fatalities and other changes caused by expiring statuses are generated through the status-resolution system rather than selected from the ordinary catalogue.

---

# Status Values

| Status       | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| Idea         | A rough concept that has not been mechanically designed      |
| Designing    | Eligibility, resolution, or outcomes are still being decided |
| Ready        | Fully specified and ready to implement                       |
| Implementing | Production code or tests are currently being written         |
| Implemented  | Production behaviour and focused tests both exist            |
| Deferred     | Intentionally postponed until a prerequisite system exists   |
| Removed      | Rejected or removed from the production catalogue            |

An event is not **Implemented** merely because its concept appears in this document.

---

# Current Engine Contracts

## Round routing

1. Day 1 daytime always uses the Bloodbath sequencer.
2. Night 1 and later rounds use the ordinary sequencer.
3. Every living starting tribute appears exactly once in the Bloodbath feed.
4. Cornucopia entrants receive only Cornucopia events.
5. Fleeing tributes receive only flee events.
6. Ordinary rounds reserve participants and physical item instances across the complete planned round.

## Cornucopia strategy

1. Between 50% and 90% of the starting roster approaches the Cornucopia.
2. Participation varies by seed and averages near 75%.
3. High Brawn strongly increases approach likelihood.
4. High Luck moderately increases approach likelihood.
5. High Brains strongly increases flee likelihood.
6. Every stat combination retains a positive chance of either strategy.
7. The same seed and round always produce the same assignments and event sequence.

## Item provenance

Every item definition has one origin:

```ts
type ItemOrigin = "natural-resource" | "manufactured";
```

Current natural resources:

```text
food
water
```

All other current item definitions are manufactured.

Every newly created item must declare one acquisition source:

```ts
type ItemAcquisitionSource = "cornucopia" | "natural-foraging" | "sponsor";
```

Current acquisition rules:

1. `natural-foraging` may create only natural-resource items.
2. `cornucopia` acquisitions may occur only during Day 1 daytime.
3. `sponsor` acquisitions are rejected until sponsor delivery is implemented.
4. Manufactured items cannot be randomly discovered during ordinary rounds.
5. Looting and stealing use `transfer-item`; they do not create new item instances.
6. Transfer operations preserve item identity, definition, remaining uses, source event, and original acquisition round.

## Ownership and shared access

1. Every physical item has exactly one owner.
2. Active truce partners may access one another's usable items when an event permits shared access.
3. Passive inventory bonuses remain personal to the physical owner.
4. Events may require either:
   - `accessible` inventory: owned by the participant or an active truce partner;
   - `owned` inventory: physically owned by the participant.
5. Borrowed-item events reserve both the physical item and its owner for the round.

## Death loot

1. A tribute who personally kills another tribute receives the victim's complete inventory.
2. Death loot moves the original item instances through `transfer-item`.
3. Environmental and status deaths do not award inventory to another tribute.
4. Every looted item is transferred at most once.
5. Killer credit, kill statistics, ownership changes, and transfer transactions must remain consistent.

## Theft

1. Non-truce theft is an ordinary encounter, not a relationship betrayal event.
2. A target must personally own at least one usable, unreserved item.
3. The target must be meaningfully stronger than the thief in direct combat.
4. Active truce partners cannot steal from one another.
5. Smart, lucky, under-equipped tributes are favoured as thieves.
6. Strong, well-equipped tributes are favoured as targets.
7. Theft uses the standard four-outcome stat-check system:
   - critical failure: target kills the thief;
   - failure: thief escapes hunted;
   - success: thief steals one item;
   - exceptional success: thief steals up to two items.
8. Theft transfers preserve the original item instance and provenance.
9. Participant selection retries alternative earlier-role candidates when a chosen candidate makes a later role impossible.

## Round item reservations

The shared commitment detector reserves item instance IDs referenced by:

```text
acquire-item
use-item
consume-item
transfer-item
required item selections
```

Within one planned round:

1. An item cannot be used twice.
2. An item cannot be consumed twice.
3. An item cannot be stolen and used by its former owner.
4. An item cannot be transferred through both theft and death loot.
5. A truce partner cannot borrow a committed item.
6. A reusable item becomes available again in a later round.
7. Reservation state never persists beyond the round being planned.

## Determinism and invariants

1. Event selection and resolution use seeded random sources.
2. Identical seeds must replay identically.
3. Every inventory instance ID is globally unique.
4. Every current item has a valid acquisition transaction.
5. Every transfer follows the previous ledger owner.
6. Transfers preserve remaining uses and provenance.
7. Every completed round must satisfy the full game-state invariant suite.
8. Every full simulation must reach a valid victory.

---

# Implemented Event Families

## Bloodbath catalogue

| Family                    | Source                                       | Participants | Period        | Core behaviour                                                                      | Inventory                                                                             | Fatality                                       | Status      |
| ------------------------- | -------------------------------------------- | -----------: | ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| Cornucopia acquisition    | `bloodbath/cornucopia-acquisition-events.ts` |            1 | Day 1 daytime | A tribute attempts to seize nearby supplies and escape                              | May create one or more Cornucopia items; all acquisitions use `cornucopia` provenance | Lower risk; some harmful outcomes              | Implemented |
| Cornucopia pair conflict  | `bloodbath/cornucopia-conflict-events.ts`    |            2 | Day 1 daytime | Two tributes compete directly over supplies                                         | May award one contested item; killer may receive victim inventory through death loot  | Frequently fatal                               | Implemented |
| Cornucopia group conflict | `bloodbath/cornucopia-conflict-events.ts`    |            3 | Day 1 daytime | Several entrants collide in a high-risk resource conflict                           | May award one contested item; death loot follows credited kills                       | Frequently fatal; multiple casualties possible | Implemented |
| Flee events               | `bloodbath/flee-events.ts`                   |            1 | Day 1 daytime | A tribute escapes the central conflict, hides, or seeks immediate natural resources | May create only food or water through `natural-foraging`                              | Mostly nonfatal                                | Implemented |

## Ordinary encounter catalogue

| Family                | Source                               | Participants | Period      | Core behaviour                                                               | Inventory                                                                 | Fatality                       | Status                           |
| --------------------- | ------------------------------------ | -----------: | ----------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ | -------------------------------- |
| Combat                | `encounters/combat-events.ts`        |       Varies | Day / Night | Direct hostile encounters selected through normal combat protections         | May move existing inventory through credited death loot                   | May be fatal                   | Implemented                      |
| Non-truce theft       | `encounters/theft-events.ts`         |            2 | Day / Night | A strategic thief targets a stronger tribute with worthwhile owned inventory | Transfers one or two existing target items with reason `theft`            | Fatal only on critical failure | Implemented                      |
| Environmental         | `encounters/environmental-events.ts` |       Varies | Day / Night | Arena hazards, terrain, weather, wildlife, and environmental fatalities      | May use accessible equipment; may gather only food or water               | Some events fatal              | Implemented                      |
| Survival and foraging | `encounters/survival-events.ts`      |       Varies | Day / Night | Resource gathering, navigation, shelter, and cooperative survival            | New acquisitions are limited to food and water through `natural-foraging` | Primarily nonfatal             | Implemented                      |
| Item-use              | `encounters/item-use-events.ts`      |            1 | Day / Night | Events requiring equipment already owned or accessible through a truce       | Uses or consumes existing items; may gather natural resources             | Primarily nonfatal             | Implemented                      |
| Gamemaker             | `encounters/gamemaker-events.ts`     |            — | —           | Reserved for future arena manipulation that obeys provenance rules           | Current catalogue is empty                                                | —                              | Deferred pending new definitions |

## Stat-gated catalogue

| Family            | Source                  | Core behaviour                                                               | Inventory rule                                           | Status      |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ----------- |
| Stat-gated events | `catalogue/stat-gated/` | Events whose eligibility or weighting depends strongly on tribute statistics | May not create manufactured items during ordinary rounds | Implemented |

## Relationship catalogue

| Family                      | Source                                         | Core behaviour                                                             | Inventory rule                                                                         | Status      |
| --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| Standard truce formation    | `relationships/standard-formation-events.ts`   | Forms temporary truces through shared shelter or gathered natural supplies | Supply-sharing formations create only food or water through `natural-foraging`         | Implemented |
| Standard truce interactions | `relationships/standard-interaction-events.ts` | Cooperative, conflicting, and betrayal interactions within active truces   | Shared access follows active-truce rules; fatal betrayal cannot transfer an item twice | Implemented |
| Standard truce dissolution  | `relationships/standard-dissolution-events.ts` | Ends temporary truces through expiry or relationship outcomes              | No manufactured item creation                                                          | Implemented |
| Romantic events             | `relationships/romantic-events.ts`             | Forms and develops romantic truces and supports the joint-victory path     | Shared access follows romantic-truce rules                                             | Implemented |

---

# Complex Event Authoring Assessment

The authoring layer is the default for straightforward weighted catalogue content. Complex subsystems remain direct when their selection, sequencing, state derivation, or change ordering would become less clear inside a generic builder.

| Family                          | Decision                       | Rationale                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-truce theft                 | Retain direct                  | Target eligibility and weighting depend on the previously selected thief. The target must personally own a usable item, participant backtracking must remain visible, and exceptional success may dynamically transfer a second item. |
| Standard truce formation        | Retain domain factory          | The existing formation factory generates group-size variants, affinity-weighted participant selection, population weighting, truce construction, expiry, natural supplies, and survival credit.                                       |
| Standard truce interaction      | Retain direct                  | Betrayal combines group-size-specific eligibility, dynamic stat selection, defender selection, theft, fatalities, statuses, survival credit, and explicit truce dissolution.                                                          |
| Standard truce dissolution      | Retain domain factory          | Amicable separation requires complete active-truce validation and state-aware randomized inventory redistribution before dissolution.                                                                                                 |
| Romantic formation              | Retain direct                  | Permanent romantic truces have specialized eligibility, formation rules, and joint-victory implications.                                                                                                                              |
| Romantic protection             | Partial helper adoption        | Keep relationship-specific roles and outcomes direct, but use the central fatal-change builder for the fatal branch.                                                                                                                  |
| Truce aftermath                 | Retain state-derived subsystem | Aftermath events are generated from applied eliminations rather than selected from a weighted catalogue. Use central status helpers where practical.                                                                                  |
| Cornucopia acquisition          | Retain direct                  | Manufactured acquisition must explicitly preserve `cornucopia` provenance and may select one or two distinct items after resolving an outcome.                                                                                        |
| Bloodbath flee events           | Full authoring migration       | These are ordinary solo four-outcome stat checks whose statuses, natural acquisition, pronouns, and survival credit already fit the authoring API.                                                                                    |
| Cornucopia pair conflicts       | Retain direct                  | Outcome probabilities compare both combatants and may reverse the killer, produce no death, or award a contested item.                                                                                                                |
| Cornucopia group conflicts      | Retain direct                  | These events contain specialized multi-kill, no-credit mutual death, sole-survivor, and soft-lethality behaviour.                                                                                                                     |
| Bloodbath sequencing            | Retain specialized subsystem   | Strategy assignment, Cornucopia grouping, fatality planning, random-stream order, and exactly-once participation remain outside the generic authoring layer.                                                                          |
| Poisonous-berries joint victory | Retain direct                  | The ordinary sequencer forces this state-dependent finale and the victory engine validates its exact definition and source event.                                                                                                     |
| Status-resolution events        | Retain state-derived subsystem | Fatal status events are generated from expiring active statuses rather than selected from the weighted catalogue. Use the central fatal-change builder.                                                                               |
| Safety resolution               | Retain sequencer behaviour     | Safety resolution selects guaranteed-fatal definitions by category. No separate safety-only event abstraction is needed.                                                                                                              |
| Dynamic inventory transfers     | Retain local helpers           | Theft, betrayal, redistribution, and death loot select different item sets with different provenance and ordering rules. A single authored transfer effect would obscure those distinctions.                                          |

---

# Notable Implemented Definitions

These entries clarify previously documented events whose mechanics changed during the provenance and Bloodbath work.

| Event                           | ID                                | Family              | Period      | Current eligibility                                                | Current inventory behaviour                                                                | Status      |
| ------------------------------- | --------------------------------- | ------------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------- |
| Forages for resources           | `forages-for-resources`           | Survival            | Day         | Any available tribute                                              | Creates food or water through `natural-foraging`                                           | Implemented |
| Upside-down map                 | `upside-down-map`                 | Survival / item-use | Day         | Requires an accessible map                                         | Uses the existing map; may locate food or water; never creates a map or manufactured cache | Implemented |
| Unfamiliar foraging ground      | `unfamiliar-foraging-ground`      | Survival / hazard   | Day         | Two available tributes                                             | May create food or water only                                                              | Implemented |
| Arena goose                     | `arena-goose`                     | Environmental       | Day         | Any available tribute                                              | May use existing food or gather natural food; never creates manufactured equipment         | Implemented |
| Brushfire supply run            | `brushfire-supply-run`            | Environmental       | Day         | Any available tribute; accessible protection may reduce difficulty | May use water, blanket, or shield; exceptional success may find food or water              | Implemented |
| Fishing-gear enormous fish      | `fishing-gear-enormous-fish`      | Item-use            | Day         | Requires accessible fishing gear                                   | Uses existing gear and may create food through `natural-foraging`                          | Implemented |
| Axe-based shelter renovation    | `axe-based-shelter-renovation`    | Item-use            | Day         | Requires an accessible axe                                         | Uses the existing axe; does not create equipment                                           | Implemented |
| Slingshot trick shot            | `slingshot-trick-shot`            | Item-use            | Day         | Requires an accessible slingshot                                   | Uses the existing slingshot and may gather food                                            | Implemented |
| Trap-kit instructions missing   | `trap-kit-instructions-missing`   | Item-use            | Day / Night | Requires an accessible trap kit                                    | Uses the existing trap kit and may gather food                                             | Implemented |
| Shield used for everything else | `shield-used-for-everything-else` | Item-use            | Day / Night | Requires an accessible shield                                      | Uses the existing shield and may gather food or water                                      | Implemented |
| Camouflage catastrophe          | `camouflage-catastrophe`          | Item-use            | Day / Night | Requires an accessible camouflage net                              | Uses the existing net; does not create equipment                                           | Implemented |
| Steal from stronger tribute     | `steal-from-stronger-tribute`     | Theft               | Day / Night | Stronger non-truce target owns usable unreserved inventory         | Transfers existing items with reason `theft`; never creates an item                        | Implemented |

---

# Removed or Superseded Concepts

| Event                                         | Former ID                              | Status     | Reason                                                                                              |
| --------------------------------------------- | -------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Sponsor drone malfunction                     | `sponsor-drone-malfunction`            | Removed    | Ordinary implementation created manufactured rewards without a sponsor-delivery system              |
| Runaway vending machine                       | `runaway-vending-machine`              | Removed    | Random ordinary-round manufactured acquisition violated provenance rules                            |
| Capitol prize crate                           | `capitol-prize-crate`                  | Removed    | Manufactured prize crates belong to the Day 1 Cornucopia or a future sponsor system                 |
| Random map discovery                          | Former `upside-down-map` reward branch | Superseded | The implemented event now requires an existing map and may reveal only natural resources or shelter |
| Random manufactured caches in ordinary events | Multiple former reward branches        | Removed    | Manufactured supplies now originate only from the Cornucopia or future sponsors                     |
| Fallen tribute's pack scavenging              | `fallen-tribute-pack`                  | Deferred   | Corpse scavenging by tributes who were not the killer is outside the current ownership contract     |

Removed concepts should not be restored without first changing the central provenance rules and corresponding invariant coverage.

---

# Future Event Backlog

Future concepts must comply with the current provenance and ownership rules.

| Event                              | Proposed ID                    | Participants | Period      | Revised design constraints                                                          | Inventory                                                                                                           | Status   |
| ---------------------------------- | ------------------------------ | -----------: | ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Sponsor-delivered mystery medicine | `sponsor-mystery-medicine`     |            1 | Day / Night | Requires gifts enabled and an implemented sponsor-delivery pipeline                 | May create medicine only with acquisition source `sponsor`                                                          | Deferred |
| Abandoned mutt laboratory          | `abandoned-mutt-laboratory`    |          1–2 | Day         | Exploration, records, mutt danger, or status outcomes; no random manufactured cache | May reveal information, improve a status, or use existing medicine; no new manufactured item without a valid source | Idea     |
| Flooded supply tunnel              | `flooded-supply-tunnel`        |            1 | Day         | Environmental traversal and natural-resource recovery                               | May provide food or water; no random weapon or manufactured supply                                                  | Idea     |
| Flickering force-field shelter     | `force-field-shelter`          |          1–3 | Night       | Shelter reliability, shock risk, concealment, and exposure                          | Status and survival outcomes; no hidden manufactured cache                                                          | Idea     |
| Capitol propaganda broadcast       | `capitol-propaganda-broadcast` |          1–2 | Day / Night | Psychological event using Brains and Luck                                           | Status, vendetta, or narrative clue outcomes; no random map acquisition                                             | Idea     |
| Tracker-jacker nest                | `tracker-jacker-nest`          |            1 | Day         | Awareness, escape, poison, and hallucination outcomes                               | May use existing medicine; cannot create medicine through foraging                                                  | Idea     |
| Shared nightmare                   | `shared-nightmare`             |            2 | Night       | Requires an active standard or romantic truce                                       | No inventory creation                                                                                               | Idea     |

---

# Event Specification Template

Copy this section when a concept needs more detail than fits comfortably in the backlog table.

## Event name

- **ID:**
- **Catalogue family:**
- **Mechanical category:**
- **Participants:**
- **Eligible periods:**
- **Event-level eligibility:**
- **Participant-role eligibility:**
- **Role order dependencies:**
- **Participant selection weights:**
- **Truce relationship rules:**
- **Item access mode:** `accessible`, `owned`, or none
- **Required item definitions:**
- **Stats used during resolution:**
- **Difficulty:**
- **Luck adjustment:**
- **Possible conclusions:**
- **Statuses applied or removed:**
- **Fatal or nonfatal:**
- **Killer-credit rules:**
- **Inventory gained, used, consumed, or transferred:**
- **Acquisition source for every new item:**
- **Transfer reason for every ownership change:**
- **Round item commitments:**
- **Repeat restrictions:**
- **Base weight:**
- **Population multiplier:**
- **Reduced-motion or UI considerations:**
- **Focused test cases:**
- **Simulation or balance assertions:**
- **Implementation status:**

---

# Design Rules

1. Every event must declare its eligible period.
2. Day 1 daytime events belong to the dedicated Bloodbath catalogue, not the ordinary catalogue.
3. Bloodbath events must respect the assigned Cornucopia or flee strategy.
4. Every participant role must state its item, status, stat, relationship, and ownership requirements explicitly.
5. Roles that may use truce-shared inventory default to `accessible`; roles requiring physical ownership must use `owned`.
6. Opposing roles must use the established truce and relationship protections.
7. Cooperative events must deliberately decide whether truce partners are preferred, required, allowed, or irrelevant.
8. Every random selection and conclusion must remain deterministic for a fixed seed.
9. Fatal outcomes must record a complete cause of death.
10. Credited kills must use the fatal-change and death-loot systems.
11. Environmental and status deaths must not award the victim's inventory to another tribute.
12. Every newly created item must declare a valid acquisition source.
13. Natural foraging may create only food or water.
14. Manufactured items may be created only at the Day 1 Cornucopia or through a future sponsor system.
15. Looting and theft must transfer existing item instances rather than recreate them.
16. Transfers must preserve item identity, remaining uses, source event, and acquisition round.
17. Every event must expose all selected, used, consumed, acquired, or transferred item instances to round reservation logic.
18. No physical item may be committed by two events planned from the same round-opening state.
19. Borrowed-item events must reserve the physical owner as well as the item.
20. Reusable items must become available again in future rounds.
21. Global uniqueness and repeat restrictions must be documented and enforced.
22. Production catalogues must contain every implemented definition exactly once.
23. Bloodbath definitions must remain absent from the ordinary catalogue.
24. Theft must remain separate from truce-betrayal events.
25. An event is not **Implemented** until production behaviour, focused tests, and relevant invariant coverage exist.
26. Balance-sensitive systems must use broad seeded aggregate assertions rather than brittle single-seed expectations.

---

# Validation Requirements

Before marking a new event or family **Implemented**, run:

```bash
npm run format
npm run typecheck
npm run lint
npm test
```

Changes affecting full-game balance, item provenance, death loot, truces, reservations, or victory flow must also extend or run the appropriate simulation stress tests.

The following behaviours must remain true across the production suite:

1. Day 1 daytime is always the Bloodbath.
2. Cornucopia participation remains between 50% and 90% and averages near 75%.
3. Day 1 accounts for most eliminations across many simulations.
4. Manufactured items are not created during ordinary rounds.
5. Natural food and water remain available through later foraging.
6. Manufactured items may change hands through credited death loot or non-truce theft.
7. Every ownership change has a matching transfer transaction.
8. No item instance is duplicated or committed to two events in one round.
9. Identical seeds replay identically.
10. Every simulation reaches a valid victory.
11. The complete game state satisfies all inventory, truce, event, status, and victory invariants.
