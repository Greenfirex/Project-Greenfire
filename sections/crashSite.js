import { allActions as salvageActions } from '../data/definitions/allActions.js';
import { resources } from '../core/resources.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { enableSection } from '../core/main.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../ui/components/contentNewBadges.js';
import { setupCrashSiteLocalMap } from './crashSiteLocalMap.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { recomputeObjectives, getLastObjectivesDelta, getObjectivesStatus, getObjectiveDefinition } from '../data/objectives.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { buildings } from '../data/definitions/buildings.js';
import { createBuildingButton, updateBuildingButtonsState, rehydrateBuildingButton } from '../ui/components/buildingButtons.js';
import { gameFlags, runActionCompletionHandlers } from '../data/gameFlags.js';
import { computeRewardMultiplier } from '../data/upgradeEffects.js';
import { lsGet, getCurrentStage, tooltipDataForAction, canAffordAction, getAffordabilityShortfalls, computeEffectiveDuration, getRandomInt } from '../data/actionsManager.js';
import { getBlockedStatus, evaluateEventUnlocks } from '../data/unlockRules.js';
import { showCombatPopup } from '../ui/panels/combatPopup.js';
import { characterState, grantItemToCharacter, countItemInBag } from '../data/character.js';
import { getItemDefinition } from '../data/definitions/items.js';


const SITE_BUILDING_NAMES = ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'];

function getMaxRewardAmount(rewardEntry) {
    if (!rewardEntry) return 0;
    const amt = rewardEntry.amount;
    if (Array.isArray(amt)) {
        const hi = Number(amt[1]);
        return Number.isFinite(hi) ? hi : 0;
    }
    const n = Number(amt);
    return Number.isFinite(n) ? n : 0;
}

function getCapacityBlockReason(action) {
    try {
        // Special-case: hunting is allowed even if Food Rations are full (you might be hunting for XP/other outcomes).
        if (action && (action.id === 'huntWildlife' || action.name === 'Hunt for Wildlife')) return null;

        const stage = getCurrentStage(action);
        const reward = []
            .concat(Array.isArray(action?.reward) ? action.reward : [])
            .concat(Array.isArray(stage?.reward) ? stage.reward : []);

        // Only consider positive reward entries.
        const rewardEntries = reward.filter(r => r && r.resource && getMaxRewardAmount(r) > 0);
        if (!rewardEntries.length) return null;

        const cappedEntries = rewardEntries.filter(r => {
            const res = resources.find(x => x && x.name === r.resource);
            if (!res) return false;
            const cap = Number(res.capacity);
            if (!Number.isFinite(cap) || cap === Number.POSITIVE_INFINITY) return false;
            const amount = Number(res.amount);
            if (!Number.isFinite(amount)) return false;
            return amount >= cap - 1e-9;
        });

        const allWasted = cappedEntries.length === rewardEntries.length;
        if (!allWasted) return null;

        const names = Array.from(new Set(cappedEntries.map(r => r.resource)));

        // Special-case Rest: if you're already topped off, show a more human-friendly reason.
        if (action && (action.id === 'rest' || action.name === 'Rest')) {
            const hasHealth = names.includes('Health');
            const hasStamina = names.includes('Stamina');
            if (hasHealth && hasStamina) return 'You are already fully rested (Health and Stamina are full).';
            if (hasHealth) return 'You are already at full Health.';
            if (hasStamina) return 'You are already at full Stamina.';
            return 'You do not need to rest right now.';
        }

        if (names.length === 1) return `Storage full: ${names[0]}.`;
        return `Storage full: ${names.join(', ')}.`;
    } catch {
        return null;
    }
}

// Ensure Investigate Bridge skips pre-power stage when emergency power is already restored
function ensureBridgeStageAfterPower() {
    try {
        if (!gameFlags.emergencyPowerRestored) return;
        const bridge = (salvageActions || []).find(a => a && a.id === 'investigateBridge');
        if (!bridge) return;
        const total = Array.isArray(bridge.stages) ? bridge.stages.length : 0;
        if (total < 2) return;
        const currentStage = Number.isFinite(bridge.stage) ? bridge.stage : 0;
        if (currentStage < 1) {
            bridge.stage = 1; // Skip the pre-power scouting stage
        }
    } catch (e) { /* non-fatal */ }
}

function attachStartClickHandler(btn, action, section) {
    btn.onclick = (e) => {
    const capReason = getCapacityBlockReason(action);
        if (capReason) {
            e.preventDefault();
            addLogEntry(capReason, LogType.INFO);
            return;
        }
    const block = getBlockedStatus(action.id, { actions: salvageActions, flags: gameFlags, characterState });
        if (block.blocked) {
            e.preventDefault();
            addLogEntry(block.reason, LogType.INFO);
            return;
        }
    const shortfalls = getAffordabilityShortfalls(action, resources);
        if (shortfalls.length > 0) {
            e.preventDefault();
            addLogEntry(`Cannot start "${action.name}": ${shortfalls.join('; ')}`, LogType.INFO);
            return;
        }
        startAction(action, section);
    };
}

let actionInterval = null;
let isPendingCancel = null;
let cancelTimeout = null;

// Start the periodic crash-site progress loop
export function startCrashSiteLoop(section = null) {
    if (actionInterval) return;
    if (lsGet('gamePaused') === 'true') {
        addLogEntry('Cannot resume crash site loop while game is paused.', LogType.INFO);
        return;
    }

    if (!section) {
        const container = document.querySelector('#salvageActionsContainer');
        section = container ? container.closest('.content-panel') || container.parentElement : null;
    }
    const activeAction = getActiveCrashSiteAction();
    if (!activeAction) return;
    if (activeAction.pauseStart) {
        const pausedDuration = Date.now() - activeAction.pauseStart;
        activeAction.startTime = (activeAction.startTime || Date.now()) + pausedDuration;
        activeAction.lastTickTime = Date.now();
        delete activeAction.pauseStart;
    }
    actionInterval = setInterval(() => updateActionProgress(section), 100);
}

// Pause the crash-site loop and mark pause time
export function stopCrashSiteLoop() {
    if (actionInterval) {
        clearInterval(actionInterval);
        actionInterval = null;
    }
    const activeAction = getActiveCrashSiteAction();
    if (activeAction) {
        activeAction.pauseStart = Date.now();
    }
}

// Build crash-site section UI
export function setupCrashSiteSection(section) {
    // Before building UI, normalize any stage transitions that depend on global flags
    ensureBridgeStageAfterPower();

    // Back-compat: if the player already unlocked scouting before this feature existed,
    // ensure the new Move action becomes available.
    try {
        const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
        const move = salvageActions.find(a => a && a.id === 'move');
        if (scout?.isUnlocked && move && !move.isUnlocked) {
            move.isUnlocked = true;
            if (move.uiNew !== false) move.uiNew = true;
        }
    } catch { /* ignore */ }
    // Always render into the outer Crash Site section host.
    // setupCrashSiteSection() can be called with an inner element (e.g., the tab pane) during refreshes.
    const resolvedHost = (() => {
        try {
            if (section && typeof section.closest === 'function') {
                const byId = section.closest('#crashSiteSection');
                if (byId) return byId;
                const bySection = section.closest('.game-section');
                if (bySection) return bySection;
            }
        } catch { /* ignore */ }
        try {
            const direct = document.getElementById('crashSiteSection');
            if (direct) return direct;
        } catch { /* ignore */ }
        try {
            const container = document.querySelector('#salvageActionsContainer');
            if (container && typeof container.closest === 'function') {
                return container.closest('#crashSiteSection') || container.closest('.game-section') || container.parentElement;
            }
        } catch { /* ignore */ }
        return null;
    })();
    if (!resolvedHost) return;
    const host = resolvedHost;

    // Preserve existing action buttons so we don't churn DOM unnecessarily.
    const existingButtons = new Map();
    try {
        host.querySelectorAll('.image-button[data-action-id]').forEach(b => {
            existingButtons.set(b.dataset.actionId, b);
        });
    } catch { /* ignore */ }

    let activeTab = 'crash';
    try { activeTab = localStorage.getItem('crashSiteActiveTab') || 'crash'; } catch { /* ignore */ }
    if (activeTab !== 'map') activeTab = 'crash';

    host.innerHTML = `
        <div class="crashsite-tabs" role="tablist" aria-label="Crash Site tabs">
            <button class="crashsite-tab ${activeTab === 'crash' ? 'active' : ''}" data-tab="crash" role="tab" aria-selected="${activeTab === 'crash' ? 'true' : 'false'}">Crash Site</button>
            <button class="crashsite-tab ${activeTab === 'map' ? 'active' : ''}" data-tab="map" role="tab" aria-selected="${activeTab === 'map' ? 'true' : 'false'}">Local map</button>
        </div>
        <div class="content-panel crashsite-panel">
            <div class="crashsite-tabpanes">
                <div id="crashSitePane" class="crashsite-pane ${activeTab === 'crash' ? 'active' : ''}" role="tabpanel">
                    <div id="salvageActionsContainer"></div>
                </div>
                <div id="localMapPane" class="crashsite-pane ${activeTab === 'map' ? 'active' : ''}" role="tabpanel">
                    <div id="crashSiteLocalMapContainer"></div>
                </div>
            </div>
        </div>
    `;

    // Tab switching
    const tabs = Array.from(host.querySelectorAll('.crashsite-tab'));
    const panes = {
        crash: host.querySelector('#crashSitePane'),
        map: host.querySelector('#localMapPane')
    };

    const renderLocalMapActions = () => {
        const actionsHost = host.querySelector('#crashSiteLocalMapActions');
        if (!actionsHost) return;

        actionsHost.innerHTML = '';

        const mkButton = (actionDef, { disabled = false, disabledReason = '' } = {}) => {
            const btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = actionDef.id;
            btn.disabled = !!disabled;
            btn.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${actionDef.name}</span>
                ${newBadgeHtml(!!actionDef.uiNew)}
                <span class="cancel-text">Abort?</span>
            `;
            if (actionDef.uiNew) {
                wireClearUiNewBadge(btn, { legacyObj: actionDef, legacyProp: 'uiNew' });
            }
            if (disabled && disabledReason) {
                btn.setAttribute('aria-disabled', 'true');
                btn.title = disabledReason;
            }
            attachStartClickHandler(btn, actionDef, host);
            actionsHost.appendChild(btn);
        };

        // Move (prototype) always shown if unlocked
        const move = salvageActions.find(a => a && a.id === 'move');
        if (move && move.isUnlocked) {
            mkButton(move);
        }

        // Coordinate-specific action: F6 has Go back inside (attemptReentry)
        try {
            const lm = characterState?.localMap;
            const selX = Number.isFinite(lm?.selectedX) ? lm.selectedX : lm?.x;
            const selY = Number.isFinite(lm?.selectedY) ? lm.selectedY : lm?.y;
            const playerX = Number.isFinite(lm?.x) ? lm.x : 6;
            const playerY = Number.isFinite(lm?.y) ? lm.y : 7;

            // F6 (col 6 row 6)
            if (selX === 6 && selY === 6) {
                const reentry = salvageActions.find(a => a && a.id === 'attemptReentry');
                if (reentry && reentry.isUnlocked) {
                    const onTile = (playerX === 6 && playerY === 6);
                    mkButton(reentry, {
                        disabled: !onTile,
                        disabledReason: onTile ? '' : 'Move to F6 to use this.'
                    });
                }
            }
        } catch { /* ignore */ }
    };

    const renderLocalMap = () => {
        try {
            const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
            const stage = Number(scout?.stage || 0);
            const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;
            const mapHost = host.querySelector('#crashSiteLocalMapContainer');
            setupCrashSiteLocalMap(mapHost, {
                scoutStage: stage,
                totalStages: total,
                state: characterState?.localMap
            });

            // Re-render action list when a coordinate is selected.
            try {
                if (mapHost && !mapHost.dataset.boundLocalMapSelection) {
                    mapHost.dataset.boundLocalMapSelection = 'true';
                    mapHost.addEventListener('local-map-selection-changed', () => {
                        renderLocalMapActions();
                    });
                }
            } catch { /* ignore */ }
        } catch { /* ignore */ }
        renderLocalMapActions();
    };
    const setActive = (key) => {
        tabs.forEach(t => {
            const isOn = t.dataset.tab === key;
            t.classList.toggle('active', isOn);
            t.setAttribute('aria-selected', isOn ? 'true' : 'false');
        });
        if (panes.crash) panes.crash.classList.toggle('active', key === 'crash');
        if (panes.map) panes.map.classList.toggle('active', key === 'map');
        try { localStorage.setItem('crashSiteActiveTab', key); } catch { /* ignore */ }
    };
    tabs.forEach(t => {
        t.addEventListener('click', () => {
            const key = t.dataset.tab === 'map' ? 'map' : 'crash';
            setActive(key);
            if (key === 'map') {
                renderLocalMap();
            }
        });
    });

    // If the map tab is active on load, render it.
    if (activeTab === 'map') {
        renderLocalMap();
    }

    // Continue building actions into the Crash Site pane.
    section = host.querySelector('#crashSitePane') || host;

    const actionsContainer = host.querySelector('#salvageActionsContainer');
    const availableActions = salvageActions.filter(action => {
        if (action && action.id === 'move') return false; // Move lives under the map
        const stageIndex = action.stage || 0;
        const totalStages = (action.stages || []).length;
        if (totalStages > 0 && stageIndex >= totalStages) return !!action.repeatable && !!action.isUnlocked;
        return !!action.isUnlocked;
    });

    const categories = [...new Set(availableActions.map(a => a.category))]
        .filter(c => c !== 'Construction' && c !== 'Upgrade');

    const createActionButton = (action, group) => {
        const getEncounterIdForActionNow = (a) => {
            if (!a) return null;
            const idx = a.stage || 0;
            const st = (a.stages || [])[idx];
            return (st && st.encounter) || a.encounter || null;
        };

        const shouldShowUnknownOutcomeBadgeNow = (a, encounterId = null) => {
            if (!a) return false;
            const idx = a.stage || 0;
            const st = (a.stages || [])[idx];
            // Allow explicit opt-in on either the action or the current stage,
            // but also cover existing exploration "Search:" actions by default.
            if (st && st.unknownOutcome === true) return true;
            if (a.unknownOutcome === true) return true;

            // Spoiler-free encounter: show "?" until the encounter is discovered.
            const spoilerFree = !!((st && st.spoilerFreeEncounter === true) || a.spoilerFreeEncounter === true);
            const discovered = !!(a.encounterDiscovered === true);
            if (encounterId && spoilerFree && !discovered) return true;

            const name = String(a.name || '');
            return (a.category === 'Exploration') && name.startsWith('Search:');
        };

        const swordsIcon = () => (
            `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <path d="M6 18L18 6" />
                <path d="M4 16L8 20" />
                <path d="M18 18L6 6" />
                <path d="M20 16L16 20" />
            </svg>`
        );

        const questionIcon = () => (
            `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                <path d="M9 8.8a3.2 3.2 0 0 1 6.4 0c0 2.9-3.2 2.7-3.2 5.2" />
                <circle cx="12" cy="17.2" r="1.2" fill="currentColor" stroke="none" />
            </svg>`
        );

        const getActionButtonLabel = (a) => {
            const name = (a && a.name) ? a.name : '';
            const max = (a && typeof a.maxUses === 'number') ? a.maxUses : null;
            if (!max || max <= 1) return name;
            const uses = (a && typeof a.uses === 'number') ? a.uses : 0;
            const clamped = Math.max(0, Math.min(max, uses));
            return `${name} (${clamped}/${max})`;
        };

        let btn = null;
        if (existingButtons && existingButtons.has(action.id)) {
            btn = existingButtons.get(action.id);
            existingButtons.delete(action.id);
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = action.id;
        }
        btn.className = 'image-button';
        btn.dataset.actionId = action.id;
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('title');
        delete btn.dataset.shortfall;
        delete btn.dataset.blockedReason;
        delete btn.dataset.blocked;
        delete btn.dataset.affordable;
        btn.classList.remove('running', 'confirm-cancel');

        const encounterId = getEncounterIdForActionNow(action);
        const idxNow = action.stage || 0;
        const stNow = (action.stages || [])[idxNow];
        const spoilerFreeEncounter = !!((stNow && stNow.spoilerFreeEncounter === true) || action.spoilerFreeEncounter === true);
        const encounterKnown = !spoilerFreeEncounter || !!(action.encounterDiscovered === true);

        const showCombatBadge = !!encounterId && encounterKnown;
        const showUnknownBadge = shouldShowUnknownOutcomeBadgeNow(action, encounterId) && !showCombatBadge;

        btn.classList.toggle('action-has-combat', !!showCombatBadge);
        btn.classList.toggle('action-has-unknown', !!showUnknownBadge);
        const label = getActionButtonLabel(action);
        btn.innerHTML = `
            <div class="action-progress-bar"></div>
            <span class="building-name">${label}</span>
            ${newBadgeHtml(!!action.uiNew)}
            ${showCombatBadge ? `<span class="action-combat-badge" aria-hidden="true">${swordsIcon()}</span>` : ''}
            ${showUnknownBadge ? `<span class="action-unknown-badge" aria-hidden="true">${questionIcon()}</span>` : ''}
            <span class="cancel-text">Abort?</span>
        `;

        // Clear "new" badge after the player notices the button (persist quietly).
        if (action.uiNew) {
            wireClearUiNewBadge(btn, { legacyObj: action, legacyProp: 'uiNew' });
        } else {
            // Ensure old handlers don't linger on reused buttons.
            btn.onmouseenter = null;
            btn.onfocus = null;
            btn.ontouchstart = null;
        }

    // register a dynamic tooltip provider so the tooltip always reflects the current stage
    setupTooltip(btn, () => tooltipDataForAction(action));

        const canAfford = canAffordAction(action, resources);
        btn.classList.toggle('unaffordable', !canAfford);
        btn.dataset.affordable = canAfford ? 'true' : 'false'; // Set initial value for state tracking
        if (!canAfford) {
            btn.setAttribute('aria-disabled', 'true');
            btn.dataset.shortfall = getAffordabilityShortfalls(action, resources).join(', ');
        } else {
            btn.removeAttribute('aria-disabled');
            delete btn.dataset.shortfall;
        }
        attachStartClickHandler(btn, action, section);

        const capReason = getCapacityBlockReason(action);
        btn.classList.toggle('capacity-blocked', !!capReason);
        if (capReason) {
            btn.dataset.capacityBlocked = 'true';
            btn.dataset.capacityBlockedReason = capReason;
        } else {
            btn.dataset.capacityBlocked = 'false';
            delete btn.dataset.capacityBlockedReason;
        }

        group.appendChild(btn);
    };

    categories.forEach(category => {
        const h = document.createElement('h3');
        h.textContent = category;
        h.className = 'category-heading';
        actionsContainer.appendChild(h);

        const group = document.createElement('div');
        group.className = 'button-group';

        availableActions.filter(a => a.category === category).forEach(action => {
            createActionButton(action, group);
        });

        actionsContainer.appendChild(group);
    });

    // Only show Construction section if Colony section is not unlocked
    const colonyUnlocked =
        (gameFlags && Number(gameFlags.chapter) >= 2) ||
        (typeof window !== 'undefined' && window.activatedSections && window.activatedSections.colonySection);
    if (!colonyUnlocked) {
        const constructionWrapper = document.createElement('div');
        constructionWrapper.style.marginTop = '18px';
        const ch = document.createElement('h3');
        ch.textContent = 'Construction';
        ch.className = 'category-heading';
        constructionWrapper.appendChild(ch);

        const buildGroup = document.createElement('div');
        buildGroup.className = 'button-group';
        const siteBuildings = buildings.filter(b => SITE_BUILDING_NAMES.includes(b.name) && b.isUnlocked === true);

        siteBuildings.forEach(bld => {
            const btn = createBuildingButton(bld, buildGroup);
            rehydrateBuildingButton(btn, bld.name);
        });

        if (buildGroup.children.length > 0) {
            if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
            constructionWrapper.appendChild(buildGroup);
            actionsContainer.appendChild(constructionWrapper);
        }
    }

     const upgradeActions = availableActions.filter(a => a.category === 'Upgrade');
    if (upgradeActions.length > 0) {
        const uh = document.createElement('h3');
        uh.textContent = 'Upgrades';
        uh.className = 'category-heading';
        actionsContainer.appendChild(uh);

        const uGroup = document.createElement('div');
        uGroup.className = 'button-group';
        upgradeActions.forEach(action => createActionButton(action, uGroup));
        actionsContainer.appendChild(uGroup);
    }
}

// Start an action and set up UI/progress state
function startAction(action, section) {
    const existing = getActiveCrashSiteAction();
    if (existing) return;
    if (lsGet('gamePaused') === 'true') {
        addLogEntry(`Cannot start "${action.name}" while game is paused. Resume the game first.`, LogType.INFO);
        return;
    }

    if (!canAffordAction(action, resources)) {
        addLogEntry(`Not enough resources to begin: ${action.name}.`, LogType.ERROR);
        return;
    }
    const stage = getCurrentStage(action);
    const upfront = [...(action.cost || []), ...((stage && stage.cost) || [])];
    upfront.forEach(cost => {
        const r = resources.find(x => x.name === cost.resource);
        if (r) r.amount -= cost.amount;
    });
    refreshCurrentTooltip();

    const btn = section.querySelector(`[data-action-id="${action.id}"]`);
    if (btn) {
        const name = btn.querySelector('.building-name');
        if (name && !btn.dataset.originalLabel) btn.dataset.originalLabel = name.innerText;
        const bar = btn.querySelector('.action-progress-bar');
        if (bar) {
            // Reset instantly without transition so the bar doesn't visibly shrink from full to empty.
            try {
                bar.style.transition = 'none';
                bar.style.width = '0%';
                // force reflow to apply the width immediately
                // eslint-disable-next-line no-unused-expressions
                void bar.offsetWidth;
                // restore to stylesheet-controlled transition (remove inline override)
                bar.style.transition = '';
            } catch (e) { bar.style.width = '0%'; }
        }
        btn.classList.add('running');
        if (action.cancelable) {
            btn.onclick = () => requestCancel(action, section);
            btn.disabled = false;
        } else {
            btn.onclick = null;
            btn.disabled = true;
        }
    }

    // create an active-action snapshot that includes any stage-specific overrides
    const snapshot = JSON.parse(JSON.stringify(action));
    // merge stage-specific cost/drain/reward/duration into the running snapshot
    if (stage) {
        snapshot.cost = [...(action.cost || []), ...((stage && stage.cost) || [])];
        snapshot.drain = Array.isArray(stage.drain) ? stage.drain : (action.drain || []);
        snapshot.reward = stage.reward || action.reward || [];
        if (typeof stage.duration !== 'undefined') snapshot.duration = stage.duration;
        if (stage.description) snapshot.description = stage.description;
    } else {
        snapshot.cost = action.cost || [];
        snapshot.drain = action.drain || [];
        snapshot.reward = action.reward || [];
    }

    setActiveCrashSiteAction({
        ...snapshot,
        startTime: Date.now(),
        lastTickTime: Date.now(),
        elapsed: 0
    });

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);
    startCrashSiteLoop(section);
}

// Ask to cancel a running action (double-click confirmation)
function requestCancel(action, section) {
    const running = getActiveCrashSiteAction();
    if (!running || running.cancelable === false) return;

    if (isPendingCancel === action.id) {
        clearTimeout(cancelTimeout);
        cancelAction(section, `${action.name} cancelled by user.`);
        return;
    }
    isPendingCancel = action.id;
    const btn = section.querySelector(`[data-action-id="${action.id}"]`);
    if (btn) btn.classList.add('confirm-cancel');
    cancelTimeout = setTimeout(() => {
        if (btn) btn.classList.remove('confirm-cancel');
        isPendingCancel = null;
        cancelTimeout = null;
    }, 2000);
}

// Progress and complete actions based on time scale and drains
function updateActionProgress(section) {
    const a = getActiveCrashSiteAction();
    if (!a) return;

    const now = Date.now();
    const rawDelta = Math.max(0, Math.min((now - (a.lastTickTime || now)) / 1000, 0.25));
    a.lastTickTime = now;

    const timeScale = (window.TIME_SCALE || 1);
    const delta = rawDelta * timeScale;

    const effectiveDuration = computeEffectiveDuration(a, resources);

    // Drain is handled centrally by the main loop (computeResourceRates + main.js).
    // Here we only check for depletion and cancel if the resource is exhausted.
    if (a.drain) {
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            if (!res) continue;
            if (res.amount <= 0) {
                cancelAction(section, `${a.name} cancelled: Ran out of ${res.name}.`, true);
                return;
            }
        }
    }

    a.elapsed = Math.min(effectiveDuration, (a.elapsed || 0) + delta);
    const progress = Math.min((a.elapsed / effectiveDuration) * 100, 100);

    const btn = section.querySelector(`[data-action-id="${a.id}"]`);
    if (btn) {
        const bar = btn.querySelector('.action-progress-bar');
        const label = btn.querySelector('.building-name');
        if (bar) bar.style.width = `${progress}%`;
        if (label) {
            const remainingRealSeconds = Math.max(0, (effectiveDuration - a.elapsed) / timeScale);
            label.innerText = `${remainingRealSeconds.toFixed(1)}s`;
        }
    }

    if (a.elapsed >= effectiveDuration) {
        handleActionCompletion(section).catch(() => { /* non-fatal */ });
    }
}

// Cancel the running action with optional force and apply refunds
function cancelAction(section, message, force = false) {
    const a = getActiveCrashSiteAction();
    if (!a) return;
    if (!force && a.cancelable === false) {
        addLogEntry(`${a.name} cannot be cancelled.`, LogType.INFO);
        return;
    }

    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const refunds = [];
    if (a.cost) {
        for (const c of a.cost) {
            const res = resources.find(r => r.name === c.resource);
            const refund = Math.floor(c.amount * 0.5);
            if (res && refund > 0) {
                res.amount = Math.min(res.amount + refund, res.capacity);
                refunds.push(`${refund} ${res.name}`);
            }
        }
    }
    refreshCurrentTooltip();

    if (a.drain) {
        const effectiveDuration = computeEffectiveDuration(a, resources);
        const elapsed = Math.max(0, Math.min(a.elapsed || 0, effectiveDuration));
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            const perSec = d.amount / effectiveDuration;
            const drained = perSec * elapsed;
            const refund = Math.floor(drained * 0.5);
            if (res && refund > 0) {
                res.amount = Math.min(res.amount + refund, res.capacity);
                refunds.push(`${refund} ${res.name}`);
            }
        }
    }

    setActiveCrashSiteAction(null);
    addLogEntry(message, LogType.ERROR);
    if (refunds.length) addLogEntry(`Refunded: ${refunds.join(', ')}.`, LogType.INFO);
    // Clear running UI for the cancelled action (in-place) then update button states to avoid DOM rebuild flicker
    const btn = section ? section.querySelector(`[data-action-id="${a.id}"]`) : document.querySelector(`[data-action-id="${a.id}"]`);
    if (btn) {
        btn.classList.remove('running');
        btn.classList.remove('confirm-cancel');
        const bar = btn.querySelector('.action-progress-bar'); if (bar) {
            try {
                bar.style.transition = 'none';
                bar.style.width = '0%';
                void bar.offsetWidth;
                bar.style.transition = '';
            } catch (e) { bar.style.width = '0%'; }
        }
        const nameSpan = btn.querySelector('.building-name');
        if (nameSpan) {
            const defForLabel = salvageActions.find(s => s.id === a.id) || a;
            const max = defForLabel && typeof defForLabel.maxUses === 'number' ? defForLabel.maxUses : null;
            const uses = defForLabel && typeof defForLabel.uses === 'number' ? defForLabel.uses : 0;
            nameSpan.textContent = (max && max > 1)
                ? `${defForLabel.name} (${Math.max(0, Math.min(max, uses))}/${max})`
                : ((defForLabel && defForLabel.name) || '');
        }
        delete btn.dataset.originalLabel;
        const actionDef = salvageActions.find(s => s.id === a.id);
        if (actionDef) { btn.disabled = false; attachStartClickHandler(btn, actionDef, section); }
    }
    if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
}

// Handle completing an action: rewards, stories, unlocks, and UI
async function handleActionCompletion(section) {
    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const completed = getActiveCrashSiteAction();
    if (!completed) return;
    const actionDef = salvageActions.find(a => a.id === completed.id);
    const suppressGeneric = !!(actionDef && (actionDef.suppressGenericLog || ((actionDef.stages && actionDef.stages[(actionDef.stage || 0)] && actionDef.stages[(actionDef.stage || 0)].suppressGenericLog))));

    // If the current stage defines a combat encounter, run it BEFORE granting stage story/unlocks.
    // If the player loses/retreats, do not advance the stage so they can retry.
    let encounterOutcomeForCompletion = null;
    const originalForEncounter = salvageActions.find(a => a.id === completed.id || a.name === completed.name);
    if (originalForEncounter) {
        const idx = originalForEncounter.stage || 0;
        const st = (originalForEncounter.stages || [])[idx];
        const encounterId = (st && st.encounter) || originalForEncounter.encounter;
        if (encounterId) {
            // Optional: not every attempt finds an encounter.
            // Accept chance in [0,1] or [0,100]. Default is 100% (always encounter).
            let encounterChance = (st && typeof st.encounterChance === 'number')
                ? st.encounterChance
                : (typeof originalForEncounter.encounterChance === 'number' ? originalForEncounter.encounterChance : 1);
            if (encounterChance > 1) encounterChance = encounterChance / 100;
            encounterChance = Math.max(0, Math.min(1, encounterChance));

            try {
                // While combat is open we don't want the underlying action drain to keep ticking.
                // We already have a local snapshot of the completed action, so it's safe to clear this now.
                setActiveCrashSiteAction(null);

                if (encounterChance < 0.999999 && !(Math.random() < encounterChance)) {
                    encounterOutcomeForCompletion = 'no-encounter';
                    const failText = (st && st.encounterFailLogText) || originalForEncounter.encounterFailLogText || 'You did not find any prey.';
                    if (!suppressGeneric) addLogEntry(failText, LogType.INFO);
                } else {
                const stageIndex = (st && st.encounter) ? idx : null;
                const result = await showCombatPopup(encounterId, { sourceActionId: originalForEncounter.id, stageIndex });
                encounterOutcomeForCompletion = result?.outcome || null;
                if (!result || result.outcome !== 'win') {
                    // Spoiler-free encounters become "known combat" after the player experiences them.
                    try {
                        const spoilerFree = !!((st && st.spoilerFreeEncounter === true) || originalForEncounter.spoilerFreeEncounter === true);
                        if (spoilerFree && (result?.outcome === 'retreat' || result?.outcome === 'lose')) {
                            originalForEncounter.encounterDiscovered = true;
                        }
                    } catch { /* non-fatal */ }
                    // Clear active action and refresh the crash site UI so the action can be restarted.
                    setActiveCrashSiteAction(null);
                    try {
                        if (section) setupCrashSiteSection(section);
                        else setupCrashSiteSection();
                    } catch (e) { /* ignore */ }
                    return;
                }
                }
            } catch (e) {
                // If combat popup fails, fail open so players aren't hard-stuck.
                console.warn('Combat popup failed; continuing stage completion.', e);
                encounterOutcomeForCompletion = 'error';
            }
        }
    }

    // Build an outcome payload to optionally show in story popups
    const outcome = { rewards: [], items: [], unlocks: { actions: [], buildings: [], sections: [], jobs: [] } };

    // Special case: Local Map movement (prototype)
    if (completed.id === 'move') {
        try {
            const st = characterState.localMap;
            if (st && Number.isFinite(st.x) && Number.isFinite(st.y)) {
                const tx = Number.isFinite(st.selectedX) ? st.selectedX : st.x;
                const ty = Number.isFinite(st.selectedY) ? st.selectedY : st.y;
                const dx = Math.sign(tx - st.x);
                const dy = Math.sign(ty - st.y);
                // Prefer horizontal movement if both differ (simple deterministic prototype)
                if (dx !== 0) st.x += dx;
                else if (dy !== 0) st.y += dy;

                // Clamp to the A-K / 1-9 grid
                st.x = Math.max(1, Math.min(11, st.x));
                st.y = Math.max(1, Math.min(9, st.y));

                const letter = String.fromCharCode('A'.charCodeAt(0) + (st.x - 1));
                addLogEntry(`Moved to ${letter}${st.y}.`, LogType.INFO);

                // If Local map tab is visible, refresh it.
                const host = (section && typeof section.closest === 'function')
                    ? (section.closest('#crashSiteSection') || section.closest('.game-section'))
                    : document.getElementById('crashSiteSection');
                if (host) {
                    let activeTab = 'crash';
                    try { activeTab = localStorage.getItem('crashSiteActiveTab') || 'crash'; } catch { /* ignore */ }
                    if (activeTab === 'map') {
                        try {
                            const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
                            const stage = Number(scout?.stage || 0);
                            const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;
                            const mapHost = host.querySelector('#crashSiteLocalMapContainer');
                            setupCrashSiteLocalMap(mapHost, { scoutStage: stage, totalStages: total, state: characterState?.localMap });
                        } catch { /* ignore */ }
                    }
                }
            }
        } catch { /* ignore */ }
    }

    if (completed.reward) {
        const gains = [];

        // If Hunt for Wildlife didn't find prey, do not grant rewards.
        if ((completed.id === 'huntWildlife' || completed.name === 'Hunt for Wildlife') && encounterOutcomeForCompletion === 'no-encounter') {
            if (!suppressGeneric) addLogEntry(`${completed.name} complete! No prey found.`, LogType.INFO);
        } else {
        completed.reward.forEach(rw => {
            // Optional percentage chance support: rw.chance in [0,1] or [0,100]
            const hasChance = typeof rw.chance === 'number';
            if (hasChance) {
                const p = rw.chance > 1 ? (rw.chance / 100) : rw.chance;
                if (!(Math.random() < p)) return; // skip this reward this time
            }

            const res = resources.find(r => r.name === rw.resource);
            if (!res) return;

            const amt = Array.isArray(rw.amount) ? getRandomInt(rw.amount[0], rw.amount[1]) : rw.amount;
            // Apply upgrade-based reward multipliers via upgradeEffects
            const rewardMul = computeRewardMultiplier(completed.id, rw.resource, gameFlags);
            // Apply debug multiplier (excluding Survivors) for action rewards
            let debugMul = 1;
            try {
                if (typeof window !== 'undefined' && window.DEBUG_RESOURCE_GAIN === 10 && rw.resource !== 'Survivors') debugMul = 10;
            } catch (e) { /* ignore */ }
            let finalAmt = Math.floor(amt * rewardMul * debugMul);
            res.amount = Math.min(res.amount + finalAmt, res.capacity);
            gains.push(`${finalAmt} ${rw.resource}`);
            try { outcome.rewards.push({ resource: rw.resource, amount: finalAmt }); } catch (e) { /* ignore */ }
        });
        // Avoid generic success/gained log for actions that opt out via suppressGenericLog
        if (!suppressGeneric) {
            if (gains.length) addLogEntry(`${completed.name} complete! Gained: ${gains.join(', ')}.`, LogType.SUCCESS);
            else addLogEntry(`${completed.name} complete!`, LogType.SUCCESS);
        }
        }
    } else {
        if (!suppressGeneric) {
            addLogEntry(`${completed.name} complete!`, LogType.SUCCESS);
        }
    }
    refreshCurrentTooltip();

    // Prepare story popup placeholders we may fill below
    let pendingStoryEvent = null;
    let pendingStoryLogText = null;

    const original = salvageActions.find(a => a.id === completed.id || a.name === completed.name);
    if (original) {
        original.completed = true;
        const idx = original.stage || 0;
        const stage = (original.stages || [])[idx];

    // We'll defer showing any story popup until after we run completion handlers
    // so the outcome can also include buildings/sections unlocked by handlers.

        if (stage) {
            const itemsToGrant = Array.isArray(stage.grantItems) ? stage.grantItems.slice() : [];

            // Fallback: ensure the tutorial weapon is actually granted on the berries story stage.
            // This guards against stale saves/definitions where grantItems might not exist.
            try {
                const hasBranch = (characterState?.equipment?.weapon === 'spiked_branch') || (countItemInBag('spiked_branch') > 0);
                if (stage.story === 'foundBerries' && !hasBranch && !itemsToGrant.includes('spiked_branch')) {
                    itemsToGrant.push('spiked_branch');
                }
            } catch { /* non-fatal */ }

            if (itemsToGrant.length) {
                const unique = Array.from(new Set(itemsToGrant.filter(Boolean)));
                for (const itemId of unique) {
                    try {
                        const preferEquip = stage.grantItemsPreferEquip !== false;
                        const placed = grantItemToCharacter(itemId, { preferEquip });
                        const def = getItemDefinition(itemId);
                        const itemName = (def && def.name) ? def.name : itemId;
                        if (placed && placed.ok) {
                            const note = placed.placed === 'equip'
                                ? `Equipped (${placed.slot})`
                                : (placed.placed === 'bag' ? 'Added to bag' : 'Obtained');
                            addLogEntry(`Item obtained: ${itemName}. ${note}.`, LogType.UNLOCK);
                            outcome.items.push({ id: itemId, note });
                        } else {
                            addLogEntry(`Found item: ${itemName}, but your inventory is full.`, LogType.INFO);
                        }
                    } catch (e) { /* ignore */ }
                }
            }
            if (Array.isArray(stage.unlocks)) {
                stage.unlocks.forEach(id => {
                    const toUnlock = salvageActions.find(a => a.id === id || a.name === id);
                    if (toUnlock && !toUnlock.isUnlocked) {
                        toUnlock.isUnlocked = true;
                        toUnlock.uiNew = true;
                        const isUpgrade = (toUnlock.category === 'Upgrade');
                        addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${toUnlock.name}`, LogType.UNLOCK);
                        try { outcome.unlocks.actions.push(toUnlock.name); } catch (e) { /* ignore */ }
                    }
                });
            }
            if (stage.story) {
                pendingStoryEvent = storyEvents[stage.story] || null;
                pendingStoryLogText = stage.logText || '';
            } else if (stage.logText) {
                addLogEntry(stage.logText, LogType.STORY);
            }

            const total = (original.stages || []).length;
            original.stage = Math.min(idx + 1, total);
            if (original.stage >= total) {
                original.isUnlocked = !!original.repeatable;
            }
        }
    }

    // Capture actions/buildings unlocked by completion handlers by diffing pre/post states
    const preUnlockedActions = new Set((salvageActions || []).filter(a => a && a.isUnlocked).map(a => a.id));
    const preUnlockedBuildings = new Set((typeof buildings !== 'undefined') ? buildings.filter(b => b.isUnlocked).map(b => b.name) : []);

    if (original && original.id === 'establishBaseCamp') {
        enableSection('crewManagementSection');
        try { outcome.unlocks.sections.push('Crew Management'); } catch (e) { /* ignore */ }
    }

    // Unlock Journal after the initial re-entry attempt, and surface it in the popup unlock list.
    if (original && original.id === 'attemptReentry') {
        enableSection('journalSection');
        try { outcome.unlocks.sections.push('Journal'); } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && typeof window.setMenuNewItemFlag === 'function') {
                let current = null;
                try { current = localStorage.getItem('currentSection'); } catch { current = null; }
                if (current !== 'journalSection') window.setMenuNewItemFlag('journalSection', true);
            }
        } catch (e) { /* ignore */ }
    }

    // If the captain's quarters has been checked, surface the new sections in the popup outcome
    if (original && original.id === 'checkCaptainsQuarters') {
        try { outcome.unlocks.sections.push('Encrypted Drive'); } catch (e) { /* ignore */ }
        try { outcome.unlocks.sections.push('Colony'); } catch (e) { /* ignore */ }
    }

    // Track whether unlocks require a full UI rebuild
    let didUnlock = false;
    if (Array.isArray((original && original.stages && original.stages[original.stage - 1])?.unlocks)) {
        try {
            const container = document.querySelector('#salvageActionsContainer');
            if (container) {
                const presentIds = new Set(Array.from(container.querySelectorAll('.image-button[data-action-id]')).map(b => b.dataset.actionId));
                for (const a of salvageActions) {
                    if (a.isUnlocked && !presentIds.has(a.id)) { didUnlock = true; break; }
                }
            }
        } catch {}

        try {
            const container = document.querySelector('#salvageActionsContainer');
            for (const name of SITE_BUILDING_NAMES) {
                const b = (typeof buildings !== 'undefined') ? buildings.find(bb => bb.name === name) : null;
                if (b && b.isUnlocked) {
                    let exists = false;
                    if (container) exists = !!container.querySelector(`.image-button[data-building="${name}"]`);
                    if (!exists) { didUnlock = true; break; }
                }
            }
        } catch {}
    }

    runActionCompletionHandlers(original, completed, section);

    // After handlers ran, include any newly unlocked actions (e.g., Base Camp upgrades) in the story payload
    try {
        const newlyUnlockedActions = (salvageActions || []).filter(a => a && a.isUnlocked && !preUnlockedActions.has(a.id));
        if (newlyUnlockedActions && newlyUnlockedActions.length) {
            const existing = new Set((outcome.unlocks && outcome.unlocks.actions) ? outcome.unlocks.actions : []);
            for (const a of newlyUnlockedActions) {
                if (!existing.has(a.name)) {
                    try { outcome.unlocks.actions.push(a.name); } catch (e) { /* ignore */ }
                }
            }
        }
    } catch (e) { /* ignore */ }

    try {
        const newlyUnlocked = (typeof buildings !== 'undefined') ? buildings.filter(b => b.isUnlocked && !preUnlockedBuildings.has(b.name)).map(b => b.name) : [];
        for (const name of newlyUnlocked) { outcome.unlocks.buildings.push(name); }
    } catch (e) { /* ignore */ }

    // Update narrative objectives in response to action completions
    // Capture a local snapshot directly from recomputeObjectives to avoid race with other listeners
    let prevStatus = [];
    try { prevStatus = getObjectivesStatus(); } catch {}
    let snapshot = null;
    try { snapshot = recomputeObjectives(); } catch (e) { /* non-fatal */ }
    try {
        let completed = [];
        let newlyActive = [];
        // Prefer the recompute snapshot
        if (snapshot) {
            completed = Array.isArray(snapshot.completed) ? snapshot.completed : [];
            newlyActive = Array.isArray(snapshot.newlyActive) ? snapshot.newlyActive : [];
        }

        // Fallback: compute diff if delta came back empty
        if ((!completed.length && !newlyActive.length)) {
            const before = new Map((prevStatus || []).map(s => [s.id, s.state]));
            const after = getObjectivesStatus();
            for (const s of (after || [])) {
                const was = before.get(s.id);
                if (s.state === 'completed' && was !== 'completed') {
                    const def = getObjectiveDefinition(s.id); if (def) completed.push(def);
                }
                if (s.state === 'active' && was !== 'active') {
                    const def = getObjectiveDefinition(s.id); if (def) newlyActive.push(def);
                }
            }
        }

        // Extra safeguard: include any objectives whose doneAt matches the current ingame minute (i.e., just completed now)
        try {
            const nowMin = getTotalIngameMinutes ? getTotalIngameMinutes() : null;
            if (typeof nowMin === 'number') {
                const after = getObjectivesStatus();
                const byId = new Set(completed.map(d => d.id));
                for (const s of (after || [])) {
                    if (s.state === 'completed' && s.doneAt === nowMin && !byId.has(s.id)) {
                        const def = getObjectiveDefinition(s.id); if (def) completed.push(def);
                    }
                }
            }
        } catch { /* ignore */ }

        if (completed.length || newlyActive.length) {
            outcome.objectives = { completed, newlyActive };
            // Merge objective rewards into rewards list so players see the total gain as well
            const seen = new Set();
            for (const def of completed) {
                if (!def || !Array.isArray(def.reward)) continue;
                if (seen.has(def.id)) continue; seen.add(def.id);
                for (const rw of def.reward) {
                    try { outcome.rewards.push({ resource: rw.resource, amount: rw.amount }); } catch {}
                }
            }
        }
    } catch {}

    try {
        const container = document.querySelector('#salvageActionsContainer');
        for (const name of SITE_BUILDING_NAMES) {
            const b = (typeof buildings !== 'undefined') ? buildings.find(bb => bb.name === name) : null;
            if (b && b.isUnlocked) {
                let exists = false;
                if (container) exists = !!container.querySelector(`.image-button[data-building="${name}"]`);
                if (!exists) { didUnlock = true; break; }
            }
        }
    } catch {}

    // Clear active action and reset the UI for the completed action (in-place) unless we must rebuild
    setActiveCrashSiteAction(null);

    // If this completion unlocked new actions or enabled a section, rebuild the UI; otherwise update states in-place.
    if (didUnlock || (original && original.id === 'establishBaseCamp')) {
        setupCrashSiteSection(section);
    } else {
        const btn2 = section ? section.querySelector(`[data-action-id="${completed.id}"]`) : document.querySelector(`[data-action-id="${completed.id}"]`);
        if (btn2) {
            btn2.classList.remove('running');
            const bar2 = btn2.querySelector('.action-progress-bar'); if (bar2) {
                try {
                    bar2.style.transition = 'none';
                    bar2.style.width = '0%';
                    void bar2.offsetWidth;
                    bar2.style.transition = '';
                } catch (e) { bar2.style.width = '0%'; }
            }
            const nameSpan2 = btn2.querySelector('.building-name');
            if (nameSpan2) {
                const defForLabel = salvageActions.find(s => s.id === completed.id) || original || completed;
                const max = defForLabel && typeof defForLabel.maxUses === 'number' ? defForLabel.maxUses : null;
                const uses = defForLabel && typeof defForLabel.uses === 'number' ? defForLabel.uses : 0;
                nameSpan2.textContent = (max && max > 1)
                    ? `${defForLabel.name} (${Math.max(0, Math.min(max, uses))}/${max})`
                    : ((defForLabel && defForLabel.name) || completed.name || '');
            }
            delete btn2.dataset.originalLabel;
            const actionDef2 = salvageActions.find(s => s.id === completed.id) || original;
            if (actionDef2) { btn2.disabled = false; attachStartClickHandler(btn2, actionDef2, section); }
            if (original && !original.isUnlocked) {
                const removeBtn = section ? section.querySelector(`[data-action-id="${original.id}"]`) : document.querySelector(`[data-action-id="${original.id}"]`);
                if (removeBtn && removeBtn.parentElement) removeBtn.parentElement.removeChild(removeBtn);
            }
        }

        if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
    }

    // Check for unlocks triggered by resource discovery / narrative gates.
    // Example: assembleMakeshiftExplosive only unlocks after Power Core is found locked AND required inputs are discovered.
    // We do this BEFORE showing the story popup so these unlocks appear in the popup's "New Actions" list
    try {
        const unlockRuleActions = evaluateEventUnlocks({ type: 'resourceDiscovered' }, { resources, actions: salvageActions, buildings });
        let ruleDidUnlock = false;
        if (unlockRuleActions && Array.isArray(unlockRuleActions.actions) && unlockRuleActions.actions.length) {
            for (const id of unlockRuleActions.actions) {
                const a = salvageActions.find(x => x.id === id || x.name === id);
                if (a && !a.isUnlocked) {
                    a.isUnlocked = true;
                    a.uiNew = true;
                    const isUpgrade = (a.category === 'Upgrade');
                    addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                    try { outcome.unlocks.actions.push(a.name); } catch (e) { /* ignore */ }
                    ruleDidUnlock = true;
                }
            }
        }
        if (ruleDidUnlock) {
            // Rebuild Crash Site UI immediately to surface newly unlocked actions/upgrades
            const container = document.querySelector('#salvageActionsContainer');
            const targetSection = section || (container ? (container.closest('.content-panel') || container.parentElement) : null);
            if (targetSection) setupCrashSiteSection(targetSection);
        }
    } catch (e) { /* ignore */ }

    // Finally, if there was a pending story, show it with the filled outcome payload
    try {
        const hasRewards = outcome.rewards && outcome.rewards.length > 0;
        const hasItems = outcome.items && outcome.items.length > 0;
        const hasUnlocks = outcome.unlocks && (
            (outcome.unlocks.actions && outcome.unlocks.actions.length) ||
            (outcome.unlocks.buildings && outcome.unlocks.buildings.length) ||
            (outcome.unlocks.sections && outcome.unlocks.sections.length) ||
            (outcome.unlocks.jobs && outcome.unlocks.jobs.length)
        );
        const hasObjectives = !!(outcome.objectives && ((outcome.objectives.completed && outcome.objectives.completed.length) || (outcome.objectives.newlyActive && outcome.objectives.newlyActive.length)));
        const payload = (hasRewards || hasItems || hasUnlocks || hasObjectives) ? outcome : null;
        if (pendingStoryEvent) {
            showStoryPopup(pendingStoryEvent, payload);
            if (pendingStoryLogText) addLogEntry(pendingStoryLogText, LogType.STORY, { onClick: () => showStoryPopup(pendingStoryEvent, payload) });
        }
    } catch (e) { /* ignore */ }
}

// Pause/resume loop on global events
window.addEventListener('game-pause', () => {
    const active = getActiveCrashSiteAction();
    if (active) stopCrashSiteLoop();
});

window.addEventListener('game-resume', () => {
    const active = getActiveCrashSiteAction();
    if (!active) return;
    const container = document.querySelector('#salvageActionsContainer');
    const section = container ? container.closest('.content-panel') || container.parentElement : null;
    startCrashSiteLoop(section);
});

// When emergency power is restored, advance Bridge stage and refresh the Crash Site UI
window.addEventListener('emergencyPowerRestored', () => {
    ensureBridgeStageAfterPower();
    try {
        const container = document.querySelector('#salvageActionsContainer');
        if (container) {
            const section = container.closest('.content-panel') || container.parentElement;
            setupCrashSiteSection(section);
        }
    } catch (e) { /* ignore */ }
});

// Also normalize after loading saved state
window.addEventListener('game-state-applied', () => {
    ensureBridgeStageAfterPower();
});

// Listen for objectives changes and update action button states
window.addEventListener('objectivesChanged', () => {
    try {
        if (typeof updateCrashSiteActionButtonsState === 'function') {
            updateCrashSiteActionButtonsState();
        }
    } catch (e) { /* ignore */ }
});

if (typeof window !== 'undefined') {
    window.setupCrashSiteSection = setupCrashSiteSection;
}

// Listen for resource discoveries and evaluate centralized unlock rules
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resourceDiscovered', () => {
        try {
            const unlocks = evaluateEventUnlocks({ type: 'resourceDiscovered' }, { resources, actions: salvageActions, buildings });
            let didUnlock = false;
            if (unlocks && Array.isArray(unlocks.actions) && unlocks.actions.length) {
                for (const id of unlocks.actions) {
                    const a = salvageActions.find(x => x.id === id || x.name === id);
                    if (a && !a.isUnlocked) {
                        a.isUnlocked = true;
                        a.uiNew = true;
                        const isUpgrade = (a.category === 'Upgrade');
                        addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                        didUnlock = true;
                    }
                }
            }
            if (didUnlock) {
                const container = document.querySelector('#salvageActionsContainer');
                if (container) {
                    const section = container.closest('.content-panel') || container.parentElement;
                    setupCrashSiteSection(section);
                }
            }
        } catch (e) { /* ignore */ }
    });
}

// Update action buttons' disabled/blocked state
export function updateCrashSiteActionButtonsState() {
    const container = document.querySelector('#salvageActionsContainer');
    if (!container) return;

    const buttons = container.querySelectorAll('.image-button[data-action-id]');
    buttons.forEach(btn => {
        const id = btn.dataset.actionId;
        if (!id) return;
        const action = salvageActions.find(a => a.id === id);
        if (!action) return;

        const canAfford = !!canAffordAction(action, resources);
    const { blocked: isBlocked, reason } = getBlockedStatus(action.id, { actions: salvageActions, flags: gameFlags, characterState });
        const capReason = getCapacityBlockReason(action);
        const isCapBlocked = !!capReason;

        const wasAffordable = btn.dataset.affordable === 'true';
        const wasBlocked = btn.dataset.blocked === 'true';
        const wasCapBlocked = btn.dataset.capacityBlocked === 'true';

        if (wasAffordable !== canAfford) {
            btn.classList.toggle('unaffordable', !canAfford);
            if (!canAfford) {
                btn.setAttribute('aria-disabled', 'true');
                btn.dataset.shortfall = getAffordabilityShortfalls(action, resources).join(', ');
            } else {
                btn.removeAttribute('aria-disabled');
                delete btn.dataset.shortfall;
            }
            btn.dataset.affordable = canAfford ? 'true' : 'false';
        }

        if (wasBlocked !== isBlocked) {
            btn.classList.toggle('blocked-action', isBlocked);
            btn.dataset.blocked = isBlocked ? 'true' : 'false';
            if (isBlocked) btn.dataset.blockedReason = reason; else delete btn.dataset.blockedReason;
        }

        if (wasCapBlocked !== isCapBlocked) {
            btn.classList.toggle('capacity-blocked', isCapBlocked);
            btn.dataset.capacityBlocked = isCapBlocked ? 'true' : 'false';
            if (isCapBlocked) btn.dataset.capacityBlockedReason = capReason; else delete btn.dataset.capacityBlockedReason;
        } else if (isCapBlocked) {
            // Keep reason current (stage-based rewards may change).
            btn.dataset.capacityBlockedReason = capReason;
        }
    });
}