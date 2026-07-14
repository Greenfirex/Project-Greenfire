export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error', WARNING: 'warning',
    STORY: 'story', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };

// --- Desktop typewriter (unchanged) ---
let _typewriterTimer = null;
let _typewriterTarget = null;
const TYPEWRITER_SPEED_MS = 25;
const MAX_LOG_ENTRIES = 50;

// --- Mobile: shared ring buffer for log entries + toasts ---
const MOBILE_MAX_VISIBLE = 3;
let _mobileBuffer = [];

// Toast container (created lazily, reused)
let _toastContainer = null;

function _ensureToastContainer() {
    if (_toastContainer && document.body.contains(_toastContainer)) return _toastContainer;
    const ct = document.createElement('div');
    ct.className = 'log-toast-container';
    document.body.appendChild(ct);
    _toastContainer = ct;
    return ct;
}

export function updateLogSettings(newSettings) {
    logSettings = newSettings || { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };
    try {
        document.body?.classList?.toggle('log-timestamps-on', !!logSettings.showTimestamps);
        const twEnabled = (logSettings.typewriterMode !== false);
        document.body?.classList?.toggle('log-typewriter-off', !twEnabled);
    } catch { /* ignore */ }
}

function _isCompact() {
    try {
        // Force mobile path for debugging (set in console: window.__FORCE_MOBILE_LOG = true)
        if (typeof window !== 'undefined' && window.__FORCE_MOBILE_LOG) return true;
        if (document?.documentElement?.classList && document.documentElement.classList.contains('is-compact')) return true;
        const w = window.innerWidth || document.documentElement.clientWidth || 1024;
        if (w <= 900 && window.matchMedia('(hover: none)').matches) return true;
    } catch { /* fall through */ }
    return false;
}

// ==========================================================================
// Desktop: typewriter
// ==========================================================================

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
            if (!_typewriterTarget || _typewriterTarget !== el) { cancelTypewriter(); return; }
            index++;
            el.textContent = fullText.slice(0, index);
            const logContent = document.getElementById('logContent');
            if (logContent) logContent.scrollTop = logContent.scrollHeight;
            if (index >= fullText.length) { cancelTypewriter(); }
        } catch { cancelTypewriter(); }
    }, TYPEWRITER_SPEED_MS);
}

// ==========================================================================
// Mobile: unified buffer — log entries + toasts (single source of truth)
// ==========================================================================

function _getToastColor(entry) {
    try {
        const color = entry.style?.color || '';
        if (color) return color;
    } catch { /* ignore */ }
    return 'rgba(255,255,255,0.9)';
}

function _getToastType(entry) {
    try {
        const color = (entry.style?.color || '').toLowerCase();
        if (color.includes('231, 76, 60') || color.includes('c04040') || color.includes('#c0')) return 'error';
        if (color.includes('144, 238, 144') || color.includes('green') || color.includes('#90')) return 'success';
        if (color.includes('192, 160, 64') || color.includes('gold') || color.includes('#c0a')) return 'unlock';
        if (color.includes('171, 71, 188') || color.includes('purple') || color.includes('#ab')) return 'story';
    } catch { /* ignore */ }
    return 'info';
}

function _createToast(logEntry, message) {
    const container = _ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `log-toast toast-${_getToastType(logEntry)}`;
    toast.style.color = _getToastColor(logEntry);

    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.className = 'log-toast-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _dismissToast(toast);
    });
    toast.appendChild(closeBtn);

    const textEl = document.createElement('span');
    textEl.className = 'log-toast-text';
    if (logSettings.typewriterMode !== false) {
        startTypewriter(textEl, String(message || ''));
    } else {
        textEl.textContent = String(message || '');
    }
    toast.appendChild(textEl);

    // Tap to dismiss
    toast.addEventListener('click', () => _dismissToast(toast));

    // Sync drawer state
    _syncToastDrawerState(container);

    container.insertBefore(toast, container.firstChild);
    container.style.pointerEvents = 'auto';

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        try { if (toast.parentNode) _dismissToast(toast); } catch { /* ignore */ }
    }, 8000);
}

function _dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-dismissing')) return;
    toast.classList.add('toast-dismissing');
    const cleanup = () => {
        try { toast.remove(); } catch { /* ignore */ }
        try {
            const ct = _toastContainer;
            if (ct && ct.children.length === 0) ct.style.pointerEvents = 'none';
        } catch { /* ignore */ }
    };
    toast.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 320);
}

function _syncToastDrawerState(container) {
    try {
        const drawer = document.getElementById('footerLogDrawer');
        const drawerOpen = !!(drawer && drawer.classList.contains('open'));
        if (container) container.classList.toggle('drawer-open', drawerOpen);
    } catch { /* ignore */ }
}

function _flushBuffer() {
    if (!_isCompact()) return;

    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    // Sync toast drawer state
    try { _syncToastDrawerState(_toastContainer); } catch { /* ignore */ }

    // Cap toast container (oldest first) — mobile toast UX limit
    try {
        const tc = _ensureToastContainer();
        if (tc.children.length >= MOBILE_MAX_VISIBLE) {
            for (let i = tc.children.length - 1; i >= 0; i--) {
                if (!tc.children[i].classList.contains('toast-dismissing')) {
                    _dismissToast(tc.children[i]);
                    break;
                }
            }
        }
    } catch { /* ignore */ }

    // Show all buffered entries — DO NOT limit logContent children count;
    // log history must persist (only capped by MAX_LOG_ENTRIES below).
    while (_mobileBuffer.length > 0) {
        const { message, type, options } = _mobileBuffer.shift();
        if (logSettings.filters[type]) continue;

        // --- Log entry ---
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';

        try { logEntry.dataset.time = new Date().toLocaleTimeString(); } catch { /* ignore */ }
        logEntry.style.color = logSettings.colors[type] || 'white';

        if (options.onClick) {
            logEntry.classList.add('clickable');
            logEntry.addEventListener('click', options.onClick);
        }
        // On mobile: instant text for log entries, typewriter only on toasts
        logEntry.textContent = String(message);

        logContent.appendChild(logEntry);

        // Cap DOM (preserves history, drops oldest when over limit)
        while (logContent.children.length > MAX_LOG_ENTRIES) {
            const oldest = logContent.firstElementChild;
            if (oldest) {
                if (oldest === _typewriterTarget) cancelTypewriter();
                try { oldest.remove(); } catch { /* ignore */ }
            } else { break; }
        }

        // Pointerdown dismisses log entry (mobile: tap to dismiss)
        const dismissLog = () => {
            try {
                if (logEntry.parentNode) logEntry.remove();
            } catch { /* ignore */ }
        };
        logEntry.addEventListener('pointerdown', (e) => {
            if (options.onClick) return;
            e.preventDefault();
            dismissLog();
        });

        // --- Toast (created from same buffer entry, auto-dismiss after 8s) ---
        _createToast(logEntry, message);
    }

    // Drop excess buffer
    while (_mobileBuffer.length > 20) { _mobileBuffer.shift(); }

    logContent.scrollTop = logContent.scrollHeight;
}

// ==========================================================================
// Public API
// ==========================================================================

export function addLogEntry(message, type, options = {}) {
    if (typeof window !== 'undefined' && window.__LOGGING_OFF) return;
    if (logSettings.filters[type]) return;

    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    // --- Mobile path ---
    if (_isCompact()) {
        _mobileBuffer.push({ message, type, options: options || {} });
        _flushBuffer();
        return;
    }

    // --- Desktop path (unchanged) ---
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';

    try { logEntry.dataset.time = new Date().toLocaleTimeString(); } catch { /* ignore */ }
    logEntry.style.color = logSettings.colors[type] || 'white';

    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', options.onClick);
    }

    logContent.appendChild(logEntry);

    while (logContent.children.length > MAX_LOG_ENTRIES) {
        const oldest = logContent.firstElementChild;
        if (oldest) {
            if (oldest === _typewriterTarget) cancelTypewriter();
            try { oldest.remove(); } catch { /* ignore */ }
        } else { break; }
    }

    logContent.scrollTop = logContent.scrollHeight;

    if (logSettings.typewriterMode !== false) {
        startTypewriter(logEntry, String(message));
    } else {
        logEntry.textContent = String(message);
    }
}

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