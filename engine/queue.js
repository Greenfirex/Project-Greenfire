// ==========================================================================
// Action Queue Engine
// ==========================================================================
// Allows queueing actions while another is running.
// Queued actions auto-start when the current action completes.
// ==========================================================================

import { t } from '../locales/locales.js';
import { addLogEntry, LogType } from './ingameLog.js';

export let actionQueue = [];

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
        <div class="queue-header">${t('queue_title')}</div>
        <div class="queue-body"></div>
    `;
    
    container.appendChild(_queueHost);
    updateQueueUI();
}

export function updateQueueUI() {
    if (!_queueHost) {
        _queueHost = document.querySelector('.queue-section');
    }
    if (!_queueHost) return;
    
    const body = _queueHost.querySelector('.queue-body');
    if (!body) return;
    
    _queueHost.classList.remove('hidden');
    
    if (actionQueue.length === 0) {
        body.innerHTML = `<div class="queue-empty">${t('queue_empty')}</div>`;
        return;
    }
    
    body.innerHTML = actionQueue.map((item, index) => {
        const name = t(item.nameKey);
        const durationMins = Math.round(item.durationSeconds || 0);
        const durationLabel = durationMins > 0 
            ? t('action_duration_label', { minutes: durationMins }) 
            : t('action_duration_ongoing');
        
        return `
            <div class="queue-item" data-queue-index="${index}">
                <div class="queue-item-info">
                    <div class="queue-item-name">${name}</div>
                    <div class="queue-item-duration">${durationLabel}</div>
                </div>
                <button class="queue-item-remove" data-queue-index="${index}" title="${t('queue_remove_tooltip')}">×</button>
            </div>
        `;
    }).join('');
    
    // Wire remove buttons
    _queueHost.querySelectorAll('.queue-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.queueIndex, 10);
            if (!isNaN(idx)) removeFromQueue(idx);
        });
    });
}