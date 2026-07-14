// ==========================================================================
// Info Panel Vitals Orbs — Mobile collapsed panel resource indicators
// ==========================================================================
// When the right panel is collapsed on compact/mobile, Diablo-like resource
// orbs show Health, Stamina, Water, Food, and Oxygen at a glance.
// ==========================================================================

import { t } from '../../locales/locales.js';
import { resources, RESOURCE_EMOJIS, areaResources, isAreaRevealed, buildResourceTooltipHtml, buildAreaResourceTooltipHtml } from '../../engine/resources.js';
import { activeEffects } from '../../engine/effects.js';
import { setupTooltip } from '../panels/tooltip.js';

const VITAL_ORDER = ['Health', 'Stamina', 'Drinking Water', 'Food Rations', 'Oxygen'];
const VITAL_ATTR = {
    'Health': 'health',
    'Stamina': 'stamina',
    'Drinking Water': 'water',
    'Food Rations': 'food',
    'Oxygen': 'oxygen',
};

const RESOURCE_ICONS = {
    'Health': '❤️',
    'Stamina': '⚡',
    'Drinking Water': '💧',
    'Food Rations': '🥩',
    'Oxygen': '🫧',
};

function getResource(name) {
    return resources.find(r => r && String(r.name) === String(name));
}

/**
 * Update all vitals orbs with current resource values.
 * Uses in-place textContent + CSS variable updates — no innerHTML.
 */
export function updateInfoVitals() {
    const orbs = document.querySelectorAll('.info-vital-orb');
    orbs.forEach(orb => {
        // Skip area resource orbs — they belong to updateAreaVitals()
        if (orb.closest('.info-area-vitals')) return;

        const vitalName = orb.dataset.vitalName;
        if (!vitalName) return;

        const res = getResource(vitalName);
        if (!res) {
            orb.style.display = 'none';
            return;
        }

        // Hide Oxygen when not available (no uniform equipped)
        if (vitalName === 'Oxygen' && (!res.isDiscovered || res.capacity <= 0)) {
            orb.style.display = 'none';
            return;
        }

        orb.style.display = '';

        const amount = Math.floor(Number(res.amount) || 0);
        const capacity = Number(res.capacity) || 1;
        const pct = Math.min(100, Math.round((amount / capacity) * 100));

        orb.style.setProperty('--fill', `${pct}%`);

        const currentEl = orb.querySelector('.orb-current');
        if (currentEl) {
            currentEl.textContent = amount;
        }

        const maxEl = orb.querySelector('.orb-max');
        if (maxEl) {
            maxEl.textContent = capacity;
        }
    });
}

/**
 * Create the vitals orbs container and inject it into the info panel.
 * Called once during setupInfoPanel.
 */
export function setupInfoVitals(panelEl) {
    if (!panelEl) return;

    // Remove old instance if re-setup
    const existing = panelEl.querySelector('.info-vitals-icons');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'info-vitals-icons';

    VITAL_ORDER.forEach(name => {
        const orb = document.createElement('div');
        orb.className = 'info-vital-orb';
        orb.dataset.vital = VITAL_ATTR[name] || '';
        orb.dataset.vitalName = name;

        const text = document.createElement('div');
        text.className = 'orb-text';
        text.innerHTML = `
            <span class="orb-current">0</span>
            <span class="orb-max">0</span>
        `;

        orb.appendChild(text);
        container.appendChild(orb);

        // Tooltip — uses the same buildResourceTooltipHtml as desktop info bars
        setupTooltip(orb, () => buildResourceTooltipHtml(name));
    });

    panelEl.appendChild(container);

    // Glowing separator line between personal and area vitals in collapsed panel
    const separator = document.createElement('div');
    separator.className = 'info-vitals-separator';
    panelEl.appendChild(separator);

    // Area resource orbs container (collapsed panel, bottom half)
    const areaContainer = document.createElement('div');
    areaContainer.className = 'info-area-vitals';
    panelEl.appendChild(areaContainer);

    // Effects warning strip in footer (compact mode)
    setupEffectsStripInFooter();

    updateInfoVitals();
    updateEffectsStrip();
    updateAreaVitals();
}

// ==========================================================================
// Effects Warning Strip — mini icons when collapsed panel
// ==========================================================================

const EFFECT_ICONS = {
    alarm: '🔔',
    hungry: '🍗',
    thirsty: '💧',
    exhausted: '😵',
    life_support_failure: '⚠️',
    oxygen_depleted: '🫁',
};

const MAX_VISIBLE_EFFECTS = 3;

function setupEffectsStrip(panelEl) {
    const existing = panelEl.querySelector('.info-effects-strip');
    if (existing) existing.remove();

    const strip = document.createElement('div');
    strip.className = 'info-effects-strip hidden';
    panelEl.appendChild(strip);
}

/**
 * In-place update: only rebuilds effects dots when the set of active effects
 * actually changes. Otherwise skips DOM entirely.
 * Uses container.dataset to cache per-container (fixes shared-cache bug
 * where panel strip would consume the cache and hide updates from footer strip).
 */
function renderEffectsDots(container) {
    if (!container) return;

    if (!activeEffects || activeEffects.length === 0) {
        container.classList.add('hidden');
        delete container.dataset._lastIds;
        return;
    }

    // Fast check: has the set of effect IDs changed for THIS container?
    const currentIds = activeEffects.map(e => e.id).join(',');
    if (currentIds === container.dataset._lastIds) return; // no change — skip DOM

    container.dataset._lastIds = currentIds;
    container.classList.remove('hidden');

    // Only rebuild when effects changed (rare — only on effect add/remove)
    container.innerHTML = '';

    const visible = activeEffects.slice(0, MAX_VISIBLE_EFFECTS);
    const overflow = activeEffects.length - MAX_VISIBLE_EFFECTS;

    visible.forEach(effect => {
        const dot = document.createElement('span');
        dot.className = 'info-effect-dot';
        dot.textContent = EFFECT_ICONS[effect.id] || '⚠';

        setupTooltip(dot, () => {
            const name = t(effect.nameKey);
            const desc = t(effect.descKey);
            let tagsHtml = '';
            if (effect.debuffs) {
                tagsHtml = Object.entries(effect.debuffs).map(([resName, rate]) => {
                    const sign = rate >= 0 ? '+' : '';
                    return `<span class="effect-debuff-tag">${resName} ${sign}${rate.toFixed(1)}/min</span>`;
                }).join(' ');
            }
            return `<h4>${effect.icon || ''} ${name}</h4><p>${desc}</p>${tagsHtml ? `<div class="effect-debuffs">${tagsHtml}</div>` : ''}`;
        });

        container.appendChild(dot);
    });

    if (overflow > 0) {
        const more = document.createElement('span');
        more.className = 'info-effect-dot effect-more';
        more.textContent = `+${overflow}`;
        container.appendChild(more);
    }
}

export function updateEffectsStrip() {
    // Panel strip (compact mode hides this via CSS)
    const panelStrip = document.querySelector('#infoPanel .info-effects-strip');
    if (panelStrip) renderEffectsDots(panelStrip);

    // Footer strip (compact mode shows this instead)
    const footerStrip = document.querySelector('#footer .footer-effects-strip');
    if (footerStrip) renderEffectsDots(footerStrip);
}

// ==========================================================================
// Effects strip in footer (compact mode)
// ==========================================================================

function setupEffectsStripInFooter() {
    const footerCol = document.querySelector('#footer .footer-column:nth-child(3)');
    if (!footerCol) return;

    const existing = footerCol.querySelector('.footer-effects-strip');
    if (existing) existing.remove();

    const strip = document.createElement('div');
    strip.className = 'footer-effects-strip hidden';
    footerCol.appendChild(strip);
}

// ==========================================================================
// Area resource orbs (collapsed panel, below separator)
// ==========================================================================

const AREA_VITAL_ORDER = ['area_fuel', 'area_o2', 'area_water'];
const AREA_VITAL_ATTR = {
    'area_fuel': 'fuel',
    'area_o2': 'oxygen',
    'area_water': 'water',
};
const AREA_ICONS = {
    'area_fuel': '⛽',
    'area_o2': '🫧',
    'area_water': '💦',
};

/**
 * Update area vitals in-place — no innerHTML wipe.
 * Only rebuilds the DOM when the set of revealed resources changes.
 */
let _lastAreaResourceIds = '';

export function updateAreaVitals() {
    // Collect all revealed area resources across locations
    const revealedResources = [];
    for (const locId of Object.keys(areaResources)) {
        if (!isAreaRevealed(locId)) continue;
        const list = areaResources[locId];
        if (!Array.isArray(list)) continue;
        for (const res of list) {
            if (!revealedResources.find(r => r.name === res.name)) {
                revealedResources.push(res);
            }
        }
    }

    const areaContainer = document.querySelector('#infoPanel .info-area-vitals');
    if (!areaContainer) return;

    // Fast check: has the set of revealed resources changed?
    const currentIds = revealedResources.map(r => r.name).join(',');
    if (currentIds !== _lastAreaResourceIds) {
        _lastAreaResourceIds = currentIds;
        // Full rebuild only when resources are added/removed (rare)
        areaContainer.innerHTML = '';

        if (revealedResources.length === 0) return;

        revealedResources.forEach(res => {
            const orb = document.createElement('div');
            orb.className = 'info-vital-orb';
            orb.dataset.vital = AREA_VITAL_ATTR[res.name] || '';
            orb.dataset.vitalName = res.name;

            const max = Number(res.capacity) || 1;
            const amount = Math.floor(Number(res.amount) || 0);
            const pct = Math.min(100, Math.round((amount / max) * 100));
            orb.style.setProperty('--fill', `${pct}%`);

            const text = document.createElement('div');
            text.className = 'orb-text';
            text.innerHTML = `
                <span class="orb-current">${amount}</span>
                <span class="orb-max">${max}</span>
            `;
            orb.appendChild(text);
            areaContainer.appendChild(orb);

            // Tooltip — uses same buildAreaResourceTooltipHtml as desktop area bars
            setupTooltip(orb, () => buildAreaResourceTooltipHtml(res.name));
        });
        return;
    }

    // In-place update: only CSS vars and textContent (fast path, called 10×/s)
    const orbs = areaContainer.querySelectorAll('.info-vital-orb');
    orbs.forEach(orb => {
        const vitalName = orb.dataset.vitalName;
        if (!vitalName) return;

        const res = revealedResources.find(r => r.name === vitalName);
        if (!res) return;

        const amount = Math.floor(Number(res.amount) || 0);
        const max = Number(res.capacity) || 1;
        const pct = Math.min(100, Math.round((amount / max) * 100));

        orb.style.setProperty('--fill', `${pct}%`);

        const currentEl = orb.querySelector('.orb-current');
        if (currentEl) currentEl.textContent = amount;

        const maxEl = orb.querySelector('.orb-max');
        if (maxEl) maxEl.textContent = max;
    });
}