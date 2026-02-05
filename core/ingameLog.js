export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error',
    STORY: 'story', ACTION: 'action', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };

export function updateLogSettings(newSettings) {
    logSettings = newSettings || { colors: {}, filters: {}, showTimestamps: false, typewriterMode: true };
    try {
        document.body?.classList?.toggle('log-timestamps-on', !!logSettings.showTimestamps);
        const twEnabled = (logSettings.typewriterMode !== false);
        document.body?.classList?.toggle('log-typewriter-off', !twEnabled);
    } catch { /* ignore */ }
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

    logEntry.textContent = `${message}`;
    logEntry.style.color = logSettings.colors[type] || 'white';
    
    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', options.onClick);
    }
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}
