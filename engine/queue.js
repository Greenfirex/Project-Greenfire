// ==========================================================================
// Action Queue Engine
// ==========================================================================
// Allows queueing actions while another is running.
// Queued actions auto-start when the current action completes.
// ==========================================================================

import { t } from '../locales/locales.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { gameFlags } from './gameFlags.js';

export let actionQueue = [];
let _activeAction = null; // { id, nameKey, progress, durationSeconds }

/**
 * Set the currently running action for live progress display.
 * Pass null to clear.
 */
export function updateQueueActive(actionObj) {
    _activeAction = actionObj || null;
    updateQueueUI();
}

/**
 * Add an action to the queue.
 */
export function addToQueue(actionObj) {
    actionQueue.push({
        actionId: actionObj.actionId,
        locationId: actionObj.locationId,
        nameKey: actionObj.nameKey,
        durationSeconds: actionObj.durationSeconds,
    });
    addLogEntry(t('queue_action_queued', { action: t(actionObj.nameKey) }), LogType.INFO);
    updateQueueUI();
}

/**
 * Remove an action from the queue by index.
 */
export function removeFromQueue(index) {
    if (index < 0 || index >= actionQueue.length) return;
    const removed = actionQueue[index];
    actionQueue.splice(index, 1);
    addLogEntry(t('queue_action_removed', { action: t(removed.nameKey) }), LogType.INFO);
    updateQueueUI();
}

/**
 * Clear the entire queue.
 */
/**
 * Check if an action is already in the queue.
 */
export function isInQueue(actionId) {
    return actionQueue.some(item => item.actionId === actionId);
}

/**
 * Move an action from one position to another in the queue.
 */
export function moveInQueue(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= actionQueue.length) return;
    if (toIndex < 0 || toIndex >= actionQueue.length) return;
    if (fromIndex === toIndex) return;
    const item = actionQueue.splice(fromIndex, 1)[0];
    actionQueue.splice(toIndex, 0, item);
    updateQueueUI();
}

/**
 * Clear the entire queue.
 */
export function clearQueue() {
    actionQueue.length = 0;
    updateQueueUI();
}

/**
 * Start the next queued action. Called when current action completes.
 * @returns {boolean} true if a queued action was started
 */
export function startNextQueuedAction() {
    if (actionQueue.length === 0) return false;
    
    const next = actionQueue.shift();
    updateQueueUI();
    
    // Dynamic import to avoid circular dependency
    import('../sections/locations/locationEngine.js').then(mod => {
        if (typeof mod.startQueuedAction === 'function') {
            mod.startQueuedAction(next);
        }
    });
    
    return true;
}

// UI

let _queueHost = null;

export function setupQueueUI(container) {
    if (!container) return;
    
    const existing = container.querySelector('.queue-section');
    if (existing) existing.remove();
    
    _queueHost = document.createElement('div');
    _queueHost.className = 'queue-section';
    _queueHost.innerHTML = `
        <div class="panel-section-header">${t('queue_title')}</div>
        <div class="queue-body"></div>
    `;
    
    container.appendChild(_queueHost);
    updateQueueUI();
}

function renderProgressBar(current, total) {
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    const remaining = Math.max(0, total - current);
    return `<div class="queue-progress">
        <div class="queue-progress-bar" style="width:${pct}%"></div>
        <span class="queue-progress-text">${remaining.toFixed(1)}s</span>
    </div>`;
}

export function updateQueueUI() {
    if (!_queueHost) {
        _queueHost = document.querySelector('.queue-section');
    }
    if (!_queueHost) return;
    
    const body = _queueHost.querySelector('.queue-body');
    if (!body) return;
    
    const hasActive = !!_activeAction && _activeAction.progress > 0;
    const hasQueue = actionQueue.length > 0;
    
    if (!hasActive && !hasQueue) {
        body.innerHTML = `<div class="queue-empty">${t('queue_empty')}</div>`;
        return;
    }
    
    _queueHost.classList.remove('hidden');
    
    let activeHtml = '';
    if (hasActive) {
        const name = t(_activeAction.nameKey);
        activeHtml = `
            <div class="queue-item queue-item-active">
                <div class="queue-item-info">
                    <div class="queue-item-name">${name}</div>
                    <div class="queue-item-duration">⏳ Active</div>
                </div>
                ${renderProgressBar(_activeAction.progress, _activeAction.durationSeconds || 1)}
            </div>
        `;
    }
    
    let queueHtml = '';
    if (hasQueue) {
        queueHtml = actionQueue.map((item, index) => {
            const name = t(item.nameKey);
            const durationMins = Math.round(item.durationSeconds || 0);
            const durationLabel = durationMins > 0 
                ? t('action_duration_label', { minutes: durationMins }) 
                : t('action_duration_ongoing');
            
            // Check for saved persistent progress
            const savedProgress = Number(gameFlags.persistentProgress[item.actionId]) || 0;
            const progressBar = savedProgress > 0 && item.durationSeconds > 0
                ? renderProgressBar(savedProgress, item.durationSeconds)
                : '';
            
            return `
                <div class="queue-item" draggable="true" data-queue-index="${index}">
                    <div class="queue-item-info">
                        <div class="queue-item-name">${name}</div>
                        <div class="queue-item-duration">${durationLabel}</div>
                    </div>
                    ${progressBar}
                    <button class="queue-item-remove" data-queue-index="${index}" title="${t('queue_remove_tooltip')}">×</button>
                </div>
            `;
        }).join('');
    }
    
    body.innerHTML = activeHtml + queueHtml;
    
    // Wire remove buttons
    _queueHost.querySelectorAll('.queue-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const idx = parseInt(btn.dataset.queueIndex, 10);
            if (!isNaN(idx)) removeFromQueue(idx);
        });
    });
    
    // Wire drag-and-drop for reordering
    _queueHost.querySelectorAll('.queue-item[draggable]').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.queueIndex);
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('drag-source');
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('drag-source');
            _queueHost.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            _queueHost.querySelectorAll('.queue-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            item.classList.add('drag-over');
        });
        
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('drag-over');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIdx = parseInt(item.dataset.queueIndex, 10);
            if (!isNaN(fromIdx) && !isNaN(toIdx) && fromIdx !== toIdx) {
                moveInQueue(fromIdx, toIdx);
            }
        });
    });
}
