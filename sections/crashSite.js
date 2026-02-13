import { allActions as salvageActions } from '../data/definitions/allActions.js';
import { resources } from '../core/resources.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../ui/components/contentNewBadges.js';
import { setupCrashSiteLocalMap, updateCrashSiteLocalMapPathOverlay } from './crashSiteLocalMap.js';
import { getLocalMapTileAt, isCrashPoi, isCrashWallBetween, SHIP_ENTRANCE, CRASH_SITE_MAP_BOUND_ACTION_IDS } from '../data/maps/crashSiteMap.js';
import { findCrashSitePath } from '../data/maps/localMapPathfinding.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { recomputeObjectives, getObjectivesStatus, getObjectiveDefinition } from '../data/objectives.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { buildings } from '../data/definitions/buildings.js';
import { gameFlags, runActionCompletionHandlers } from '../data/gameFlags.js';
import { computeRewardMultiplier } from '../data/upgradeEffects.js';
import { lsGet, getCurrentStage, tooltipDataForAction, canAffordAction, getAffordabilityShortfalls, computeEffectiveDuration, getRandomInt } from '../data/actionsManager.js';
import { getBlockedStatus, evaluateEventUnlocks } from '../data/unlockRules.js';
import { showCombatPopup } from '../ui/panels/combatPopup.js';
import { characterState, grantItemToCharacter, consumeItemQuantityFromBag, countItemInBag, computeCarryCapacity } from '../data/character.js';
import { getItemDefinition } from '../data/definitions/items.js';
import { getItemIdForResourceName, isInventoryAliasResourceName } from '../data/inventoryAliases.js';
import { getCampsitePaneHtml, wireCampsiteCollapsibles, renderCampsitePanels, applyCampsiteBackground, updateCampsiteCampResourcesPanel } from './campsite.js';

/*
    crashSite.js organization

    1) Local map helpers (selection, route preview, traverse)
    2) Action gating helpers (capacity/blocked/afford)
    3) Action loop control + progress ticking
    4) Crash Site UI setup + render helpers (tabs, map pane, campsite pane)
    5) UI refresh helpers (button states, badges)
*/

// Travel-dot animation duration in the local map renderer (keep in sync with crashSiteLocalMap.js).
const LOCALMAP_TRAVEL_ANIM_MS = 320;

/* =============================
   Local map helpers
   ============================= */

function getCrashSiteLocalMapContainer(section) {
    try {
        if (section && typeof section.querySelector === 'function') {
            const el = section.querySelector('#crashSiteLocalMapContainer');
            if (el) return el;
        }
    } catch { /* ignore */ }

    try {
        return document.querySelector('#crashSiteLocalMapContainer');
    } catch {
        return null;
    }
}

function clearLocalMapRoutePreview(section) {
    try {
        const mapHost = getCrashSiteLocalMapContainer(section);
        if (!mapHost) return;
        updateCrashSiteLocalMapPathOverlay(mapHost, null);
    } catch { /* ignore */ }
}

function refreshCrashSiteLocalMapUi(section) {
    try {
        const mapHost = getCrashSiteLocalMapContainer(section);
        if (!mapHost) return;

        const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
        const stage = Number(scout?.stage || 0);
        const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;

        setupCrashSiteLocalMap(mapHost, {
            scoutStage: stage,
            totalStages: total,
            state: characterState?.localMap
        });

        // This event is wired (once) in renderLocalMap() to call renderLocalMapActions().
        try {
            mapHost.dispatchEvent(new CustomEvent('local-map-selection-changed'));
        } catch { /* ignore */ }
    } catch { /* ignore */ }
}

function stopTraverseAndReselectPlayerTile(section, message = null) {
    const lm = characterState?.localMap;
    if (!lm) return;

    const px = Number.isFinite(lm.x) ? lm.x : 6;
    const py = Number.isFinite(lm.y) ? lm.y : 8;

    clearTraverseState(lm);
    try { delete lm.inFlightTravel; } catch { /* ignore */ }

    try {
        lm.selectedX = px;
        lm.selectedY = py;
    } catch { /* ignore */ }

    try { clearLocalMapRoutePreview(section); } catch { /* ignore */ }
    try { refreshCrashSiteLocalMapUi(section); } catch { /* ignore */ }

    if (message) {
        addLogEntry(String(message), LogType.INFO);
    }
}

function getLocalMapMoveActionInstance({ nameOverride = null } = {}) {
    const move = salvageActions.find(a => a && a.id === 'move');
    if (!move) return null;
    // Match the instance id used by local-map Move buttons.
    const out = Object.assign({}, move, { uiInstanceId: 'localmap:move' });
    if (nameOverride) out.name = String(nameOverride);
    return out;
}

function multiplyDrain(drain, steps) {
    const n = Math.max(0, Math.floor(Number(steps) || 0));
    if (!Array.isArray(drain) || n <= 0) return [];
    return drain
        .filter(d => d && d.resource && Number.isFinite(Number(d.amount)) && Number(d.amount) > 0)
        .map(d => ({ resource: d.resource, amount: Number(d.amount) * n }));
}

function buildMoveStyleTooltipData(moveAction, { mode = 'explore', steps = 1 } = {}) {
    const base = tooltipDataForAction(moveAction);
    const nSteps = Math.max(1, Math.floor(Number(steps) || 1));
    const drain = (nSteps <= 1) ? (Array.isArray(base.drain) ? base.drain : []) : multiplyDrain(base.drain, nSteps);
    const baseDuration = (base && typeof base.duration === 'number' && Number.isFinite(base.duration)) ? base.duration : null;
    const duration = (baseDuration !== null) ? Number((baseDuration * nSteps).toFixed(2)) : undefined;
    const stepText = nSteps === 1 ? '1 step' : `${nSteps} steps`;
    const isTraverse = String(mode) === 'traverse';
    const name = isTraverse ? 'Traverse here' : 'Explore';

    const desc = isTraverse
        ? `Traverse to the selected tile (${stepText}, explored tiles only).`
        : 'Explore the selected adjacent tile.';

    // Tooltip renderer expects action-like objects with id/name.
    return {
        id: 'move',
        name,
        description: `${desc} Stops if you run out of required resources.`.trim(),
        cost: [],
        drain,
        duration,
        category: 'Exploration',
    };
}

function clearTraverseState(lm) {
    try {
        delete lm.traverseQueue;
        delete lm.traverseQueuedDestination;
    } catch { /* ignore */ }
}

function isTraverseActive(lm) {
    try {
        return !!(lm && Array.isArray(lm.traverseQueue) && lm.traverseQueue.length);
    } catch {
        return false;
    }
}

function traverseIsExhausted(moveAction) {
    try {
        if (!moveAction || !Array.isArray(moveAction.drain)) return false;
        for (const d of moveAction.drain) {
            const res = resources.find(r => r && r.name === d.resource);
            if (!res) continue;
            if (Number(res.amount) <= 0) return true;
        }
        return false;
    } catch {
        return false;
    }
}

function getVisualLocalMapPlayerPos(lm) {
    const fallbackX = Number.isFinite(lm?.x) ? lm.x : 6;
    const fallbackY = Number.isFinite(lm?.y) ? lm.y : 8;
    try {
        const travel = lm && typeof lm === 'object' ? lm.inFlightTravel : null;
        if (travel && typeof travel === 'object') {
            const startAt = Number(travel.startAt);
            const dur = Number(travel.durationMs);
            const fromX = Number(travel.fromX);
            const fromY = Number(travel.fromY);
            if ([startAt, dur, fromX, fromY].every(Number.isFinite) && (Date.now() - startAt) <= (dur + 120)) {
                // During in-flight travel, treat the player as still on the origin tile
                // so tile-bound actions don't appear early.
                return { x: fromX, y: fromY };
            }
        }

        return { x: fallbackX, y: fallbackY };
    } catch {
        return { x: fallbackX, y: fallbackY };
    }
}

function tryStartNextTraverseStep(section) {
    const lm = characterState?.localMap;
    if (!lm || !Array.isArray(lm.traverseQueue) || lm.traverseQueue.length === 0) return;

    // Never start a new action while one is active.
    if (getActiveCrashSiteAction()) return;

    const moveAction = getLocalMapMoveActionInstance({ nameOverride: 'Traverse' });
    if (!moveAction || !moveAction.isUnlocked) {
        stopTraverseAndReselectPlayerTile(section);
        return;
    }

    if (traverseIsExhausted(moveAction)) {
        stopTraverseAndReselectPlayerTile(section, 'Too exhausted to continue traversing.');
        return;
    }

    const next = lm.traverseQueue[0];
    const nx = Number(next && next.x);
    const ny = Number(next && next.y);
    const px = Number.isFinite(lm.x) ? lm.x : 6;
    const py = Number.isFinite(lm.y) ? lm.y : 8;
    const dist = Math.abs(nx - px) + Math.abs(ny - py);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || dist !== 1) {
        stopTraverseAndReselectPlayerTile(section);
        return;
    }

    try {
        lm.selectedX = nx;
        lm.selectedY = ny;
    } catch { /* ignore */ }

    // Refresh the action row so the Move button exists/runs for this step.
    try {
        const mapHost = getCrashSiteLocalMapContainer(section);
        if (mapHost) mapHost.dispatchEvent(new CustomEvent('local-map-selection-changed'));
    } catch { /* ignore */ }

    // Preflight checks mirror attachStartClickHandler.
    const capReason = getCapacityBlockReason(moveAction);
    if (capReason) {
        stopTraverseAndReselectPlayerTile(section, capReason);
        return;
    }
    const block = getBlockedStatus(moveAction.id, { actions: salvageActions, flags: gameFlags, characterState });
    if (block.blocked) {
        stopTraverseAndReselectPlayerTile(section, block.reason);
        return;
    }
    const shortfalls = getAffordabilityShortfalls(moveAction, resources, characterState);
    if (shortfalls.length > 0) {
        stopTraverseAndReselectPlayerTile(section, `Cannot start "${moveAction.name}": ${shortfalls.join('; ')}`);
        return;
    }

    // Hide any hover preview once traversal starts.
    clearLocalMapRoutePreview(section);

    startAction(moveAction, section);
}

function scheduleTraverseAdvance(section) {
    try {
        setTimeout(() => {
            const lm = characterState?.localMap;
            if (!lm || !Array.isArray(lm.traverseQueue)) return;

            const px = Number.isFinite(lm.x) ? lm.x : 6;
            const py = Number.isFinite(lm.y) ? lm.y : 8;

            // If the player queued a new destination mid-traverse, re-path from the new position.
            const queued = lm.traverseQueuedDestination;
            if (queued && Number.isFinite(queued.x) && Number.isFinite(queued.y)) {
                const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
                const scoutStage = Number(scout?.stage || 0);
                const hasTriedReentry = !!(lm && lm.hasTriedReentry === true);
                const path = findCrashSitePath({
                    fromX: px,
                    fromY: py,
                    toX: Number(queued.x),
                    toY: Number(queued.y),
                    localMapState: lm,
                    scoutStage,
                    hasTriedReentry,
                });
                delete lm.traverseQueuedDestination;
                if (!path || path.length < 2) {
                    stopTraverseAndReselectPlayerTile(section, 'No clear route to that tile.');
                    return;
                }
                lm.traverseQueue = path.slice(1);
            }

            if (!isTraverseActive(lm)) return;

            // Step completed -> only advance if we actually arrived at the expected tile.
            const expected = lm.traverseQueue[0];
            const ex = Number(expected && expected.x);
            const ey = Number(expected && expected.y);
            if (!Number.isFinite(ex) || !Number.isFinite(ey) || px !== ex || py !== ey) {
                stopTraverseAndReselectPlayerTile(section, 'Traverse stopped.');
                return;
            }

            try { lm.traverseQueue.shift(); } catch { /* ignore */ }
            if (!isTraverseActive(lm)) {
                stopTraverseAndReselectPlayerTile(section);
                return;
            }
            tryStartNextTraverseStep(section);
        }, 0);
    } catch { /* ignore */ }
}

function computeAdjacentLocalMapBlockReason(fromX, fromY, toX, toY, { localMapState, scoutStage, hasTriedReentry } = {}) {
    try {
        const lm = localMapState;

        const isEntrance = (toX === SHIP_ENTRANCE.x && toY === SHIP_ENTRANCE.y);
        if (isEntrance && hasTriedReentry) return 'The way back inside collapsed — you will have to find another way in.';

        const isC5 = (toX === 3 && toY === 5);
        const isC5ThornWallBurned = !!(lm && lm.c5ThornWallBurned === true);
        if (isC5 && !isC5ThornWallBurned) return 'A thick wall of thorns blocks the way. I may be able to burn it with a torch.';

        const tile = getLocalMapTileAt(toX, toY, { scoutStage, hasTriedReentry, localMapState: lm });
        if (tile && tile.blocked) return 'There is currently no need to go there.';

        const blockedByCrashWall = isCrashWallBetween(fromX, fromY, toX, toY, { localMapState: lm });
        if (blockedByCrashWall) return 'Wreckage blocks the way.';

        const isMovingWest = toX < fromX;
        const blockedByWestGate = !!(isMovingWest && !(lm && lm.riverCombatDone));
        if (blockedByWestGate) return 'You should first check out the east side.';
    } catch { /* ignore */ }
    return '';
}

/* =============================
   Action gating (capacity/blocked/afford)
   ============================= */

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
            // Inventory-backed "resources" (e.g., Power Cells): check bag space.
            if (isInventoryAliasResourceName(r.resource)) {
                const itemId = getItemIdForResourceName(r.resource);
                if (!itemId) return false;

                const maxAmt = getMaxRewardAmount(r);
                if (maxAmt <= 0) return false;

                const def = getItemDefinition(itemId);
                const isStackable = !!def?.stackable;
                const have = countItemInBag(itemId, characterState);
                const cap = computeCarryCapacity(characterState);
                const emptySlots = Math.max(0, (cap.total ?? 0) - (cap.used ?? 0));

                if (isStackable) {
                    // Stackable: ok if we already have a stack, else need one empty slot.
                    return !(have > 0 || emptySlots > 0);
                }

                // Non-stack: need one slot per item.
                return emptySlots < maxAmt;
            }

            // Normal resource capacity check.
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

/* =============================
   Stage normalization helpers
   ============================= */

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

        // Strip Wiring is limited per ship tile.
        try {
            if (action && action.id === 'stripWiring') {
                const lm = characterState?.localMap;
                const x = Number.isFinite(lm?.x) ? lm.x : null;
                const y = Number.isFinite(lm?.y) ? lm.y : null;
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    const key = `${x},${y}`;
                    const used = Number(lm?.wiringStrippedByTile?.[key] || 0);
                    if (used >= 5) {
                        e.preventDefault();
                        addLogEntry('No more wires to be stripped here.', LogType.INFO);
                        return;
                    }
                }
            }
        } catch { /* ignore */ }

        // Cafeteria supplies scavenging is limited per tile.
        try {
            if (action && action.id === 'scavengeCafeteriaSupplies') {
                const lm = characterState?.localMap;
                const x = Number.isFinite(lm?.x) ? lm.x : null;
                const y = Number.isFinite(lm?.y) ? lm.y : null;
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    const key = `${x},${y}`;
                    const used = Number(lm?.cafeteriaSuppliesByTile?.[key] || 0);
                    if (used >= 7) {
                        e.preventDefault();
                        addLogEntry('There is nothing usable left to scavenge here.', LogType.INFO);
                        return;
                    }
                }
            }
        } catch { /* ignore */ }

        // Scavenge Debris Field is limited per tile.
        try {
            if (action && action.id === 'scavengeDebris') {
                const lm = characterState?.localMap;
                const x = Number.isFinite(lm?.x) ? lm.x : null;
                const y = Number.isFinite(lm?.y) ? lm.y : null;
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    const key = `${x},${y}`;
                    const used = Number(lm?.debrisScavengedByTile?.[key] || 0);
                    if (used >= 3) {
                        e.preventDefault();
                        addLogEntry('The debris here has been picked clean.', LogType.INFO);
                        return;
                    }
                }
            }
        } catch { /* ignore */ }

        const block = getBlockedStatus(action.id, { actions: salvageActions, flags: gameFlags, characterState });
        if (block.blocked) {
            e.preventDefault();
            addLogEntry(block.reason, LogType.INFO);
            return;
        }
        const shortfalls = getAffordabilityShortfalls(action, resources, characterState);
        if (shortfalls.length > 0) {
            e.preventDefault();
            addLogEntry(`Cannot start "${action.name}": ${shortfalls.join('; ')}`, LogType.INFO);
            return;
        }
        // UI hint: once the player attempts re-entry, stop nudging them via Move tooltips.
        try {
            if (action && action.id === 'attemptReentry' && characterState && characterState.localMap) {
                characterState.localMap.reentryAttemptStarted = true;
            }
        } catch { /* ignore */ }

        startAction(action, section);
    };
}

let actionInterval = null;
let isPendingCancel = null;
let cancelTimeout = null;

/* =============================
   Crash Site loop control
   ============================= */

// Start the periodic crash-site progress loop
export function startCrashSiteLoop(section = null) {
    if (actionInterval) return;
    if (lsGet('gamePaused') === 'true') {
        return;
    }

    if (!section) {
        section = document.getElementById('crashSiteSection') || document.body;
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

/* =============================
   Crash Site UI setup
   ============================= */

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
        return null;
    })();
    if (!resolvedHost) return;
    const host = resolvedHost;

    // Preserve existing action buttons so we don't churn DOM unnecessarily.
    const existingButtons = new Map();
    try {
        host.querySelectorAll('.image-button[data-action-id]').forEach(b => {
            const id = b.dataset.actionId;
            const inst = b.dataset.actionInstance || 'main';
            existingButtons.set(`${id}::${inst}`, b);
        });
    } catch { /* ignore */ }

    const lm = characterState?.localMap;
    const isCampsiteUnlocked = !!(lm && lm.baseCampEstablished === true);
    const campsiteTabLabel = isCampsiteUnlocked ? 'Campsite' : '???';

    let activeTab = 'map';
    try {
        activeTab = localStorage.getItem('crashSiteActiveTab') || 'map';
    } catch { /* ignore */ }
    // Back-compat: old key "crash" -> new key "camp".
    if (activeTab === 'crash') activeTab = 'camp';
    if (activeTab !== 'map' && activeTab !== 'camp') activeTab = 'map';
    if (!isCampsiteUnlocked && activeTab === 'camp') activeTab = 'map';

    host.innerHTML = `
        <div class="crashsite-tabs" role="tablist" aria-label="Crash Site tabs">
            <button class="crashsite-tab ${activeTab === 'map' ? 'active' : ''}" data-tab="map" role="tab" aria-selected="${activeTab === 'map' ? 'true' : 'false'}">Local map</button>
            <button class="crashsite-tab ${activeTab === 'camp' ? 'active' : ''}" data-tab="camp" role="tab" aria-selected="${activeTab === 'camp' ? 'true' : 'false'}" ${isCampsiteUnlocked ? '' : 'disabled'}>
                <span class="crashsite-tab-label">${campsiteTabLabel}</span>
                ${newBadgeHtml(!!(lm && lm.campsiteTabUiNew === true))}
            </button>
        </div>
        <div class="content-panel crashsite-panel">
            <div class="crashsite-tabpanes">
                <div id="localMapPane" class="crashsite-pane ${activeTab === 'map' ? 'active' : ''}" role="tabpanel">
                    <div id="crashSiteLocalMapContainer"></div>
                </div>
                <div id="campsitePane" class="crashsite-pane ${activeTab === 'camp' ? 'active' : ''}" role="tabpanel">
                    ${getCampsitePaneHtml({ isUnlocked: isCampsiteUnlocked })}
                </div>
            </div>
        </div>
    `;

    // Initial state: apply immediately.
    try { applyCampsiteBackground(host, activeTab === 'camp'); } catch { /* ignore */ }
    try { wireCampsiteCollapsibles(host); } catch { /* ignore */ }

    // Tab switching
    const tabs = Array.from(host.querySelectorAll('.crashsite-tab'));
    const panes = {
        map: host.querySelector('#localMapPane'),
        camp: host.querySelector('#campsitePane')
    };

    // Campsite tab "NEW" badge wiring
    try {
        const campTab = host.querySelector('.crashsite-tab[data-tab="camp"]');
        if (campTab && lm && lm.campsiteTabUiNew === true) {
            wireClearUiNewBadge(campTab, { legacyObj: lm, legacyProp: 'campsiteTabUiNew', selector: '.action-new-badge' });
        }
    } catch { /* ignore */ }

    const tooltipDataForActionWithContext = (action) => {
        const out = tooltipDataForAction(action);
        try {
            // Contextual tooltip fix: Investigate Bridge stage 2 assumes emergency power is online.
            // If the player hasn't restored power yet, show a "needs power" description instead.
            const idx = Number.isFinite(action?.stage) ? action.stage : 0;
            if (action && action.id === 'investigateBridge' && idx >= 1 && gameFlags?.emergencyPowerRestored !== true) {
                out.description = 'Emergency power required: the bridge lift won\'t cycle. Restore Emergency Power to proceed.';
            }
        } catch { /* ignore */ }
        return out;
    };

    const renderLocalMapActions = () => {
        const actionsHost = host.querySelector('#crashSiteLocalMapActions');
        if (!actionsHost) return;

        actionsHost.innerHTML = '';

        // Clear any stale hover route preview when re-rendering the actions.
        try { clearLocalMapRoutePreview(host); } catch { /* ignore */ }

        let didAddAction = false;

        const mkButton = (actionDef, { label = null, disabled = false, ariaDisabled = false, disabledReason = '', onClick = null, tooltipOverride = null } = {}) => {
            const btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = actionDef.id;
            // Local-map actions can also appear in the main Crash Site list (same data-action-id).
            // Give them a distinct instance key so progress updates/cancel UX targets the right button.
            const localMapInstanceId = `localmap:${String(actionDef.id)}`;
            btn.dataset.actionInstance = localMapInstanceId;
            btn.disabled = !!disabled;
            btn.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${label != null ? String(label) : actionDef.name}</span>
                ${newBadgeHtml(!!actionDef.uiNew)}
                <span class="cancel-text">Abort?</span>
            `;
            if (actionDef.uiNew) {
                wireClearUiNewBadge(btn, { legacyObj: actionDef, legacyProp: 'uiNew' });
            }
            if ((disabled || ariaDisabled) && disabledReason) {
                btn.setAttribute('aria-disabled', 'true');
                btn.title = disabledReason;
            }

            // Match Crash Site styling for unaffordable / capacity-blocked actions.
            // (We keep the button clickable unless it's truly disabled, so the click handler can explain why.)
            try {
                const canAfford = canAffordAction(actionDef, resources, characterState);
                btn.classList.toggle('unaffordable', !canAfford);
                btn.dataset.affordable = canAfford ? 'true' : 'false';
                if (!canAfford) {
                    btn.setAttribute('aria-disabled', 'true');
                    const shortfalls = getAffordabilityShortfalls(actionDef, resources, characterState);
                    if (shortfalls.length) {
                        btn.dataset.shortfall = shortfalls.join(', ');
                        if (!btn.title) btn.title = `Cannot afford: ${shortfalls.join('; ')}`;
                    }
                }

                const capReason = getCapacityBlockReason(actionDef);
                btn.classList.toggle('capacity-blocked', !!capReason);
                if (capReason) {
                    btn.dataset.capacityBlocked = 'true';
                    btn.dataset.capacityBlockedReason = capReason;
                    btn.setAttribute('aria-disabled', 'true');
                    if (!btn.title) btn.title = capReason;
                } else {
                    btn.dataset.capacityBlocked = 'false';
                }
            } catch { /* ignore */ }

            // Tooltips for local-map actions should behave the same as main action buttons.
            if (typeof tooltipOverride === 'function') {
                setupTooltip(btn, tooltipOverride);
            } else {
                setupTooltip(btn, () => tooltipDataForActionWithContext(actionDef));
            }

            if (typeof onClick === 'function') {
                btn.onclick = onClick;
            } else {
                const actionForThisButton = Object.assign({}, actionDef, { uiInstanceId: localMapInstanceId });
                attachStartClickHandler(btn, actionForThisButton, host);
            }
            actionsHost.appendChild(btn);
            didAddAction = true;

            return btn;
        };

        const mkUtilityButton = ({ id, label, disabled = false, ariaDisabled = false, disabledReason = '', tooltipOverride = null, onClick = null } = {}) => {
            const btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = String(id || 'utility');
            btn.dataset.actionInstance = `localmap:utility:${String(id || 'utility')}`;
            btn.disabled = !!disabled;
            btn.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${String(label || '')}</span>
                <span class="cancel-text">Abort?</span>
            `;
            if ((disabled || ariaDisabled) && disabledReason) {
                btn.setAttribute('aria-disabled', 'true');
                btn.title = disabledReason;
            }
            if (typeof tooltipOverride === 'function') {
                setupTooltip(btn, tooltipOverride);
            }
            if (typeof onClick === 'function') {
                btn.onclick = onClick;
            }
            actionsHost.appendChild(btn);
            didAddAction = true;
            return btn;
        };

        const lm = characterState?.localMap;
        const visualPos = getVisualLocalMapPlayerPos(lm);
        const playerX = Number.isFinite(visualPos?.x) ? visualPos.x : (Number.isFinite(lm?.x) ? lm.x : 6);
        const playerY = Number.isFinite(visualPos?.y) ? visualPos.y : (Number.isFinite(lm?.y) ? lm.y : 8);

        const selX = Number.isFinite(lm?.selectedX) ? lm.selectedX : playerX;
        const selY = Number.isFinite(lm?.selectedY) ? lm.selectedY : playerY;
        const isSelectingPlayerTile = (selX === playerX && selY === playerY);

        const isTileExplored = (x, y) => {
            try {
                const key = `${Number(x)},${Number(y)}`;
                return !!(lm && lm.visited && typeof lm.visited === 'object' && lm.visited[key] === true);
            } catch { /* ignore */ }
            return false;
        };

        const selectedExplored = isTileExplored(selX, selY);

        const logNeedCloser = () => {
            addLogEntry('You need to be closer to perform this action.', LogType.INFO);
        };

        const playerOnSelected = isSelectingPlayerTile;

        const hasTriedReentry = !!(lm && lm.hasTriedReentry === true);
        const hasStartedReentry = !!(lm && lm.reentryAttemptStarted === true);

        const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
        const scoutStage = Number(scout?.stage || 0);

        const setRoutePreview = (points, kind = 'move') => {
            try {
                const mapHost = host.querySelector('#crashSiteLocalMapContainer');
                if (!mapHost) return;
                updateCrashSiteLocalMapPathOverlay(mapHost, { points, kind });
            } catch { /* ignore */ }
        };

        const clearRoutePreview = () => {
            try {
                const mapHost = host.querySelector('#crashSiteLocalMapContainer');
                if (!mapHost) return;
                updateCrashSiteLocalMapPathOverlay(mapHost, null);
            } catch { /* ignore */ }
        };

        const isFinished = (a) => {
            if (!a) return false;
            // Repeatables should never be considered "finished".
            if (a.repeatable === true) return false;
            if (a.completed === true) return true;
            const idx = Number(a.stage || 0);
            const total = Array.isArray(a.stages) ? a.stages.length : 0;
            if (total > 0 && idx >= total && !a.repeatable) return true;
            return false;
        };

        const coordKey = (x, y) => `${Number(x)},${Number(y)}`;

        const isOrthogonallyAdjacentToCrashPoi = (x, y) => {
            const c = Number(x);
            const r = Number(y);
            if (isCrashPoi(c, r)) return false;
            return (
                isCrashPoi(c - 1, r)
                || isCrashPoi(c + 1, r)
                || isCrashPoi(c, r - 1)
                || isCrashPoi(c, r + 1)
            );
        };

        // Actions that are tied to a specific tile.
        // For explored tiles, we show these even if the player is far away,
        // but starting them requires being on the tile.
        const TILE_ACTIONS = {
            // B6 (2,6)
            '2,6': ['rest', 'createBasicTorch', 'makeCrudePrybar', 'drinkCaveWater'],
            // B2 (2,2)
            '2,2': ['huntWildlife'],
            // B7 (2,7) - base camp tile (unlocked later)
            '2,7': ['establishBaseCamp'],
            // D7 (4,7)
            '4,7': ['forageFood'],
            // H8 (8,8)
            // River tile actions are intentionally tile-bound (not shown in the main action list).
            '8,8': ['purifyWater'],

            // E5 (5,5) - ship interior junction (inside POI)
            '5,5': ['investigateSound'],

            // Ship interior rooms
            // G3 (7,3)
            '7,3': ['searchLabs', 'collectChemicals'],
            // G4 (7,4)
            '7,4': ['searchPowerCore'],

            // F6 (6,6)
            '6,6': ['collectFabric'],

            // H6 (8,6) - bridge: salvage comms components after lift access
            '8,6': ['scavengeCommsPanel'],

            // J2 (10,2) - distant smoke investigation
            '10,2': ['investigateDistantSmoke'],
        };

        const renderSelectedTileActions = () => {
            if (!selectedExplored) return;
            // Base camp (B7): once established, it becomes a small crafting hub.
            let ids = TILE_ACTIONS[coordKey(selX, selY)] || [];

            // Cave (B6): once Workbench is built, remove early-game one-off crafting actions.
            // Those items are handled by the Crafting menu after Workbench.
            try {
                const isCave = (selX === 2 && selY === 6);
                if (isCave) {
                    const wb = (salvageActions || []).find(a => a && a.id === 'workbench');
                    const wbDone = !!(wb && isFinished(wb));
                    if (wbDone && Array.isArray(ids) && ids.length) {
                        ids = ids.filter(id => id !== 'createBasicTorch' && id !== 'makeCrudePrybar');
                    }
                }
            } catch { /* ignore */ }
            try {
                const isBaseCamp = (selX === 2 && selY === 7);
                const established = !!(lm && lm.baseCampEstablished === true);
                if (isBaseCamp && established) {
                    // After base camp is established, keep the tile simple:
                    // - Sleep (better than Rest; flavor: inside your tent)
                    // - Visit camp shortcut
                    ids = ['sleep', 'refillCanteen', 'packRations'];

                    mkUtilityButton({
                        id: 'visitCamp',
                        label: 'Visit camp',
                        tooltipOverride: () => ({ id: 'visitCamp', name: 'Visit camp', description: 'Open the Campsite tab.' }),
                        onClick: (e) => {
                            e.preventDefault();
                            try { setActive('camp'); } catch { /* ignore */ }
                        }
                    });
                }
            } catch { /* ignore */ }

            // After base camp is established, allow hauling to camp storage from key supply tiles.
            try {
                const established = !!(lm && lm.baseCampEstablished === true);
                if (established) {
                    const k = coordKey(selX, selY);
                    if (k === '4,7') {
                        // D7 berries
                        if (!ids.includes('haulBerries')) ids = [...ids, 'haulBerries'];
                    }
                    if (k === '8,8') {
                        // H8 river
                        if (!ids.includes('haulWater')) ids = [...ids, 'haulWater'];
                    }
                }
            } catch { /* ignore */ }
            for (const id of ids) {
                const a = salvageActions.find(x => x && x.id === id);
                if (!a) continue;

                // Some actions are intentionally tile-bound and should not rely on global unlock state.
                // (We still respect unlock rules via getBlockedStatus when attempting to start.)
                const shouldShow = (id === 'huntWildlife') ? true : !!a.isUnlocked;
                if (!shouldShow) continue;

                mkButton(a, {
                    ariaDisabled: !playerOnSelected,
                    disabledReason: !playerOnSelected ? 'You need to be closer to perform this action.' : '',
                    onClick: (e) => {
                        if (!playerOnSelected) {
                            e.preventDefault();
                            logNeedCloser();
                            return;
                        }

                        // Mirror attachStartClickHandler preflight so disabled reasons still apply.
                        const capReason = getCapacityBlockReason(a);
                        if (capReason) {
                            e.preventDefault();
                            addLogEntry(capReason, LogType.INFO);
                            return;
                        }
                        const block = getBlockedStatus(a.id, { actions: salvageActions, flags: gameFlags, characterState });
                        if (block.blocked) {
                            e.preventDefault();
                            addLogEntry(block.reason, LogType.INFO);
                            return;
                        }
                        const shortfalls = getAffordabilityShortfalls(a, resources, characterState);
                        if (shortfalls.length > 0) {
                            e.preventDefault();
                            addLogEntry(`Cannot start "${a.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                            return;
                        }

                        const actionForHandler = Object.assign({}, a, { uiInstanceId: `localmap:${String(a.id)}` });
                        startAction(actionForHandler, host);
                        try { renderLocalMap(); } catch { /* ignore */ }
                    }
                });
            }
        };

        // Sit down: tile-bound convenience action.
        try {
            const sit = salvageActions.find(a => a && a.id === 'sitDown');
            const isB6 = (selX === 2 && selY === 6);
            const isBaseCampEstablished = (selX === 2 && selY === 7 && !!(lm && lm.baseCampEstablished === true));
            if (sit && sit.isUnlocked && selectedExplored && playerOnSelected && !isB6 && !isBaseCampEstablished) {
                mkButton(sit, {
                    onClick: (e) => {
                        const actionForHandler = Object.assign({}, sit, { uiInstanceId: `localmap:${String(sit.id)}` });
                        startAction(actionForHandler, host);
                        try { renderLocalMap(); } catch { /* ignore */ }
                    }
                });
            }
        } catch { /* ignore */ }

        // Selected-tile actions (Rest/Forage/Purify/etc) via the coord→actions mapping.
        try { renderSelectedTileActions(); } catch { /* ignore */ }

        // Scavenge Debris Field: available on any tile adjacent to the crash POI.
        try {
            const debris = salvageActions.find(a => a && a.id === 'scavengeDebris');
            if (debris && debris.isUnlocked && selectedExplored && isOrthogonallyAdjacentToCrashPoi(selX, selY)) {
                const lm = characterState?.localMap;
                const key = `${selX},${selY}`;
                const used = Math.max(0, Math.floor(Number(lm?.debrisScavengedByTile?.[key] || 0)));
                const max = 3;
                if (used < max) {
                    const remaining = Math.max(0, max - used);
                    mkButton(debris, {
                        label: `${debris.name} (${remaining} left)`,
                        ariaDisabled: !playerOnSelected,
                        disabledReason: !playerOnSelected ? 'You need to be closer to perform this action.' : '',
                        onClick: (e) => {
                            if (!playerOnSelected) {
                                e.preventDefault();
                                logNeedCloser();
                                return;
                            }
                            // Safety: prevent starting if depleted (can happen if state updates mid-render)
                            try {
                                const usedNow = Math.max(0, Math.floor(Number(characterState?.localMap?.debrisScavengedByTile?.[key] || 0)));
                                if (usedNow >= max) {
                                    e.preventDefault();
                                    addLogEntry('The debris here has been picked clean.', LogType.INFO);
                                    return;
                                }
                            } catch { /* ignore */ }
                            const actionForHandler = Object.assign({}, debris, { uiInstanceId: `localmap:${String(debris.id)}` });
                            startAction(actionForHandler, host);
                            try { renderLocalMap(); } catch { /* ignore */ }
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        // Strip Wiring: available on any crash POI tile the player is standing on (once unlocked).
        try {
            const strip = salvageActions.find(a => a && a.id === 'stripWiring');
            const here = getLocalMapTileAt(selX, selY, { scoutStage, hasTriedReentry, localMapState: lm });
            const isCorridorOnly = !!(here && here.typeId === 'corridor');
            if (strip && strip.isUnlocked && selectedExplored && isCorridorOnly) {
                const lm = characterState?.localMap;
                const key = `${selX},${selY}`;
                const used = Math.max(0, Math.floor(Number(lm?.wiringStrippedByTile?.[key] || 0)));
                const max = 5;
                if (used < max) {
                    const remaining = Math.max(0, max - used);
                    mkButton(strip, {
                        label: `${strip.name} (${remaining} left)`,
                        ariaDisabled: !playerOnSelected,
                        disabledReason: !playerOnSelected ? 'You need to be closer to perform this action.' : '',
                        onClick: (e) => {
                            if (!playerOnSelected) {
                                e.preventDefault();
                                logNeedCloser();
                                return;
                            }
                            const actionForHandler = Object.assign({}, strip, { uiInstanceId: `localmap:${String(strip.id)}` });
                            startAction(actionForHandler, host);
                            try { renderLocalMap(); } catch { /* ignore */ }
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        // Cafeteria supplies scavenging: only on D6, limited.
        try {
            const sup = salvageActions.find(a => a && a.id === 'scavengeCafeteriaSupplies');
            const isD6 = (selX === 4 && selY === 6);
            if (sup && sup.isUnlocked && selectedExplored && isD6) {
                const lm = characterState?.localMap;
                const key = '4,6';
                const used = Math.max(0, Math.floor(Number(lm?.cafeteriaSuppliesByTile?.[key] || 0)));
                const max = 7;
                if (used < max) {
                    const remaining = Math.max(0, max - used);
                    mkButton(sup, {
                        label: `${sup.name} (${remaining} left)`,
                        ariaDisabled: !playerOnSelected,
                        disabledReason: !playerOnSelected ? 'You need to be closer to perform this action.' : '',
                        onClick: (e) => {
                            if (!playerOnSelected) {
                                e.preventDefault();
                                logNeedCloser();
                                return;
                            }
                            const actionForHandler = Object.assign({}, sup, { uiInstanceId: `localmap:${String(sup.id)}` });
                            startAction(actionForHandler, host);
                            try { renderLocalMap(); } catch { /* ignore */ }
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        // Ship interior corridor/bridge tiles: these behave like "movement" choices until searched.
        // When selecting one of these adjacent tiles, do NOT show Move; show the corresponding action instead.
        const SHIP_JUNCTION_TILE_ACTIONS = {
            // E4
            '5,4': 'searchNorthCorridor',
            // E6
            '5,6': 'searchSouthCorridor',
            // F5
            '6,5': 'investigateBridge',
        };

        // Ship interior rooms: also approached via a tile-bound "Search:" action first.
        const SHIP_ROOM_TILE_ACTIONS = {
            // D6
            '4,6': 'exploreCafeteria',
            // F6
            '6,6': 'checkCrewQuarters',
            // G3
            '7,3': 'searchLabs',
            // G4
            '7,4': 'searchPowerCore',
            // G7
            '7,7': 'checkCaptainsQuarters',
        };

        const SHIP_TILE_ACTIONS = Object.assign({}, SHIP_JUNCTION_TILE_ACTIONS, SHIP_ROOM_TILE_ACTIONS);

        const getShipTileActionIdFor = (x, y) => {
            const key = coordKey(x, y);
            if (key === '7,4') {
                try {
                    const core = salvageActions.find(a => a && a.id === 'searchPowerCore');
                    if (core && core.isUnlocked && !isFinished(core)) return 'searchPowerCore';
                    const restore = salvageActions.find(a => a && a.id === 'restoreEmergencyPower');
                    if (restore && restore.isUnlocked && !isFinished(restore)) return 'restoreEmergencyPower';
                } catch { /* ignore */ }
                return null;
            }
            return SHIP_TILE_ACTIONS[key] || null;
        };

        const isShipTileWithActionGate = (x, y) => {
            return !!getShipTileActionIdFor(x, y);
        };

        const isShipTileActionIncompleteForTile = (x, y) => {
            try {
                const actionId = getShipTileActionIdFor(x, y) || null;
                if (!actionId) return false;
                const a = salvageActions.find(z => z && z.id === actionId);
                if (!a) return false;
                if (!a.isUnlocked) return false;
                return !isFinished(a);
            } catch { /* ignore */ }
            return false;
        };

        // If selecting a ship gate tile, surface its action and treat it as the primary interaction.
        // (This keeps existing affordability/blocking rules because mkButton uses attachStartClickHandler.)
        try {
            if (!isSelectingPlayerTile || selectedExplored) {
                const dx = Math.abs(selX - playerX);
                const dy = Math.abs(selY - playerY);
                const dist = dx + dy;
                const isDiagonal = (dx === 1 && dy === 1);
                const actionId = getShipTileActionIdFor(selX, selY) || null;

                // Allow interaction if adjacent (original behavior) OR if the tile is explored.
                const canShow = !!(actionId && (!isDiagonal && dist === 1 || selectedExplored));
                if (canShow && actionId) {
                    const a = salvageActions.find(x => x && x.id === actionId);
                    // Once the action is finished, the tile becomes traversable like normal (Move comes back).
                    if (a && a.isUnlocked && !isFinished(a)) {
                        mkButton(a, {
                            ariaDisabled: !(dist === 1 || playerOnSelected),
                            disabledReason: !(dist === 1 || playerOnSelected) ? 'You need to be closer to perform this action.' : '',
                            onClick: (e) => {
                                if (!(dist === 1 || playerOnSelected)) {
                                    e.preventDefault();
                                    logNeedCloser();
                                    return;
                                }
                                // Preflight checks mirror attachStartClickHandler.
                                const capReason = getCapacityBlockReason(a);
                                if (capReason) {
                                    e.preventDefault();
                                    addLogEntry(capReason, LogType.INFO);
                                    return;
                                }
                                const block = getBlockedStatus(a.id, { actions: salvageActions, flags: gameFlags, characterState });
                                if (block.blocked) {
                                    e.preventDefault();
                                    addLogEntry(block.reason, LogType.INFO);
                                    return;
                                }
                                const shortfalls = getAffordabilityShortfalls(a, resources, characterState);
                                if (shortfalls.length > 0) {
                                    e.preventDefault();
                                    addLogEntry(`Cannot start "${a.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                                    return;
                                }

                                // Queue a post-completion move only when starting from an adjacent tile.
                                // (If you're already standing on the tile, do not queue an extra move.)
                                try {
                                    if (dist === 1 && characterState && characterState.localMap) {
                                        const idx = Number(a.stage || 0);
                                        const total = Array.isArray(a.stages) ? a.stages.length : 0;
                                        const willFinish = (total <= 0) ? true : ((idx + 1) >= total);
                                        if (willFinish && a.id !== 'pryOpenHull') {
                                            characterState.localMap.pendingActionMove = {
                                                actionId: String(a.id),
                                                fromX: playerX,
                                                fromY: playerY,
                                                toX: selX,
                                                toY: selY,
                                                queuedAt: Date.now(),
                                            };
                                        }
                                    }
                                } catch { /* ignore */ }

                                const actionForHandler = Object.assign({}, a, { uiInstanceId: `localmap:${String(a.id)}` });
                                startAction(actionForHandler, host);

                                // Refresh action list in case any disabling text changes.
                                try { renderLocalMap(); } catch { /* ignore */ }
                            }
                        });
                    }
                }
            }
        } catch { /* ignore */ }

        // Move (prototype): show the Move button only once it is unlocked.
        // Exception: when selecting the ship entrance tile (F7), show only "Go back inside".
        const move = salvageActions.find(a => a && a.id === 'move');
        const reentry = salvageActions.find(a => a && a.id === 'attemptReentry');
        const moveUnlocked = !!(move && move.isUnlocked);

        if (move && moveUnlocked && !isSelectingPlayerTile) {
            const dx = Math.abs(selX - playerX);
            const dy = Math.abs(selY - playerY);
            const dist = dx + dy;

            // If the destination tile itself is blocked by map rules (e.g., collapsed entrance),
            // do not show movement actions for it.
            const selectedMeta = (() => {
                try {
                    return getLocalMapTileAt(selX, selY, { scoutStage, hasTriedReentry, localMapState: lm });
                } catch { /* ignore */ }
                return null;
            })();
            const selectedTileBlocked = !!(selectedMeta && selectedMeta.blocked);

            if (selectedTileBlocked) {
                // Intentionally show no Explore/Traverse button.
            }

            // Explored tiles: Traverse is the only movement-style action.
            else if (selectedExplored) {
                const path = findCrashSitePath({
                    fromX: playerX,
                    fromY: playerY,
                    toX: selX,
                    toY: selY,
                    localMapState: lm,
                    scoutStage,
                    hasTriedReentry,
                });

                const hasPath = !!(path && path.length >= 2);
                const steps = hasPath ? Math.max(0, path.length - 1) : 0;
                const disabledReason = hasPath
                    ? ''
                    : ((dist === 1) ? (computeAdjacentLocalMapBlockReason(playerX, playerY, selX, selY, { localMapState: lm, scoutStage, hasTriedReentry }) || 'No clear route to that tile.') : 'No clear route to that tile.');

                const traverseBtn = mkUtilityButton({
                    id: 'traverse',
                    label: 'Traverse here',
                    ariaDisabled: !hasPath,
                    disabledReason,
                    tooltipOverride: () => buildMoveStyleTooltipData(move, { mode: 'traverse', steps: Math.max(1, steps) }),
                    onClick: (e) => {
                        e.preventDefault();

                        if (!hasPath) {
                            addLogEntry(disabledReason || 'No clear route to that tile.', LogType.INFO);
                            return;
                        }

                        const active = getActiveCrashSiteAction();
                        if (active) {
                            // Queue the destination to re-path after the current step.
                            try {
                                if (lm) lm.traverseQueuedDestination = { x: selX, y: selY };
                                addLogEntry('Traverse updated.', LogType.INFO);
                            } catch { /* ignore */ }
                            return;
                        }

                        try {
                            lm.traverseQueue = path.slice(1);
                            delete lm.traverseQueuedDestination;
                        } catch { /* ignore */ }

                        clearRoutePreview();
                        tryStartNextTraverseStep(host);
                    }
                });

                // Ensure Traverse is always shown first when multiple actions are visible.
                try {
                    if (traverseBtn && actionsHost && actionsHost.firstChild && actionsHost.firstChild !== traverseBtn) {
                        actionsHost.insertBefore(traverseBtn, actionsHost.firstChild);
                    }
                } catch { /* ignore */ }

                if (traverseBtn && hasPath) {
                    traverseBtn.addEventListener('mouseenter', () => setRoutePreview(path, 'traverse'));
                    traverseBtn.addEventListener('mouseleave', () => clearRoutePreview());
                }
            } else {
                // Unexplored tiles: show Explore only when adjacent (one-step move into fog).
                if (dist === 1) {
                    // Captain's Quarters: forbid generic Explore until the narrative unlock occurs.
                    // (This prevents players from bypassing the intended unlock gating by simply exploring the tile.)
                    try {
                        if (selX === 7 && selY === 7) {
                            const cq = salvageActions.find(a => a && a.id === 'checkCaptainsQuarters');
                            const cqUnlocked = !!(cq && cq.isUnlocked);
                            if (!cqUnlocked) {
                                const reason = "You’re pretty sure the captain’s body is still on the bridge — and you don’t feel like going through his stuff now.";
                                const btn = mkButton(move, {
                                    label: 'Explore',
                                    ariaDisabled: true,
                                    disabledReason: reason,
                                    tooltipOverride: () => buildMoveStyleTooltipData(move, { mode: 'explore', steps: 1 }),
                                    onClick: (e) => {
                                        e.preventDefault();
                                        addLogEntry(reason, LogType.INFO);
                                    }
                                });
                                if (btn) {
                                    btn.addEventListener('mouseenter', () => setRoutePreview([{ x: playerX, y: playerY }, { x: selX, y: selY }], 'move'));
                                    btn.addEventListener('mouseleave', () => clearRoutePreview());
                                }
                                return;
                            }
                        }
                    } catch { /* ignore */ }

                    // Do not offer Explore onto ship interior gated tiles until their tile-action is complete.
                    if (!(isShipTileWithActionGate(selX, selY) && isShipTileActionIncompleteForTile(selX, selY))) {
                        const blockReason = computeAdjacentLocalMapBlockReason(playerX, playerY, selX, selY, { localMapState: lm, scoutStage, hasTriedReentry });
                        const isAltAccessTile = (selX === 4 && selY === 5);
                        const pry = isAltAccessTile ? salvageActions.find(a => a && a.id === 'pryOpenHull') : null;
                        const pryDone = isAltAccessTile ? isFinished(pry) : false;
                        const shouldHideExploreForAltAccess = !!(isAltAccessTile && !pryDone);

                        if (!shouldHideExploreForAltAccess) {
                            if (blockReason) {
                                const btn = mkButton(move, {
                                    label: 'Explore',
                                    ariaDisabled: true,
                                    disabledReason: blockReason,
                                    tooltipOverride: () => buildMoveStyleTooltipData(move, { mode: 'explore', steps: 1 }),
                                    onClick: (e) => {
                                        e.preventDefault();
                                        addLogEntry(blockReason, LogType.INFO);
                                    }
                                });
                                if (btn) {
                                    btn.addEventListener('mouseenter', () => setRoutePreview([{ x: playerX, y: playerY }, { x: selX, y: selY }], 'move'));
                                    btn.addEventListener('mouseleave', () => clearRoutePreview());
                                }
                            } else {
                                const btn = mkButton(move, {
                                    label: 'Explore',
                                    tooltipOverride: () => buildMoveStyleTooltipData(move, { mode: 'explore', steps: 1 }),
                                });
                                if (btn) {
                                    btn.addEventListener('mouseenter', () => setRoutePreview([{ x: playerX, y: playerY }, { x: selX, y: selY }], 'move'));
                                    btn.addEventListener('mouseleave', () => clearRoutePreview());
                                }
                            }
                        }
                    }
                }
            }
        }

        

        // Coordinate-specific action: F7 has Go back inside (attemptReentry)
        try {
            if (selX === SHIP_ENTRANCE.x && selY === SHIP_ENTRANCE.y) {
                if (reentry && reentry.isUnlocked) {
                    const nearTile = (Math.abs(playerX - SHIP_ENTRANCE.x) + Math.abs(playerY - SHIP_ENTRANCE.y) <= 1);
                    mkButton(reentry, {
                        disabled: !nearTile,
                        disabledReason: nearTile ? '' : 'Move next to F7 to use this.'
                    });
                }
            }
        } catch { /* ignore */ }

        // Coordinate-specific action: D5 can be interacted with from C5.
        // It starts as Attempt Alternate Access, then swaps to Pry Open Hull.
        try {
            const ALT_ACCESS = { x: 4, y: 5 }; // D5
            const ALT_ACCESS_STAND = { x: 3, y: 5 }; // C5

            if (selX === ALT_ACCESS.x && selY === ALT_ACCESS.y) {
                const alt = salvageActions.find(a => a && a.id === 'attemptAlternateAccess');
                const pry = salvageActions.find(a => a && a.id === 'pryOpenHull');

                const playerAtC5 = (playerX === ALT_ACCESS_STAND.x && playerY === ALT_ACCESS_STAND.y);
                const notAtC5Reason = 'Move to C5 to use this.';

                const altDone = isFinished(alt);
                const pryDone = isFinished(pry);

                // Tile-bound: show Attempt Alternate Access once the player has discovered the opening at C5.
                // Do not depend on the action being globally unlocked (prevents story popups from listing it).
                const openingKnown = !!(lm && (lm.c5ShipOpeningSpotted === true || lm.c5ThornWallBurned === true));
                if (openingKnown && alt && !altDone) {
                    mkButton(alt, {
                        disabled: !playerAtC5,
                        disabledReason: playerAtC5 ? '' : notAtC5Reason,
                    });
                } else if (altDone && pry && pry.isUnlocked && !pryDone) {
                    mkButton(pry, {
                        disabled: !playerAtC5,
                        disabledReason: playerAtC5 ? '' : notAtC5Reason,
                    });
                }
            }
        } catch { /* ignore */ }

        // Coordinate-specific action: C5 thorny wall can be burned from C6 (one-time gate).
        try {
            const C5 = { x: 3, y: 5 };
            const C6 = { x: 3, y: 6 };
            const burn = salvageActions.find(a => a && a.id === 'burnThornyWall');

            if (selX === C5.x && selY === C5.y && burn) {
                const playerAtC6 = (playerX === C6.x && playerY === C6.y);
                const alreadyBurned = !!(lm && lm.c5ThornWallBurned === true);

                if (playerAtC6 && !alreadyBurned) {
                    mkButton(burn, {
                        ariaDisabled: true,
                        disabledReason: 'Equip a Basic Torch in an accessory slot to burn the thorns.',
                        onClick: (e) => {
                            e.preventDefault();

                            const torchEquippedNow = !!(
                                (characterState?.equipment?.accessory_1 === 'basic_torch')
                                || (characterState?.equipment?.accessory_2 === 'basic_torch')
                            );

                            if (!torchEquippedNow) {
                                addLogEntry('Equip a Basic Torch in an accessory slot to burn the thorny wall.', LogType.INFO);
                                return;
                            }

                            // Preflight checks mirror attachStartClickHandler.
                            const capReason = getCapacityBlockReason(burn);
                            if (capReason) {
                                addLogEntry(capReason, LogType.INFO);
                                return;
                            }

                            const block = getBlockedStatus(burn.id, { actions: salvageActions, flags: gameFlags, characterState });
                            if (block.blocked) {
                                addLogEntry(block.reason, LogType.INFO);
                                return;
                            }

                            const shortfalls = getAffordabilityShortfalls(burn, resources, characterState);
                            if (shortfalls.length > 0) {
                                addLogEntry(`Cannot start "${burn.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                                return;
                            }

                            const actionForHandler = Object.assign({}, burn, { uiInstanceId: `localmap:${String(burn.id)}` });
                            startAction(actionForHandler, host);

                            try { renderLocalMap(); } catch { /* ignore */ }
                        },
                        tooltipOverride: () => {
                            const base = tooltipDataForAction(burn);
                            const desc = String(base.description || '');
                            return Object.assign({}, base, { description: `${desc}\n\nRequires: Basic Torch equipped (accessory).` });
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        // No more text hint blocks; Move is always present now.
    };

    const renderLocalMap = () => {
        try {
            const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
            const stage = Number(scout?.stage || 0);
            const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;
            const reentry = salvageActions.find(a => a && a.id === 'attemptReentry');
            const hasTriedReentry = !!(reentry && ((reentry.completed === true) || (Number.isFinite(reentry.stage) && reentry.stage > 0)));

            try {
                if (characterState && characterState.localMap) {
                    characterState.localMap.hasTriedReentry = hasTriedReentry;
                }
            } catch { /* ignore */ }

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

            // Double-click a tile to attempt Move.
            try {
                if (mapHost && !mapHost.dataset.boundLocalMapDoubleClick) {
                    mapHost.dataset.boundLocalMapDoubleClick = 'true';
                    mapHost.addEventListener('local-map-tile-double-clicked', (ev) => {
                        const detail = ev && ev.detail ? ev.detail : null;
                        const tx = Number(detail && detail.x);
                        const ty = Number(detail && detail.y);
                        const lm = characterState?.localMap;
                        if (!lm || !Number.isFinite(tx) || !Number.isFinite(ty)) return;

                        const px = Number.isFinite(lm.x) ? lm.x : 6;
                        const py = Number.isFinite(lm.y) ? lm.y : 8;
                        const dist = Math.abs(tx - px) + Math.abs(ty - py);

                        // Double-click on the current tile: Sit down.
                        if (tx === px && ty === py) {
                            try {
                                const sit = salvageActions.find(a => a && a.id === 'sitDown');
                                if (sit && sit.isUnlocked) {
                                    const capReason = getCapacityBlockReason(sit);
                                    if (capReason) {
                                        addLogEntry(capReason, LogType.INFO);
                                        return;
                                    }
                                    const block = getBlockedStatus(sit.id, { actions: salvageActions, flags: gameFlags, characterState });
                                    if (block.blocked) {
                                        addLogEntry(block.reason, LogType.INFO);
                                        return;
                                    }
                                    const shortfalls = getAffordabilityShortfalls(sit, resources, characterState);
                                    if (shortfalls.length > 0) {
                                        addLogEntry(`Cannot start "${sit.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                                        return;
                                    }

                                    const actionForHandler = Object.assign({}, sit, { uiInstanceId: `localmap:${String(sit.id)}` });
                                    startAction(actionForHandler, host);
                                    try { renderLocalMap(); } catch { /* ignore */ }
                                    return;
                                }
                            } catch { /* ignore */ }
                            return;
                        }

                        // If the tile is already explored, double-click should attempt a Traverse
                        // using pathfinding (can be more than one step).
                        const isExplored = (() => {
                            try {
                                const key = `${Number(tx)},${Number(ty)}`;
                                return !!(lm && lm.visited && typeof lm.visited === 'object' && lm.visited[key] === true);
                            } catch { return false; }
                        })();

                        if (isExplored && !(tx === px && ty === py)) {
                            try {
                                lm.selectedX = tx;
                                lm.selectedY = ty;
                            } catch { /* ignore */ }

                            // Keep the action list in sync with selection.
                            try { renderLocalMapActions(); } catch { /* ignore */ }

                            const path = findCrashSitePath({
                                fromX: px,
                                fromY: py,
                                toX: tx,
                                toY: ty,
                                localMapState: lm,
                                scoutStage: stage,
                                hasTriedReentry,
                            });

                            if (!path || path.length < 2) {
                                const blockReason = (dist === 1)
                                    ? computeAdjacentLocalMapBlockReason(px, py, tx, ty, { localMapState: lm, scoutStage: stage, hasTriedReentry })
                                    : '';
                                addLogEntry(blockReason || 'No clear route to that tile.', LogType.INFO);
                                return;
                            }

                            const active = getActiveCrashSiteAction();
                            if (active) {
                                // Queue the destination to re-path after the current step.
                                try {
                                    lm.traverseQueuedDestination = { x: tx, y: ty };
                                } catch { /* ignore */ }
                                addLogEntry('Traverse updated.', LogType.INFO);
                                return;
                            }

                            try {
                                lm.traverseQueue = path.slice(1);
                                delete lm.traverseQueuedDestination;
                            } catch { /* ignore */ }

                            try { clearLocalMapRoutePreview(host); } catch { /* ignore */ }
                            tryStartNextTraverseStep(host);
                            return;
                        }

                        // Only adjacent orthogonal moves are valid.
                        if (dist !== 1) return;

                        // Ship interior tiles: double-click starts the tile-bound action instead of Move (until complete).
                        // After completion (or if not currently unlocked), double-click falls through to plain Move.
                        const tileActions = {
                            // Corridor junction tiles
                            '5,4': 'searchNorthCorridor',
                            '5,6': 'searchSouthCorridor',
                            '6,5': 'investigateBridge',
                            // Cafeteria tile gate
                            '4,6': 'exploreCafeteria',
                            // Crew quarters gate
                            '6,6': 'checkCrewQuarters',
                            // Rooms
                            '7,3': 'searchLabs',
                            '7,4': 'searchPowerCore',
                            // Captain's Quarters
                            '7,7': 'checkCaptainsQuarters',
                        };
                        const tKey = `${tx},${ty}`;
                        let tileActionId = tileActions[tKey] || null;
                        if (tKey === '7,4') {
                            try {
                                const core = salvageActions.find(a => a && a.id === 'searchPowerCore');
                                if (core && core.isUnlocked && !isFinished(core)) {
                                    tileActionId = 'searchPowerCore';
                                } else {
                                    const restore = salvageActions.find(a => a && a.id === 'restoreEmergencyPower');
                                    if (restore && restore.isUnlocked && !isFinished(restore)) {
                                        tileActionId = 'restoreEmergencyPower';
                                    } else {
                                        tileActionId = null;
                                    }
                                }
                            } catch { /* ignore */ }
                        }
                        if (tileActionId) {
                            const a = salvageActions.find(x => x && x.id === tileActionId);
                            const canStart = !!(a && a.isUnlocked && !isFinished(a));
                            if (canStart) {
                                const capReason = getCapacityBlockReason(a);
                                if (capReason) {
                                    addLogEntry(capReason, LogType.INFO);
                                    return;
                                }
                                const block = getBlockedStatus(a.id, { actions: salvageActions, flags: gameFlags, characterState });
                                if (block.blocked) {
                                    addLogEntry(block.reason, LogType.INFO);
                                    return;
                                }
                                const shortfalls = getAffordabilityShortfalls(a, resources, characterState);
                                if (shortfalls.length > 0) {
                                    addLogEntry(`Cannot start "${a.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                                    return;
                                }

                                // Queue a post-completion move.
                                try {
                                    lm.pendingActionMove = {
                                        actionId: String(a.id),
                                        fromX: px,
                                        fromY: py,
                                        toX: tx,
                                        toY: ty,
                                        queuedAt: Date.now(),
                                    };
                                } catch { /* ignore */ }

                                try { renderLocalMapActions(); } catch { /* ignore */ }
                                const actionForHandlerJ = Object.assign({}, a, { uiInstanceId: `localmap:${String(a.id)}` });
                                startAction(actionForHandlerJ, host);
                                return;
                            }
                        }

                        try {
                            lm.selectedX = tx;
                            lm.selectedY = ty;
                        } catch { /* ignore */ }

                        // Ensure action list reflects the new selection (so Move button state stays consistent).
                        try { renderLocalMapActions(); } catch { /* ignore */ }

                        const move = salvageActions.find(a => a && a.id === 'move');
                        if (!move) return;

                        if (!move.isUnlocked) return;

                        // Captain's Quarters: forbid generic Explore until the narrative unlock occurs.
                        try {
                            if (tx === 7 && ty === 7 && !isExplored) {
                                const cq = salvageActions.find(a => a && a.id === 'checkCaptainsQuarters');
                                const cqUnlocked = !!(cq && cq.isUnlocked);
                                if (!cqUnlocked) {
                                    addLogEntry("You’re pretty sure the captain’s body is still on the bridge — and you don’t feel like going through his stuff now.", LogType.INFO);
                                    return;
                                }
                            }
                        } catch { /* ignore */ }

                        const actionForHandler = Object.assign({}, move, {
                            uiInstanceId: `localmap:${String(move.id)}`,
                            name: isExplored ? 'Traverse' : 'Explore'
                        });
                        const capReason = getCapacityBlockReason(actionForHandler);
                        if (capReason) {
                            addLogEntry(capReason, LogType.INFO);
                            return;
                        }
                        const block = getBlockedStatus(actionForHandler.id, { actions: salvageActions, flags: gameFlags, characterState });
                        if (block.blocked) {
                            addLogEntry(block.reason, LogType.INFO);
                            return;
                        }
                        const shortfalls = getAffordabilityShortfalls(actionForHandler, resources, characterState);
                        if (shortfalls.length > 0) {
                            addLogEntry(`Cannot start "${actionForHandler.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                            return;
                        }

                        startAction(actionForHandler, host);
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
        if (panes.map) panes.map.classList.toggle('active', key === 'map');
        if (panes.camp) panes.camp.classList.toggle('active', key === 'camp');

        // Background cross-fade is handled purely by CSS.
        try { applyCampsiteBackground(host, key === 'camp'); } catch { /* ignore */ }
        try { localStorage.setItem('crashSiteActiveTab', key); } catch { /* ignore */ }
    };
    tabs.forEach(t => {
        t.addEventListener('click', () => {
            const wanted = t.dataset.tab === 'camp' ? 'camp' : 'map';
            if (wanted === 'camp' && !isCampsiteUnlocked) return;
            setActive(wanted);
            if (wanted === 'map') renderLocalMap();
        });
    });

    // If the map tab is active on load, render it.
    if (activeTab === 'map') renderLocalMap();

    // Crash Site pane has been replaced by the Campsite tab layout.
    section = host.querySelector('#campsitePane') || host;

    const availableActions = salvageActions.filter(action => {
        if (!action) return false;
        if (CRASH_SITE_MAP_BOUND_ACTION_IDS.has(action.id)) return false;
        const stageIndex = action.stage || 0;
        const totalStages = (action.stages || []).length;
        if (totalStages > 0 && stageIndex >= totalStages) return !!action.repeatable && !!action.isUnlocked;
        return !!action.isUnlocked;
    });

    // Campsite tab no longer renders a generic action list.
    // All non-upgrade actions are either tile-bound (Local map) or live in the Crafting section.

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

        const mainInstanceKey = `${action.id}::main`;
        let btn = null;
        if (existingButtons && existingButtons.has(mainInstanceKey)) {
            btn = existingButtons.get(mainInstanceKey);
            existingButtons.delete(mainInstanceKey);
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = action.id;
        }
        btn.className = 'image-button';
        btn.dataset.actionId = action.id;
        btn.dataset.actionInstance = 'main';
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
    // (and any context-dependent description overrides)
    setupTooltip(btn, () => tooltipDataForActionWithContext(action));

        const canAfford = canAffordAction(action, resources, characterState);
        btn.classList.toggle('unaffordable', !canAfford);
        btn.dataset.affordable = canAfford ? 'true' : 'false'; // Set initial value for state tracking
        if (!canAfford) {
            btn.setAttribute('aria-disabled', 'true');
            btn.dataset.shortfall = getAffordabilityShortfalls(action, resources, characterState).join(', ');
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

    // Campsite panels (Upgrades / Buildings / Jobs)
    try { renderCampsitePanels(host, { availableActions, createActionButton }); } catch { /* ignore */ }
}

// Start an action and set up UI/progress state
    export function startAction(action, section) {
    const existing = getActiveCrashSiteAction();
    if (existing) {
        const runningName = existing && existing.name ? String(existing.name) : 'another action';
        addLogEntry(`Cannot start "${action.name}" while "${runningName}" is in progress.`, LogType.INFO);
        return;
    }
    if (lsGet('gamePaused') === 'true') {
        addLogEntry(`Cannot start "${action.name}" while game is paused. Resume the game first.`, LogType.INFO);
        return;
    }

    if (!canAffordAction(action, resources, characterState)) {
        addLogEntry(`Not enough resources to begin: ${action.name}.`, LogType.ERROR);
        return;
    }
    const stage = getCurrentStage(action);
    const upfront = [...(action.cost || []), ...((stage && stage.cost) || [])];
    upfront.forEach(cost => {
        const itemId = getItemIdForResourceName(cost?.resource);
        const amt = Math.max(0, Math.floor(Number(cost?.amount) || 0));
        if (itemId) {
            // Consume inventory items.
            try { consumeItemQuantityFromBag(itemId, amt, characterState); } catch { /* ignore */ }
            return;
        }

        const r = resources.find(x => x && x.name === cost.resource);
        if (r) r.amount -= amt;
    });
    refreshCurrentTooltip();

    const sel = action && action.uiInstanceId
        ? `[data-action-id="${action.id}"][data-action-instance="${action.uiInstanceId}"]`
        : `[data-action-id="${action.id}"][data-action-instance="main"]`;
    const btn = section.querySelector(sel);
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
        // Optional: used to locate the correct UI button when multiple instances exist.
        uiInstanceId: action && action.uiInstanceId ? action.uiInstanceId : undefined,
        startTime: Date.now(),
        lastTickTime: Date.now(),
        elapsed: 0
    });

    // Local map movement: start the travel-dot animation immediately and let it run
    // for the full effective action duration (so it doesn't feel delayed).
    try {
        if (snapshot && snapshot.id === 'move') {
            const lm = characterState?.localMap;
            if (lm) {
                const fromX = Number.isFinite(lm.x) ? lm.x : 6;
                const fromY = Number.isFinite(lm.y) ? lm.y : 8;
                const toX = Number.isFinite(lm.selectedX) ? lm.selectedX : fromX;
                const toY = Number.isFinite(lm.selectedY) ? lm.selectedY : fromY;
                const dist = Math.abs(toX - fromX) + Math.abs(toY - fromY);
                if (dist === 1 && !(toX === fromX && toY === fromY)) {
                    const effectiveSec = computeEffectiveDuration(snapshot, resources);
                    const ts = Number(window.TIME_SCALE || 1);
                    const timeScale = (Number.isFinite(ts) && ts > 0) ? ts : 1;
                    // updateActionProgress() advances elapsed by delta * TIME_SCALE, so real-time duration is duration / TIME_SCALE.
                    const durationMs = Math.max(180, Math.round((Number(effectiveSec) * 1000) / timeScale));
                    try { lm._skipPostMoveAnimUntil = 0; } catch { /* ignore */ }
                    lm.inFlightTravel = {
                        fromX,
                        fromY,
                        toX,
                        toY,
                        startAt: Date.now(),
                        durationMs
                    };
                    refreshCrashSiteLocalMapUi(section);
                }
            }
        }
    } catch { /* ignore */ }

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
    const sel = action && action.uiInstanceId
        ? `[data-action-id="${action.id}"][data-action-instance="${action.uiInstanceId}"]`
        : `[data-action-id="${action.id}"][data-action-instance="main"]`;
    const btn = section.querySelector(sel);
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

    const sel = a && a.uiInstanceId
        ? `[data-action-id="${a.id}"][data-action-instance="${a.uiInstanceId}"]`
        : `[data-action-id="${a.id}"][data-action-instance="main"]`;
    const btn = section.querySelector(sel);
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
            const refund = Math.floor(Number(c.amount || 0) * 0.5);
            if (refund <= 0) continue;

            const itemId = getItemIdForResourceName(c?.resource);
            if (itemId) {
                try {
                    const placed = grantItemToCharacter(itemId, { preferEquip: false, amount: refund }, characterState);
                    if (placed && placed.ok) refunds.push(`${refund} ${c.resource}`);
                } catch { /* ignore */ }
                continue;
            }

            const res = resources.find(r => r && r.name === c.resource);
            if (res) {
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

    // If traversal was driving Move, stop it immediately.
    try {
        const lm = characterState?.localMap;
        if (a && a.id === 'move' && lm && Array.isArray(lm.traverseQueue) && lm.traverseQueue.length) {
            clearTraverseState(lm);
            try { delete lm.inFlightTravel; } catch { /* ignore */ }
            if (String(message || '').includes('Ran out of')) {
                addLogEntry('Too exhausted to continue traversing.', LogType.INFO);
            }
            clearLocalMapRoutePreview(section);
            // Ensure the actions panel reflects the tile we actually ended on.
            try { refreshCrashSiteLocalMapUi(section); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }

    if (refunds.length) addLogEntry(`Refunded: ${refunds.join(', ')}.`, LogType.INFO);
    // Clear running UI for the cancelled action (in-place) then update button states to avoid DOM rebuild flicker
    const sel = a && a.uiInstanceId
        ? `[data-action-id="${a.id}"][data-action-instance="${a.uiInstanceId}"]`
        : `[data-action-id="${a.id}"][data-action-instance="main"]`;
    const btn = section ? section.querySelector(sel) : document.querySelector(sel);
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
            if (btn.dataset.originalLabel) {
                nameSpan.textContent = btn.dataset.originalLabel;
            } else {
                const defForLabel = salvageActions.find(s => s.id === a.id) || a;
                const max = defForLabel && typeof defForLabel.maxUses === 'number' ? defForLabel.maxUses : null;
                const uses = defForLabel && typeof defForLabel.uses === 'number' ? defForLabel.uses : 0;
                nameSpan.textContent = (max && max > 1)
                    ? `${defForLabel.name} (${Math.max(0, Math.min(max, uses))}/${max})`
                    : ((defForLabel && defForLabel.name) || '');
            }
        }
        delete btn.dataset.originalLabel;
        const actionDef = salvageActions.find(s => s.id === a.id);
        if (actionDef) {
            const inst = btn.dataset.actionInstance;
            const actionForHandler = (inst && inst !== 'main')
                ? Object.assign({}, actionDef, { uiInstanceId: inst })
                : actionDef;
            btn.disabled = false;
            attachStartClickHandler(btn, actionForHandler, section);
        }
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
    const completedUiInstanceId = (() => {
        try { return completed && completed.uiInstanceId ? String(completed.uiInstanceId) : ''; } catch { return ''; }
    })();
    const completedFromLocalMap = completedUiInstanceId.startsWith('localmap:');
    const actionDef = salvageActions.find(a => a.id === completed.id);
    const suppressGeneric = (() => {
        if (!actionDef) return false;
        if (actionDef.suppressGenericLog) return true;
        if (!Array.isArray(actionDef.stages) || actionDef.stages.length === 0) return false;
        const raw = Number.isFinite(actionDef.stage) ? actionDef.stage : 0;
        const idx = Math.max(0, Math.min(actionDef.stages.length - 1, Math.floor(Number(raw) || 0)));
        return !!(actionDef.stages[idx] && actionDef.stages[idx].suppressGenericLog);
    })();

    // If the current stage defines a combat encounter, run it BEFORE granting stage story/unlocks.
    // If the player loses/retreats, do not advance the stage so they can retry.
    let encounterOutcomeForCompletion = null;
    const originalForEncounter = salvageActions.find(a => a.id === completed.id || a.name === completed.name);
    if (originalForEncounter) {
        const totalStages = Array.isArray(originalForEncounter.stages) ? originalForEncounter.stages.length : 0;
        const rawStage = Number.isFinite(originalForEncounter.stage) ? originalForEncounter.stage : (originalForEncounter.stage || 0);
        const idx = (totalStages > 0)
            ? Math.max(0, Math.min(totalStages - 1, Math.floor(Number(rawStage) || 0)))
            : 0;
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
                        const host = document.getElementById('crashSiteSection');
                        if (host) setupCrashSiteSection(host);
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

    const refreshLocalMapIfVisible = () => {
        try {
            const host = document.getElementById('crashSiteSection');
            if (!host) return;

            // Be robust to missing/legacy stored tab state.
            // If the map pane is currently visible, we should refresh it.
            let activeTab = 'map';
            try { activeTab = localStorage.getItem('crashSiteActiveTab') || 'map'; } catch { /* ignore */ }
            if (activeTab === 'crash') activeTab = 'camp';
            if (activeTab !== 'map' && activeTab !== 'camp') activeTab = 'map';

            const localMapPane = host.querySelector('#localMapPane');
            const isMapActive = (activeTab === 'map') || !!(localMapPane && localMapPane.classList.contains('active'));
            if (!isMapActive) return;

            const scout = salvageActions.find(a => a && a.id === 'scoutSurroundings');
            const stage = Number(scout?.stage || 0);
            const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;
            const mapHost = host.querySelector('#crashSiteLocalMapContainer');
            setupCrashSiteLocalMap(mapHost, { scoutStage: stage, totalStages: total, state: characterState?.localMap });

            // Also refresh the local-map action row immediately.
            if (mapHost) {
                mapHost.dispatchEvent(new CustomEvent('local-map-selection-changed'));
            }
        } catch { /* ignore */ }
    };

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

            const itemId = getItemIdForResourceName(rw?.resource);

            const amt = Array.isArray(rw.amount) ? getRandomInt(rw.amount[0], rw.amount[1]) : rw.amount;
            // Apply upgrade-based reward multipliers via upgradeEffects
            const rewardMul = computeRewardMultiplier(completed.id, rw.resource, gameFlags);
            // Apply debug multiplier (excluding Survivors) for action rewards
            let debugMul = 1;
            try {
                if (typeof window !== 'undefined' && window.DEBUG_RESOURCE_GAIN === 10 && rw.resource !== 'Survivors') debugMul = 10;
            } catch (e) { /* ignore */ }
            let finalAmt = Math.floor(amt * rewardMul * debugMul);

            if (itemId) {
                // Grant inventory items.
                try {
                    const placed = grantItemToCharacter(itemId, { preferEquip: false, amount: finalAmt }, characterState);
                    if (placed && placed.ok) {
                        gains.push(`${finalAmt} ${rw.resource}`);
                        try {
                            outcome.items.push({ id: itemId, note: (placed.stacked ? 'Added to stack' : (placed.placed === 'bag' ? 'Added to bag' : 'Obtained')) });
                        } catch { /* ignore */ }
                    } else {
                        addLogEntry(`Found ${rw.resource}, but your inventory is full.`, LogType.INFO);
                    }
                } catch { /* ignore */ }
                return;
            }

            const res = resources.find(r => r && r.name === rw.resource);
            if (!res) return;
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

    // Capture unlock state BEFORE applying stage unlocks and completion handlers.
    // This lets us decide later whether we must rebuild the Crash Site UI (e.g., to show newly unlocked Campsite buildings).
    const preUnlockedActions = new Set((salvageActions || []).filter(a => a && a.isUnlocked).map(a => a.id));
    const preUnlockedBuildings = new Set((typeof buildings !== 'undefined' && Array.isArray(buildings))
        ? buildings.filter(b => b && b.isUnlocked).map(b => b.name)
        : []);
    if (original) {
        const total = Array.isArray(original.stages) ? original.stages.length : 0;
        const rawStage = Number.isFinite(original.stage) ? original.stage : (original.stage || 0);
        const idx = (total > 0)
            ? Math.max(0, Math.min(total - 1, Math.floor(Number(rawStage) || 0)))
            : 0;
        const willFullyCompleteNow = (total <= 0) ? true : ((idx + 1) >= total);

        // Only treat multi-stage actions as completed once the final stage has finished.
        // This is critical for ship-tile gated actions like Investigate Bridge / Search Power Core.
        original.completed = !!(willFullyCompleteNow && !original.repeatable);

        const stage = (original.stages || [])[idx];

    // We'll defer showing any story popup until after we run completion handlers
    // so the outcome can also include buildings/sections unlocked by handlers.

        if (stage) {
            const itemsToGrant = Array.isArray(stage.grantItems) ? stage.grantItems.slice() : [];

            // (Tutorial weapon is granted by a one-time local-map story trigger now.)

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
                const allowUnlockOutcome = !(
                    (actionDef && actionDef.showUnlocks === false)
                    || (stage && stage.showUnlocks === false)
                );
                stage.unlocks.forEach(id => {
                    const toUnlock = salvageActions.find(a => a.id === id || a.name === id);
                    if (toUnlock && !toUnlock.isUnlocked) {
                        toUnlock.isUnlocked = true;
                        toUnlock.uiNew = true;
                        const isUpgrade = (toUnlock.category === 'Upgrade');
                        if (!toUnlock.suppressUnlockLog) {
                            addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${toUnlock.name}`, LogType.UNLOCK);
                        }
                        if (allowUnlockOutcome) {
                            try { outcome.unlocks.actions.push(toUnlock.name); } catch (e) { /* ignore */ }
                        }
                    }
                });
            }
            if (stage.story) {
                pendingStoryEvent = storyEvents[stage.story] || null;
                pendingStoryLogText = stage.logText || '';
            } else if (stage.logText) {
                addLogEntry(stage.logText, LogType.STORY);
            }

            const hasGrantItems = Array.isArray(stage.grantItems) && stage.grantItems.some(Boolean);
            const hasUnlocks = Array.isArray(stage.unlocks) && stage.unlocks.length > 0;
            const hasStory = !!stage.story;

            // Some repeatable single-stage actions (notably Crafting recipes) use stage.grantItems
            // as their primary effect, and should grant on every completion.
            // But other repeatable actions use stages for one-time story/unlocks.
            const repeatStageEffects = !!(original.repeatable && total === 1 && hasGrantItems && !hasUnlocks && !hasStory);

            if (repeatStageEffects) {
                original.stage = 0;
                original.isUnlocked = true;
            } else {
                original.stage = Math.min(idx + 1, total);
                if (original.stage >= total) {
                    original.isUnlocked = !!original.repeatable;
                }
            }
        }
    }

    if (original && original.id === 'establishBaseCamp') {
        try { outcome.unlocks.sections.push('Campsite'); } catch (e) { /* ignore */ }
    }

    // Unlock Journal after the initial re-entry attempt, and surface it in the popup unlock list.
    if (original && original.id === 'attemptReentry') {
        try { outcome.unlocks.sections.push('Journal'); } catch (e) { /* ignore */ }
    }

    // If the captain's quarters has been checked, surface the new sections in the popup outcome
    if (original && original.id === 'checkCaptainsQuarters') {
        try { outcome.unlocks.sections.push('Encrypted Drive'); } catch (e) { /* ignore */ }
        try { outcome.unlocks.sections.push('Colony'); } catch (e) { /* ignore */ }
    }

    // We'll decide whether unlocks require a full UI rebuild AFTER completion handlers run,
    // since many unlocks happen there (e.g. planning upgrades unlocking buildings).
    let didUnlock = false;

    const preLocalMapLastMoveAt = Number(characterState?.localMap?.lastMoveAt || 0);
    const preLocalMapX = Number(characterState?.localMap?.x);
    const preLocalMapY = Number(characterState?.localMap?.y);

    await runActionCompletionHandlers(original, completed, section);

    // If completion handlers (or stage progression) unlocked new actions/buildings, rebuild UI.
    // This ensures newly unlocked Campsite buildings (e.g. Food Larder) appear immediately.
    try {
        for (const a of (salvageActions || [])) {
            if (a && a.isUnlocked && !preUnlockedActions.has(a.id)) { didUnlock = true; break; }
        }
        if (!didUnlock && (typeof buildings !== 'undefined') && Array.isArray(buildings)) {
            for (const b of buildings) {
                if (b && b.isUnlocked && !preUnlockedBuildings.has(b.name)) { didUnlock = true; break; }
            }
        }
    } catch { /* ignore */ }

    // If completion handlers changed local-map position/selection (e.g., Pry Open Hull auto-steps into D5),
    // refresh the visible map UI so the action row stays in sync.
    try {
        const postLastMoveAt = Number(characterState?.localMap?.lastMoveAt || 0);
        const postX = Number(characterState?.localMap?.x);
        const postY = Number(characterState?.localMap?.y);
        const movedViaHandler = (postLastMoveAt && postLastMoveAt !== preLocalMapLastMoveAt)
            || (Number.isFinite(preLocalMapX) && Number.isFinite(preLocalMapY) && (postX !== preLocalMapX || postY !== preLocalMapY));

        if (movedViaHandler || (completed && completed.id === 'move')) {
            refreshLocalMapIfVisible();
        }
    } catch { /* ignore */ }

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

    // (No DOM-based "exists" checks; Campsite no longer renders a generic list.)

    // Clear active action and reset the UI for the completed action (in-place) unless we must rebuild
    setActiveCrashSiteAction(null);

    // Local-map actions use dynamic labels (e.g. "(X left)"). The generic in-place completion UI update
    // below would overwrite those labels, so instead we re-render the local map UI after clearing the action.
    if (completedFromLocalMap) {
        try { refreshLocalMapIfVisible(); } catch { /* ignore */ }
        if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
    }

    // If this completion unlocked new actions or enabled a section, rebuild the UI; otherwise update states in-place.
    if (didUnlock || (original && original.id === 'establishBaseCamp')) {
        try {
            const host = document.getElementById('crashSiteSection');
            if (host) setupCrashSiteSection(host);
        } catch { /* ignore */ }
    } else {
        if (completedFromLocalMap) {
            // Already refreshed above; do not clobber dynamic local-map button labels.
            // (The local-map action row is rebuilt via local-map-selection-changed.)
            // Continue on to unlock rules/story handling.
        } else {
        const sel2 = completed && completed.uiInstanceId
            ? `[data-action-id="${completed.id}"][data-action-instance="${completed.uiInstanceId}"]`
            : `[data-action-id="${completed.id}"][data-action-instance="main"]`;
        const btn2 = section ? section.querySelector(sel2) : document.querySelector(sel2);
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
                if (btn2.dataset.originalLabel) {
                    nameSpan2.textContent = btn2.dataset.originalLabel;
                } else {
                    const defForLabel = salvageActions.find(s => s.id === completed.id) || original || completed;
                    const max = defForLabel && typeof defForLabel.maxUses === 'number' ? defForLabel.maxUses : null;
                    const uses = defForLabel && typeof defForLabel.uses === 'number' ? defForLabel.uses : 0;
                    nameSpan2.textContent = (max && max > 1)
                        ? `${defForLabel.name} (${Math.max(0, Math.min(max, uses))}/${max})`
                        : ((defForLabel && defForLabel.name) || completed.name || '');
                }
            }
            delete btn2.dataset.originalLabel;
            const actionDef2 = salvageActions.find(s => s.id === completed.id) || original;
            if (actionDef2) {
                const inst2 = btn2.dataset.actionInstance;
                const actionForHandler2 = (inst2 && inst2 !== 'main')
                    ? Object.assign({}, actionDef2, { uiInstanceId: inst2 })
                    : actionDef2;
                btn2.disabled = false;
                attachStartClickHandler(btn2, actionForHandler2, section);
            }
            if (original && !original.isUnlocked) {
                const sel3 = original && original.uiInstanceId
                    ? `[data-action-id="${original.id}"][data-action-instance="${original.uiInstanceId}"]`
                    : `[data-action-id="${original.id}"][data-action-instance="main"]`;
                const removeBtn = section ? section.querySelector(sel3) : document.querySelector(sel3);
                if (removeBtn && removeBtn.parentElement) removeBtn.parentElement.removeChild(removeBtn);
            }
        }

        if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
        }
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
                        if (!a.suppressUnlockLog) {
                            addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                        }
                    try { outcome.unlocks.actions.push(a.name); } catch (e) { /* ignore */ }
                    ruleDidUnlock = true;
                }
            }
        }
        if (ruleDidUnlock) {
            // Rebuild Crash Site UI immediately to surface newly unlocked actions/upgrades
            const host = document.getElementById('crashSiteSection');
            if (host) setupCrashSiteSection(host);
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

    // Traverse: on completing a Move step, immediately queue the next step.
    try {
        if (completed && completed.id === 'move') {
            try {
                const lm = characterState?.localMap;
                if (lm) {
                    if (lm.inFlightTravel) {
                        // Prevent the completion rerender from playing the fallback post-hop animation.
                        // (Otherwise the dot can appear to teleport back briefly.)
                        lm._skipPostMoveAnimUntil = Date.now() + 1100;
                    }
                    delete lm.inFlightTravel;
                }
            } catch { /* ignore */ }

            // Re-render the local map on completion so the player marker snaps to the new tile.
            try { refreshCrashSiteLocalMapUi(section); } catch { /* ignore */ }

            const lm = characterState?.localMap;
            if (lm && Array.isArray(lm.traverseQueue) && lm.traverseQueue.length) {
                scheduleTraverseAdvance(section);
            }
        }
    } catch { /* ignore */ }
}

// Pause/resume loop on global events
window.addEventListener('game-pause', () => {
    const active = getActiveCrashSiteAction();
    if (active) stopCrashSiteLoop();
});

/* =============================
   Event wiring
   ============================= */

window.addEventListener('game-resume', () => {
    const active = getActiveCrashSiteAction();
    if (!active) return;
    startCrashSiteLoop(document.getElementById('crashSiteSection'));
});

// When emergency power is restored, advance Bridge stage and refresh the Crash Site UI
window.addEventListener('emergencyPowerRestored', () => {
    ensureBridgeStageAfterPower();
    try {
        const host = document.getElementById('crashSiteSection');
        if (host) setupCrashSiteSection(host);
    } catch (e) { /* ignore */ }
});

// Also normalize after loading saved state
window.addEventListener('game-state-applied', () => {
    ensureBridgeStageAfterPower();

    // Apply resource-discovery-based unlock rules against the *current* discovered resources,
    // so older saves immediately receive new recipes/upgrades without requiring a fresh event.
    try {
        const unlocks = evaluateEventUnlocks({ type: 'resourceDiscovered' }, { resources, actions: salvageActions, buildings });
        if (unlocks && Array.isArray(unlocks.actions) && unlocks.actions.length) {
            for (const id of unlocks.actions) {
                const a = salvageActions.find(x => x.id === id || x.name === id);
                if (a && !a.isUnlocked) {
                    a.isUnlocked = true;
                    a.uiNew = true;
                }
            }
        }
    } catch { /* ignore */ }
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
                        if (!a.suppressUnlockLog) {
                            addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                        }
                        didUnlock = true;
                    }
                }
            }
            if (didUnlock) {
                const host = document.getElementById('crashSiteSection');
                if (host) setupCrashSiteSection(host);
            }
        } catch (e) { /* ignore */ }
    });
}

/* =============================
   Button state sync
   ============================= */

// Update action buttons' disabled/blocked state
export function updateCrashSiteActionButtonsState() {
    const updateButtonsInContainer = (container) => {
        if (!container) return;
        const buttons = container.querySelectorAll('.image-button[data-action-id]');
        buttons.forEach(btn => {
            const id = btn.dataset.actionId;
            if (!id) return;
            const action = salvageActions.find(a => a && a.id === id);
            if (!action) return;

            const canAfford = !!canAffordAction(action, resources, characterState);
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
                    btn.dataset.shortfall = getAffordabilityShortfalls(action, resources, characterState).join(', ');
                } else {
                    // Only clear aria-disabled if it was set due to affordability.
                    // (Other gates use aria-disabled too.)
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

            // Keep aria-disabled/title in sync for map-bound buttons as well.
            // Prefer capacity-block reason, then blocked reason, then affordability shortfalls.
            if (isCapBlocked) {
                btn.setAttribute('aria-disabled', 'true');
                btn.title = capReason;
            } else if (isBlocked) {
                btn.setAttribute('aria-disabled', 'true');
                if (reason) btn.title = reason;
            } else if (!canAfford) {
                btn.setAttribute('aria-disabled', 'true');
            } else {
                // Clear only if there is no other disabled state.
                if (!btn.disabled && !btn.dataset.blockedReason && !btn.dataset.capacityBlockedReason) {
                    btn.removeAttribute('aria-disabled');
                    // Keep title if the button set a disabledReason tooltip.
                }
            }
        });
    };

    updateButtonsInContainer(document.querySelector('#crashSiteLocalMapActions'));
    // Campsite tab embeds Upgrade-category action buttons.
    // Keep these in sync so affordability updates immediately after building/crafting.
    updateButtonsInContainer(document.querySelector('#campsiteUpgrades'));

    // Keep the Campsite Camp Resources orbs in sync without requiring a full re-render.
    try { updateCampsiteCampResourcesPanel(document); } catch { /* ignore */ }
}