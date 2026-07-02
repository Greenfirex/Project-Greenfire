// ==========================================================================
// Info Panel Vitals Orbs — Mobile collapsed panel resource indicators
// ==========================================================================
// When the right panel is collapsed on compact/mobile, Diablo-like resource
// orbs show Health, Stamina, Water, Food, and Oxygen at a glance.
// ==========================================================================

import { t } from '../../locales/locales.js';
import { resources, RESOURCE_EMOJIS } from '../../engine/resources.js';
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
 */
export function updateInfoVitals() {
    const orbs = document.querySelectorAll('.info-vital-orb');
    orbs.forEach(orb => {
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

        // Tooltip with resource info
        setupTooltip(orb, () => {
            const res = getResource(name);
            if (!res) return `<h4>${name}</h4>`;

            const emoji = RESOURCE_ICONS[name] || '';
            const amount = Math.floor(Number(res.amount) || 0);
            const cap = Number(res.capacity) || 0;
            const pct = cap > 0 ? Math.round((amount / cap) * 100) : 0;

            // Get current rate from dataset or compute
            let rateHtml = '';
            try {
                const rateEl = document.querySelector(`.info-row[data-resource="${name.replace(/"/g, '\\"')}"] .infocolumn3 span`);
                if (rateEl) {
                    rateHtml = `<div style="font-size:10px;margin-top:2px;opacity:0.7">${rateEl.textContent}</div>`;
                }
            } catch { /* ignore */ }

            return `
                <h4>${emoji} ${t(RESOURCE_ICONS[name] ? name : name)}</h4>
                <p>${amount} / ${cap} (${pct}%)</p>
                ${rateHtml}
            `;
        });
    });

    panelEl.appendChild(container);

    // Effects warning strip (below vitals orbs)
    setupEffectsStrip(panelEl);

    updateInfoVitals();
    updateEffectsStrip();
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

export function updateEffectsStrip() {
    const strip = document.querySelector('#infoPanel .info-effects-strip');
    if (!strip) return;

    strip.innerHTML = '';

    if (!activeEffects || activeEffects.length === 0) {
        strip.classList.add('hidden');
        return;
    }

    strip.classList.remove('hidden');

    const visible = activeEffects.slice(0, MAX_VISIBLE_EFFECTS);
    const overflow = activeEffects.length - MAX_VISIBLE_EFFECTS;

    visible.forEach(effect => {
        const dot = document.createElement('span');
        dot.className = 'info-effect-dot';
        dot.textContent = EFFECT_ICONS[effect.id] || '⚠';

        setupTooltip(dot, () => {
            const name = t(effect.nameKey);
            const desc = t(effect.descKey);
            return `<h4>${name}</h4><p>${desc}</p>`;
        });

        strip.appendChild(dot);
    });

    if (overflow > 0) {
        const overflowDot = document.createElement('span');
        overflowDot.className = 'info-effect-dot info-effect-overflow';
        overflowDot.textContent = `+${overflow}`;

        const names = activeEffects.slice(MAX_VISIBLE_EFFECTS).map(e => t(e.nameKey)).join(', ');
        setupTooltip(overflowDot, () => `<h4>+${overflow} more</h4><p>${names}</p>`);

        strip.appendChild(overflowDot);
    }
}
