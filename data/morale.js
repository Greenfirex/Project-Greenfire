// Global Morale system: additive percent-based modifier that scales job outputs only.
// 100% = baseline. Final multiplier = percent / 100. Values are clamped to [0, 200].

import { resources } from '../resources.js';
import { gameFlags } from './gameFlags.js';
import { getTotalIngameMinutes } from '../time.js';

// In-memory additional modifiers registry for future events. Values are deltas in percent.
// Example: { id: 'festival', delta: +10, label: 'Festival +10%' }
const extraModifiers = new Map();

export function setMoraleModifier(id, deltaPercent, label) {
    if (!id) return;
    extraModifiers.set(id, { id, delta: Number(deltaPercent) || 0, label: label || String(id) });
}

export function clearMoraleModifier(id) {
    extraModifiers.delete(id);
}

export function listMoraleModifiers() {
    return Array.from(extraModifiers.values());
}

function daysSinceMinutes(startMinutes) {
    try {
        const nowMin = getTotalIngameMinutes();
        const startMin = Number(startMinutes) || 0;
        if (startMin <= 0) return Infinity;
        const deltaMin = Math.max(0, nowMin - startMin);
        return deltaMin / (60 * 24);
    } catch (e) { return Infinity; }
}

export function getMorale() {
    // Base morale 100%
    let percent = 100;
    const sources = [];

    // Crashlanded baseline penalty starts at -50% and linearly decays to 0 over 7 (in-game) days
    if (gameFlags && gameFlags.crashlandedActive) {
        // lazy init if needed
        if (!gameFlags.crashlandedStartMinutes) {
            try { gameFlags.crashlandedStartMinutes = getTotalIngameMinutes(); } catch (e) {}
        }
        const d = daysSinceMinutes(gameFlags.crashlandedStartMinutes);
        const remainingFrac = Math.max(0, 1 - (d / 7));
        if (remainingFrac <= 0) {
            // fully decayed — flip the flag off so it doesn't show up anymore
            try { gameFlags.crashlandedActive = false; } catch (e) {}
        } else {
            const delta = -50 * remainingFrac;
            percent += delta; // delta is negative
            const remDays = Math.max(0, 7 - d);
            sources.push({ id: 'crashlanded', label: 'Crashlanded', deltaPercent: Math.round(delta), remainingDays: Number(remDays.toFixed(1)) });
        }
    }

    // Establishing Base Camp adds a temporary +10% that decays over 7 (in-game) days
    if (gameFlags && gameFlags.baseCampEstablished) {
        if (!gameFlags.baseCampBoostStartMinutes) {
            try { gameFlags.baseCampBoostStartMinutes = getTotalIngameMinutes(); } catch (e) {}
        }
        const d2 = daysSinceMinutes(gameFlags.baseCampBoostStartMinutes);
        const remainingFrac2 = Math.max(0, 1 - (d2 / 7));
        const delta2 = +10 * remainingFrac2;
        if (delta2 > 0.001) {
            percent += delta2;
            const remDays2 = Math.max(0, 7 - d2);
            sources.push({ id: 'baseCamp', label: 'Base Camp Established', deltaPercent: Math.round(delta2), remainingDays: Number(remDays2.toFixed(1)) });
        }
    }

    // Hunger: Food depleted => -20%
    try {
        const food = resources.find(r => r.name === 'Food Rations');
        if (food && Number(food.amount) <= 0) {
            percent -= 20;
            sources.push({ id: 'hunger', label: 'Hunger', deltaPercent: -20 });
        }
    } catch {}

    // Thirst: Water depleted => -20%
    try {
        const water = resources.find(r => r.name === 'Clean Water');
        if (water && Number(water.amount) <= 0) {
            percent -= 20;
            sources.push({ id: 'thirst', label: 'Thirst', deltaPercent: -20 });
        }
    } catch {}

    // Future/custom event modifiers
    for (const m of extraModifiers.values()) {
        percent += m.delta;
        sources.push({ id: m.id, label: m.label || m.id, deltaPercent: m.delta });
    }

    // Clamp and compute multiplier
    percent = Math.max(0, Math.min(200, percent));
    const multiplier = percent / 100;

    return { percent: Math.round(percent), multiplier, sources };
}
