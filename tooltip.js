// Tooltip + debuff-icon module

import { resources, computeResourceRates } from './resources.js';
import { formatNumber } from './formatting.js';
import { gameFlags } from './data/gameFlags.js';
import { computeRewardEffects } from './data/upgradeEffects.js';

let globalTooltip = null;
const tooltipRegistry = new WeakMap();
let currentTooltipElement = null;
let docMouseMoveHandler = null;
let tooltipAttributeObserver = null; // new: keep observer to strip native title attrs
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
    // stop any running tooltip auto-refresh
    if (tooltip._refreshInterval) {
        clearInterval(tooltip._refreshInterval);
        tooltip._refreshInterval = null;
    }
    // clear persisted position so next show repositions from cursor
    tooltip._fixedLeft = null;
    tooltip._fixedTop = null;

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

    // persist the chosen coordinates so subsequent auto-refreshes reuse them
    tooltip._fixedLeft = tooltip.style.left;
    tooltip._fixedTop = tooltip.style.top;
}

// Helper: build tooltip HTML from the registry data (pure, side-effect-free)
function buildTooltipHTML(data) {
    // string builder
    let html = '';

    if (data && typeof data.totalProduction !== 'undefined') {
        html = `
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
        return html;
    }

    if (typeof data === 'string') {
        if (/<[a-z][\s\S]*>/i.test(data)) return data;
        return data.replace(/\n/g, '<br>');
    }

    if (data && typeof data.count !== 'undefined') {
        if (data.description) html += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) html += `<div class="tooltip-section"><h4>Cost</h4>${data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
        if (data.produces) html += `<div class="tooltip-section"><h4>Generation</h4><p>${data.produces}: +${data.rate}/s</p></div>`;
        return html;
    }

    if (data && data.id) {
        html += `<h4>${data.name}</h4>`;
        if (data.description) html += `<p class="tooltip-description">${data.description}</p>`;

        // Costs / drains — highlight missing resources and show ETA when net production is positive
        function formatETA(seconds) {
            if (!isFinite(seconds) || seconds <= 0) return null;
            const s = Math.ceil(seconds);
            if (s >= 3600) {
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                return `${h}h ${m}m`;
            }
            if (s >= 60) {
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return `${m}m ${sec}s`;
            }
            return `${s}s`;
        }

        let costHtml = '';
        if (data.cost && data.cost.length > 0) {
            const parts = data.cost.map(c => {
                const res = resources.find(r => r.name === c.resource);
                const have = res ? Number(res.amount) : 0;
                const need = Number(c.amount || 0);
                if (have < need) {
                    // compute shortfall and ETA using computeResourceRates
                    let etaText = '';
                    try {
                        const rates = computeResourceRates(c.resource);
                        if (rates && rates.netPerSecond > 1e-9) {
                            const shortfall = need - have;
                            const eta = formatETA(shortfall / rates.netPerSecond);
                            if (eta) etaText = ` <span class="eta">(ETA: ${eta})</span>`;
                        }
                    } catch (e) { /* ignore compute errors */ }
                    return `<p><span style="color:#ff6b6b">${c.resource}: ${need} (missing ${formatNumber(need - have)})</span>${etaText}</p>`;
                }
                return `<p>${c.resource}: ${need}</p>`;
            });
            costHtml += parts.join('');
        }
        if (data.drain && data.drain.length > 0) {
            const parts = data.drain.map(d => {
                const res = resources.find(r => r.name === d.resource);
                const have = res ? Number(res.amount) : 0;
                const need = Number(d.amount || 0);
                if (have < need) {
                    let etaText = '';
                    try {
                        const rates = computeResourceRates(d.resource);
                        if (rates && rates.netPerSecond > 1e-9) {
                            const shortfall = need - have;
                            const eta = formatETA(shortfall / rates.netPerSecond);
                            if (eta) etaText = ` <span class="eta">(ETA: ${eta})</span>`;
                        }
                    } catch (e) { /* ignore */ }
                    return `<p><span style="color:#ff6b6b">${d.resource}: ${need} (Total) — missing ${formatNumber(need - have)}</span>${etaText}</p>`;
                }
                return `<p>${d.resource}: ${need} (Total)</p>`;
            });
            costHtml += parts.join('');
        }
        if (costHtml) html += `<div class="tooltip-section"><h4>Cost</h4>${costHtml}</div>`;

        // Rewards (may be hidden for certain actions)
        if (data.reward && data.reward.length > 0) {
            const hideReward = !!data.hideRewardPreview || data.id === 'investigateSound';
            if (!hideReward) {
                const rewardsHtml = data.reward.map(r => {
                    // compute base label
                    const rawActionKey = data.id || (typeof data.name === 'string' ? data.name : null);
                    const actionKey = rawActionKey ? String(rawActionKey).toLowerCase().replace(/\s+/g, '') : null;
                    const { multiplier } = computeUpgradeMultiplier(r.resource, actionKey);
                    const isRange = Array.isArray(r.amount);
                    const label = isRange
                        ? `${Math.floor(r.amount[0] * multiplier)} - ${Math.floor(r.amount[1] * multiplier)}`
                        : `${Math.floor(r.amount * multiplier)}`;
                    return `<p>${r.resource}: <span class="reward-amount">${label}</span></p>`;
                }).join('');

                // collect labels for display
                const labelsFlat = [].concat(...(data.reward.map((r) => {
                    const rawActionKey = data.id || (typeof data.name === 'string' ? data.name : null);
                    const actionKey = rawActionKey ? String(rawActionKey).toLowerCase().replace(/\s+/g, '') : null;
                    const entry = computeUpgradeMultiplier(r.resource, actionKey);
                    return entry.labels || [];
                })));
                const uniqueLabels = Array.from(new Set(labelsFlat));

                html += `<div class="tooltip-section"><h4>Reward</h4>${rewardsHtml}` +
                    (uniqueLabels.length ? `<ul class="tooltip-bonuses">${uniqueLabels.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul>` : '') +
                    `</div>`;
            } else {
                const rewardHtmlHidden = data.reward.map(() => `<p>???</p>`).join('');
                html += `<div class="tooltip-section"><h4>Reward</h4>${rewardHtmlHidden}</div>`;
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
                html += `<div class="tooltip-section"><h4>Current Conditions</h4><p>${effects.join('<br>')}</p></div>`;
            }
        } catch (err) {
            // don't break tooltip rendering on errors
        }

        html += `<div class="tooltip-section">${durationHtml}</div>`;
        return html;
    }

    if (data && typeof data.isResearched !== 'undefined') {
        html += `<h4>${data.name}</h4>`;
        if (data.description) html += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) html += `<div class="tooltip-section"><h4>Cost</h4>${data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
        html += `<p>Research Time: ${data.duration}s</p>`;
        return html;
    }

    return html;
}

// Render tooltip for a registered element (uses buildTooltipHTML and preserves position on refresh)
function renderTooltipForElement(regEl, event) {
    const tooltip = getOrCreateTooltip();

    if (tooltip._hideTimeout) {
        clearTimeout(tooltip._hideTimeout);
        tooltip._hideTimeout = null;
    }

    // remember last mouse event so auto-refresh can re-position the tooltip reliably
    tooltip._lastEvent = event || tooltip._lastEvent || { clientX: Math.round(window.innerWidth / 2), clientY: Math.round(window.innerHeight / 2) };

    const tooltipData = tooltipRegistry.get(regEl);
    const data = (typeof tooltipData === 'function') ? tooltipData() : tooltipData;

    // build content and show
    tooltip.innerHTML = buildTooltipHTML(data);

    tooltip.style.visibility = 'visible';
    tooltip.classList.add('visible');
    if (event && typeof updateTooltipPosition === 'function') updateTooltipPosition(event, tooltip);

    currentTooltipElement = regEl;

    // start a single persistent auto-refresh while visible
    ensureTooltipAutoRefresh(tooltip);
}

/* helper: compute combined multiplier and collect labels for a specific resource/action */
function computeUpgradeMultiplier(resourceName, actionId) {
    const normalizedActionId = actionId ? String(actionId).toLowerCase().replace(/\s+/g, '') : '';
    return computeRewardEffects(normalizedActionId, resourceName, gameFlags);
}

// Public: register element with tooltip data (function or value)
export function setupTooltip(element, tooltipData) {
    tooltipRegistry.set(element, tooltipData);
    try { element.dataset.tooltipRegistered = '1'; } catch (e) { /* ignore */ }

    // Remove any native title (browser tooltip) and ensure future title changes are stripped
    try {
        element.removeAttribute('title');
        if (!tooltipAttributeObserver) {
            tooltipAttributeObserver = new MutationObserver((records) => {
                for (const r of records) {
                    if (r.type === 'attributes' && r.attributeName === 'title') {
                        try {
                            const t = r.target;
                            if (t && t.dataset && t.dataset.tooltipRegistered) t.removeAttribute('title');
                        } catch (e) { /* ignore */ }
                    }
                }
            });
        }
        tooltipAttributeObserver.observe(element, { attributes: true, attributeFilter: ['title'] });
    } catch (e) { /* ignore */ }

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

// Public: refresh the currently visible tooltip (rebuild content, reposition, ensure auto-refresh)
export function refreshCurrentTooltip() {
    const tooltip = getOrCreateTooltip();
    if (!tooltip || tooltip.style.visibility !== 'visible') return;

    // prefer the existing currentTooltipElement, but fall back to resolving a candidate
    let element = currentTooltipElement;
    if (!element || !tooltipRegistry.has(element)) {
        // try to resolve from last known mouse event
        const evt = tooltip._lastEvent || { clientX: Math.round(window.innerWidth / 2), clientY: Math.round(window.innerHeight / 2) };
        try {
            const elems = document.elementsFromPoint(evt.clientX, evt.clientY || 0);
            for (const e of elems) {
                const cand = e.closest && e.closest('[data-tooltip-registered]');
                if (cand && tooltipRegistry.has(cand)) {
                    element = cand;
                    break;
                }
            }
        } catch (err) { /* ignore */ }
    }

    if (!element || !tooltipRegistry.has(element)) {
        // nothing we can refresh for
        return;
    }

    try {
        // ensure hide timeout cleared so tooltip remains visible while we refresh
        if (tooltip._hideTimeout) {
            clearTimeout(tooltip._hideTimeout);
            tooltip._hideTimeout = null;
        }

        currentTooltipElement = element;
        const tooltipData = tooltipRegistry.get(element);
        const data = (typeof tooltipData === 'function') ? tooltipData() : tooltipData;

        // single immediate rebuild
        tooltip.innerHTML = buildTooltipHTML(data);

        // reuse persisted coords where possible to avoid jumps
        if (tooltip._fixedLeft && tooltip._fixedTop) {
            tooltip.style.left = tooltip._fixedLeft;
            tooltip.style.top = tooltip._fixedTop;
        } else if (tooltip._lastEvent && typeof updateTooltipPosition === 'function') {
            updateTooltipPosition(tooltip._lastEvent, tooltip);
        }

        // ensure the single persistent auto-refresh is running
        ensureTooltipAutoRefresh(tooltip);
    } catch (e) { /* ignore */ }
}

// Ensure there is exactly one auto-refresh interval while the tooltip is visible.
// Rebuilds the currently-visible tooltip every second (cheap) and stops when tooltip is hidden.
function ensureTooltipAutoRefresh(tooltip) {
    if (!tooltip) return;
    // already running
    if (tooltip._refreshInterval) return;

    tooltip._refreshInterval = setInterval(() => {
        try {
            // stop if tooltip hidden
            if (tooltip.style.visibility !== 'visible') {
                clearInterval(tooltip._refreshInterval);
                tooltip._refreshInterval = null;
                return;
            }

            // if we have a visible registered element, rebuild content in-place
            const el = (currentTooltipElement && tooltipRegistry.has(currentTooltipElement)) ? currentTooltipElement : null;
            if (!el) return;

            const td = tooltipRegistry.get(el);
            const d = (typeof td === 'function') ? td() : td;
            tooltip.innerHTML = buildTooltipHTML(d);

            // keep tooltip anchored: prefer persisted coords, else recompute
            if (tooltip._fixedLeft && tooltip._fixedTop) {
                tooltip.style.left = tooltip._fixedLeft;
                tooltip.style.top = tooltip._fixedTop;
            } else if (tooltip._lastEvent && typeof updateTooltipPosition === 'function') {
                updateTooltipPosition(tooltip._lastEvent, tooltip);
            }
        } catch (e) {
            // swallow errors so the interval keeps running
        }
    }, 1000);
}