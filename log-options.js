import { LogType, updateLogSettings } from './log.js';

const defaultLogSettings = {
    colors: {
        [LogType.INFO]: '#2196F3',
        [LogType.SUCCESS]: '#4CAF50',
        [LogType.ERROR]: '#F44336',
        [LogType.STORY]: '#9C27B0',
        [LogType.ACTION]: '#9E9E9E',
        [LogType.UNLOCK]: '#FFC107'
    },
    filters: { 
        [LogType.ACTION]: false 
    }
};

function setupLogOptions() {
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    if (logOptionsBtn) {
        logOptionsBtn.addEventListener('click', () => logOptionsMenu.classList.remove('hidden'));
    }
    if (closeButton) {
        closeButton.addEventListener('click', () => logOptionsMenu.classList.add('hidden'));
    }
    if (logOptionsMenu) {
        logOptionsMenu.addEventListener('click', (e) => {
            if (e.target === logOptionsMenu) {
                logOptionsMenu.classList.add('hidden');
            }
        });
    }

    let logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    logSettings.colors = {...defaultLogSettings.colors, ...logSettings.colors};
    logSettings.filters = {...defaultLogSettings.filters, ...logSettings.filters};
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

    const colorPickers = document.querySelectorAll('.log-color-option input[type="color"]');
    colorPickers.forEach(picker => {
        const logType = picker.dataset.logType;
        if (logSettings.colors[logType]) {
            picker.value = logSettings.colors[logType];
        }

        picker.addEventListener('input', () => {
            logSettings.colors[logType] = picker.value;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
        });
    });
}

window.addEventListener('load', setupLogOptions);