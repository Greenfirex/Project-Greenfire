export function addLogEntry(message, color = 'white', options = {}) {
    // MODIFIED: Target the new 'logContent' div for entries
    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const now = new Date();
    const timeString = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;

    logEntry.textContent = `${timeString} ${message}`;
    logEntry.style.color = color;
    
    if (options.onClick) {
        logEntry.classList.add('clickable');
        logEntry.addEventListener('click', (event) => {
            console.log("Clickable log entry was successfully clicked!"); 
            options.onClick(event);
        });
    }
    
    logContent.appendChild(logEntry);
    // Scroll the new container
    logContent.scrollTop = logContent.scrollHeight;
}
