export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error',
    STORY: 'story', ACTION: 'action', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };

// Track ongoing typewriter animation so we can cancel it if a new entry arrives.
let _typewriterTimer = null;
let _typewriterTarget = null;
const TYPEWRITER_SPEED_MS = 25; // ms per character

export function updateLogSettings(newSettings) {
    logSettings = newSettings || { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };
    try {
        document.body?.classList?.toggle('log-timestamps-on', !!logSettings.showTimestamps);
        const twEnabled = (logSettings.typewriterMode !== false);
        document.body?.classList?.toggle('log-typewriter-off', !twEnabled);
    } catch { /* ignore */ }
}

function startTypewriter(el, fullText) {
    // Cancel any previous animation.
    if (_typewriterTimer) {
        clearInterval(_typewriterTimer);
        _typewriterTimer = null;
    }
    // Instantly finish the previous entry if it was mid-animation.
    if (_typewriterTarget) {
        _typewriterTarget.textContent = _typewriterTarget._fullText || '';
        _typewriterTarget = null;
    }

    el._fullText = fullText;
    el.textContent = '';
    let index = 0;
    _typewriterTarget = el;

    _typewriterTimer = setInterval(() => {
        if (!_typewriterTarget || _typewriterTarget !== el) {
            clearInterval(_typewriterTimer);
            _typewriterTimer = null;
            return;
        }
        index++;
        el.textContent = fullText.slice(0, index);
        if (index >= fullText.length) {
            clearInterval(_typewriterTimer);
            _typewriterTimer = null;
            _typewriterTarget = null;
            delete el._fullText;
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
    logContent.scrollTop = logContent.scrollHeight;

    // Typewriter effect or instant text.
    if (logSettings.typewriterMode !== false) {
        startTypewriter(logEntry, String(message));
    } else {
        logEntry.textContent = String(message);
    }
}
