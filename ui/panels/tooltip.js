// Tooltip + debuff-icon module

import { resources, computeResourceRates } from '../../core/resources.js';
import { formatNumber } from '../../core/formatting.js';
import { gameFlags } from '../../data/gameFlags.js';
import { computeRewardEffects, upgradeEffects } from '../../data/upgradeEffects.js';
import { getMorale } from '../../data/morale.js';
import { jobs } from '../../data/jobsManager.js';
import { buildings } from '../../data/definitions/buildings.js';
import { allActions as salvageActions } from '../../data/definitions/allActions.js';
import { getBlockedStatus } from '../../data/unlockRules.js';

let globalTooltip = null;
const tooltipRegistry = new WeakMap();
let currentTooltipElement = null;
let docMouseMoveHandler = null;
let tooltipsEnabled = true;
let tooltipScopeRoot = null; // when set, tooltips only resolve within this subtree
let tooltipAttributeObserver = null; // new: keep observer to strip native title attrs
// removed tooltipLockUntil and per-element lock complexity

// --- NEW: ensure a single persistent doc mousemove handler ----------------
function ensureDocMouseMoveHandler() {
    if (docMouseMoveHandler) return;
    // reuse the same logic previously created inline
    docMouseMoveHandler = (moveEvent) => {
        // respect global suppression (popups/menus)
        if (!tooltipsEnabled) return;
        const tt = getOrCreateTooltip();
        if (tt._hideTimeout) {
            clearTimeout(tt._hideTimeout);
            tt._hideTimeout = null;
        }

        // No per-element lock here anymore — rely on priority + topmost hit element
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);

        // If a modal/popup opted-in to tooltips, only allow tooltips inside that popup.
        // This prevents background elements (behind the overlay) from generating tooltips.
        if (tooltipScopeRoot) {
            const isInsideScope = elements.some(el => {
                try { return !!(el && tooltipScopeRoot.contains(el)); } catch { return false; }
            });
            if (!isInsideScope) {
                hideTooltip();
                return;
            }
        }

        // If the cursor is over the open objectives drawer, suppress tooltips just for that region
        try {
            const overObjectivesDrawer = elements.some(el => {
                if (!el || !el.closest) return false;
                const host = el.closest('.objectives-drawer');
                return !!(host && host.classList && host.classList.contains('open'));
            });
            if (overObjectivesDrawer) {
                hideTooltip();
                return;
            }
        } catch (e) { /* ignore */ }

        const candidates = [];
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const candidate = el.closest('[data-tooltip-registered]');
            if (!candidate || !tooltipRegistry.has(candidate)) continue;
            if (tooltipScopeRoot && !(tooltipScopeRoot.contains(candidate))) continue;

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
    // Some overlays (e.g., combat) use extremely high z-index values.
    // Keep tooltips above those overlays.
    try { t.style.zIndex = '2147483202'; } catch (e) { /* ignore */ }
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

// Disable tooltip rendering while popups/menus are open to avoid accidental hover
window.addEventListener('popup-open', (e) => {
    // Some overlays (e.g., combat) want tooltips enabled inside the popup.
    // Default behavior remains: disable tooltips while popups/menus are open.
    try {
        if (e && e.detail && e.detail.allowTooltips) {
            tooltipsEnabled = true;
            // Optional scoping: restrict tooltips to the popup root to avoid leaking through the overlay.
            tooltipScopeRoot = null;
            const rootId = e.detail.tooltipRootId;
            if (rootId) tooltipScopeRoot = document.getElementById(rootId) || null;
            hideTooltip();
            return;
        }
        tooltipsEnabled = false;
        tooltipScopeRoot = null;
        hideTooltip();
    } catch (err) { /* ignore */ }
});
window.addEventListener('popup-close', () => {
    try {
        tooltipsEnabled = true;
        tooltipScopeRoot = null;
    } catch (e) { /* ignore */ }
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

    // Helper: format seconds into human ETA (reused for both actions and buildings)
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

    // Helper: render an array of cost/drain entries with affordability and ETA logic
    function renderCostItems(arr, opts = {}) {
        if (!Array.isArray(arr) || !arr.length) return '';
        const parts = arr.map(item => {
            const res = resources.find(r => r.name === item.resource);
            const have = res ? Number(res.amount) : 0;
            const need = Number(item.amount || 0);
            if (have < need) {
                // compute shortfall and ETA using computeResourceRates
                let etaText = '';
                try {
                    const rates = computeResourceRates(item.resource);
                    if (rates && rates.netPerSecond > 1e-9) {
                        const shortfall = need - have;
                        const eta = formatETA(shortfall / rates.netPerSecond);
                        if (eta) etaText = ` <span class="eta">(ETA: ${eta})</span>`;
                    }
                } catch (e) { /* ignore compute errors */ }
                const totalLabel = opts.showTotal ? ' (Total)' : '';
                return `<p><span style="color:#ff6b6b">${item.resource}: ${need}${totalLabel} (missing ${formatNumber(need - have)})</span>${etaText}</p>`;
            }
            const totalLabel = opts.showTotal ? ' (Total)' : '';
            return `<p>${item.resource}: ${need}${totalLabel}</p>`;
        });
        return parts.join('');
    }

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
        // This is a building tooltip; internal fields like buildTime are excluded from display
        if (data.description) html += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) html += `<div class="tooltip-section"><h4>Cost</h4>${renderCostItems(data.cost)}</div>`;
        if (data.produces) html += `<div class="tooltip-section"><h4>Generation</h4><p>${data.produces}: +${data.rate}/s</p></div>`;
        // Buildings: render Effects section when building has an effect descriptor
        try {
            const lines = [];
            const renderEff = (eff) => {
                if (!eff || !eff.type) return;
                if (eff.type === 'storage') {
                    lines.push(`${eff.resource}: +${eff.value} capacity`);
                } else if (eff.type === 'job') {
                    // find job friendly name
                    const job = jobs.find(j => j.id === eff.jobId || j.name === eff.jobId || j.id === eff.job || j.name === eff.job);
                    lines.push(`Unlocks job: ${job ? job.name : (eff.jobId || eff.job || 'unknown')} (per built)`);
                } else if (eff.type === 'passive') {
                    lines.push(`${eff.resource}: +${eff.rate}/s (per built)`);
                } else if (eff.type === 'production') {
                    lines.push(`${eff.resource}: +${eff.rate}/s`);
                } else {
                    try { lines.push(Object.keys(eff).map(k => `${k}: ${eff[k]}`).join(', ')); } catch (e) { lines.push(String(eff)); }
                }
            };
            if (data.effect) renderEff(data.effect);
            if (Array.isArray(data.effects)) data.effects.forEach(renderEff);
            if (lines.length) html += `<div class="tooltip-section"><h4>Effects</h4>${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
        } catch (e) { /* ignore building effect rendering errors */ }
        return html;
    }

    if (data && data.id) {
        html += `<h4>${data.name}</h4>`;
        if (data.description) html += `<p class="tooltip-description">${data.description}</p>`;

        // If the action is currently blocked, surface the reason prominently
        try {
            const block = getBlockedStatus(data.id, { actions: salvageActions, flags: gameFlags, characterState });
            if (block && block.blocked) {
                const reason = String(block.reason || 'Currently unavailable').trim();
                html += `<div class="tooltip-section"><h4>Requirements</h4><p style="color:#ff6b6b;margin-left:0">${reason}</p></div>`;
            }
        } catch (e) { /* ignore block check errors */ }

        // Costs / drains — use the shared renderer so ETA/affordability is consistent
        const costHtml = (renderCostItems(data.cost) || '') + (renderCostItems(data.drain) || '');
        if (costHtml) html += `<div class="tooltip-section"><h4>Cost</h4>${costHtml}</div>`;

        // If this item/job produces a resource, show any active upgrade modifiers and Morale that affect
        // that production (e.g., Rain Tarp, Purification Unit, Morale). This uses the same matching
        // logic as computeRewardEffects so labels are consistent with action previews.
        try {
            if (data.produces) {
                const produced = data.produces;
                const aid = (data.id || '').toLowerCase();
                const eff = computeRewardEffects(aid, produced, gameFlags);
                const labels = (eff && Array.isArray(eff.labels)) ? eff.labels.slice() : [];
                try {
                    const m = getMorale();
                    if (m && typeof m.percent === 'number') {
                        const delta = Math.round(m.percent - 100);
                        if (delta !== 0) {
                            const sign = delta > 0 ? '+' : '';
                            labels.push(`Morale: ${sign}${delta}%`);
                        }
                    }
                } catch {}
                if (labels.length) {
                    html += `<div class="tooltip-section"><h4>Modifiers</h4><ul class="tooltip-bonuses">${labels.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul></div>`;
                }
            }
        } catch (e) { /* ignore modifier rendering errors */ }

        // Effects: for Upgrade-category items, show expected modifiers / impacts below Cost
        try {
            if (data.category === 'Upgrade' || data.category === 'Upgrades') {
                // explicit tooltipEffects override
                let effectLines = [];
                if (Array.isArray(data.tooltipEffects)) {
                    effectLines = data.tooltipEffects.map(e => {
                        if (typeof e === 'string') return e;
                        if (e.resource && e.multiplier) return `${e.resource}: +${((e.multiplier - 1) * 100).toFixed(0)}%`;
                        if (e.label) return e.label;
                        return JSON.stringify(e);
                    });
                } else {
                    // try to infer from upgradeEffects by matching eff.actions tokens to this action id
                    const aid = (data.id || '').toLowerCase();
                    const matched = [];
                    for (const eff of (upgradeEffects || [])) {
                        if (!eff) continue;
                        if (!eff.actions || eff.actions.length === 0) {
                            // global effect — include conservatively
                            matched.push(eff);
                            continue;
                        }
                        // check each token in eff.actions against the action id
                        const matches = eff.actions.some(tok => {
                            if (!tok) return false;
                            const t = String(tok).toLowerCase();
                            return aid.indexOf(t) !== -1 || t.indexOf(aid) !== -1;
                        });
                        if (matches) matched.push(eff);
                    }
                    // build human lines from matched effects
                    effectLines = matched.map(eff => {
                        if (eff.label) return eff.label;
                        if (eff.resources && eff.multiplier) return `${eff.resources.join(', ')}: +${((eff.multiplier - 1) * 100).toFixed(0)}%`;
                        if (eff.resources) return `Affects: ${eff.resources.join(', ')}`;
                        return JSON.stringify(eff);
                    });
                }

                if (effectLines.length) {
                    html += `<div class="tooltip-section"><h4>Effects</h4><ul class="tooltip-bonuses">${effectLines.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul></div>`;
                }
            }
        } catch (e) { /* ignore effect rendering errors */ }

        // Rewards (may be hidden for certain actions)
        if (data.reward && data.reward.length > 0) {
            const hideReward = !!data.hideRewardPreview || data.id === 'investigateSound';
            if (!hideReward) {
                const rewardsHtml = data.reward.map(r => {
                    // compute base label and whether any upgrade multiplier applies
                    const rawActionKey = data.id || (typeof data.name === 'string' ? data.name : null);
                    const actionKey = rawActionKey ? String(rawActionKey).toLowerCase().replace(/\s+/g, '') : null;
                    const entry = computeUpgradeMultiplier(r.resource, actionKey);
                    const multiplier = entry?.multiplier || 1;
                    const isBoosted = multiplier > 1.000001;
                    const isRange = Array.isArray(r.amount);
                    const label = isRange
                        ? `${Math.floor(r.amount[0] * multiplier)} - ${Math.floor(r.amount[1] * multiplier)}`
                        : `${Math.floor(r.amount * multiplier)}`;
                    const cls = isBoosted ? 'reward-amount boosted' : 'reward-amount';
                    const chance = (typeof r.chance === 'number') ? (r.chance > 1 ? r.chance / 100 : r.chance) : null;
                    const chanceText = (chance && chance > 0 && chance < 1) ? ` (${Math.round(chance * 100)}% chance)` : '';
                    return `<p>${r.resource}: <span class="${cls}">${label}</span>${chanceText}</p>`;
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

                // --- Optional: Unlocks section (only shown when this item actually unlocks things) ---
                try {
                    // Global policy: hide unlock spoilers for exploration actions unless explicitly asked.
                    // Allow explicit control per-data object:
                    // - If data.showUnlocks === false -> never show
                    // - If data.tooltipUnlocks is an array -> use it instead of auto-detection
                    // - If data.category === 'Exploration' and caller did not explicitly opt-in
                    //   (showUnlocks === true or tooltipUnlocks provided), skip rendering.
                    if (data && data.showUnlocks === false) {
                        /* explicit opt-out */
                    } else if (data && data.category === 'Exploration' && data.showUnlocks !== true && !Array.isArray(data.tooltipUnlocks)) {
                        // respect global no-spoiler rule for exploration category
                    } else {
                        let unlockIds = [];
                        if (Array.isArray(data.tooltipUnlocks)) {
                            unlockIds = data.tooltipUnlocks.slice();
                        } else {
                            // auto-detect from data.unlocks and current stage unlocks (legacy behavior)
                            if (Array.isArray(data.unlocks)) unlockIds.push(...data.unlocks);
                            const stageIdx = (typeof data.stage === 'number') ? data.stage : 0;
                            const stageObj = (data.stages || [])[stageIdx];
                            if (stageObj && Array.isArray(stageObj.unlocks)) unlockIds.push(...stageObj.unlocks);
                        }

                        if (unlockIds.length) {
                            // Deduplicate
                            const uniq = Array.from(new Set(unlockIds));
                            const sectionNames = {
                                crewManagementSection: 'Crew Management',
                                crashSiteSection: 'Crash Site',
                                colonySection: 'Colony',
                                researchSection: 'Research',
                                manufacturingSection: 'Manufacturing',
                                shipyardSection: 'Shipyard',
                                galaxyMapSection: 'Galaxy Map',
                                journalSection: 'Journal',
                                encryptedDriveSection: 'Encrypted Drive'
                            };
                            const unlockLines = uniq.map(id => {
                                // job id?
                                const job = jobs.find(j => j.id === id || j.name === id);
                                if (job) return `<li class="bonus-item">Unlocks job: ${job.name}</li>`;
                                // building?
                                const b = buildings.find(bb => bb.id === id || bb.name === id);
                                if (b) return `<li class="bonus-item">Unlocks building: ${b.name}</li>`;
                                if (sectionNames[id]) return `<li class="bonus-item">Unlocks ${sectionNames[id]}</li>`;
                                // fallback: show raw id
                                return `<li class="bonus-item">Unlocks: ${String(id)}</li>`;
                            }).join('');
                            html += `<div class="tooltip-section"><h4>Unlocks</h4><ul class="tooltip-bonuses">${unlockLines}</ul></div>`;
                        }
                    }
                } catch (e) { /* ignore unlock rendering errors */ }

        try {
            // Check for depleted survival resources and present clear player guidance.
            const food = resources.find(r => r.name === 'Food Rations');
            const water = resources.find(r => r.name === 'Clean Water');
            const isHungry = !!(food && Number(food.amount) <= 0);
            const isThirsty = !!(water && Number(water.amount) <= 0);
            const effects = [];
            if (isHungry && isThirsty) {
                effects.push('<span style="color:#ff6b6b">Hunger &amp; Thirst — actions take 2× as long.</span>');
            } else {
                if (isHungry) effects.push('<span style="color:#ff6b6b">Hunger — actions take 50% longer.</span>');
                if (isThirsty) effects.push('<span style="color:#ff6b6b">Thirst — actions take 50% longer.</span>');
            }

            if (effects.length) {
                // compute effective duration if base numeric
                if (typeof data.duration === 'number') {
                    const multiplier = 1 + (isHungry ? 0.5 : 0) + (isThirsty ? 0.5 : 0);
                    const effective = Math.ceil(data.duration * multiplier);
                    // mark effective duration with a class so it can be highlighted via CSS
                    durationHtml = `<p>Duration: ${baseDurationText}</p><p><strong class="effective-duration">Effective duration: ${effective}s</strong></p>`;
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
        if (data.cost && data.cost.length > 0) html += `<div class="tooltip-section"><h4>Cost</h4>${renderCostItems(data.cost)}</div>`;
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
        icon.innerHTML = `<span class="debuff-badge" aria-hidden="true">!</span>`;

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
            icon.style.zIndex = '650'; // above drawer (600) but below modal overlays (>=1000)
            icon.style.position = 'relative';
            icon.style.pointerEvents = 'auto';
            const span = icon.querySelector('.debuff-badge');
            if (span) span.style.pointerEvents = 'auto';
        } catch (e) { /* ignore */ }

        // no manual mouse handlers needed — setupTooltip takes care of showing/hiding
    }
    return icon;
}

function buildSurvivalDebuffTooltipHtml(kind) {
    const k = String(kind || '').toLowerCase();
    const isHungry = k === 'hunger';
    const isThirsty = k === 'thirst';
    const title = isHungry ? 'Hunger' : 'Thirst';

    const lines = [];
    lines.push('Morale: -20%.');
    // Keep this phrasing general (not action-tooltip specific), while still conveying impact.
    lines.push('Task time: +50%.');
    if (isHungry) lines.push('Combat: -10 hit chance.');
    if (isThirsty) lines.push('Combat: +18% time between attacks.');

    return `
        <h4>${title}</h4>
        <div class="tooltip-section">
            <ul class="tooltip-bonuses">${lines.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul>
        </div>
    `;
}

// Public: update the small debuff icons on resource rows
export function updateSurvivalDebuffBadge() {
    const food = resources.find(r => r.name === 'Food Rations');
    const water = resources.find(r => r.name === 'Clean Water');

    const isHungry = !!(food && Number(food.amount) <= 0);
    const isThirsty = !!(water && Number(water.amount) <= 0);

    const foodIcon = ensureDebuffIcon('Food Rations');
    if (foodIcon) {
        if (isHungry) {
            foodIcon.classList.add('active');
            foodIcon._tooltipText = buildSurvivalDebuffTooltipHtml('hunger');
        } else {
            foodIcon.classList.remove('active');
            foodIcon._tooltipText = '';
        }
    }

    const waterIcon = ensureDebuffIcon('Clean Water');
    if (waterIcon) {
        if (isThirsty) {
            waterIcon.classList.add('active');
            waterIcon._tooltipText = buildSurvivalDebuffTooltipHtml('thirst');
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