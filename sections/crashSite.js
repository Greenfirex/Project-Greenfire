import { salvageActions } from '../data/actions.js';
import { resources } from '../resources.js';
import { addLogEntry, LogType } from '../log.js';
import { enableSection } from '../main.js';
import { setupTooltip } from '../tooltip.js';
import { storyEvents } from '../data/storyEvents.js';
import { showStoryPopup } from '../popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { buildings } from '../data/buildings.js';
import { buildBuilding, updateBuildingButtonsState, createBuildingButton } from './colony.js';

function canAffordAction(action) {
    const required = {};
    if (action.cost) {
        for (const c of action.cost) required[c.resource] = (required[c.resource] || 0) + c.amount;
    }
    if (action.drain) {
        for (const d of action.drain) required[d.resource] = (required[d.resource] || 0) + d.amount;
    }
    for (const resourceName in required) {
        const res = resources.find(r => r.name === resourceName);
        if (!res || res.amount < required[resourceName]) return false;
    }
    return true;
}

function getAffordabilityShortfalls(action) {
    const required = {};
    if (action.cost) {
        for (const c of action.cost) required[c.resource] = (required[c.resource] || 0) + c.amount;
    }
    if (action.drain) {
        for (const d of action.drain) required[d.resource] = (required[d.resource] || 0) + d.amount;
    }
    const shortfalls = [];
    for (const resourceName in required) {
        const res = resources.find(r => r.name === resourceName);
        const have = res ? res.amount : 0;
        const need = required[resourceName];
        if (!res) {
            shortfalls.push(`${resourceName} missing (need ${need})`);
        } else if (have < need) {
            const more = Math.ceil(need - have);
            shortfalls.push(`${resourceName}: need ${more} more`);
        }
    }
    return shortfalls;
}

let actionInterval = null;
let isPendingCancel = null;
let cancelTimeout = null;

export function startCrashSiteLoop(section = null) {
    if (actionInterval) return;
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

function getRandomInt(min, max) {
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function setupCrashSiteSection(section) {
    if (!section) return;
    section.innerHTML = `
        <div class="content-panel">
            <h2>Crash Site</h2>
            <p>The wreckage of the exploration ship smolders at the edge of a dense forest. The priority is to assess the damage and salvage whatever you can.</p>
            <div id="salvageActionsContainer" style="margin-top: 20px;"></div>
        </div>
    `;

    const actionsContainer = section.querySelector('#salvageActionsContainer');
    const availableActions = salvageActions.filter(action => {
        const stageIndex = action.stage || 0;
        const totalStages = (action.stages || []).length;
        if (totalStages > 0 && stageIndex >= totalStages) return !!action.repeatable && !!action.isUnlocked;
        return !!action.isUnlocked;
    });

    const categories = [...new Set(availableActions.map(a => a.category))].filter(c => c !== 'Construction');

    categories.forEach(category => {
        const h = document.createElement('h3');
        h.textContent = category;
        h.className = 'category-heading';
        actionsContainer.appendChild(h);

        const group = document.createElement('div');
        group.className = 'button-group';

        availableActions.filter(a => a.category === category).forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = action.id;
            btn.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${action.name}</span>
                <span class="cancel-text">Abort?</span>
            `;

            setupTooltip(btn, action);

            const canAfford = canAffordAction(action);
            if (!canAfford) {
                btn.classList.add('unaffordable');
                btn.setAttribute('aria-disabled', 'true');
            }

            // Block certain exploration actions until investigating / basecamp progress.
            // Requires salvageActions to be available in this module (import if needed).
            const blocked = ['searchSouthCorridor','searchNorthCorridor','investigateBridge'];
            const investigateAction = salvageActions.find(a => a.id === 'investigateSound');
            const basecampAction = salvageActions.find(a => a.id === 'establishBaseCamp');
            const isInvestigateDone = !!(investigateAction && investigateAction.completed);
            const isBasecampDone = !!(basecampAction && basecampAction.completed);

            const blockedByInvestigate = blocked.includes(action.id) && !isInvestigateDone;
            const blockedByBasecamp = blocked.includes(action.id) && isInvestigateDone && !isBasecampDone;
            if (blockedByInvestigate || blockedByBasecamp) {
                btn.classList.add('blocked-action');        // style this class in CSS
                btn.setAttribute('aria-disabled', 'true');
                btn.title = blockedByInvestigate
                    ? 'Investigate Nearby Sound first — someone might be alive nearby.'
                    : 'You found survivors — secure a base camp first before exploring deeper.';
            }

            btn.onclick = (e) => {
                if (blocked.includes(action.id) && !isInvestigateDone) {
                    e.preventDefault();
                    addLogEntry('You should investigate the nearby sound first — someone might be alive nearby. Try "Investigate Nearby Sound".', LogType.INFO);
                    return;
                }
                if (blocked.includes(action.id) && isInvestigateDone && !isBasecampDone) {
                    e.preventDefault();
                    addLogEntry('You found survivors — secure a base camp first before exploring deeper. Try "Establish Base Camp".', LogType.INFO);
                    return;
                }
                const shortfalls = getAffordabilityShortfalls(action);
                if (shortfalls.length > 0) {
                    e.preventDefault();
                    addLogEntry(`Cannot start "${action.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                    return;
                }
                startAction(action, section);
            };

            group.appendChild(btn);
        });

        actionsContainer.appendChild(group);
    });

    const constructionWrapper = document.createElement('div');
    constructionWrapper.style.marginTop = '18px';
    const ch = document.createElement('h3');
    ch.textContent = 'Construction';
    constructionWrapper.appendChild(ch);

    const buildGroup = document.createElement('div');
    buildGroup.className = 'button-group';
    const siteBuildings = buildings.filter(b => ['Foraging Camp', 'Water Station'].includes(b.name) && b.isUnlocked === true);

    siteBuildings.forEach(bld => {
        createBuildingButton(bld, buildGroup);
        const btn = buildGroup.querySelector(`.image-button[data-building="${bld.name}"]`);
        if (btn) {
            const nameSpan = btn.querySelector('.building-name');
            if (nameSpan) nameSpan.textContent = bld.name;
            const countSpan = btn.querySelector('.building-count');
            if (countSpan) countSpan.textContent = `(${bld.count})`;
            // click handler already attached by createBuildingButton; keep tooltip in sync
            setupTooltip(btn, bld);
        }
    });

    if (buildGroup.children.length > 0) {
        if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
        constructionWrapper.appendChild(buildGroup);
        actionsContainer.appendChild(constructionWrapper);
    }
}

function startAction(action, section) {
    const existing = getActiveCrashSiteAction();
    if (existing) return;

    if (!canAffordAction(action)) {
        addLogEntry(`Not enough resources to begin: ${action.name}.`, LogType.ERROR);
        return;
    }
    const upfront = action.cost || [];
    upfront.forEach(cost => {
        const r = resources.find(x => x.name === cost.resource);
        if (r) r.amount -= cost.amount;
    });

    const btn = section.querySelector(`[data-action-id="${action.id}"]`);
    if (btn) {
        const name = btn.querySelector('.building-name');
        if (name && !btn.dataset.originalLabel) btn.dataset.originalLabel = name.innerText;
        const bar = btn.querySelector('.action-progress-bar');
        if (bar) bar.style.width = '0%';
        btn.classList.add('running');
        if (action.cancelable) {
            btn.onclick = () => requestCancel(action, section);
            btn.disabled = false;
        } else {
            btn.onclick = null;
            btn.disabled = true;
        }
    }

    setActiveCrashSiteAction({
        ...JSON.parse(JSON.stringify(action)),
        startTime: Date.now(),
        lastTickTime: Date.now(),
        elapsed: 0
    });

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);
    startCrashSiteLoop(section);
}

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

function updateActionProgress(section) {
    const a = getActiveCrashSiteAction();
    if (!a) return;

    const now = Date.now();
    const rawDelta = Math.max(0, Math.min((now - (a.lastTickTime || now)) / 1000, 0.25));
    a.lastTickTime = now;

    const timeScale = (window.TIME_SCALE || 1);
    const delta = rawDelta * timeScale;

    const food = resources.find(r => r.name === 'Food Rations');
    const water = resources.find(r => r.name === 'Clean Water');
    let debuff = 1;
    if (food && food.amount <= 0) debuff *= 1.5;
    if (water && water.amount <= 0) debuff *= 1.5;

    const effectiveDuration = Math.max(0.001, (a.duration || 1) * debuff);

    if (a.drain) {
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            const perSec = d.amount / effectiveDuration;
            const take = perSec * delta;
            if (res.amount < take) {
                if (a.cancelable) {
                    cancelAction(section, `${a.name} cancelled: Ran out of ${res.name}.`);
                    return;
                } else {
                    res.amount = 0;
                }
            } else {
                res.amount -= take;
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

    if (a.elapsed >= effectiveDuration) handleActionCompletion(section);
}

function cancelAction(section, message) {
    const a = getActiveCrashSiteAction();
    if (!a) return;
    if (a.cancelable === false) {
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
    if (a.drain) {
        const elapsed = Math.max(0, Math.min(a.elapsed || 0, a.duration));
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            const perSec = d.amount / a.duration;
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
    setupCrashSiteSection(section);
}

function handleActionCompletion(section) {
    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const completed = getActiveCrashSiteAction();
    if (!completed) return;

    if (completed.reward) {
        const gains = [];
        completed.reward.forEach(rw => {
            const res = resources.find(r => r.name === rw.resource);
            if (!res) return;
            const amt = Array.isArray(rw.amount) ? getRandomInt(rw.amount[0], rw.amount[1]) : rw.amount;
            res.amount = Math.min(res.amount + amt, res.capacity);
            gains.push(`${amt} ${rw.resource}`);
        });
        addLogEntry(`${completed.name} complete! Gained: ${gains.join(', ')}.`, LogType.SUCCESS);
    } else {
        addLogEntry(`${completed.name} complete!`, LogType.SUCCESS);
    }

    const original = salvageActions.find(a => a.id === completed.id || a.name === completed.name);
    if (original) {
        original.completed = true;
        const idx = original.stage || 0;
        const stage = (original.stages || [])[idx];

        if (stage) {
            if (stage.story) {
                const event = storyEvents[stage.story];
                if (event) {
                    showStoryPopup(event);
                    addLogEntry(stage.logText || '', LogType.STORY, { onClick: () => showStoryPopup(event) });
                }
            } else if (stage.logText) {
                addLogEntry(stage.logText, LogType.STORY);
            }
            if (Array.isArray(stage.unlocks)) {
                stage.unlocks.forEach(id => {
                    const toUnlock = salvageActions.find(a => a.id === id || a.name === id);
                    if (toUnlock && !toUnlock.isUnlocked) {
                        toUnlock.isUnlocked = true;
                        addLogEntry(`New action available: ${toUnlock.name}`, LogType.UNLOCK);
                    }
                });
            }
            if (original.id === 'establishBaseCamp') {
                try {
                    if (typeof enableSection === 'function') enableSection('crewManagementSection');
                    const toUnlock = ['Foraging Camp', 'Water Station'];
                    buildings.forEach(b => {
                        if (toUnlock.includes(b.name) && !b.isUnlocked) {
                            b.isUnlocked = true;
                            addLogEntry(`New building available: ${b.name}`, LogType.UNLOCK);
                        }
                    });
                } catch {}
            }
            const total = (original.stages || []).length;
            original.stage = Math.min(idx + 1, total);
            if (original.stage >= total) {
                original.isUnlocked = !!original.repeatable;
            }
        }
    }

    setActiveCrashSiteAction(null);
    setupCrashSiteSection(section);
}

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