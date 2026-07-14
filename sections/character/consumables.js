// Consumables module for the timeloop reset game.
// Generic handler — reads consumable effects from item definitions.
import { getItemDefinition } from './items.js';
import { consumeItemQuantityFromBag } from './character.js';
import { resources } from '../../engine/resources.js';
import { getTotalIngameMinutes } from '../../engine/time.js';
import { gameFlags } from '../../engine/gameFlags.js';
import { t } from '../../locales/locales.js';

/**
 * Use one unit of a consumable from the character's bag.
 * Handles both 'heal' (restore resource) and 'buff' (apply timed buff) types.
 * @param {string} itemId - Item ID
 * @param {object} state - Character state (must have .bag and .buffs)
 * @returns {boolean} - true if the consumable was used successfully
 */
export function useConsumableFromBag(itemId, state) {
    if (!itemId || !state) return false;
    const def = getItemDefinition(itemId);
    if (!def || !def.consumable) return false;

    const { type, resource, amount, buff, bonusPerSec, durationMinutes } = def.consumable;

    // Canteen special handling — don't remove the item from bag
    if (type === 'canteen_drink') {
        if (gameFlags.canteenWater <= 0) return false;
        const drinkAmount = Math.min(amount || 10, gameFlags.canteenWater);
        const waterRes = resources.find(r => r && r.name === 'Drinking Water');
        if (waterRes) {
            const space = Math.max(0, waterRes.capacity - waterRes.amount);
            const actuallyDrink = Math.min(drinkAmount, space);
            if (actuallyDrink > 0) {
                waterRes.amount += actuallyDrink;
                gameFlags.canteenWater -= actuallyDrink;
            }
            if (actuallyDrink < drinkAmount) {
                // Cannot overfill — leftover stays in canteen
            }
            try {
                const msg = t('log_canteen_drink', {
                    amount: String(actuallyDrink),
                    canteen: String(gameFlags.canteenWater),
                    max: '50',
                    water: String(Math.round(waterRes.amount)),
                    cap: String(Math.round(waterRes.capacity))
                });
                window.dispatchEvent(new CustomEvent('ingame-log', { detail: { message: msg, type: 'success' } }));
            } catch { /* ignore */ }
        }
        return true;
    }

    // Remove one from bag first — if removal fails, don't apply the effect
    if (!consumeItemQuantityFromBag(itemId, 1, state)) return false;

    // Apply the consumable effect
    if (type === 'heal' && resource && Number.isFinite(amount) && amount > 0) {
        const res = resources.find(r => r && r.name === resource);
        if (res) {
            res.amount = Math.min(res.capacity, Number(res.amount || 0) + amount);
        }
    } else if (type === 'buff' && buff && state.buffs) {
        const bps = Number.isFinite(bonusPerSec) ? bonusPerSec : 0;
        const dur = Number.isFinite(durationMinutes) ? durationMinutes : 0;
        if (bps > 0 && dur > 0) {
            const until = getTotalIngameMinutes() + dur;
            state.buffs[buff] = {
                untilMinutes: until,
                bonusPerSec: bps,
                label: def.name || buff,
            };
        }
    } else {
        return false;
    }

    return true;
}
