import { resources } from '../core/resources.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';

const LOOP_ACTIONS = [
    {
        id: 'investigate',
        name: 'Investigate',
        description: 'Spend energy to study the loop signature and learn from it.',
        drain: [{ resource: 'Stamina', amount: 6 }],
        durationSeconds: 5,
        xp: 10
    },
    {
        id: 'stabilize',
        name: 'Stabilize',
        description: 'Use supplies to keep the loop from fragmenting.',
        drain: [{ resource: 'Stamina', amount: 4 }, { resource: 'Food Rations', amount: 1 }],
        durationSeconds: 4,
        xp: 8
    },
    {
        id: 'scan',
        name: 'Scan',
        description: 'Analyze incoming anomalies and gain experience.',
        drain: [{ resource: 'Stamina', amount: 3 }],
        durationSeconds: 3,
        xp: 5
    }
];

let activeAction = null;
let actionTimer = null;
let actionProgress = 0;
let loopCount = Number(localStorage.getItem('loopCount') || 0);

function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

function canAffordAction(action) {
    if (!action || !Array.isArray(action.drain)) return false;
    return action.drain.every(drain => {
        const resource = getResourceByName(drain.resource);
        return resource && Number.isFinite(Number(resource.amount)) && Number(resource.amount) >= Number(drain.amount);
    });
}

function applyActionDrain(action) {
    if (!action || !Array.isArray(action.drain)) return;
    action.drain.forEach(drain => {
        const resource = getResourceByName(drain.resource);
        if (!resource) return;
        resource.amount = Math.max(0, Number(resource.amount) - Number(drain.amount));
    });
}

function addActionXp(amount) {
    const xpResource = getResourceByName('XP');
    if (!xpResource) return;
    xpResource.amount = Number(xpResource.amount || 0) + Number(amount);
}

function resetLoopState() {
    loopCount += 1;
    try {
        localStorage.setItem('loopCount', String(loopCount));
    } catch (e) {
        console.warn('Could not persist loop count', e);
    }

    const stamina = getResourceByName('Stamina');
    if (stamina) stamina.amount = Math.max(5, Math.min(stamina.capacity || 20, 12));
    const food = getResourceByName('Food Rations');
    if (food) food.amount = Math.max(2, Math.min(food.capacity || 10, 6));
    const water = getResourceByName('Drinking Water');
    if (water) water.amount = Math.max(2, Math.min(water.capacity || 10, 6));

    addLogEntry(`Loop ${loopCount} started. Resources have been partially restored.`, LogType.INFO);
    updateStatus();
    updateActionButtons();
}

function checkLoopTrigger() {
    const drained = resources.filter(r => r && Number.isFinite(Number(r.amount)) && Number(r.amount) <= 0 && r.name !== 'XP');
    if (drained.length === 0) return false;
    const names = drained.map(r => r.name).join(', ');
    addLogEntry(`Loop triggered: ${names} depleted.`, LogType.ERROR);
    resetLoopState();
    return true;
}

function completeActiveAction() {
    const action = activeAction;
    if (!action) return;
    applyActionDrain(action);
    addActionXp(action.xp);
    addLogEntry(`Completed ${action.name}. Gained ${action.xp} XP.`, LogType.ACTION);
    activeAction = null;
    actionProgress = 0;
    clearInterval(actionTimer);
    actionTimer = null;
    updateStatus();
    updateActionButtons();
    checkLoopTrigger();
}

function startAction(actionId) {
    if (activeAction) return;
    const action = LOOP_ACTIONS.find(a => a.id === actionId);
    if (!action || !canAffordAction(action)) return;
    activeAction = action;
    actionProgress = 0;
    updateStatus();
    updateActionButtons();

    actionTimer = setInterval(() => {
        if (!activeAction) {
            clearInterval(actionTimer);
            actionTimer = null;
            return;
        }
        actionProgress += 0.1;
        updateStatus();
        if (actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

function updateStatus() {
    const statusEl = document.querySelector('#crashSiteLoopStatus');
    if (!statusEl) return;
    if (activeAction) {
        statusEl.textContent = `Active: ${activeAction.name} — ${Math.min(100, Math.round((actionProgress / activeAction.durationSeconds) * 100))}% complete`;
    } else {
        statusEl.textContent = `Loop ${loopCount} — Ready for next action.`;
    }
}

function updateActionButtons() {
    const buttons = document.querySelectorAll('.loop-action-button');
    buttons.forEach(button => {
        const actionId = button.dataset.actionId;
        const action = LOOP_ACTIONS.find(a => a.id === actionId);
        if (!action) return;
        button.disabled = !!activeAction || !canAffordAction(action);
    });
}

export function updateCrashSiteActionButtonsState() {
    updateActionButtons();
    updateStatus();
}

function renderActionList() {
    const actionsHost = document.querySelector('#crashSiteActionList');
    if (!actionsHost) return;
    actionsHost.innerHTML = LOOP_ACTIONS.map(action => {
        const drains = action.drain.map(d => `${d.amount} ${d.resource}`).join(', ');
        return `<div class="loop-action-card">
                <h3>${action.name}</h3>
                <p>${action.description}</p>
                <p class="loop-action-details">Drain: ${drains}</p>
                <p class="loop-action-details">Duration: ${action.durationSeconds}s</p>
                <button type="button" class="loop-action-button" data-action-id="${action.id}">Start</button>
            </div>`;
    }).join('');

    actionsHost.querySelectorAll('.loop-action-button').forEach(button => {
        button.addEventListener('click', () => {
            startAction(button.dataset.actionId);
        });
    });
}

export function setupCrashSiteSection(section) {
    section.innerHTML = `
        <div class="crashsite-action-loop">
            <div class="crashsite-action-loop__header">
                <h2>Time Loop Hub</h2>
                <p id="crashSiteLoopStatus">Initializing...</p>
            </div>
            <div id="crashSiteActionList" class="loop-action-list"></div>
        </div>
    `;

    renderActionList();
    updateStatus();
    updateActionButtons();

    window.setupCrashSiteSection = setupCrashSiteSection;
    window.updateCrashSiteActionButtonsState = updateCrashSiteActionButtonsState;
}
