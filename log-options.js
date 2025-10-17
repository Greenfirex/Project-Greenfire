import { LogType, updateLogSettings } from './log.js';

const defaultLogSettings = {
    colors: {
        [LogType.INFO]: '#2196F3',    [LogType.SUCCESS]: '#4CAF50',
        [LogType.ERROR]: '#F44336',   [LogType.STORY]: '#9C27B0',
        [LogType.ACTION]: '#9E9E9E',  [LogType.UNLOCK]: '#FFC107'
    },
    filters: {
        [LogType.INFO]: false, [LogType.SUCCESS]: false,
        [LogType.ERROR]: false, [LogType.STORY]: false,
        [LogType.ACTION]: false, [LogType.UNLOCK]: false
    }
};

// NEW: A map of example messages for each log type
const exampleMessages = {
    [LogType.INFO]: 'Game state saved.',
    [LogType.SUCCESS]: 'Built a new Quarry!',
    [LogType.ERROR]: 'Not enough Stone to build.',
    [LogType.STORY]: 'A new journey begins... (Click to read)',
    [LogType.ACTION]: 'Manually mined 1 Stone.',
    [LogType.UNLOCK]: 'New menu section unlocked: Research'
};

let logSettings;

/**
 * Updates the example log message style and text.
 * @param {string} logType - The log type to show as an example.
 */
function updateExampleLog(logType) {
    const exampleLog = document.getElementById('logExample');
    if (exampleLog) {
        exampleLog.style.color = logSettings.colors[logType];
        exampleLog.textContent = `[12:34:56] ${exampleMessages[logType]}`;
    }
}

function updateFilterButtonsUI() {
    Object.keys(logSettings.filters).forEach(logType => {
        const group = document.querySelector(`.log-filter-group[data-log-type="${logType}"]`);
        if (!group) return;

        const isDisabled = logSettings.filters[logType];
        const btnEnabled = group.querySelector('button:nth-of-type(1)');
        const btnDisabled = group.querySelector('button:nth-of-type(2)');

        btnEnabled.classList.toggle('active', !isDisabled);
        btnDisabled.classList.toggle('active', isDisabled);
    });
}

function updateFilter(logType, isDisabled) {
    logSettings.filters[logType] = isDisabled;
    localStorage.setItem('logSettings', JSON.stringify(logSettings));
    updateLogSettings(logSettings);
    updateFilterButtonsUI();
}

function setupLogOptions() {
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    logOptionsBtn?.addEventListener('click', () => logOptionsMenu.classList.remove('hidden'));
    closeButton?.addEventListener('click', () => logOptionsMenu.classList.add('hidden'));
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) logOptionsMenu.classList.add('hidden');
    });

    logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    logSettings.filters = {...defaultLogSettings.filters, ...logSettings.filters};
    logSettings.colors = {...defaultLogSettings.colors, ...logSettings.colors};
    updateLogSettings(logSettings);

    const filterContainer = document.getElementById('logFiltersContainer');
    if (filterContainer) {
        filterContainer.innerHTML = ''; 
        for (const logType in logSettings.filters) {
            const group = document.createElement('div');
            group.className = 'log-filter-group';
            group.dataset.logType = logType;

            const label = document.createElement('span');
            label.textContent = `${logType.charAt(0).toUpperCase() + logType.slice(1)}`;
            
            const buttonWrapper = document.createElement('div');
            const btnEnabled = document.createElement('button');
            btnEnabled.className = 'filter-btn';
            btnEnabled.textContent = 'Show';
            btnEnabled.addEventListener('click', () => updateFilter(logType, false));

            const btnDisabled = document.createElement('button');
            btnDisabled.className = 'filter-btn';
            btnDisabled.textContent = 'Hide';
            btnDisabled.addEventListener('click', () => updateFilter(logType, true));

            // NEW: Add hover listeners to update the example
            group.addEventListener('mouseenter', () => updateExampleLog(logType));

            buttonWrapper.appendChild(btnEnabled);
            buttonWrapper.appendChild(btnDisabled);
            group.appendChild(label);
            group.appendChild(buttonWrapper);
            filterContainer.appendChild(group);
        }
        updateFilterButtonsUI();
    }

    const colorPickers = document.querySelectorAll('#logColorsContainer input[type="color"]');
    colorPickers.forEach(picker => {
        const logType = picker.dataset.logType;
        if (logSettings.colors[logType]) {
            picker.value = logSettings.colors[logType];
        }
        picker.addEventListener('input', () => {
            logSettings.colors[logType] = picker.value;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            updateExampleLog(logType);
        });
        // NEW: Update example on hover
        picker.closest('.log-color-option').addEventListener('mouseenter', () => updateExampleLog(logType));
    });

    // Set initial example text when popup is opened
    logOptionsBtn?.addEventListener('click', () => {
        updateExampleLog(LogType.INFO); // Default to showing an 'info' example
    });
}
window.addEventListener('load', setupLogOptions);