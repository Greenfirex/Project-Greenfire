// Tooltip + debuff-icon module

import { resources } from './resources.js';
import { formatNumber } from './formatting.js';

// ...existing code...
let globalTooltip = null;
const tooltipRegistry = new WeakMap();
let currentTooltipElement = null;
let docMouseMoveHandler = null;
// removed tooltipLockUntil and per-element lock complexity

// --- NEW: ensure a single persistent doc mousemove handler ----------------
function ensureDocMouseMoveHandler() {
    if (docMouseMoveHandler) return;
    // reuse the same logic previously created inline
    docMouseMoveHandler = (moveEvent) => {
        const tt = getOrCreateTooltip();
        if (tt._hideTimeout) {
            clearTimeout(tt._hideTimeout);
            tt._hideTimeout = null;
        }

        // No per-element lock here anymore — rely on priority + topmost hit element
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);

        const candidates = [];
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const candidate = el.closest('[data-tooltip-registered]');
            if (!candidate || !tooltipRegistry.has(candidate)) continue;

            let topIndex = -1;
            for (let k = 0; k < elements.length; k++) {
                const maybe = elements[k];
                if (maybe === candidate || (candidate.contains && candidate.contains(maybe))) {
                    topIndex = k;
                    break;
                }
            }
            if (topIndex === -1) topIndex = elements.length + 10;

            let area = Infinity;
            try {
                const r = candidate.getBoundingClientRect();
                area = Math.max(1, Math.ceil(r.width * r.height));
            } catch (e) { area = Infinity; }

            if (!candidates.find(c => c.candidate === candidate)) {
                candidates.push({
                    candidate,
                    priority: parseInt(candidate.dataset.tooltipPriority || '0', 10),
                    topIndex,
                    area
                });
            }
        }

        let regEl = null;
        if (candidates.length) {
            candidates.sort((a, b) => {
                if (a.priority !== b.priority) return b.priority - a.priority;
                if (a.area !== b.area) return a.area - b.area;
                return a.topIndex - b.topIndex;
            });
            regEl = candidates[0].candidate;
        }

        if (regEl) {
            if (regEl !== currentTooltipElement) {
                renderTooltipForElement(regEl, moveEvent);
            } else if (tt.style.visibility === 'visible') {
                updateTooltipPosition(moveEvent, tt);
            }
            return;
        }

        const topNonTooltip = elements.find(el => !(el instanceof HTMLElement && el.classList && el.classList.contains('tooltip')));
        const gameArea = document.getElementById('gameArea');
        if (!topNonTooltip || (gameArea && gameArea.contains(topNonTooltip))) {
            hideTooltip();
            return;
        }

        hideTooltip();
    };
    document.addEventListener('mousemove', docMouseMoveHandler);
}
// -------------------------------------------------------------------------

// Create / return tooltip DOM
export function getOrCreateTooltip() {
    if (globalTooltip) return globalTooltip;
    const t = document.createElement('div');
    t.className = 'tooltip';
    document.body.appendChild(t);
    globalTooltip = t;
    return t;
}

export function hideTooltip() {
    const tooltip = getOrCreateTooltip();
    if (!tooltip) return;
    tooltip.classList.remove('visible');
    if (tooltip._hideTimeout) {
        clearTimeout(tooltip._hideTimeout);
        tooltip._hideTimeout = null;
    }
    tooltip._hideTimeout = setTimeout(() => {
        try { tooltip.style.visibility = 'hidden'; } catch (e) {}
        tooltip._hideTimeout = null;
    }, 180);
    currentTooltipElement = null;
    // keep the persistent docMouseMoveHandler registered — don't remove it here
}

window.addEventListener('request-hide-tooltip', () => {
    try { hideTooltip(); } catch (e) { /* ignore */ }
});

export function updateTooltipPosition(event, tooltip) {
    if (!tooltip) return;
    const pad = 8; // keep tooltip away from edges
    const offset = 12; // cursor offset
    const vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    const vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);

    // use client coordinates so fixed-position tooltip doesn't cause scroll changes
    const cx = (event && typeof event.clientX === 'number') ? event.clientX : (window.innerWidth / 2);
    const cy = (event && typeof event.clientY === 'number') ? event.clientY : (window.innerHeight / 2);

    // ensure tooltip has been laid out to read dimensions
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    tooltip.style.transform = 'none';

    const rect = tooltip.getBoundingClientRect();
    let tx = cx + offset;
    let ty = cy + offset;

    // clamp horizontally: prefer placing to the right of cursor, else left
    if (tx + rect.width + pad > vw) {
        tx = cx - offset - rect.width;
        if (tx < pad) tx = Math.max(pad, vw - rect.width - pad); // fallback clamp
    }

    // clamp vertically
    if (ty + rect.height + pad > vh) {
        ty = cy - offset - rect.height;
        if (ty < pad) ty = Math.max(pad, vh - rect.height - pad);
    }

    tooltip.style.left = `${Math.round(tx)}px`;
    tooltip.style.top = `${Math.round(ty)}px`;
}

// Render tooltip for a registered element
function renderTooltipForElement(regEl, event) {
    const tooltip = getOrCreateTooltip();

    if (tooltip._hideTimeout) {
        clearTimeout(tooltip._hideTimeout);
        tooltip._hideTimeout = null;
    }

    const tooltipData = tooltipRegistry.get(regEl);
    const data = (typeof tooltipData === 'function') ? tooltipData() : tooltipData;

    tooltip.innerHTML = '';

    // ...existing rendering logic unchanged...
    if (data && typeof data.totalProduction !== 'undefined') {
        tooltip.innerHTML = `
            <h4>Production Breakdown</h4>
            <div class="tooltip-section">
                <p>Base: ${formatNumber(data.base)}/s</p>
                ${data.buildings.map(b => `<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`).join('')}
            </div>
            <div class="tooltip-section">
                <p>Bonus: +${(data.bonusMultiplier * 100).toFixed(0)}%</p>
                ${data.bonuses.map(b => `<p class="tooltip-detail">+${b.multiplier * 100}% from ${b.name}</p>`).join('')}
            </div>
            <hr>
            <p><strong>Total: ${formatNumber(data.totalProduction)}/s</strong></p>
        `;
    } else if (typeof data === 'string') {
        if (/<[a-z][\s\S]*>/i.test(data)) {
            tooltip.innerHTML = data;
        } else {
            tooltip.innerHTML = data.replace(/\n/g, '<br>');
        }
    } else if (data && typeof data.count !== 'undefined') {
        if (data.description) tooltip.innerHTML += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
        if (data.produces) tooltip.innerHTML += `<div class="tooltip-section"><h4>Generation</h4><p>${data.produces}: +${data.rate}/s</p></div>`;
    } else if (data && data.id) {
        tooltip.innerHTML = `<h4>${data.name}</h4>`;
        if (data.description) tooltip.innerHTML += `<p class="tooltip-description">${data.description}</p>`;

        // Costs / drains
        let costHtml = '';
        if (data.cost && data.cost.length > 0) costHtml += data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('');
        if (data.drain && data.drain.length > 0) costHtml += data.drain.map(d => `<p>${d.resource}: ${d.amount} (Total)</p>`).join('');
        if (costHtml) tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${costHtml}</div>`;

        // Rewards (may be hidden for certain actions)
        if (data.reward && data.reward.length > 0) {
            const hideReward = !!data.hideRewardPreview || data.id === 'investigateSound';
            if (!hideReward) {
                const rewardHtml = data.reward.map(r => {
                    const amountText = Array.isArray(r.amount) ? `${r.amount[0]} - ${r.amount[1]}` : r.amount;
                    return `<p>${r.resource}: ${amountText}</p>`;
                }).join('');
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Reward</h4>${rewardHtml}</div>`;
            } else {
                const rewardHtmlHidden = data.reward.map(() => `<p>???</p>`).join('');
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Reward</h4>${rewardHtmlHidden}</div>`;
            }
        }

        // Duration and conditional modifiers (e.g. hunger/thirst debuffs)
        const baseDurationText = (typeof data.duration === 'number') ? `${data.duration}s` : (data.duration || '—');
        let durationHtml = `<p>Duration: ${baseDurationText}</p>`;

        try {
            // Check for depleted survival resources and present clear player guidance.
            const food = resources.find(r => r.name === 'Food Rations');
            const water = resources.find(r => r.name === 'Clean Water');
            const effects = [];
            if (food && Number(food.amount) <= 0) effects.push('<span style="color:#ff6b6b">Hunger — actions take 50% longer.</span>');
            if (water && Number(water.amount) <= 0) effects.push('<span style="color:#ff6b6b">Thirst — actions take 50% longer.</span>');
 
            if (effects.length) {
                // compute effective duration if base numeric
                if (typeof data.duration === 'number') {
                    const multiplier = 1 + 0.5 * effects.length;
                    const effective = Math.ceil(data.duration * multiplier);
                    durationHtml = `<p>Duration: ${baseDurationText}</p><p><strong>Effective duration: ${effective}s</strong></p>`;
                }
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Current Conditions</h4><p>${effects.join('<br>')}</p></div>`;
            }
        } catch (err) {
            // don't break tooltip rendering on errors
        }

        tooltip.innerHTML += `<div class="tooltip-section">${durationHtml}</div>`;
    } else if (data && typeof data.isResearched !== 'undefined') {
        tooltip.innerHTML = `<h4>${data.name}</h4>`;
        if (data.description) tooltip.innerHTML += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
        tooltip.innerHTML += `<p>Research Time: ${data.duration}s</p>`;
    }

    tooltip.style.visibility = 'visible';
    tooltip.classList.add('visible');
    if (event && typeof updateTooltipPosition === 'function') updateTooltipPosition(event, tooltip);

    currentTooltipElement = regEl;
}

// Public: register element with tooltip data (function or value)
export function setupTooltip(element, tooltipData) {
    tooltipRegistry.set(element, tooltipData);
    try { element.dataset.tooltipRegistered = '1'; } catch (e) { /* ignore */ }

    // ensure tooltip DOM + global mousemove handler exist so registered rows work immediately
    ensureDocMouseMoveHandler();
    
    element.addEventListener('mouseenter', (e) => {
        const tooltip = getOrCreateTooltip();
        if (tooltip._hideTimeout) {
            clearTimeout(tooltip._hideTimeout);
            tooltip._hideTimeout = null;
        }

        renderTooltipForElement(element, e);
    });

    element.addEventListener('mouseleave', (e) => {
        const tooltip = getOrCreateTooltip();
        if (tooltip._hideTimeout) clearTimeout(tooltip._hideTimeout);
        tooltip._hideTimeout = setTimeout(() => {
            hideTooltip();
            tooltip._hideTimeout = null;
        }, 160);
    });

    element.addEventListener('mousemove', (e) => {
        const tt = getOrCreateTooltip();
        if (tt.style.visibility === 'visible') updateTooltipPosition(e, tt);
    });
}

// Helper: find resource row tooltip HTML used by row fallback
function getResourceTooltipText(resourceName) {
    const res = resources.find(r => r.name === resourceName);
    if (!res) return resourceName;
    const amount = Number.isInteger(res.amount) ? res.amount : res.amount.toFixed(2);

    return `
        <h4>${res.name}</h4>
        <div class="tooltip-section">
            <p><strong>${amount}</strong> / ${res.capacity}</p>
            ${res.baseConsumption ? `<p>Consumption: ${res.baseConsumption}/s per survivor</p>` : ''}
        </div>
    `;
}

// Create/ensure the small debuff icon on the resource row and attach direct icon handlers
function ensureDebuffIcon(resourceName) {
    let row = document.querySelector(`.info-row[data-resource="${resourceName}"]`);
    if (!row) {
        row = Array.from(document.querySelectorAll('.info-row')).find(r => {
            const labelEl = r.querySelector('.infocolumn1') || r.querySelector('.resource-name') || r.querySelector('span');
            const label = labelEl && labelEl.textContent ? labelEl.textContent.trim() : '';
            return label.toLowerCase() === (resourceName || '').toLowerCase();
        });
    }
    if (!row) return null;

    let icon = row.querySelector('.debuff-icon');
    if (!icon) {
        icon = document.createElement('div');
        icon.className = 'debuff-icon';
        icon.innerHTML = `<span class="icon" aria-hidden="true">⚠️</span>`;

        const leftCol = row.querySelector('.infocolumn1');
        if (leftCol) leftCol.insertBefore(icon, leftCol.firstChild);
        else row.insertBefore(icon, row.firstChild);

        try {
            // register icon with shared tooltip system so doc-level handler can render it
            setupTooltip(icon, () => icon._tooltipText || '');
            icon.dataset.tooltipSource = 'debuff-icon';
            // very high priority so elementsFromPoint + sorting picks it instead of the row
            icon.dataset.tooltipPriority = '9999';
            // ensure the icon is above the row and receives pointer events so elementsFromPoint picks it
            icon.style.zIndex = '9999';
            icon.style.position = 'relative';
            icon.style.pointerEvents = 'auto';
            const span = icon.querySelector('.icon');
            if (span) span.style.pointerEvents = 'auto';
        } catch (e) { /* ignore */ }

        // no manual mouse handlers needed — setupTooltip takes care of showing/hiding
    }
    return icon;
}

// Public: update the small debuff icons on resource rows
export function updateSurvivalDebuffBadge() {
    const food = resources.find(r => r.name === 'Food Rations');
    const water = resources.find(r => r.name === 'Clean Water');

    const foodIcon = ensureDebuffIcon('Food Rations');
    if (foodIcon) {
        if (food && food.amount <= 0) {
            foodIcon.classList.add('active');
            foodIcon._tooltipText = 'Food depleted — actions take longer and consume more.';
        } else {
            foodIcon.classList.remove('active');
            foodIcon._tooltipText = '';
        }
    }

    const waterIcon = ensureDebuffIcon('Clean Water');
    if (waterIcon) {
        if (water && water.amount <= 0) {
            waterIcon.classList.add('active');
            waterIcon._tooltipText = 'Water depleted — actions take longer and consume more.';
        } else {
            waterIcon.classList.remove('active');
            waterIcon._tooltipText = '';
        }
    }
}

// new: ensure tooltip system is initialized at game start
export function initTooltips() {
    // create tooltip DOM and install persistent mousemove handler
    ensureDocMouseMoveHandler();
    getOrCreateTooltip();
}
// ...existing code...