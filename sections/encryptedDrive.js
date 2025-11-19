// encryptedDrive.js
import { resources } from '../core/resources.js';
import { formatNumber } from '../core/formatting.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';

// Local task state (first iteration: not persisted)
const driveTasks = [
    {
        id: 'extract_key_material',
        name: 'Extract Key Material',
        duration: 20,
        cost: [
            { resource: 'Scrap Metal', amount: 20 },
            { resource: 'Wire', amount: 15 }
        ],
        xp: 50,
        running: false,
        progress: 0,
        completed: false,
        _timer: null,
        _startAt: 0
    },
    {
        id: 'build_cipher_dictionary',
        name: 'Build Cipher Dictionary',
        duration: 25,
        cost: [
            { resource: 'Fabric', amount: 5 },
            { resource: 'Chemicals', amount: 5 },
            { resource: 'Wire', amount: 10 }
        ],
        xp: 70,
        running: false,
        progress: 0,
        completed: false,
        _timer: null,
        _startAt: 0
    },
    {
        id: 'pattern_analysis',
        name: 'Pattern Analysis',
        duration: 30,
        cost: [
            { resource: 'Scrap Metal', amount: 15 },
            { resource: 'Chemicals', amount: 8 }
        ],
        xp: 80,
        running: false,
        progress: 0,
        completed: false,
        _timer: null,
        _startAt: 0
    },
    {
        id: 'signal_reconstruction',
        name: 'Signal Reconstruction',
        duration: 40,
        cost: [
            { resource: 'Wire', amount: 25 },
            { resource: 'Scrap Metal', amount: 30 }
        ],
        xp: 100,
        running: false,
        progress: 0,
        completed: false,
        _timer: null,
        _startAt: 0
    },
    {
        id: 'final_decryption_attempt',
        name: 'Final Decryption Attempt',
        duration: 60,
        cost: [
            { resource: 'Power Cells', amount: 1 },
            { resource: 'Wire', amount: 50 }
        ],
        xp: 150,
        running: false,
        progress: 0,
        completed: false,
        _timer: null,
        _startAt: 0
    }
];

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

function renderTaskRow(task) {
    const costText = (task.cost || []).map(c => `${formatNumber(c.amount)} ${c.resource}`).join(', ');
    const buttonLabel = task.completed ? 'Completed' : (task.running ? 'In Progress…' : 'Start');
    const disabled = task.completed || task.running;
    const affordable = canAfford(task.cost);
    const shortfall = affordable ? '' : getShortfalls(task.cost).join(', ');
    const affordClass = affordable ? '' : 'unaffordable';

    return `
        <div class="drive-action" data-task-id="${task.id}">
            <div class="drive-action-main">
                <div class="drive-action-title">${task.name}</div>
                <button class="menu-button start-task ${affordClass}" ${disabled ? 'disabled' : ''} ${!affordable && !disabled ? 'aria-disabled="true"' : ''} ${shortfall ? `data-shortfall="${shortfall}"` : ''}>${buttonLabel}</button>
            </div>
            <div class="drive-action-sub">
                <div class="drive-costs"><span class="label">Cost:</span> ${costText || '—'}</div>
                <div class="drive-reward"><span class="label">Reward:</span> +${formatNumber(task.xp)} XP</div>
            </div>
            <div class="drive-progress">
                <div class="bar" style="width: ${Math.max(0, Math.min(100, Math.round(task.progress * 100)))}%"></div>
            </div>
        </div>
    `;
}

function attachHandlers(container) {
    const buttons = container.querySelectorAll('.drive-action .start-task');
    buttons.forEach(btn => {
        const row = btn.closest('.drive-action');
        if (!row) return;
        const id = row.getAttribute('data-task-id');
        const task = driveTasks.find(t => t.id === id);
        if (!task) return;

        btn.addEventListener('click', () => {
            if (task.running || task.completed) return;
            // Pause check
            try {
                if (localStorage.getItem('gamePaused') === 'true') {
                    addLogEntry('Game is paused. Resume to start analysis tasks.', LogType.INFO);
                    return;
                }
            } catch {}

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
            addLogEntry(`${task.name} started.`, LogType.INFO);

            const progressEl = row.querySelector('.drive-progress .bar');
            const btnEl = row.querySelector('.start-task');
            if (btnEl) { btnEl.textContent = 'In Progress…'; btnEl.disabled = true; btnEl.classList.remove('unaffordable'); }

            task._timer = setInterval(() => {
                // Respect pause: freeze progress while paused
                try {
                    if (localStorage.getItem('gamePaused') === 'true') return;
                } catch {}

                const elapsed = (Date.now() - task._startAt) / 1000;
                const pct = Math.max(0, Math.min(1, elapsed / task.duration));
                task.progress = pct;
                if (progressEl) progressEl.style.width = `${Math.round(pct * 100)}%`;

                if (pct >= 1) {
                    clearInterval(task._timer);
                    task._timer = null;
                    task.running = false;
                    task.completed = true;
                    grantXP(task.xp);
                    updateHeaderResources();
                    addLogEntry(`${task.name} completed. +${formatNumber(task.xp)} XP`, LogType.UNLOCK);
                    // Refresh the section to update states/affordability
                    try { setupEncryptedDriveSection(container); } catch {}
                } else {
                    // no-op
                }
            }, 300);
        });
    });
}

/**
 * Sets up the Encrypted Drive section UI
 * @param {HTMLElement} container - The container element for this section
 */
export function setupEncryptedDriveSection(container) {
    if (!container) return;

    const rowsHtml = driveTasks.map(renderTaskRow).join('');

    container.innerHTML = `
        <div class="section-header">
            <h2>Encrypted Drive</h2>
            <p class="section-description">
                Data recovered from the captain's personal drive. The encryption is military-grade,
                but fragments of information are beginning to emerge.
            </p>
        </div>

        <div class="encrypted-drive-content">
            <div class="drive-panel">
                <div class="panel-header">Drive Analysis</div>
                <div class="drive-actions">
                    ${rowsHtml}
                </div>
            </div>
        </div>
    `;

    attachHandlers(container);
}
