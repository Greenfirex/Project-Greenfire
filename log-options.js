import { LogType, updateLogSettings } from './log.js';

const defaultLogSettings = {
    colors: {
        [LogType.INFO]: '#2196F3', [LogType.SUCCESS]: '#4CAF50',
        [LogType.ERROR]: '#F44336', [LogType.STORY]: '#9C27B0',
        [LogType.ACTION]: '#9E9E9E', [LogType.UNLOCK]: '#FFC107'
    },
    filters: { [LogType.ACTION]: false }
};

function setupLogOptions() {
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    logOptionsBtn?.addEventListener('click', () => logOptionsMenu.classList.remove('hidden'));
    closeButton?.addEventListener('click', () => logOptionsMenu.classList.add('hidden'));
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) logOptionsMenu.classList.add('hidden');
    });

    let logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    updateLogSettings(logSettings);

    const filterCheckbox = document.getElementById('filterAction');
    if (filterCheckbox) {
        const logType = filterCheckbox.dataset.logType;
        filterCheckbox.checked = logSettings.filters[logType] ?? false;

        filterCheckbox.addEventListener('change', () => {
            logSettings.filters[logType] = filterCheckbox.checked;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
        });
    }
}
window.addEventListener('load', setupLogOptions);