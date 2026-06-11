// ==========================================================================
// Location Engine
//
// Renders the current location into the 3-tile layout inside #crashSiteSection.
// Resource drain is handled entirely by the main game loop via
// setActiveDrainRates() → computeResourceRates() → applyResourceRates().
// The action timer only tracks progress and updates info panel periodically.
// ==========================================================================

import { resources, updateResourceInfo, setActiveDrainRates } from '../../engine/resources.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';
import { getCurrentLocationId, switchToLocation, getLocation } from './locationData.js';

// ==========================================================================
// Active action state
// ==========================================================================

let activeAction = null;
let activeActionId = null;
let actionTimer = null;
let actionProgress = 0;
let loopCount = Number(localStorage.getItem('loopCount') || 0);

// Typewriter state for details tile
let _twTimer = null;
let _twTarget = null;

// Info panel update counter — update every 5 ticks (500ms)
let _infoUpdateCounter = 0;

function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

function canAffordAction(action) {
    if (!action || !Array.isArray(action.drain)) return true;
    return action.drain.every(drain => {
        const resource = getResourceByName(drain.resource);
        if (!resource) return true;
        if (Number(drain.amount) <= 0) return true;
        return Number.isFinite(Number(resource.amount)) && Number(resource.amount) >= Number(drain.amount);
    });
}

function resetLoopState() {
    loopCount += 1;
    try { localStorage.setItem('loopCount', String(loopCount)); } catch { /* ignore */ }
    const stamina = getResourceByName('Stamina');
    if (stamina) stamina.amount = Math.max(5, Math.min(stamina.capacity || 20, 12));
    const food = getResourceByName('Food Rations');
    if (food) food.amount = Math.max(2, Math.min(food.capacity || 10, 6));
    const water = getResourceByName('Drinking Water');
    if (water) water.amount = Math.max(2, Math.min(water.capacity || 10, 6));
    addLogEntry(t('log_loop_started', { loop: loopCount }), LogType.INFO);
    refreshUI();
}

function checkLoopTrigger() {
    const drained = resources.filter(r => r && Number.isFinite(Number(r.amount)) && Number(r.amount) <= 0 && r.name !== 'XP');
    if (drained.length === 0) return false;
    const names = drained.map(r => r.name).join(', ');
    addLogEntry(t('log_loop_triggered', { resources: names }), LogType.ERROR);
    resetLoopState();
    return true;
}

function completeActiveAction() {
    const action = activeAction;
    if (!action) return;

    // Clear active drain rates so the main loop stops deducting resources.
    setActiveDrainRates(null);

    if (action.resultKey) {
        addLogEntry(t(action.resultKey), LogType.SUCCESS);
    } else {
        addLogEntry(`${action._displayName || action.id} completed.`, LogType.INFO);
    }

    // Mark one-time actions completed and force full rebuild so button disappears.
    if (action.oneTime && !action.repeatable) {
        action._completed = true;
        const locHost = document.querySelector('#crashSiteLocationTile');
        if (locHost) { try { delete locHost.dataset.renderedId; } catch { /* ignore */ } }
    }

    try { updateResourceInfo(); } catch { /* ignore */ }

    const targetLoc = action.targetLocation;
    activeAction = null;
    activeActionId = null;
    actionProgress = 0;
    _infoUpdateCounter = 0;
    clearInterval(actionTimer);
    actionTimer = null;

    if (targetLoc && switchToLocation(targetLoc)) {
        addLogEntry(`Arrived at ${t(getLocation(targetLoc)?.nameKey || targetLoc)}.`, LogType.INFO);
    }

    refreshUI();
    checkLoopTrigger();
}

function getGameSpeed() {
    try {
        const s = Number(window.TIME_SCALE);
        return Number.isFinite(s) && s > 0 ? s : 1;
    } catch { return 1; }
}

function startAction(actionId) {
    if (activeAction) return;
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const action = location.actions.find(a => a.id === actionId);
    if (!action) return;
    if (!canAffordAction(action)) return;

    // Tell the main loop about active drain rates so it applies them via computeResourceRates().
    if (action.drain && action.drain.length) {
        const perSecRates = {};
        action.drain.forEach(d => {
            // Negate: positive drain amount → negative per-second rate.
            perSecRates[d.resource] = -Number(d.amount || 0) / (action.durationSeconds || 1);
        });
        setActiveDrainRates(perSecRates);
    } else {
        setActiveDrainRates(null);
    }

    activeActionId = actionId;
    activeAction = action;
    activeAction._displayName = t(action.nameKey);
    actionProgress = 0;
    _infoUpdateCounter = 0;
    refreshUI();

    actionTimer = setInterval(() => {
        if (!activeAction) { clearInterval(actionTimer); actionTimer = null; return; }

        // Advance progress at game speed. At 2x, each 100ms tick counts as 0.2s.
        actionProgress += 0.1 * getGameSpeed();

        _infoUpdateCounter++;
        if (_infoUpdateCounter >= 5) {
            try { updateResourceInfo(); } catch { /* ignore */ }
            _infoUpdateCounter = 0;
        }

        refreshUI();
        if (actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

// ==========================================================================
// Typewriter effect
// ==========================================================================

function typewriteText(el, text, speedMs = 20) {
    if (_twTimer) { clearInterval(_twTimer); _twTimer = null; }
    if (_twTarget) { _twTarget.textContent = _twTarget._twFullText || ''; _twTarget = null; }
    el.textContent = '';
    el._twFullText = text;
    let i = 0;
    _twTarget = el;
    _twTimer = setInterval(() => {
        i++;
        el.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(_twTimer); _twTimer = null; _twTarget = null; delete el._twFullText; }
    }, speedMs);
}

export function updateLocationActionButtonsState() { refreshUI(); }

// ==========================================================================
// Rendering
// ==========================================================================

function renderLocationTile(location) {
    const imgHtml = location.image
        ? `<div class="crashsite-location-image" style="max-height:none;flex:1 1 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;">
               <img src="${location.image}" alt="${t(location.nameKey)}" style="width:100%;height:100%;object-fit:contain;" />
           </div>` : '';
    return `<div class="crashsite-card crashsite-card-location">
        <div class="crashsite-card-header"><h3>${t(location.nameKey)}</h3></div>${imgHtml}</div>`;
}

function renderDetailsTile(location) {
    return `<div class="crashsite-card crashsite-card-details">
        <div class="crashsite-card-header"><h3>${t('crash_details')}</h3></div>
        <p class="crashsite-location-desc" id="crashsiteDetailDesc"></p></div>`;
}

function drainCostHtml(d) {
    const rn = String(d.resource || '');
    const amt = Number(d.amount || 0);
    let cls = 'drain-other';
    if (/stamina/i.test(rn)) cls = 'drain-stamina';
    else if (/food/i.test(rn)) cls = 'drain-food';
    else if (/water/i.test(rn)) cls = 'drain-water';
    const sign = amt < 0 ? '+' : '-';
    return `<span class="crashsite-action-btn-cost ${cls}">${sign}${Math.abs(amt)} ${rn}</span>`;
}

function renderActionsTile(location) {
    const actions = (location.actions || []).filter(a => !a._completed);
    const buttons = actions.map(action => {
        const isActive = activeActionId === action.id;
        const pct = isActive ? Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)) : 0;
        const otherBusy = !!activeAction && activeActionId !== action.id;
        const cannotAfford = action.drain && !canAffordAction(action);
        const disabled = otherBusy || cannotAfford;

        let tagHtml = '';
        if (action.repeatable) {
            tagHtml = '<span class="crashsite-action-tag tag-repeatable" title="Repeatable">&#x21BB;</span>';
        } else if (action.oneTime) {
            tagHtml = '<span class="crashsite-action-tag tag-onetime" title="One-time">1&#x00D7;</span>';
        }

        const costsHtml = action.drain ? action.drain.map(d => drainCostHtml(d)).join(' ') : '';

        let btnClass = 'crashsite-action-btn';
        if (isActive) btnClass += ' is-active';
        if (action.oneTime && !action.repeatable) btnClass += ' btn-onetime';
        if (action.repeatable) btnClass += ' btn-repeatable';

        return `<button type="button" class="${btnClass}" data-action-id="${action.id}"${disabled && !isActive ? ' disabled' : ''}>
            <span class="crashsite-action-btn-name">${tagHtml}${t(action.nameKey)}</span>
            <span class="crashsite-action-btn-desc">${t(action.descKey)}</span>
            ${costsHtml ? `<span class="crashsite-action-costs-row">${costsHtml}</span>` : ''}
            <div class="crashsite-action-progress" style="--progress:${pct}%"></div></button>`;
    }).join('');
    return `<div class="crashsite-card crashsite-card-actions">
        <div class="crashsite-card-header"><h3>${t('crash_actions')}</h3></div>
        <div class="crashsite-actions-list">${buttons}</div></div>`;
}

function refreshUI() {
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const locationHost = document.querySelector('#crashSiteLocationTile');
    const detailsHost = document.querySelector('#crashSiteDetailsTile');
    const actionsHost = document.querySelector('#crashSiteActionsTile');

    if (!locationHost || !locationHost.dataset.renderedId || locationHost.dataset.renderedId !== location.id) {
        if (locationHost) { locationHost.innerHTML = renderLocationTile(location); locationHost.dataset.renderedId = location.id; }
        if (detailsHost) {
            detailsHost.innerHTML = renderDetailsTile(location);
            setTimeout(() => { const descEl = document.getElementById('crashsiteDetailDesc'); if (descEl) typewriteText(descEl, t(location.descriptionKey)); }, 100);
        }
        if (actionsHost) {
            actionsHost.innerHTML = renderActionsTile(location);
            actionsHost.querySelectorAll('.crashsite-action-btn').forEach(btn => { btn.addEventListener('click', () => startAction(btn.dataset.actionId)); });
        }
    } else {
        updateActionButtonsDynamic();
    }
}

function updateActionButtonsDynamic() {
    const actionsHost = document.querySelector('#crashSiteActionsTile');
    if (!actionsHost) return;
    const buttons = actionsHost.querySelectorAll('.crashsite-action-btn');
    buttons.forEach(btn => {
        const actionId = btn.dataset.actionId;
        const location = getLocation(getCurrentLocationId());
        if (!location) return;
        const action = location.actions.find(a => a.id === actionId);
        if (!action) return;
        const isActive = activeActionId === actionId;
        const otherBusy = !!activeAction && activeActionId !== actionId;
        const cannotAfford = action.drain && !canAffordAction(action);
        try { btn.disabled = (otherBusy || cannotAfford) && !isActive; } catch { /* ignore */ }
        btn.classList.toggle('is-active', isActive);
        const progBar = btn.querySelector('.crashsite-action-progress');
        if (progBar) {
            const pct = isActive ? Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)) : 0;
            progBar.style.setProperty('--progress', `${pct}%`);
        }
    });
}

export function setupLocationSection(section) {
    section.innerHTML = `<div class="content-panel crashsite-panel"><div class="crashsite-layout">
        <div id="crashSiteLocationTile" class="crashsite-tile crashsite-tile-location"></div>
        <div id="crashSiteDetailsTile" class="crashsite-tile crashsite-tile-details"></div>
        <div id="crashSiteActionsTile" class="crashsite-tile crashsite-tile-actions"></div>
    </div></div>`;
    refreshUI();
}
