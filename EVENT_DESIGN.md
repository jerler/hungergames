# Event Design Catalogue

This document is the master registry and planning board for arena events.

Every proposed event should be recorded here before implementation begins. Update its row as its mechanics become clearer, and mark it **Implemented** only after its event definition and focused tests are complete.

## Status values

| Status       | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| Idea         | A rough concept that has not been mechanically designed         |
| Designing    | Eligibility, resolution, or outcomes are still being decided    |
| Ready        | Fully specified and ready to implement                          |
| Implementing | Production code or tests are currently being written            |
| Implemented  | Event is present in the catalogue and has focused test coverage |
| Deferred     | Intentionally postponed                                         |
| Removed      | Rejected or removed from the catalogue                          |

## Event registry

| Event                              | ID                             | Participants | Period      | Eligibility                                                      | Resolution stats                         | Possible conclusions                                                              | Inventory                         | Statuses                                   | Fatal?      | Repeat restrictions        | Implementation |
| ---------------------------------- | ------------------------------ | -----------: | ----------- | ---------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ | ----------- | -------------------------- | -------------- |
| Sponsor drone malfunction          | `sponsor-drone-malfunction`    |            1 | Day / Night | Gifts enabled; Luck ≥ 4                                          | Luck vs difficulty 3                     | Injury; no reward; one supply; medicine and bow                                   | Gains supply, medicine, or bow    | Injured                                    | No          | None currently             | Implemented    |
| Runaway vending machine            | `runaway-vending-machine`      |            1 | Day         | Luck ≤ 2                                                         | Luck vs difficulty 2                     | Injury; useless reward; water; medicine and matches                               | Gains water, medicine, or matches | Injured                                    | No          | None currently             | Implemented    |
| Capitol prize crate                | `capitol-prize-crate`          |            2 | Day / Night | At least two living tributes                                     | Separate Luck checks                     | Both win; one wins; neither wins; boxing-glove injury                             | Gains supplies or weapons         | Injured                                    | No          | Population-weighted        | Implemented    |
| Upside-down map                    | `upside-down-map`              |            1 | Day         | Any                                                              | Brains, adjusted by Luck                 | Severe confusion; mild confusion; map; map and cache                              | Gains map and possible cache item | Disoriented                                | No          | None currently             | Implemented    |
| Suspicious picnic                  | `suspicious-picnic`            |            2 | Day         | At least two living tributes                                     | Separate Brains checks, adjusted by Luck | Poisoned; sick; food; food and water for each participant                         | Gains food and/or water           | Poisoned, sick                             | No          | Population-weighted        | Implemented    |
| Arena goose                        | `arena-goose`                  |            1 | Day         | Any                                                              | Brawn, adjusted by Luck                  | Hunted and robbed; exhausted; escape; food reward                                 | May consume food or gain food     | Hunted, exhausted                          | No          | None currently             | Implemented    |
| Camouflage catastrophe             | `camouflage-catastrophe`       |            1 | Day / Night | Any                                                              | Brains, adjusted by Luck                 | To be copied from production definition                                           | Camouflage net involvement        | Status outcomes from production definition | No          | None currently             | Implemented    |
| Sponsor-delivered mystery medicine | `sponsor-mystery-medicine`     |            1 | Day / Night | Gifts enabled; tribute has a negative status                     | Brains or Luck                           | Worse condition; no effect; removes status; removes status and grants inspiration | Medicine                          | Existing negative status, inspired         | No          | Once per tribute per Games | Idea           |
| Abandoned mutt laboratory          | `abandoned-mutt-laboratory`    |          1–2 | Day         | Any                                                              | Brains / Awareness                       | Trap; useful records; medicine cache; mutt encounter                              | Medicine, map                     | Hunted, injured, inspired                  | Potentially | Once per Games             | Idea           |
| Flooded supply tunnel              | `flooded-supply-tunnel`        |            1 | Day         | Any                                                              | Brawn / Survival                         | Retreat; exhaustion; recovered supplies; rare weapon                              | Supplies or weapon                | Exhausted, injured                         | No          | None currently             | Idea           |
| Flickering force-field shelter     | `force-field-shelter`          |          1–3 | Night       | Any                                                              | Awareness / Luck                         | Safe rest; exposed; shocked; hidden cache                                         | Possible cache item               | Exposed, injured, concealed                | No          | Once per round             | Idea           |
| Capitol propaganda broadcast       | `capitol-propaganda-broadcast` |          1–2 | Day / Night | Any                                                              | Brains / Luck                            | Demoralized; unaffected; inspired; discovers clue                                 | Possible map                      | Disoriented, inspired                      | No          | Once per tribute per Games | Idea           |
| Tracker-jacker nest                | `tracker-jacker-nest`          |            1 | Day         | Any                                                              | Awareness / Brawn                        | Escape; stings; hallucination; harvest medicine                                   | Possible medicine                 | Poisoned, disoriented, injured             | Potentially | None currently             | Idea           |
| Fallen tribute’s pack              | `fallen-tribute-pack`          |            1 | Day / Night | At least one dead tribute; living tribute has inventory capacity | Awareness / Luck                         | Trap; empty pack; supply; weapon                                                  | Supplies or weapon                | Hunted, injured                            | No          | Once per death record      | Idea           |
| Shared nightmare                   | `shared-nightmare`             |            2 | Night       | Active standard or romantic truce                                | Brains / relationship type               | Exhaustion; conflict; mutual comfort; inspiration                                 | None                              | Exhausted, disoriented, inspired           | No          | Once per truce             | Idea           |

## Event specification template

Copy this section when an event needs more detail than fits comfortably in the registry.

### Event name

- **ID:**
- **Mechanical category:**
- **Participants:**
- **Eligible periods:**
- **Event-level eligibility:**
- **Participant-role eligibility:**
- **Participant selection weights:**
- **Stats used during resolution:**
- **Difficulty:**
- **Possible conclusions:**
- **Inventory required:**
- **Inventory gained, consumed, or transferred:**
- **Statuses applied or removed:**
- **Fatal or nonfatal:**
- **Repeat restrictions:**
- **Base weight:**
- **Population multiplier:**
- **Truce interactions:**
- **Reduced-motion or UI considerations:**
- **Focused test cases:**
- **Implementation status:**

## Design rules

1. Every event must declare its eligible period in its event definition.
2. Organize events primarily by mechanical theme rather than duplicating them across day and night files.
3. Every participant role must state any item, status, stat, or relationship requirements explicitly.
4. Every random conclusion must have a deterministic seeded test.
5. Fatal outcomes must record a complete cause of death.
6. Inventory changes must use the inventory change and transaction systems.
7. Status changes must use status instances rather than editing tribute state directly.
8. Opposing combat roles must use the combat-role relationship protections.
9. Cooperative events should deliberately decide whether truce partners are preferred, required, or irrelevant.
10. Events requiring global uniqueness must document and enforce their repeat restriction.
11. An event is not **Implemented** until production behavior and focused tests both exist.
12. The catalogue index must contain every implemented event exactly once.
