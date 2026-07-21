// ==========================================================================
// Action Queue Engine
// ==========================================================================
// Allows queueing actions while another is running.
// Queued actions auto-start when the current action completes.
// ==========================================================================

import { t } from '../locales/locales.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { gameFlags } from './gameFlags.js';
import { advanceIngameTimeBySeconds, getIngameTimeString } from './time.js';
import { applyTimePassiveDrain, checkDeathAndLoop, setActiveDrainRates } from './resources.js';
import { advanceEffectProgress } from './effects.js';
import { setupTooltip } from '../ui/panels/tooltip.js';

export let actionQueue = [];
let _activeAction = null; // { id, nameKey, progress, durationSeconds }

// End Loop button state
let _endLoopActive = false; // prevent double-clicks while confirm popup is open

function initEndLoopButton() {
    const btn = document.getElementById('endLoopBtn');
    if (!btn) return;

    // Wire tooltip
    setupTooltip(btn, () => `<p style="font-size:var(--font-size-small)">${t('queue_end_loop_desc')}</p>`);

    // Update visibility based on loop count
    function updateEndLoopVisibility() {
        const loop = gameFlags.loopCount || 0;
        if (loop >= 3) {
            btn.classList.remove('hidden');
            btn.textContent = t('action_end_loop');
        } else {
            btn.classList.add('hidden');
        }
    }

    // Reset state on death-loop-reset
    window.addEventListener('death-loop-reset', () => {
        _endLoopActive = false;
        updateEndLoopVisibility();
    });

    // Also update when queue UI is first set up
    updateEndLoopVisibility();

    // Wire click on End Loop button
    btn.addEventListener('click', async () => {
        if (_endLoopActive) return; // prevent double-clicks

        const loop = gameFlags.loopCount || 0;
        const hintSeen = gameFlags.loopKnowledge && gameFlags.loopKnowledge._endLoopHintSeen;

        if (!hintSeen) {
            // First ever click — show narrative hint in log
            if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = {};
            gameFlags.loopKnowledge._endLoopHintSeen = true;
            try {
                const state = JSON.parse(localStorage.getItem('gameState') || '{}');
                if (!state.gameFlags) state.gameFlags = {};
                if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
                state.gameFlags.loopKnowledge._endLoopHintSeen = true;
                localStorage.setItem('gameState', JSON.stringify(state));
            } catch { /* ignore */ }
            addLogEntry(t('log_end_loop_hint'), LogType.STORY);
            return;
        }

        // Show confirmation popup (same style as title screen)
        _endLoopActive = true;
        const { showConfirmPopup } = await import('../ui/panels/confirmPopup.js');
        const confirmed = await showConfirmPopup({
            title: t('action_end_loop'),
            message: t('action_end_loop_confirm'),
            confirmText: t('action_end_loop_confirm_ok'),
            cancelText: t('action_end_loop_confirm_cancel'),
        });
        _endLoopActive = false;

        if (confirmed) {
            import('../engine/resources.js').then(mod => {
                if (typeof mod.triggerManualLoopReset === 'function') {
                    mod.triggerManualLoopReset();
                }
            });
        }
    });
}

// Call init when module loads (DOM should already be ready since queue loads from main.js)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initEndLoopButton();
        initPassTimeButton();
    });
} else {
    initEndLoopButton();
    initPassTimeButton();
}

// ==========================================================================
// Pass Time Button
// ==========================================================================

let _passTimeTimer = null;
let _passTimeActive = false;

// Default idle drain rates (per second) — same as DEFAULT_DRAIN in locationEngine.js
const IDLE_DRAIN_RATES = { 'Stamina': -0.20, 'Food Rations': -0.08, 'Drinking Water': -0.12 };

function initPassTimeButton() {
    const btn = document.getElementById('passTimeBtn');
    if (!btn) return;

    // Always visible
    btn.classList.remove('hidden');
    btn.textContent = t('queue_pass_time');

    // Wire tooltip
    setupTooltip(btn, () => `<p style="font-size:var(--font-size-small)">${t('queue_pass_time_desc')}</p>`);

    function updateClockDisplay() {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) clockEl.textContent = getIngameTimeString();
    }

    function stopPassTime() {
        if (_passTimeTimer) {
            clearInterval(_passTimeTimer);
            _passTimeTimer = null;
        }
        _passTimeActive = false;
        btn.textContent = t('queue_pass_time');
        btn.classList.remove('pass-time-active');
        // Restore previous drain rates (or null if no action was running)
        try {
            const state = window.__getActiveActionState ? window.__getActiveActionState() : null;
            if (!state) setActiveDrainRates(null, null);
        } catch { setActiveDrainRates(null, null); }
    }

    function startPassTime() {
        if (_passTimeTimer) return;
        _passTimeActive = true;
        btn.textContent = t('queue_pass_time_stop');
        btn.classList.add('pass-time-active');

        // Apply idle drain rates so stamina/food/water drain while waiting
        const hasActiveAction = (() => {
            try { return !!(window.__getActiveActionState && window.__getActiveActionState()); }
            catch { return false; }
        })();
        if (!hasActiveAction) {
            setActiveDrainRates(IDLE_DRAIN_RATES, { 'Stamina': [{ rate: 0.20, label: 'Wait' }], 'Food Rations': [{ rate: 0.08, label: 'Wait' }], 'Drinking Water': [{ rate: 0.12, label: 'Wait' }] });
        }

        const TICK_SECONDS = 0.1;
        const gameSpeed = () => {
            try { const s = Number(window.TIME_SCALE); return Number.isFinite(s) && s > 0 ? s : 1; }
            catch { return 1; }
        };

        _passTimeTimer = setInterval(() => {
            if (!_passTimeActive) { stopPassTime(); return; }
            const tickSecs = TICK_SECONDS * gameSpeed();
            advanceIngameTimeBySeconds(tickSecs);
            applyTimePassiveDrain(tickSecs);
            advanceEffectProgress(tickSecs);
            updateClockDisplay();
            try { checkDeathAndLoop(); } catch { /* ignore */ }
        }, 100);
    }

    btn.addEventListener('click', () => {
        if (_passTimeActive) {
            stopPassTime();
        } else {
            startPassTime();
        }
    });

    // Stop on death/reset
    window.addEventListener('force-cancel-action', () => stopPassTime());
    window.addEventListener('game-pause', () => stopPassTime());
}

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

/**
 * Return a save-safe snapshot of the action queue.
 */
export function getQueueForSave() {
    return actionQueue.slice();
}

/**
 * Replace the action queue from saved data (used during load).
 */
export function setQueueFromSave(saved) {
    if (!Array.isArray(saved)) return;
    actionQueue.length = 0;
    actionQueue.push(...saved);
    updateQueueUI();
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
    
    // Refresh end-loop button visibility (game state might have loaded after init)
    const btn = document.getElementById('endLoopBtn');
    if (btn) {
        const loop = gameFlags.loopCount || 0;
        if (loop >= 3) {
            btn.classList.remove('hidden');
            btn.textContent = t('action_end_loop');
        }
    }
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
