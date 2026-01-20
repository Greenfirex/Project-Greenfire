// encryptedDrive.js
import { resources } from '../core/resources.js';
import { formatNumber } from '../core/formatting.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { driveTasks } from '../data/definitions/encryptedDriveTasks.js';

function getResourceByName(name) {
    return (resources || []).find(r => r && r.name === name);
}

function canAfford(cost = []) {
    return (cost || []).every(c => {
        const r = getResourceByName(c.resource);
        return r && Number(r.amount) >= Number(c.amount || 0);
    });
}

function getShortfalls(cost = []) {
    const lines = [];
    for (const c of (cost || [])) {
        const r = getResourceByName(c.resource);
        const have = r ? Number(r.amount) : 0;
        const need = Number(c.amount || 0);
        if (have < need) lines.push(`${c.resource} (${formatNumber(need - have)} short)`);
    }
    return lines;
}

function deductCost(cost = []) {
    for (const c of cost) {
        const r = getResourceByName(c.resource);
        if (!r) continue;
        r.amount = Math.max(0, Number(r.amount) - Number(c.amount || 0));
    }
}

function grantXP(amount) {
    const r = getResourceByName('XP');
    if (!r) return;
    const add = Number(amount || 0);
    r.amount = Math.min(r.capacity, Number(r.amount) + add);
}

function updateHeaderResources() {
    try {
        if (typeof window !== 'undefined' && typeof window.updateResourceInfo === 'function') {
            window.updateResourceInfo();
        }
    } catch {}
}

// Track selected task for detail view
let selectedTaskId = null;

function getTimeScale() {
    try {
        if (typeof window !== 'undefined' && typeof window.TIME_SCALE === 'number') {
            return window.TIME_SCALE;
        }
    } catch {}
    return 1;
}

function isPaused() {
    try {
        return localStorage.getItem('gamePaused') === 'true';
    } catch {
        return false;
    }
}

function updateSelectedDetailsProgress(container, task) {
    if (!container || !task) return;
    if (selectedTaskId !== task.id) return;
    const bar = container.querySelector('.drive-details-panel .drive-progress .bar');
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, Math.round((task.progress || 0) * 100)));
    bar.style.width = `${pct}%`;
}

function completeTask(task, container) {
    task.running = false;
    task.completed = true;
    task.progress = 1;
    if (task._timer) {
        clearInterval(task._timer);
        task._timer = null;
    }
    task._elapsedSec = 0;
    task._lastTickAt = 0;

    grantXP(task.xp);
    updateHeaderResources();
    addLogEntry(`${task.name} completed. +${formatNumber(task.xp)} XP`, LogType.UNLOCK);
    try { setupEncryptedDriveSection(container); } catch {}
}

function startOrResumeTaskTimer(task, container) {
    if (!task || !task.running || task.completed) return;
    if (task._timer) return;

    // Initialize elapsed time from saved progress when resuming
    if (typeof task._elapsedSec !== 'number' || task._elapsedSec < 0) {
        const d = Math.max(0.001, Number(task.duration || 1));
        const p = Math.max(0, Math.min(1, Number(task.progress || 0)));
        task._elapsedSec = p * d;
    }
    task._lastTickAt = Date.now();

    task._timer = setInterval(() => {
        const now = Date.now();

        if (isPaused()) {
            // Freeze progress while paused
            task._lastTickAt = now;
            return;
        }

        const deltaSec = Math.max(0, Math.min((now - (task._lastTickAt || now)) / 1000, 0.25));
        task._lastTickAt = now;

        const d = Math.max(0.001, Number(task.duration || 1));
        const timeScale = getTimeScale();
        task._elapsedSec = Math.min(d, (task._elapsedSec || 0) + deltaSec * timeScale);
        task.progress = Math.max(0, Math.min(1, (task._elapsedSec || 0) / d));

        updateSelectedDetailsProgress(container, task);

        if (task.progress >= 1) {
            completeTask(task, container);
        }
    }, 300);
}

function renderTaskListItem(task) {
    const idx = driveTasks.findIndex(t => t && t.id === task.id);
    const prev = idx > 0 ? driveTasks[idx - 1] : null;
    const isLocked = !!(prev && !prev.completed);
    const isSelected = selectedTaskId === task.id;
    const disabled = task.completed || task.running || isLocked;
    const affordable = !isLocked && canAfford(task.cost);
    const affordClass = affordable ? '' : 'unaffordable';
    const buttonText = task.running ? 'In Progress…' : task.completed ? 'Completed' : (isLocked ? 'Locked' : 'Start');

    return `
        <div class="drive-task-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" data-task-id="${task.id}">
            <div class="task-item-content">
                ${isLocked ? '<span class="lock-icon-small">🔒</span>' : ''}
                <span class="task-item-name">${task.name}</span>
            </div>
            ${!isLocked ? `<button class="drive-action-button ${affordClass}" ${disabled ? 'disabled' : ''} data-task-id="${task.id}">${buttonText}</button>` : ''}
        </div>
    `;
}

function renderTaskDetails(task) {
    if (!task) {
        return '<div class="drive-details-empty">Select a task to view details</div>';
    }

    const statusBadge = task.running ? '<span class="status-badge in-progress">IN PROGRESS</span>' : 
                        task.completed ? '<span class="status-badge completed">COMPLETED</span>' : '';
    const description = task.description || 'No description available.';
    const costText = (task.cost || []).map(c => `${formatNumber(c.amount)} ${c.resource}`).join(', ');
    
    // Check if there's a next task
    const idx = driveTasks.findIndex(t => t && t.id === task.id);
    const nextTask = (idx >= 0 && idx < driveTasks.length - 1) ? driveTasks[idx + 1] : null;
    const unlockText = nextTask ? ` • Unlocks: ${nextTask.name}` : '';

    return `
        <div class="drive-task-details">
            ${statusBadge}
            <div class="drive-description">${description}</div>
            <div class="drive-progress">
                <div class="bar" style="width: ${Math.max(0, Math.min(100, Math.round(task.progress * 100)))}%"></div>
            </div>
            <div class="drive-cost-display">Cost: ${costText}</div>
            <div class="drive-reward-display">Reward: +${formatNumber(task.xp)} XP${unlockText}</div>
        </div>
    `;
}

function attachTaskListHandlers(container) {
    const taskItems = container.querySelectorAll('.drive-task-item');
    taskItems.forEach(item => {
        const taskId = item.getAttribute('data-task-id');
        const task = driveTasks.find(t => t.id === taskId);
        if (!task) return;

        // Check if locked
        const idx = driveTasks.findIndex(t => t && t.id === task.id);
        const prev = idx > 0 ? driveTasks[idx - 1] : null;
        const isLocked = !!(prev && !prev.completed);

        if (!isLocked) {
            item.addEventListener('click', () => {
                selectedTaskId = taskId;
                setupEncryptedDriveSection(container);
            });
            item.style.cursor = 'pointer';
        }
    });
}

function attachHandlers(container) {
    const buttons = container.querySelectorAll('.drive-action-button');
    buttons.forEach(btn => {
        const taskId = btn.getAttribute('data-task-id');
        const task = driveTasks.find(t => t.id === taskId);
        if (!task) return;

        // Add tooltip using the shared action tooltip schema
        setupTooltip(btn, () => {
            // Sequential lock check for tooltip
            const idx = driveTasks.findIndex(t => t && t.id === task.id);
            const prev = idx > 0 ? driveTasks[idx - 1] : null;
            const isLocked = !!(prev && !prev.completed);
            const tooltipData = {
                id: task.id,
                name: task.name,
                description: task.description || 'High-complexity analysis step. Resource-intensive with long duration.',
                cost: task.cost,
                duration: task.duration,
                reward: [ { resource: 'XP', amount: task.xp } ]
            };
            if (isLocked) {
                tooltipData.tooltipUnlocks = []; // prevent spoilers
                tooltipData.showUnlocks = false;
                tooltipData.description += '\n\nComplete the previous analysis to unlock this step.';
            }
            return tooltipData;
        });

        btn.addEventListener('click', () => {
            // Enforce sequential lock
            const idx = driveTasks.findIndex(t => t && t.id === task.id);
            const prev = idx > 0 ? driveTasks[idx - 1] : null;
            if (prev && !prev.completed) return;
            if (task.running || task.completed) return;
            
            // Pause check
            if (isPaused()) {
                addLogEntry('Game is paused. Resume to start analysis tasks.', LogType.INFO);
                return;
            }

            if (!canAfford(task.cost)) {
                const short = getShortfalls(task.cost).join(', ');
                addLogEntry(`Cannot start: missing ${short}`, LogType.INFO);
                return;
            }

            deductCost(task.cost);
            updateHeaderResources();
            task.running = true;
            task.progress = 0;
            task._startAt = Date.now();
            task._elapsedSec = 0;
            task._lastTickAt = Date.now();
            addLogEntry(`${task.name} started.`, LogType.INFO);

            // Ensure the details panel shows the running task
            selectedTaskId = taskId;
            try { setupEncryptedDriveSection(container); } catch {}

            // Start ticking progress
            startOrResumeTaskTimer(task, container);
        });
    });
}

/**
 * Sets up the Encrypted Drive section UI
 * @param {HTMLElement} container - The container element for this section
 */
export function setupEncryptedDriveSection(container) {
    if (!container) return;

    // Resume ticking for any already-running tasks (e.g. after load / refresh)
    (driveTasks || []).forEach(t => {
        if (t && t.running && !t.completed) {
            startOrResumeTaskTimer(t, container);
        }
    });

    // Separate tasks into active and locked
    const activeTasks = [];
    const lockedTasks = [];
    
    driveTasks.forEach((task, idx) => {
        const prev = idx > 0 ? driveTasks[idx - 1] : null;
        const isLocked = !!(prev && !prev.completed);
        
        if (isLocked) {
            lockedTasks.push(task);
        } else {
            activeTasks.push(task);
        }
    });

    // Auto-select first active task if none selected
    if (!selectedTaskId && activeTasks.length > 0) {
        selectedTaskId = activeTasks[0].id;
    }

    const activeListHtml = activeTasks.map(renderTaskListItem).join('');
    const lockedListHtml = lockedTasks.map(renderTaskListItem).join('');
    const selectedTask = driveTasks.find(t => t.id === selectedTaskId);
    const detailsHtml = renderTaskDetails(selectedTask);

    container.innerHTML = `
        <div class="content-panel">
            <div class="section-inner encrypted-section">
                <h2>Encrypted Drive</h2>
                <div class="drive-summary">
                    <p class="drive-note">Data recovered from the captain's personal drive. Military-grade encryption prevents direct access — each decryption task reveals fragments of critical information.</p>
                </div>

                <div class="encrypted-drive-content">
                    <div class="drive-panel">
                        <div class="panel-header">Drive Analysis</div>
                        <div class="drive-layout">
                            <div class="drive-task-list">
                                ${activeTasks.length > 0 ? `
                                    <div class="drive-section-header active-header">UNLOCKED</div>
                                    ${activeListHtml}
                                ` : ''}
                                ${lockedTasks.length > 0 ? `
                                    <div class="drive-section-header locked-header">LOCKED</div>
                                    ${lockedListHtml}
                                ` : ''}
                            </div>
                            <div class="drive-details-panel">
                                ${detailsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    attachHandlers(container);
    attachTaskListHandlers(container);
}
