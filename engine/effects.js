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
    debuffs: { 'Stamina': -0.3 },
};

export const EFFECT_THIRSTY = {
    id: 'thirsty',
    nameKey: 'effect_thirsty_name',
    descKey: 'effect_thirsty_desc',
    icon: '💧',
    debuffs: { 'Stamina': -0.4 },
};

export const EFFECT_EXHAUSTED = {
    id: 'exhausted',
    nameKey: 'effect_exhausted_name',
    descKey: 'effect_exhausted_desc',
    icon: '😵',
    debuffs: { 'Health': -1.0 },
};

export const EFFECT_LIFE_SUPPORT_FAILURE = {
    id: 'life_support_failure',
    nameKey: 'effect_life_support_failure_name',
    descKey: 'effect_life_support_failure_desc',
    icon: '⚠️',
    debuffs: {},
};

export const EFFECT_OXYGEN_DEPLETED = {
    id: 'oxygen_depleted',
    nameKey: 'effect_oxygen_depleted_name',
    descKey: 'effect_oxygen_depleted_desc',
    icon: '🫁',
    debuffs: { 'Health': -2.0 },
};

/**
 * Add a new effect. Ignored if an effect with the same id already exists.
 * @param {{ id: string, nameKey: string, descKey: string, icon?: string, 
 *           progress?: number, maxProgress?: number, isCountdown?: boolean,
 *           debuffs?: { staminaCostMultiplier?: number, foodCostMultiplier?: number, waterCostMultiplier?: number }
 * }} effect
 */
// --- Defer effects UI updates to a single rAF tick ---
let _effectsDirty = false;
let _effectsRafId = null;

function scheduleEffectsUIUpdate() {
    if (_effectsDirty) return;
    _effectsDirty = true;
    if (!_effectsRafId) {
        _effectsRafId = requestAnimationFrame(() => {
            _effectsRafId = null;
            _effectsDirty = false;
            updateEffectsUI();
        });
    }
}

/**
 * Immediately flush pending effects UI update (used during load/setup).
 */
function flushEffectsUI() {
    if (_effectsRafId) {
        cancelAnimationFrame(_effectsRafId);
        _effectsRafId = null;
    }
    _effectsDirty = false;
    updateEffectsUI();
}

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
    scheduleEffectsUIUpdate();
}

/**
 * Remove an effect by id.
 */
export function removeEffect(id) {
    const idx = activeEffects.findIndex(e => e.id === id);
    if (idx === -1) return;
    activeEffects.splice(idx, 1);
    scheduleEffectsUIUpdate();
}

/**
 * Check if an effect is active.
 */
export function hasEffect(id) {
    return activeEffects.some(e => e.id === id);
}

/**
 * Get combined flat per-minute debuff drains from all active effects.
 * Returns { resourceName: totalFlatPerMin }
 */
export function getEffectDrains() {
    const drains = {};
    for (const effect of activeEffects) {
        if (effect.debuffs) {
            for (const [resName, rate] of Object.entries(effect.debuffs)) {
                drains[resName] = (drains[resName] || 0) + rate;
            }
        }
    }
    return drains;
}

/**
 * Get combined flat per-minute debuff drains (alias for getEffectDrains).
 */
export function getEffectDebuffs() {
    return getEffectDrains();
}

/**
 * Get detailed debuff info for tooltip display.
 * Returns an array of active effects with flat debuff rates.
 */
export function getEffectDebuffDetails() {
    const details = [];
    for (const effect of activeEffects) {
        if (effect.debuffs && Object.keys(effect.debuffs).length > 0) {
            details.push({
                nameKey: effect.nameKey,
                icon: effect.icon || '',
                debuffs: { ...effect.debuffs },
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
    if (changed) scheduleEffectsUIUpdate();
}

/**
 * Clear all effects (e.g., on new game or loop reset).
 */
export function clearAllEffects() {
    activeEffects.length = 0;
    scheduleEffectsUIUpdate();
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
        <div class="panel-section-header">${t('effects_title')}</div>
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
        
        // Show flat debuff rates. When exhausted, Stamina-targeted debuffs redirect to Health.
        const debuffTags = [];
        if (effect.debuffs) {
            for (const [resName, rate] of Object.entries(effect.debuffs)) {
                const sign = rate >= 0 ? '+' : '';
                const isStaminaDebuff = resName === 'Stamina';
                const showAsHealth = isStaminaDebuff && hasEffect('exhausted');
                const displayResName = showAsHealth ? 'Health' : resName;
                debuffTags.push(`<span class="effect-debuff-tag">${displayResName} ${sign}${rate.toFixed(1)}/min</span>`);
            }
        }
        
        return `
            <div class="effect-row" data-effect-id="${effect.id}" data-effect-tooltip="${effect.nameKey}">
                <div class="effect-icon">${effect.icon || '⚠'}</div>
                <div class="effect-info">
                    <div class="effect-name">${name}</div>
                    ${debuffTags.length ? `<div class="effect-debuffs">${debuffTags.join(' ')}</div>` : ''}
                    ${progressBarHtml ? `<div class="effect-progress">${progressBarHtml}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Wire tooltips on effect rows (description shown on hover instead of inline).
    // Use dynamic import to avoid circular dependency at module init.
    body.querySelectorAll('.effect-row').forEach(row => {
        if (row._effectTooltipWired) return;
        row._effectTooltipWired = true;
        const effectId = row.dataset.effectId;
        const effect = activeEffects.find(e => e.id === effectId);
        if (!effect) return;
        import('../ui/panels/tooltip.js').then(({ setupTooltip }) => {
            if (typeof setupTooltip !== 'function') return;
            setupTooltip(row, () => {
                return `<h4>${t(effect.nameKey)}</h4><p>${t(effect.descKey)}</p>`;
            });
        }).catch(() => {});
    });

    // Trigger enter animation for newly added effects, then remove class so pulse takes over.
    const now = Date.now();
    body.querySelectorAll('.effect-row').forEach(row => {
        const effectId = row.dataset.effectId;
        const effect = activeEffects.find(e => e.id === effectId);
        if (!effect || !effect._addedAt) return;
        if (now - effect._addedAt >= 800) return;
        row.classList.add('effect-enter');
        setTimeout(() => row.classList.remove('effect-enter'), 600);
    });
}

/**
 * Reset: reinitialize effects for new game.
 */
export function initEffects() {
    clearAllEffects();
    // Alarm is now triggered by completing the "wake_up" action (addsEffect: 'alarm')
    // via completeActiveAction in locationEngine.js
}

// ==========================================================================
// Defensive re-render after game-state-applied
// ==========================================================================
// setActiveEffects() calls updateEffectsUI() during load, but _effectsHost may
// not exist yet (setupInfoPanel runs later in startGame). This listener ensures
// effects are rendered once the full UI is assembled.
if (typeof window !== 'undefined') {
    window.addEventListener('game-state-applied', () => {
        updateEffectsUI();
    });
}

/**
 * Return a save-safe snapshot of active effects (no transient _addedAt).
 */
export function getActiveEffectsForSave() {
    return activeEffects.map(e => {
        const { _addedAt, ...rest } = e;
        return rest;
    });
}

/**
 * Replace active effects from saved data (used during load).
 * Re-renders UI if effects changed.
 */
export function setActiveEffects(saved) {
    if (!Array.isArray(saved)) return;
    activeEffects.length = 0;
    activeEffects.push(...saved.map(e => ({
        ...e,
        _addedAt: 0,
        progress: e.progress ?? 0,
        maxProgress: e.maxProgress ?? Infinity,
        isCountdown: e.isCountdown ?? false,
        debuffs: e.debuffs || {},
    })));
    updateEffectsUI();
}
