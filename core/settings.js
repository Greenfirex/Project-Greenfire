import { setNotation } from './formatting.js';
import { saveGameState } from './saveload.js';
import { exportSaveToClipboard, importSaveFromText } from './saveload.js';
import { LogType, updateLogSettings } from './ingameLog.js';

// A single, unified map for all color options
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    white:  '224, 224, 224',
    black:  '0, 0, 0'
};

const EXPORT_ENCRYPT_KEY = 'options.exportEncryptDefault';

const COMBAT_START_PAUSED_KEY = 'options.combatStartPaused';

export function getCombatStartPaused() {
    try {
        const raw = localStorage.getItem(COMBAT_START_PAUSED_KEY);
        // Default to true (safer for new players).
        return raw === null ? true : !!JSON.parse(raw);
    } catch (e) {
        return true;
    }
}

function setCombatStartPaused(value) {
    try {
        localStorage.setItem(COMBAT_START_PAUSED_KEY, JSON.stringify(!!value));
    } catch (e) {
        console.warn('Could not persist combat-start-paused option', e);
    }
}

function setExportEncryptDefault(value) {
    try {
        localStorage.setItem(EXPORT_ENCRYPT_KEY, JSON.stringify(!!value));
    } catch (e) {
        console.warn('Could not persist export-encrypt option', e);
    }
}

function getExportEncryptDefault() {
    try {
        const raw = localStorage.getItem(EXPORT_ENCRYPT_KEY);
        return raw === null ? false : JSON.parse(raw);
    } catch (e) {
        return false;
    }
}

let runInBackground = true;
let glowEffectsEnabled = true;

export function shouldRunInBackground() {
    return runInBackground;
}

export function setGlowColor(colorName) {
    const rgb = colorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    document.body.style.setProperty('--glow-r', r);
    document.body.style.setProperty('--glow-g', g);
    document.body.style.setProperty('--glow-b', b);

    localStorage.setItem('glowColor', colorName);
    
    // --- Update the visual indicator ---
    const swatches = document.querySelectorAll('#colorPickerContainer .color-swatch');
    swatches.forEach(swatch => {
        swatch.classList.remove('selected');
        if (swatch.dataset.color === colorName) {
            swatch.classList.add('selected');
        }
    });

    // Restart animation logic
    const animatedElements = document.querySelectorAll('#header, #footer, #mainMenu, #infoPanel, #mainContainer');
    animatedElements.forEach(element => {
        element.style.animation = 'none';
        void element.offsetWidth;
        element.style.animation = '';
    });
}

export function setActiveGlowColor(colorName) {
    const rgb = colorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    document.body.style.setProperty('--active-glow-r', r);
    document.body.style.setProperty('--active-glow-g', g);
    document.body.style.setProperty('--active-glow-b', b);

    localStorage.setItem('activeGlowColor', colorName);

    // --- Update the visual indicator ---
    const swatches = document.querySelectorAll('#activeButtonColorPicker .color-swatch');
    swatches.forEach(swatch => {
        swatch.classList.remove('selected');
        if (swatch.dataset.color === colorName) {
            swatch.classList.add('selected');
        }
    });
}

/**
 * NEW: Sets the UI glow intensity by updating a CSS variable.
 * @param {number} intensity - The opacity value from 0 to 1.
 */
export function setGlowIntensity(intensity) {
    // Opacity is capped at 1 (100%)
    const opacity = Math.min(intensity, 1);
    // The spread multiplier can go up to 2 (200%)
    const spreadMultiplier = intensity;

    document.body.style.setProperty('--glow-opacity', opacity);
    document.body.style.setProperty('--glow-spread-multiplier', spreadMultiplier);
    
    localStorage.setItem('glowIntensity', intensity);
}

/**
 * Initializes the options menu event listeners.
 */
export function initOptions() {
    // Setup for the main UI glow picker
    const mainSwatches = document.querySelectorAll('#colorPickerContainer .color-swatch');
    mainSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            setGlowColor(swatch.dataset.color);
        });
    });

    // Setup for the active button glow picker
    const activeSwatches = document.querySelectorAll('#activeButtonColorPicker .color-swatch');
    activeSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            setActiveGlowColor(swatch.dataset.color);
        });
    });
	
	const glowSlider = document.getElementById('glowIntensitySlider');
    if (glowSlider) {
        // Set the slider's initial position from localStorage (defaulting to 1)
        glowSlider.value = localStorage.getItem('glowIntensity') || 1;

        glowSlider.addEventListener('input', (event) => {
            setGlowIntensity(event.target.value);
        });
    }
	
	// --- Glow Toggle ---
    const glowToggle = document.getElementById('glowToggle');
    if (glowToggle) {
        glowEffectsEnabled = JSON.parse(localStorage.getItem('glowEffectsEnabled')) ?? true;
        glowToggle.checked = glowEffectsEnabled;
        document.body.classList.toggle('glow-disabled', !glowEffectsEnabled);

        glowToggle.addEventListener('change', () => {
            glowEffectsEnabled = glowToggle.checked;
            localStorage.setItem('glowEffectsEnabled', glowEffectsEnabled);
            document.body.classList.toggle('glow-disabled', !glowEffectsEnabled);
        });
    }
	
	// --- Run in background Toggle ---
	const backgroundToggle = document.getElementById('backgroundToggle');
    if (backgroundToggle) {
        // 1. Load the saved setting
        runInBackground = JSON.parse(localStorage.getItem('runInBackground')) ?? true;
        // 2. Set the checkbox to match the loaded setting
        backgroundToggle.checked = runInBackground;
        // 3. Listen for changes
        backgroundToggle.addEventListener('change', () => {
            runInBackground = backgroundToggle.checked;
            localStorage.setItem('runInBackground', runInBackground);
        });
    }

    // --- Combat starts paused Toggle ---
    const combatStartPausedToggle = document.getElementById('combatStartPausedToggle');
    if (combatStartPausedToggle) {
        combatStartPausedToggle.checked = getCombatStartPaused();
        combatStartPausedToggle.addEventListener('change', () => {
            setCombatStartPaused(combatStartPausedToggle.checked);
        });
    }
	
	 // --- Notation Picker ---
    const notationRadios = document.querySelectorAll('input[name="notation"]');
    if (notationRadios.length > 0) {
        const savedNotation = localStorage.getItem('numberNotation') || 'standard';
        setNotation(savedNotation);
        document.querySelector(`input[value="${savedNotation}"]`).checked = true;

        notationRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    setNotation(radio.value);
                    localStorage.setItem('numberNotation', radio.value);
                }
            });
        });
    }
}

// ============================================================================
// LOG SETTINGS (merged from log-options.js)
// ============================================================================

const defaultLogSettings = {
    colors: {
        [LogType.INFO]: '#64B5F6',    [LogType.SUCCESS]: '#81C784',
        [LogType.ERROR]: '#E57373',   [LogType.STORY]: '#BA68C8',
        [LogType.ACTION]: '#9E9E9E',  [LogType.UNLOCK]: '#FFD54F'
    },
    filters: {
        [LogType.INFO]: false, [LogType.SUCCESS]: false,
        [LogType.ERROR]: false, [LogType.STORY]: false,
        [LogType.ACTION]: false, [LogType.UNLOCK]: false
    }
};

const exampleMessages = {
    [LogType.INFO]: 'Game state saved.',
    [LogType.SUCCESS]: 'Built a new Quarry!',
    [LogType.ERROR]: 'Not enough Crystal.',
    [LogType.STORY]: 'A new journey begins...',
    [LogType.ACTION]: 'Mined 1 Crystal.',
    [LogType.UNLOCK]: 'Research unlocked.'
};

let logSettings;

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

function updateAllColorUI() {
    const colorPickers = document.querySelectorAll('#logColorsContainer input[type="color"]');
    colorPickers.forEach(picker => {
        const logType = picker.dataset.logType;
        if (logSettings.colors[logType]) {
            picker.value = logSettings.colors[logType];
        }
    });
    for (const logType in logSettings.colors) {
        const exampleText = document.querySelector(`.log-filter-group[data-log-type="${logType}"] .log-filter-example`);
        if (exampleText) {
            exampleText.style.color = logSettings.colors[logType];
        }
    }
}

function setupLogOptions() {
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    logOptionsBtn?.addEventListener('click', () => {
        logOptionsMenu.classList.remove('hidden');
        try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
        // Refresh the UI every time the popup is opened
        updateFilterButtonsUI();
        updateAllColorUI();
        updateExampleLog(LogType.INFO);
    });
    closeButton?.addEventListener('click', () => { logOptionsMenu.classList.add('hidden'); try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ } });
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) { logOptionsMenu.classList.add('hidden'); try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ } }
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
    }

    const colorPickers = document.querySelectorAll('#logColorsContainer input[type="color"]');
    colorPickers.forEach(picker => {
        const logType = picker.dataset.logType;
        picker.addEventListener('input', () => {
            logSettings.colors[logType] = picker.value;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            updateAllColorUI();
        });
        const colorOption = picker.closest('.log-color-option');
        if (colorOption) {
            colorOption.addEventListener('mouseenter', () => updateExampleLog(logType));
        }
    });
    
    const resetColorsBtn = document.getElementById('resetLogColorsBtn');
    if (resetColorsBtn) {
        resetColorsBtn.addEventListener('click', () => {
            logSettings.colors = { ...defaultLogSettings.colors };
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            updateAllColorUI();
        });
    }

    updateFilterButtonsUI();
    updateAllColorUI();
}

// Replace the load handler with a robust one-time init on DOMContentLoaded
if (!window.__pgfLogOptionsInitialized) {
    window.__pgfLogOptionsInitialized = true;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLogOptions, { once: true });
    } else {
        setupLogOptions();
    }
}

