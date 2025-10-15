export const LogType = {
    INFO: 'info', SUCCESS: 'success', ERROR: 'error',
    STORY: 'story', ACTION: 'action', UNLOCK: 'unlock'
};

let logSettings = { colors: {}, filters: {} };

export function updateLogSettings(newSettings) {
    logSettings = newSettings;
}

export function addLogEntry(message, type, options = {}) {
    if (logSettings.filters[type]) { return; }

    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timeString = `[${new Date().toLocaleTimeString()}]`;
    logEntry.textContent = `${timeString} ${message}`;
    logEntry.style.color = logSettings.colors[type] || 'white';
    
    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', options.onClick);
    }
    
    logContent.appendChild(logEntry);
    logContent.scrollTop = logContent.scrollHeight;
}
