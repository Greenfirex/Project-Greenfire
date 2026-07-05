export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error', WARNING: 'warning',
    STORY: 'story', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };

// Track ongoing typewriter animation so we can cancel it if a new entry arrives.
let _typewriterTimer = null;
let _typewriterTarget = null;
const TYPEWRITER_SPEED_MS = 25; // ms per character

// Cap log entries to prevent DOM bloat / iOS compositing failures after many actions.
const MAX_LOG_ENTRIES = 50;

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
    if (_typewriterTimer) {
        clearInterval(_typewriterTimer);
        _typewriterTimer = null;
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
    _typewriterTarget = el;

    _typewriterTimer = setInterval(() => {
        try {
            if (!_typewriterTarget || _typewriterTarget !== el) {
                cancelTypewriter();
                return;
            }
            index++;
            el.textContent = fullText.slice(0, index);
            // Scroll log to bottom on every character reveal so it stays pinned
            const logContent = document.getElementById('logContent');
            if (logContent) logContent.scrollTop = logContent.scrollHeight;
            if (index >= fullText.length) {
                cancelTypewriter();
            }
        } catch {
            // If the DOM was torn down mid-animation (e.g. logout/refresh), stop cleanly.
            cancelTypewriter();
        }
    }, TYPEWRITER_SPEED_MS);
}

export function addLogEntry(message, type, options = {}) {
    if (logSettings.filters[type]) { return; }

    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';

    // Store time separately; CSS renders it only when timestamps are enabled.
    try {
        const time = new Date().toLocaleTimeString();
        logEntry.dataset.time = time;
    } catch { /* ignore */ }

    logEntry.style.color = logSettings.colors[type] || 'white';
    
    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', options.onClick);
    }
    
    logContent.appendChild(logEntry);

    // Cap the number of log-entry DOM elements to prevent iOS compositing failures.
    // After many actions the log can accumulate 100+ elements with complex CSS,
    // which causes Safari to stop processing clicks/taps entirely.
    while (logContent.children.length > MAX_LOG_ENTRIES) {
        const oldest = logContent.firstElementChild;
        if (oldest) {
            // If the oldest entry is the current typewriter target, cancel it first.
            if (oldest === _typewriterTarget) cancelTypewriter();
            try { oldest.remove(); } catch { /* ignore */ }
        } else {
            break;
        }
    }

    logContent.scrollTop = logContent.scrollHeight;

    // Typewriter effect or instant text.
    // Skip animation when a previous typewriter is still running (prevents
    // stuttering on mobile when multiple log entries arrive rapidly, e.g.,
    // action start + effect + resource warnings all in the same tick).
    if (logSettings.typewriterMode !== false && !_typewriterTarget) {
        startTypewriter(logEntry, String(message));
    } else {
        // If another typewriter was active, cancel it and show text instantly
        if (_typewriterTarget) cancelTypewriter();
        logEntry.textContent = String(message);
    }
}

// Pause typewriter when page/app is hidden (iOS aggressively freezes timers,
// and on resume multiple stalled timers can fire simultaneously, flooding the DOM).
function _onVisibilityChange() {
    try {
        if (document.visibilityState === 'hidden') {
            cancelTypewriter();
        }
    } catch { /* ignore */ }
}

try {
    document.addEventListener('visibilitychange', _onVisibilityChange, { passive: true });
} catch { /* ignore */ }