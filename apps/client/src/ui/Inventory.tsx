// Inventory: owned items, where they're equipped, crafting (content recipes) and salvage
// (docs/equipment.md §3). Only unequipped items can be crafted with or salvaged.

import { useState } from 'react';
import { canAfford, formatAmounts, itemElement, salvageValue } from '@arena/meta';
import type { InventoryItem } from '../api.js';
import { content } from '../content.js';
import { useMeta } from '../meta.js';

interface Craftable {
  recipe: string;
  label: string;
  cost: Record<string, number>;
  instanceIds: string[];
  output: string;
}

/** Every recipe the spare items can pay for right now, one entry per input group. */
function craftables(spare: InventoryItem[]): Craftable[] {
  const out: Craftable[] = [];
  for (const r of Object.values(content.economy.recipes)) {
    const inputs = spare.filter((i) => content.items[i.itemId]?.type === r.inputs.type);
    const groups = new Map<string, InventoryItem[]>();
    for (const i of inputs) {
      const key = r.inputs.sameElement ? (itemElement(content.items[i.itemId]!) ?? '') : '*';
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    for (const [key, items] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (items.length < r.inputs.count) continue;
      const output = Object.values(content.items).find((o) => o.type === r.output.type && (!r.inputs.sameElement || itemElement(o) === key));
      if (!output) continue;
      out.push({
        recipe: r.id,
        label: `${r.inputs.count}× ${content.items[items[0]!.itemId]!.name} → ${output.name}`,
        cost: r.cost ?? {},
        instanceIds: items.slice(0, r.inputs.count).map((i) => i.id),
        output: output.id,
      });
    }
  }
  return out;
}

export function InventoryPanel() {
  const { inventory, characters, wallet, busy, craft, salvage } = useMeta();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const spare = inventory.filter((i) => !i.equippedOn);
  const recipes = craftables(spare);
  const sorted = [...inventory].sort((a, b) => {
    const da = content.items[a.itemId];
    const db = content.items[b.itemId];
    return (da?.type ?? '').localeCompare(db?.type ?? '') || (da?.name ?? '').localeCompare(db?.name ?? '');
  });

  return (
    <section aria-label="Inventory">
      <div className="section-head">
        <h2>
          Inventory <span className="muted">{inventory.length}</span>
        </h2>
        <span className="muted">Equip items from a character's page. Wins in casual and ranked matches drop more.</span>
      </div>

      {recipes.length > 0 && (
        <div className="craft-list" aria-label="Crafting">
          {recipes.map((c) => (
            <button
              key={c.instanceIds.join()}
              type="button"
              className="btn small"
              disabled={busy || !canAfford(wallet, c.cost)}
              title={content.economy.recipes[c.recipe]?.description}
              onClick={() => {
                setMade(null);
                void craft(c.recipe, c.instanceIds).then((item) => item && setMade(content.items[item.itemId]?.name ?? item.itemId));
              }}
            >
              {content.economy.recipes[c.recipe]?.name}: {c.label} ({formatAmounts(content, c.cost)})
            </button>
          ))}
        </div>
      )}
      {made && (
        <p className="notice" role="status">
          Crafted {made}.
        </p>
      )}

      <div className="inventory-list">
        {sorted.map((i) => {
          const def = content.items[i.itemId];
          const on = i.equippedOn ? characters.find((c) => c.id === i.equippedOn)?.name : null;
          const value = formatAmounts(content, salvageValue(content, i.itemId));
          return (
            <div key={i.id} className="inv-item">
              <span className="item-type">{def?.type}</span>
              <span className="item-name" title={def?.passive}>
                {def?.name ?? i.itemId}
              </span>
              {i.source === 'reward' && <span className="muted">won</span>}
              {on ? (
                <span className="muted">on {on}</span>
              ) : (
                <button
                  type="button"
                  className={`btn small${confirming === i.id ? ' danger' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    if (confirming !== i.id) return setConfirming(i.id);
                    setConfirming(null);
                    void salvage(i.id);
                  }}
                  onBlur={() => confirming === i.id && setConfirming(null)}
                >
                  {confirming === i.id ? `Salvage for ${value}?` : 'Salvage'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
