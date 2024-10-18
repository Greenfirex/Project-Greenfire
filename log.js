export function addLogEntry(message, color = 'white') {
  const logSection = document.getElementById('logSection');
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.style.color = color;
  logEntry.textContent = message;
  logSection.appendChild(logEntry);
  logSection.scrollTop = logSection.scrollHeight;
}
