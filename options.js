import { setNotation } from './formatting.js';

// A single, unified map for all color options
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    white:  '224, 224, 224',
    black:  '0, 0, 0'
};

let runInBackground = true;
let glowEffectsEnabled = true;

export function shouldRunInBackground() {
    return runInBackground;
}

/**
 * Sets the main UI glow color.
 */
export function setGlowColor(colorName) {
    const rgb = colorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    document.body.style.setProperty('--glow-r', r);
    document.body.style.setProperty('--glow-g', g);
    document.body.style.setProperty('--glow-b', b);

    localStorage.setItem('glowColor', colorName);
    
    // Restart animation logic...
    const animatedElements = document.querySelectorAll('#header, #footer, #mainMenu, #infoPanel, #mainContainer');
    animatedElements.forEach(element => {
        element.style.animation = 'none';
        void element.offsetWidth;
        element.style.animation = '';
    });
}

/**
 * Sets the active menu button glow color.
 */
export function setActiveGlowColor(colorName) {
    const rgb = colorMap[colorName]; // MODIFIED: Uses the single colorMap
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    document.body.style.setProperty('--active-glow-r', r);
    document.body.style.setProperty('--active-glow-g', g);
    document.body.style.setProperty('--active-glow-b', b);

    localStorage.setItem('activeGlowColor', colorName);
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
	
	// --- Save Management ---
    const exportBtn = document.getElementById('exportSaveButton');
    const importBtn = document.getElementById('importSaveButton');
    const importText = document.getElementById('importSaveText');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const saveData = localStorage.getItem('gameState');
            if (saveData) {
                navigator.clipboard.writeText(saveData).then(() => {
                    exportBtn.textContent = 'Copied!';
                    setTimeout(() => { exportBtn.textContent = 'Export to Clipboard'; }, 2000);
                });
            }
        });
    }

    if (importBtn && importText) {
        importBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to import this save? It will overwrite your current progress.')) {
                try {
                    // Test if the save data is valid JSON
                    JSON.parse(importText.value);
                    localStorage.setItem('gameState', importText.value);
                    location.reload();
                } catch (e) {
                    alert('Invalid save data!');
                }
            }
        });
    }
}


