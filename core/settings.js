import { LogType, updateLogSettings } from './ingameLog.js';

// A single, unified map for all color options
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    cyan:   '0, 229, 255',
    teal:   '29, 233, 182',
    orange: '255, 179, 0',
    red:    '255, 82, 82',
    pink:   '255, 79, 216',
    lime:   '198, 255, 0',
    white:  '224, 224, 224',
    black:  '0, 0, 0'
};

function rgbCsvToHex(csv) {
    const parts = String(csv || '').split(',').map(s => Number(String(s).trim()));
    if (parts.length < 3) return null;
    const [r, g, b] = parts;
    if (![r, g, b].every(v => Number.isFinite(v))) return null;
    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const LOG_SWATCH_KEYS = [
    'green','blue','purple','gold','cyan','teal','orange','red','pink','lime','white','black'
];

const LOG_SWATCH_HEX = (() => {
    const out = {};
    LOG_SWATCH_KEYS.forEach(k => {
        const hex = rgbCsvToHex(colorMap[k]);
        if (hex) out[k] = hex;
    });
    return out;
})();

const EXPORT_ENCRYPT_KEY = 'options.exportEncryptDefault';

const COMBAT_START_PAUSED_KEY = 'options.combatStartPaused';

const REDUCE_MOTION_KEY = 'options.reduceMotion';
const CONFIRM_LOAD_KEY = 'options.confirmBeforeLoad';
const CONFIRM_RESET_KEY = 'options.confirmBeforeReset';

export function getCombatStartPaused() {
    try {
        const raw = localStorage.getItem(COMBAT_START_PAUSED_KEY);
        // Default to true (safer for new players).
        return raw === null ? true : !!JSON.parse(raw);
    } catch (e) {
        return true;
    }
}

export function getReduceMotionEnabled() {
    try {
        const raw = localStorage.getItem(REDUCE_MOTION_KEY);
        return raw === null ? false : !!JSON.parse(raw);
    } catch (e) {
        return false;
    }
}

export function getConfirmOnLoad() {
    try {
        const raw = localStorage.getItem(CONFIRM_LOAD_KEY);
        return raw === null ? true : !!JSON.parse(raw);
    } catch (e) {
        return true;
    }
}

export function getConfirmOnReset() {
    try {
        const raw = localStorage.getItem(CONFIRM_RESET_KEY);
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

    // Keep the "active" glow color in sync with the main UI glow.
    document.body.style.setProperty('--active-glow-r', r);
    document.body.style.setProperty('--active-glow-g', g);
    document.body.style.setProperty('--active-glow-b', b);

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
    // Legacy API: active glow is no longer separately configurable.
    // Keep compatibility by mapping this to the main glow color.
    setGlowColor(colorName);
}

/**
 * NEW: Sets the UI glow intensity by updating a CSS variable.
 * @param {number} intensity - The opacity value from 0 to 1.
 */
export function setGlowIntensity(intensity) {
    let raw = Number.parseFloat(intensity);
    if (!Number.isFinite(raw)) raw = 70;

    // Back-compat: older saves used 0..2. Convert roughly to 0..100.
    if (raw <= 2.0001) raw = raw * 50;

    const value = Math.max(0, Math.min(100, raw));
    const t = value / 100;

    // Smooth mapping across the full slider range (avoid the old "opacity plateaus at 1" feel).
    const opacity = 0.15 + 0.85 * t;
    const spreadMultiplier = 0.6 + 1.8 * t;

    document.body.style.setProperty('--glow-opacity', opacity);
    document.body.style.setProperty('--glow-spread-multiplier', spreadMultiplier);
    
    localStorage.setItem('glowIntensity', String(Math.round(value)));
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

	
	const glowSlider = document.getElementById('glowIntensitySlider');
    if (glowSlider) {
        // Set the slider's initial position from localStorage (defaulting to 70)
        const stored = localStorage.getItem('glowIntensity');
        let v = stored === null ? 70 : Number.parseFloat(stored);
        if (!Number.isFinite(v)) v = 70;
        if (v <= 2.0001) v = v * 50; // migrate legacy scale
        v = Math.max(0, Math.min(100, v));
        glowSlider.value = String(Math.round(v));
        // Apply immediately so opening Options reflects the real state.
        setGlowIntensity(glowSlider.value);

        glowSlider.addEventListener('input', (event) => {
            setGlowIntensity(event.target.value);
        });
    }

	// --- Reduce Motion Toggle ---
	const reduceMotionToggle = document.getElementById('reduceMotionToggle');
	if (reduceMotionToggle) {
		const enabled = getReduceMotionEnabled();
		reduceMotionToggle.checked = enabled;
		document.body.classList.toggle('reduce-motion', enabled);
		reduceMotionToggle.addEventListener('change', () => {
			const next = !!reduceMotionToggle.checked;
			try { localStorage.setItem(REDUCE_MOTION_KEY, JSON.stringify(next)); } catch (e) {}
			document.body.classList.toggle('reduce-motion', next);
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
	

    // --- Confirm before load/reset ---
    const confirmLoadToggle = document.getElementById('confirmLoadToggle');
    if (confirmLoadToggle) {
        confirmLoadToggle.checked = getConfirmOnLoad();
        confirmLoadToggle.addEventListener('change', () => {
            try { localStorage.setItem(CONFIRM_LOAD_KEY, JSON.stringify(!!confirmLoadToggle.checked)); } catch (e) {}
        });
    }

    const confirmResetToggle = document.getElementById('confirmResetToggle');
    if (confirmResetToggle) {
        confirmResetToggle.checked = getConfirmOnReset();
        confirmResetToggle.addEventListener('change', () => {
            try { localStorage.setItem(CONFIRM_RESET_KEY, JSON.stringify(!!confirmResetToggle.checked)); } catch (e) {}
        });
    }
}

// ============================================================================
// LOG SETTINGS (merged from log-options.js)
// ============================================================================

const defaultLogSettings = {
    colors: {
        [LogType.INFO]: (LOG_SWATCH_HEX.blue || '#40C4FF'),
        [LogType.SUCCESS]: (LOG_SWATCH_HEX.green || '#69F0AE'),
        [LogType.ERROR]: (LOG_SWATCH_HEX.red || '#FF5252'),
        [LogType.STORY]: (LOG_SWATCH_HEX.purple || '#AB47BC'),
        [LogType.ACTION]: (LOG_SWATCH_HEX.white || '#E0E0E0'),
        [LogType.UNLOCK]: (LOG_SWATCH_HEX.gold || '#FFD700')
    },
    filters: {
        [LogType.INFO]: false, [LogType.SUCCESS]: false,
        [LogType.ERROR]: false, [LogType.STORY]: false,
        [LogType.ACTION]: false, [LogType.UNLOCK]: false
    },
    // Default: timestamps off (cleaner / more space).
    showTimestamps: false,
    // Default: typewriter on (compact footer latest-log effect).
    typewriterMode: true
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

function normalizeHex(hex) {
    const s = String(hex || '').trim();
    if (!s) return '';
    return s.toUpperCase();
}

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
    const rows = document.querySelectorAll('#logColorsContainer .log-color-row');
    rows.forEach(row => {
        const logType = row.dataset.logType;
        const want = normalizeHex(logSettings.colors[logType]);
        const swatches = row.querySelectorAll('button.color-swatch');
        swatches.forEach(btn => {
            const key = btn.dataset.color;
            const hex = normalizeHex(LOG_SWATCH_HEX[key]);
            btn.classList.toggle('selected', !!want && !!hex && want === hex);
        });
    });

    for (const logType in logSettings.colors) {
        const exampleText = document.querySelector(`.log-filter-group[data-log-type="${logType}"] .log-filter-example`);
        if (exampleText) {
            exampleText.style.color = logSettings.colors[logType];
        }
    }
}

function renderLogColorSwatches() {
    const colorsContainer = document.getElementById('logColorsContainer');
    if (!colorsContainer) return;

    colorsContainer.innerHTML = '';

    const title = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
    const types = Object.keys(logSettings.colors || {});

    types.forEach((logType) => {
        const row = document.createElement('div');
        row.className = 'log-color-row';
        row.dataset.logType = logType;

        const label = document.createElement('div');
        label.className = 'log-color-row-label';
        label.textContent = title(logType);

        const swatches = document.createElement('div');
        swatches.className = 'log-color-swatches';

        LOG_SWATCH_KEYS.forEach((key) => {
            const hex = LOG_SWATCH_HEX[key];
            if (!hex) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-swatch';
            btn.dataset.color = key;
            btn.title = key;
            btn.addEventListener('click', () => {
                logSettings.colors[logType] = hex;
                localStorage.setItem('logSettings', JSON.stringify(logSettings));
                updateLogSettings(logSettings);
                updateAllColorUI();
                try { window.dispatchEvent(new CustomEvent('log-settings-updated')); } catch { /* ignore */ }
            });
            btn.addEventListener('mouseenter', () => updateExampleLog(logType));
            swatches.appendChild(btn);
        });

        row.appendChild(label);
        row.appendChild(swatches);
        colorsContainer.appendChild(row);
    });
}

function setupLogOptions() {
    const logOptionsBtn = document.getElementById('logOptionsBtn');
    const logOptionsMenu = document.getElementById('logOptionsMenu');
    const closeButton = logOptionsMenu?.querySelector('.log-options-close');

    logOptionsBtn?.addEventListener('click', () => {
        try { logOptionsMenu.hidden = false; } catch { /* ignore */ }
        logOptionsMenu.classList.remove('hidden');
        try { logOptionsMenu.style.display = ''; } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
        // Refresh the UI every time the popup is opened
        updateFilterButtonsUI();
        updateAllColorUI();
        updateExampleLog(LogType.INFO);

        const tsToggle = document.getElementById('logTimestampsToggle');
        if (tsToggle) tsToggle.checked = !!logSettings.showTimestamps;

        const twToggle = document.getElementById('logTypewriterToggle');
        if (twToggle) twToggle.checked = (logSettings.typewriterMode !== false);
    });
    closeButton?.addEventListener('click', () => {
        logOptionsMenu.classList.add('hidden');
        try { logOptionsMenu.hidden = true; } catch { /* ignore */ }
        try { logOptionsMenu.style.display = ''; } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
    });
    logOptionsMenu?.addEventListener('click', (e) => {
        if (e.target === logOptionsMenu) {
            logOptionsMenu.classList.add('hidden');
            try { logOptionsMenu.hidden = true; } catch { /* ignore */ }
            try { logOptionsMenu.style.display = ''; } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
        }
    });

    logSettings = JSON.parse(localStorage.getItem('logSettings')) || defaultLogSettings;
    logSettings.filters = { ...defaultLogSettings.filters, ...logSettings.filters };
    logSettings.colors = { ...defaultLogSettings.colors, ...logSettings.colors };
    logSettings.showTimestamps = (typeof logSettings.showTimestamps === 'boolean')
        ? logSettings.showTimestamps
        : !!defaultLogSettings.showTimestamps;
    logSettings.typewriterMode = (typeof logSettings.typewriterMode === 'boolean')
        ? logSettings.typewriterMode
        : !!defaultLogSettings.typewriterMode;
    updateLogSettings(logSettings);

    // Timestamps toggle
    const tsToggle = document.getElementById('logTimestampsToggle');
    if (tsToggle) {
        tsToggle.checked = !!logSettings.showTimestamps;
        tsToggle.addEventListener('change', () => {
            logSettings.showTimestamps = !!tsToggle.checked;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            try { window.dispatchEvent(new CustomEvent('log-settings-updated')); } catch { /* ignore */ }
        });
    }

    // Typewriter toggle (compact footer latest-log effect)
    const twToggle = document.getElementById('logTypewriterToggle');
    if (twToggle) {
        twToggle.checked = (logSettings.typewriterMode !== false);
        twToggle.addEventListener('change', () => {
            logSettings.typewriterMode = !!twToggle.checked;
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            try { window.dispatchEvent(new CustomEvent('log-settings-updated')); } catch { /* ignore */ }
        });
    }

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

    // Colors (swatches)
    renderLogColorSwatches();
    
    const resetColorsBtn = document.getElementById('resetLogColorsBtn');
    if (resetColorsBtn) {
        resetColorsBtn.addEventListener('click', () => {
            logSettings.colors = { ...defaultLogSettings.colors };
            localStorage.setItem('logSettings', JSON.stringify(logSettings));
            updateLogSettings(logSettings);
            updateAllColorUI();
            try { window.dispatchEvent(new CustomEvent('log-settings-updated')); } catch { /* ignore */ }
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

