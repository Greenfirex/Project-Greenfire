export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error', WARNING: 'warning',
    STORY: 'story', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };

// Track ongoing typewriter animation so we can cancel it if a new entry arrives.
let _typewriterRafId = null;
let _typewriterTarget = null;
const TYPEWRITER_SPEED_MS = 25; // ms per character

// Cap log entries to prevent DOM bloat / iOS compositing failures after many actions.
const MAX_LOG_ENTRIES = 50;

// --- Batching: defer DOM operations to a single rAF tick ---
let _pendingEntries = [];
let _batchRafId = null;

export function updateLogSettings(newSettings) {
    logSettings = newSettings || { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };
    try {
        document.body?.classList?.toggle('log-timestamps-on', !!logSettings.showTimestamps);
        const twEnabled = (logSettings.typewriterMode !== false);
        document.body?.classList?.toggle('log-typewriter-off', !twEnabled);
    } catch { /* ignore */ }
}

/** Immediately stop any running typewriter and finish the target text. Safe to call any time. */
function cancelTypewriter() {
    if (_typewriterRafId) {
        cancelAnimationFrame(_typewriterRafId);
        _typewriterRafId = null;
    }
    if (_typewriterTarget) {
        try { _typewriterTarget.textContent = _typewriterTarget._fullText || ''; } catch { /* ignore */ }
        try { delete _typewriterTarget._fullText; } catch { /* ignore */ }
        _typewriterTarget = null;
    }
}

function startTypewriter(el, fullText) {
    cancelTypewriter();

    el._fullText = fullText;
    el.textContent = '';
    let index = 0;
    let lastCharTime = 0;
    _typewriterTarget = el;

    function tick(now) {
        try {
            if (!_typewriterTarget || _typewriterTarget !== el) {
                cancelTypewriter();
                return;
            }
            // Rate-limit character reveals (same 25ms pacing, but via rAF)
            if (now - lastCharTime < TYPEWRITER_SPEED_MS) {
                _typewriterRafId = requestAnimationFrame(tick);
                return;
            }
            lastCharTime = now;
            index++;
            el.textContent = fullText.slice(0, index);
            // Scroll log only on first character to avoid per-character layout thrash on mobile
            if (index === 1) {
                const logContent = document.getElementById('logContent');
                if (logContent) logContent.scrollTop = logContent.scrollHeight;
            }
            if (index >= fullText.length) {
                cancelTypewriter();
                // Final scroll to bottom
                const logContent = document.getElementById('logContent');
                if (logContent) logContent.scrollTop = logContent.scrollHeight;
                return;
            }
            _typewriterRafId = requestAnimationFrame(tick);
        } catch {
            cancelTypewriter();
        }
    }

    _typewriterRafId = requestAnimationFrame(tick);
}

/**
 * Flush all queued log entries in a single rAF tick.
 * This batches DOM mutations (appendChild, scroll) so multiple
 * addLogEntry calls in the same synchronous frame don't cause
 * N separate layout reflows on iOS Safari.
 */
function flushLogBatch() {
    _batchRafId = null;
    const entries = _pendingEntries;
    _pendingEntries = [];

    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    // Build all entries
    const fragments = [];
    const entryCount = entries.length;
    for (let i = 0; i < entryCount; i++) {
        const { message, type, options } = entries[i];
        if (logSettings.filters[type]) continue;

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        try {
            const time = new Date().toLocaleTimeString();
            logEntry.dataset.time = time;
        } catch { /* ignore */ }

        logEntry.style.color = logSettings.colors[type] || 'white';

        if (options.onClick) {
            logEntry.classList.add('clickable');
            logEntry.addEventListener('click', options.onClick);
        }

        // Determine if this entry should be typewriter-animated.
        // Only animate the LAST entry in a batch (if any), and only
        // when no typewriter is already running.
        const isLast = (i === entryCount - 1);
        const shouldAnimate = isLast && logSettings.typewriterMode !== false && !_typewriterTarget;

        if (shouldAnimate) {
            // Leave textContent empty — typewriter will fill it
        } else {
            // If another typewriter was active for a previous entry, cancel it
            if (_typewriterTarget && isLast) cancelTypewriter();
            logEntry.textContent = String(message);
        }

        logContent.appendChild(logEntry);

        // Cap the number of log-entry DOM elements
        while (logContent.children.length > MAX_LOG_ENTRIES) {
            const oldest = logContent.firstElementChild;
            if (oldest) {
                if (oldest === _typewriterTarget) cancelTypewriter();
                try { oldest.remove(); } catch { /* ignore */ }
            } else {
                break;
            }
        }

        // Store for typewriter start after DOM is settled
        if (shouldAnimate) {
            fragments.push({ el: logEntry, text: String(message), animate: true });
        }
    }

    // Scroll once after all appends
    logContent.scrollTop = logContent.scrollHeight;

    // Start typewriter on the last entry (if queued)
    for (const f of fragments) {
        if (f.animate) {
            startTypewriter(f.el, f.text);
        }
    }
}

export function addLogEntry(message, type, options = {}) {
    if (logSettings.filters[type]) return;

    // Queue the entry — flush happens in next rAF, batching multiple
    // addLogEntry calls from the same synchronous tick into one DOM update.
    _pendingEntries.push({ message, type, options: options || {} });

    if (!_batchRafId) {
        _batchRafId = requestAnimationFrame(flushLogBatch);
    }
}

// Pause typewriter when page/app is hidden (iOS aggressively freezes timers,
// and on resume multiple stalled timers can fire simultaneously, flooding the DOM).
function _onVisibilityChange() {
    try {
        if (document.visibilityState === 'hidden') {
            cancelTypewriter();
            // Also flush any pending batch immediately so entries aren't lost
            if (_batchRafId) {
                cancelAnimationFrame(_batchRafId);
                flushLogBatch();
            }
        }
    } catch { /* ignore */ }
}

try {
    document.addEventListener('visibilitychange', _onVisibilityChange, { passive: true });
} catch { /* ignore */ }