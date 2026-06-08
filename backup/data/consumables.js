import { addLogEntry, LogType } from '../core/ingameLog.js';
import { resources } from '../core/resources.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { getItemDefinition } from './definitions/items.js';
import { characterState, consumeItemQuantityFromBag } from './character.js';

function addResourceClamped(resourceName, amount) {
    const res = (resources || []).find(r => r && r.name === resourceName);
    if (!res) return 0;
    const before = Number(res.amount) || 0;
    const cap = Number(res.capacity);
    const canCap = Number.isFinite(cap) ? cap : Number.POSITIVE_INFINITY;
    const next = Math.min(before + (Number(amount) || 0), canCap);
    res.amount = next;
    return Math.max(0, next - before);
}

function ensureBuffs(state) {
    if (!state || typeof state !== 'object') return null;
    if (!state.buffs || typeof state.buffs !== 'object') state.buffs = {};
    return state.buffs;
}

function applyStaminaRegenBuff({ bonusPerSec, durationMinutes, label } = {}, state = characterState) {
    const buffs = ensureBuffs(state);
    if (!buffs) return { ok: false };

    const now = getTotalIngameMinutes();
    const dur = Math.max(1, Math.floor(Number(durationMinutes) || 0));
    const bonus = Number(bonusPerSec) || 0;
    if (!(bonus > 0)) return { ok: false };

    const prev = buffs.staminaRegen && typeof buffs.staminaRegen === 'object' ? buffs.staminaRegen : {};
    const prevUntil = Number(prev.untilMinutes) || 0;
    const base = Math.max(now, prevUntil);
    const untilMinutes = base + dur;

    buffs.staminaRegen = {
        untilMinutes,
        bonusPerSec: bonus,
        label: label || 'Stamina Regen'
    };

    return { ok: true, untilMinutes, bonusPerSec: bonus };
}

export function useConsumableFromBag(itemId, state = characterState) {
    const id = String(itemId || '');
    if (!id) return { ok: false, reason: 'No item.' };

    const def = getItemDefinition(id);
    const cons = def && def.consumable ? def.consumable : null;
    if (!def || !cons) return { ok: false, reason: 'Not usable.' };

    // Consume the item first; if the effect fails we can decide later if we want refunds.
    const consumed = consumeItemQuantityFromBag(id, 1, state);
    if (!consumed) return { ok: false, reason: 'Not in bag.' };

    if (cons.type === 'heal') {
        const resName = String(cons.resource || '');
        const amt = Number(cons.amount) || 0;
        const added = addResourceClamped(resName, amt);

        if (added > 0) {
            addLogEntry(`Used ${def.name}. +${Math.round(added)} ${resName}.`, LogType.INFO);
        } else {
            addLogEntry(`Used ${def.name}.`, LogType.INFO);
        }

        try {
            window.dispatchEvent(new CustomEvent('resources-updated'));
        } catch { /* non-fatal */ }

        return { ok: true, kind: 'heal', resource: resName, amountAdded: added };
    }

    if (cons.type === 'buff') {
        const buffKey = String(cons.buff || '');
        if (buffKey === 'staminaRegen') {
            const applied = applyStaminaRegenBuff({
                bonusPerSec: cons.bonusPerSec,
                durationMinutes: cons.durationMinutes,
                label: def.name || 'Herb Tea'
            }, state);

            if (applied.ok) {
                const hours = (Number(cons.durationMinutes) || 0) / 60;
                const label = Number.isFinite(hours) && hours > 0 ? `${hours} hours` : 'a while';
                addLogEntry(`Used ${def.name}. Stamina regeneration increased for ${label}.`, LogType.INFO);
                return { ok: true, kind: 'buff', buff: 'staminaRegen', untilMinutes: applied.untilMinutes };
            }
        }

        addLogEntry(`Used ${def.name}.`, LogType.INFO);
        return { ok: true, kind: 'buff' };
    }

    addLogEntry(`Used ${def.name}.`, LogType.INFO);
    return { ok: true };
}
