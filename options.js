// A single, unified map for all color options
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    white:  '224, 224, 224',
    black:  '0, 0, 0'
};

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
}
