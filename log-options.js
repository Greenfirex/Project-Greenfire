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
        [LogType.INFO]: false,
        [LogType.SUCCESS]: false,
        [LogType.ERROR]: false,
        [LogType.STORY]: false,
        [LogType.ACTION]: false,
        [LogType.UNLOCK]: false
    }
};

const exampleMessages = {
    [LogType.INFO]: 'Game state saved.',
    [LogType.SUCCESS]: 'Built a new Quarry!',
    [LogType.ERROR]: 'Not enough Stone.',
    [LogType.STORY]: 'A new journey begins...',
    [LogType.ACTION]: 'Mined 1 Stone.',
    [LogType.UNLOCK]: 'Research unlocked.'
};

let logSettings;

/**
 * Updates the example log message style and text.
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
        const btnEnabled = group.querySelector('.filter-btn-show');
        const btnDisabled = group.querySelector('.filter-btn-hide');

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

    logOptionsBtn?.addEventListener('click', () => {
        logOptionsMenu.classList.remove('hidden');
        updateExampleLog(LogType.INFO);
    });
    closeButton?.addEventListener('click', () => logOptionsMenu.classList.add('hidden'));
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) logOptionsMenu.classList.add('hidden');
    });

    logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    logSettings.filters = { ...defaultLogSettings.filters, ...logSettings.filters };
    logSettings.colors = { ...defaultLogSettings.colors, ...logSettings.colors };
    updateLogSettings(logSettings);

    const filterContainer = document.getElementById('logFiltersContainer');
    if (filterContainer) {
        filterContainer.innerHTML = '';
        for (const logType in logSettings.filters) {
            const group = document.createElement('div');
            group.className = 'log-filter-group';
            group.dataset.logType = logType;

            const label = document.createElement('span');
            label.className = 'log-filter-label';
            label.textContent = `${logType.charAt(0).toUpperCase() + logType.slice(1)}`;

            const example = document.createElement('span');
            example.className = 'log-filter-example';
            example.textContent = `(e.g., "${exampleMessages[logType]}")`;
            example.style.color = logSettings.colors[logType];

            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'log-filter-buttons';

            const btnEnabled = document.createElement('button');
            btnEnabled.className = 'filter-btn filter-btn-show';
            btnEnabled.textContent = 'Show';
            btnEnabled.addEventListener('click', () => updateFilter(logType, false));

            const btnDisabled = document.createElement('button');
            btnDisabled.className = 'filter-btn filter-btn-hide';
            btnDisabled.textContent = 'Hide';
            btnDisabled.addEventListener('click', () => updateFilter(logType, true));
            
            group.addEventListener('mouseenter', () => updateExampleLog(logType));

            buttonWrapper.appendChild(btnEnabled);
            buttonWrapper.appendChild(btnDisabled);
            group.appendChild(label);
            group.appendChild(example);
            group.appendChild(buttonWrapper);
            filterContainer.appendChild(group);
        }
        updateFilterButtonsUI();
    }

    const colorPickers = document.querySelectorAll('.log-color-option input[type="color"]');
    colorPickers.forEach(picker => {
        const logType = picker.dataset.logType;
        // Set the initial color from loaded settings
        if (logSettings.colors[logType]) {
            picker.value = logSettings.colors[logType];
        }
        // Add listener to update settings on change
        picker.addEventListener('input', () => {
            logSettings.colors[logType] = picker.value;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
        });
    });
}

window.addEventListener('load', setupLogOptions);