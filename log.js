export function addLogEntry(message, color = 'white', options = {}) {
    const logSection = document.getElementById('logSection');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const now = new Date();
    const timeString = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

    logEntry.textContent = `${timeString} ${message}`;
    logEntry.style.color = color;
    
    // NEW: Check for an onClick option
    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', options.onClick);
    }
    
    logSection.appendChild(logEntry);
    logSection.scrollTop = logSection.scrollHeight;
}
