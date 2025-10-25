// Tooltip + debuff-icon module

import { resources } from './resources.js';
import { formatNumber } from './formatting.js';

let globalTooltip = null;
const tooltipRegistry = new WeakMap();
let currentTooltipElement = null;
let docMouseMoveHandler = null;
let tooltipLockUntil = 0;

// Create / return tooltip DOM
export function getOrCreateTooltip() {
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.className = 'tooltip';
        document.body.appendChild(globalTooltip);
    }
    return globalTooltip;
}

export function hideTooltip() {
    const tooltip = getOrCreateTooltip();
    if (tooltip) tooltip.style.visibility = 'hidden';
    currentTooltipElement = null;
    if (docMouseMoveHandler) {
        document.removeEventListener('mousemove', docMouseMoveHandler);
        docMouseMoveHandler = null;
    }
}

window.addEventListener('request-hide-tooltip', () => {
    try { hideTooltip(); } catch (e) { /* ignore */ }
});

export function updateTooltipPosition(e, tooltip) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let newLeft = e.clientX + 15;
    let newTop = e.clientY + 15;

    if (newLeft + tooltipRect.width > viewportWidth) newLeft = e.clientX - tooltipRect.width - 15;
    if (newTop + tooltipRect.height > viewportHeight) newTop = e.clientY - tooltipRect.height - 15;
    if (newTop < 0) newTop = 5;
    if (newLeft < 0) newLeft = 5;
    
    tooltip.style.left = `${newLeft}px`;
    tooltip.style.top = `${newTop}px`;
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

        let costHtml = '';
        if (data.cost && data.cost.length > 0) costHtml += data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('');
        if (data.drain && data.drain.length > 0) costHtml += data.drain.map(d => `<p>${d.resource}: ${d.amount} (Total)</p>`).join('');
        if (costHtml) tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${costHtml}</div>`;

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

        tooltip.innerHTML += `<p>Duration: ${data.duration}s</p>`;
    } else if (data && typeof data.isResearched !== 'undefined') {
        tooltip.innerHTML = `<h4>${data.name}</h4>`;
        if (data.description) tooltip.innerHTML += `<p class="tooltip-description">${data.description}</p>`;
        if (data.cost && data.cost.length > 0) tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${data.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
        tooltip.innerHTML += `<p>Research Time: ${data.duration}s</p>`;
    }

    tooltip.style.visibility = 'visible';
    if (event && typeof updateTooltipPosition === 'function') updateTooltipPosition(event, tooltip);

    currentTooltipElement = regEl;
}

// Public: register element with tooltip data (function or value)
export function setupTooltip(element, tooltipData) {
    tooltipRegistry.set(element, tooltipData);
    try { element.dataset.tooltipRegistered = '1'; } catch (e) { /* ignore */ }

    element.addEventListener('mouseenter', (e) => {
        const tooltip = getOrCreateTooltip();
        if (tooltip._hideTimeout) {
            clearTimeout(tooltip._hideTimeout);
            tooltip._hideTimeout = null;
        }

        renderTooltipForElement(element, e);

        if (!docMouseMoveHandler) {
            docMouseMoveHandler = (moveEvent) => {
                const tt = getOrCreateTooltip();
                if (tt._hideTimeout) {
                    clearTimeout(tt._hideTimeout);
                    tt._hideTimeout = null;
                }

                if (tooltipLockUntil && Date.now() < tooltipLockUntil) {
                    if (currentTooltipElement) {
                        if (tt.style.visibility === 'visible') updateTooltipPosition(moveEvent, tt);
                        return;
                    }
                }

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
            icon.dataset.tooltipRegistered = '1';
            icon.dataset.tooltipSource = 'debuff-icon';
            icon.dataset.tooltipPriority = '999';
            icon.style.zIndex = '999';
            icon.style.position = 'relative';
            const span = icon.querySelector('.icon');
            if (span) span.style.pointerEvents = 'none';
        } catch (e) { /* ignore */ }

        // direct icon tooltip (keeps row tooltip untouched)
        icon.addEventListener('mouseenter', (ev) => {
            try {
                const tt = getOrCreateTooltip();
                if (tt._hideTimeout) { clearTimeout(tt._hideTimeout); tt._hideTimeout = null; }
                tt.innerHTML = `<p class="tooltip-description">${icon._tooltipText || ''}</p>`;
                tt.style.visibility = 'visible';
                updateTooltipPosition(ev, tt);
                currentTooltipElement = icon;
                tooltipLockUntil = Date.now() + 220;
            } catch (err) { /* ignore */ }
        });

        icon.addEventListener('mouseleave', (e) => {
            try {
                const elUnder = document.elementFromPoint(e.clientX, e.clientY);
                if (elUnder && (elUnder === row || row.contains(elUnder))) {
                    row.dispatchEvent(new MouseEvent('mouseenter', {
                        bubbles: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    }));
                } else {
                    const tt = getOrCreateTooltip();
                    if (tt._hideTimeout) clearTimeout(tt._hideTimeout);
                    tt._hideTimeout = setTimeout(() => { hideTooltip(); tt._hideTimeout = null; }, 160);
                }
            } catch (err) { /* ignore */ }
        });

        icon.addEventListener('mousemove', (e) => {
            try {
                const tt = getOrCreateTooltip();
                if (tt.style.visibility === 'visible') updateTooltipPosition(e, tt);
            } catch (ignore) {}
        });
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
