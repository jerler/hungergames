import { getItemDefinition } from "~/game/items/item-catalogue";
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
            <li key={tribute.id}>
              <strong>{tribute.snapshot.name}</strong>

              <ul>
                {tribute.inventory.map((item) => {
                  const definition = getItemDefinition(item.definitionId);

                  return (
                    <li key={item.id}>
                      <span>{definition.label}</span>

                      <span>
                        {item.usesRemaining === null
                          ? "Reusable"
                          : `${item.usesRemaining} ${item.usesRemaining === 1 ? "use" : "uses"}`}
                      </span>
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
