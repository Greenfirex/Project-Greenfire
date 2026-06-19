// ==========================================================================
// Active Effects Engine
// ==========================================================================
// Tracks temporary effects (debuffs, events) with optional progress bars.
// Effects can apply multipliers to action costs and be removed by actions.
// ==========================================================================

import { t } from '../locales/locales.js';
import { addLogEntry, LogType } from './ingameLog.js';

export let activeEffects = [];

// Predefined survival effect definitions
export const EFFECT_HUNGRY = {
    id: 'hungry',
    nameKey: 'effect_hungry_name',
    descKey: 'effect_hungry_desc',
    icon: '🥩',
    debuffs: { staminaCostMultiplier: 3 },
};

export const EFFECT_THIRSTY = {
    id: 'thirsty',
    nameKey: 'effect_thirsty_name',
    descKey: 'effect_thirsty_desc',
    icon: '💧',
    debuffs: { staminaCostMultiplier: 4 },
};

export const EFFECT_EXHAUSTED = {
    id: 'exhausted',
    nameKey: 'effect_exhausted_name',
    descKey: 'effect_exhausted_desc',
    icon: '😵',
    debuffs: {},
};

/**
 * Add a new effect. Ignored if an effect with the same id already exists.
 * @param {{ id: string, nameKey: string, descKey: string, icon?: string, 
 *           progress?: number, maxProgress?: number, isCountdown?: boolean,
 *           debuffs?: { staminaCostMultiplier?: number, foodCostMultiplier?: number, waterCostMultiplier?: number }
 * }} effect
 */
export function addEffect(effect) {
    if (activeEffects.some(e => e.id === effect.id)) return;
    activeEffects.push({
        ...effect,
        progress: effect.progress ?? 0,
        maxProgress: effect.maxProgress ?? Infinity,
        isCountdown: effect.isCountdown ?? false,
        debuffs: effect.debuffs || {},
        _addedAt: Date.now(),
    });
    updateEffectsUI();
}

/**
 * Remove an effect by id.
 */
export function removeEffect(id) {
    const idx = activeEffects.findIndex(e => e.id === id);
    if (idx === -1) return;
    activeEffects.splice(idx, 1);
    updateEffectsUI();
}

/**
 * Check if an effect is active.
 */
export function hasEffect(id) {
    return activeEffects.some(e => e.id === id);
}

/**
 * Get combined debuff multipliers for action cost calculations.
 * Returns { staminaMultiplier, foodMultiplier, waterMultiplier }
 */
export function getEffectDebuffs() {
    let staminaMult = 1;
    let foodMult = 1;
    let waterMult = 1;
    for (const effect of activeEffects) {
        if (effect.debuffs.staminaCostMultiplier) staminaMult *= effect.debuffs.staminaCostMultiplier;
        if (effect.debuffs.foodCostMultiplier) foodMult *= effect.debuffs.foodCostMultiplier;
        if (effect.debuffs.waterCostMultiplier) waterMult *= effect.debuffs.waterCostMultiplier;
    }
    return { staminaMultiplier: staminaMult, foodMultiplier: foodMult, waterMultiplier: waterMult };
}

/**
 * Get detailed debuff info for tooltip display.
 * Returns an array of active effects that modify costs.
 */
export function getEffectDebuffDetails() {
    const details = [];
    for (const effect of activeEffects) {
        const d = {};
        if (effect.debuffs.staminaCostMultiplier && effect.debuffs.staminaCostMultiplier !== 1) {
            d.staminaMult = effect.debuffs.staminaCostMultiplier;
        }
        if (effect.debuffs.foodCostMultiplier && effect.debuffs.foodCostMultiplier !== 1) {
            d.foodMult = effect.debuffs.foodCostMultiplier;
        }
        if (effect.debuffs.waterCostMultiplier && effect.debuffs.waterCostMultiplier !== 1) {
            d.waterMult = effect.debuffs.waterCostMultiplier;
        }
        if (Object.keys(d).length > 0) {
            details.push({
                nameKey: effect.nameKey,
                icon: effect.icon || '',
                ...d,
            });
        }
    }
    return details;
}

/**
 * Advance effect progress (for effects with finite maxProgress).
 * @param {number} deltaSeconds 
 */
export function advanceEffectProgress(deltaSeconds) {
    let changed = false;
    for (const effect of activeEffects) {
        if (effect.maxProgress === Infinity || effect.maxProgress <= 0) continue;
        effect.progress = Math.min(effect.maxProgress, (effect.progress || 0) + deltaSeconds);
        changed = true;
    }
    if (changed) updateEffectsUI();
}

/**
 * Clear all effects (e.g., on new game or loop reset).
 */
export function clearAllEffects() {
    activeEffects.length = 0;
    updateEffectsUI();
}

/**
 * Render the Active Effects section in the info panel.
 */
let _effectsHost = null;

export function setupEffectsUI(container) {
    if (!container) return;
    
    // Find or create the effects host
    const existing = container.querySelector('.effects-section');
    if (existing) existing.remove();
    
    _effectsHost = document.createElement('div');
    _effectsHost.className = 'effects-section hidden';
    _effectsHost.innerHTML = `
        <div class="effects-header">${t('effects_title')}</div>
        <div class="effects-body"></div>
    `;
    
    container.appendChild(_effectsHost);
    updateEffectsUI();
}

export function updateEffectsUI() {
    if (!_effectsHost) {
        // Try to find it
        _effectsHost = document.querySelector('.effects-section');
    }
    if (!_effectsHost) return;
    
    const body = _effectsHost.querySelector('.effects-body');
    if (!body) return;
    
    _effectsHost.classList.remove('hidden');
    
    if (activeEffects.length === 0) {
        body.innerHTML = `<div class="effect-empty">${t('effects_empty')}</div>`;
        return;
    }
    
    body.innerHTML = activeEffects.map(effect => {
        const name = t(effect.nameKey);
        const desc = t(effect.descKey);
        const isNew = effect._addedAt && (Date.now() - effect._addedAt < 800);
        
        let progressBarHtml = '';
        if (effect.maxProgress !== Infinity && effect.maxProgress > 0) {
            const pct = Math.min(100, Math.round(((effect.progress || 0) / effect.maxProgress) * 100));
            const remaining = effect.isCountdown 
                ? Math.max(0, effect.maxProgress - (effect.progress || 0))
                : effect.progress;
            progressBarHtml = `
                <div class="effect-progress-bar" style="width:${pct}%"></div>
                <span class="effect-progress-text">${Math.ceil(remaining)}s</span>
            `;
        }
        
        const debuffTags = [];
        if (effect.debuffs.staminaCostMultiplier && effect.debuffs.staminaCostMultiplier !== 1) {
            debuffTags.push(`<span class="effect-debuff-tag">Stamina ×${effect.debuffs.staminaCostMultiplier}</span>`);
        }
        if (effect.debuffs.foodCostMultiplier && effect.debuffs.foodCostMultiplier !== 1) {
            debuffTags.push(`<span class="effect-debuff-tag">Food ×${effect.debuffs.foodCostMultiplier}</span>`);
        }
        if (effect.debuffs.waterCostMultiplier && effect.debuffs.waterCostMultiplier !== 1) {
            debuffTags.push(`<span class="effect-debuff-tag">Water ×${effect.debuffs.waterCostMultiplier}</span>`);
        }
        
        return `
            <div class="effect-row${isNew ? ' effect-enter' : ''}" data-effect-id="${effect.id}">
                <div class="effect-icon">${effect.icon || '⚠'}</div>
                <div class="effect-info">
                    <div class="effect-name">${name}</div>
                    ${desc ? `<div class="effect-desc">${desc}</div>` : ''}
                    ${debuffTags.length ? `<div class="effect-debuffs">${debuffTags.join(' ')}</div>` : ''}
                    ${progressBarHtml ? `<div class="effect-progress">${progressBarHtml}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Reset: reinitialize effects for new game.
 */
export function initEffects() {
    clearAllEffects();
    // Alarm is now triggered by completing the "wake_up" action (addsEffect: 'alarm')
    // via completeActiveAction in locationEngine.js
}
