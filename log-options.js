import { LogType, updateLogSettings } from './log.js';

// Define the default settings, including a filter for every type
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

// This will hold the current settingssssss
let logSettings;

// This function updates the button UI to show what's active
function updateFilterButtonsUI() {
    Object.keys(logSettings.filters).forEach(logType => {
        const group = document.querySelector(`[data-log-type="${logType}"]`)?.closest('.log-filter-group');
        if (!group) return;

        const isDisabled = logSettings.filters[logType];
        const btnEnabled = group.querySelector('button:nth-of-type(1)');
        const btnDisabled = group.querySelector('button:nth-of-type(2)');

        btnEnabled.classList.toggle('active', !isDisabled);
        btnDisabled.classList.toggle('active', isDisabled);
    });
}

// This function is called when a filter button is clicked
function updateFilter(logType, isDisabled) {
    logSettings.filters[logType] = isDisabled;
    localStorage.setItem('logSettings', JSON.stringify(logSettings));
    updateLogSettings(logSettings);
    updateFilterButtonsUI();
}

function setupLogOptions() {
    // --- Popup Show/Hide Logic ---
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    logOptionsBtn?.addEventListener('click', () => logOptionsMenu.classList.remove('hidden'));
    closeButton?.addEventListener('click', () => logOptionsMenu.classList.add('hidden'));
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) logOptionsMenu.classList.add('hidden');
    });

    // --- Load settings and send to log.js ---
    logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    logSettings.filters = {...defaultLogSettings.filters, ...logSettings.filters};
    logSettings.colors = {...defaultLogSettings.colors, ...logSettings.colors};
    updateLogSettings(logSettings);

    // --- Dynamically Create Filter Buttons ---
    const filterContainer = document.getElementById('logFiltersContainer');
    if (filterContainer) {
        filterContainer.innerHTML = ''; 
        // Create a button group for each filterable log type
        for (const logType in logSettings.filters) {
            const group = document.createElement('div');
            group.className = 'log-filter-group';
            // Add a data-attribute to the group itself to find it later
            group.dataset.logType = logType;

            const label = document.createElement('span');
            label.textContent = `${logType.charAt(0).toUpperCase() + logType.slice(1)} Msgs`;
            
            const btnEnabled = document.createElement('button');
            btnEnabled.className = 'filter-btn';
            btnEnabled.textContent = 'Enabled';
            btnEnabled.addEventListener('click', () => updateFilter(logType, false));

            const btnDisabled = document.createElement('button');
            btnDisabled.className = 'filter-btn';
            btnDisabled.textContent = 'Disabled';
            btnDisabled.addEventListener('click', () => updateFilter(logType, true));

            group.appendChild(label);
            group.appendChild(btnEnabled);
            group.appendChild(btnDisabled);
            filterContainer.appendChild(group);
        }
        updateFilterButtonsUI(); // Set the initial active buttons
    }

    // --- Color Picker Logic (Unchanged) ---
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