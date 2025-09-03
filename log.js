export function addLogEntry(message, color = 'white') {
    const logSection = document.getElementById('logSection');
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    // Get the current time and format it
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const timeString = `[${hours}:${minutes}:${seconds}]`;

    // Combine the time with the message
    logEntry.textContent = `${timeString} ${message}`;
    logEntry.style.color = color;
    
    logSection.appendChild(logEntry);
    logSection.scrollTop = logSection.scrollHeight;
}
