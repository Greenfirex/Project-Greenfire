// Global Morale system: additive percent-based modifier that scales job outputs only.
// 100% = baseline. Final multiplier = percent / 100. Values are clamped to [0, 200].

import { resources } from '../core/resources.js';
import { gameFlags } from './gameFlags.js';
import { getCurrentWeather } from './weather.js';
import { getTotalIngameMinutes } from '../core/time.js';

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

export function resetMoraleModifiers() {
    extraModifiers.clear();
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

    // Stockpiling resources adds a temporary +10% for 5 (in-game) days (flat, not decaying)
    if (gameFlags && gameFlags.stockpileMoraleBoostActive) {
        if (!gameFlags.stockpileMoraleBoostStartMinutes) {
            try { gameFlags.stockpileMoraleBoostStartMinutes = getTotalIngameMinutes(); } catch (e) {}
        }
        const d3 = daysSinceMinutes(gameFlags.stockpileMoraleBoostStartMinutes);
        const remainingDays3 = Math.max(0, 5 - d3);
        if (remainingDays3 <= 0) {
            try { gameFlags.stockpileMoraleBoostActive = false; } catch (e) {}
        } else {
            percent += 10;
            sources.push({ id: 'stockpile', label: 'Stockpile Secured', deltaPercent: +10, remainingDays: Number(remainingDays3.toFixed(1)) });
        }
    }

    // Hunger: Food depleted => -20%
    try {
        const food = resources.find(r => r.name === 'Provisions');
        if (food && Number(food.amount) <= 0) {
            percent -= 20;
            sources.push({ id: 'hunger', label: 'Hunger', deltaPercent: -20 });
        }
    } catch {}

    // Thirst: Water depleted => -20%
    try {
        const water = resources.find(r => r.name === 'Water');
        if (water && Number(water.amount) <= 0) {
            percent -= 20;
            sources.push({ id: 'thirst', label: 'Thirst', deltaPercent: -20 });
        }
    } catch {}

    // Weather effect (v1): add morale delta and show remaining time
    try {
        const w = getCurrentWeather();
        if (w && typeof w.moraleDelta === 'number' && w.moraleDelta !== 0) {
            percent += w.moraleDelta;
            const remainingDays = (typeof w.remainingMinutes === 'number') ? Number((w.remainingMinutes / (60 * 24)).toFixed(2)) : undefined;
            sources.push({ id: `weather_${w.id}` , label: `Weather — ${w.label}` , deltaPercent: w.moraleDelta, remainingDays });
        }
    } catch {}

    // Future/custom event modifiers
    for (const m of extraModifiers.values()) {
        percent += m.delta;
        sources.push({ id: m.id, label: m.label || m.id, deltaPercent: m.delta });
    }

    // Persistent campfire morale boost (+5%) when the campfire is lit
    try {
        if (gameFlags && gameFlags.campfireLit) {
            percent += 5;
            sources.push({ id: 'campfire', label: 'Campfire', deltaPercent: +5 });
        }
    } catch {}

    // Clamp and compute multiplier
    percent = Math.max(0, Math.min(200, percent));
    const multiplier = percent / 100;

    return { percent: Math.round(percent), multiplier, sources };
}
