// A map of color names to their RGB values
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0'
};

/**
 * Sets the UI glow color by updating CSS variables.
 * @param {string} colorName - The name of the color (e.g., 'green').
 */
export function setGlowColor(colorName) {
    const rgb = colorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    const root = document.documentElement;
    root.style.setProperty('--glow-r', r);
    root.style.setProperty('--glow-g', g);
    root.style.setProperty('--glow-b', b);

    localStorage.setItem('glowColor', colorName);

    // --- NEW: Force the animation to restart ---
    const animatedElements = document.querySelectorAll('#header, #footer, #mainMenu, #infoPanel');
    animatedElements.forEach(element => {
        // Temporarily remove the animation
        element.style.animation = 'none';
        // Trigger a reflow (this is a standard trick to make the browser apply the change)
        void element.offsetWidth;
        // Re-add the animation from the stylesheet
        element.style.animation = '';
    });
}

/**
 * Initializes the options menu, including the color picker.
 */
export function initOptions() {
    const colorSwatches = document.querySelectorAll('.color-swatch');

    // ADD THIS LINE FOR DEBUGGING
    console.log('Searching for color swatches. Found:', colorSwatches.length);

    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const colorName = swatch.dataset.color;
            setGlowColor(colorName);
        });
    });
}