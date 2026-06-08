// Minimal consumables module for the timeloop reset game.
// Legacy file was moved to backup/data/.
import { getItemDefinition } from './items.js';
import { getTotalIngameMinutes } from '../../core/time.js';

export function useConsumableFromBag(itemId, state) {
    if (!itemId || !state) return false;
    const def = getItemDefinition(itemId);
    if (!def || !def.consumable) return false;

    // Apply consumable effect
    if (itemId === 'stimpack') {
        // Heal 30 health
        const health = (typeof window !== 'undefined' && window.debugResources)
            ? window.debugResources.find(r => r && r.name === 'Health')
            : null;
        if (health) {
            health.amount = Math.min(health.capacity, Number(health.amount || 0) + 30);
        }
    } else if (itemId === 'herb_tea') {
        // Apply stamina regen buff for 120 in-game minutes
        if (state && state.buffs) {
            const until = getTotalIngameMinutes() + 120;
            state.buffs.staminaRegen = {
                untilMinutes: until,
                bonusPerSec: 1.0,
                label: 'Herb Tea'
            };
        }
    }

    // Remove the consumable from bag
    const bag = Array.isArray(state.bag) ? state.bag : [];
    for (let i = 0; i < bag.length; i++) {
        const entry = bag[i];
        if (!entry) continue;
        const id = typeof entry === 'string' ? entry : (entry && typeof entry === 'object' ? entry.id : null);
        if (id !== itemId) continue;

        if (typeof entry === 'object' && entry.qty > 1) {
            entry.qty -= 1;
            if (entry.qty <= 0) bag[i] = null;
        } else {
            bag[i] = null;
        }
        return true;
    }
    return false;
}