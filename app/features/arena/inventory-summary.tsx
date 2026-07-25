import { createInventoryItemPresentation } from "~/game/items/item-presentation";

import type { GameTribute } from "~/game/types/game-state";

interface InventorySummaryProps {
  tributes: readonly GameTribute[];
}

export function InventorySummary({ tributes }: InventorySummaryProps) {
  const tributesWithItems = tributes.filter(
    (tribute) => tribute.isAlive && tribute.inventory.length > 0,
  );

  return (
    <aside className="inventory-summary" aria-labelledby="inventory-summary-title">
      <header>
        <p className="eyebrow">Arena supplies</p>

        <h2 id="inventory-summary-title">Inventory</h2>
      </header>

      {tributesWithItems.length === 0 ? (
        <p className="inventory-summary__empty">No living tribute currently possesses an item.</p>
      ) : (
        <ul className="inventory-summary__tributes">
          {tributesWithItems.map((tribute) => (
            <li className="inventory-summary__owner" key={tribute.id}>
              <strong>{tribute.snapshot.name}</strong>

              <ul className="inventory-summary__items">
                {tribute.inventory.map((item) => {
                  const presentation = createInventoryItemPresentation(tribute, item);

                  return (
                    <li
                      className={[
                        "inventory-item",

                        presentation.usable ? "inventory-item--usable" : "inventory-item--unusable",
                      ].join(" ")}
                      key={item.id}
                    >
                      <details className="inventory-item__disclosure">
                        <summary>
                          <span className="inventory-item__summary-main">
                            <strong>{presentation.label}</strong>

                            <span
                              className="inventory-item__usability"
                              data-usable={presentation.usable}
                            >
                              {presentation.usable ? "Usable" : "Unusable"}
                            </span>
                          </span>

                          <span className="inventory-item__uses">{presentation.usesLabel}</span>
                        </summary>

                        <div className="inventory-item__details">
                          <p className="inventory-item__description">{presentation.description}</p>

                          <dl className="inventory-item__metadata">
                            <div>
                              <dt>Requirements</dt>

                              <dd>{presentation.minimumRequirements.join(", ")}</dd>
                            </div>

                            <div>
                              <dt>Owner usability</dt>

                              <dd>{presentation.usabilityLabel}</dd>
                            </div>
                          </dl>

                          {presentation.unusableReasons.length > 0 ? (
                            <section
                              className="inventory-item__warning"
                              aria-label={`${presentation.label} usability problems`}
                            >
                              <strong>Why it is unusable</strong>

                              <ul>
                                {presentation.unusableReasons.map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            </section>
                          ) : null}

                          {presentation.capabilityGroups.length > 0 ? (
                            <div className="inventory-item__capabilities">
                              {presentation.capabilityGroups.map((group) => (
                                <section key={group.label}>
                                  <strong>{group.label}</strong>

                                  <ul>
                                    {group.details.map((detail) => (
                                      <li key={detail}>{detail}</li>
                                    ))}
                                  </ul>
                                </section>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
