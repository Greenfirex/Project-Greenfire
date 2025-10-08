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
    if (!rgb) { return; } // Exit if color is not found

    const [r, g, b] = rgb.split(', ');
    const root = document.documentElement;
    root.style.setProperty('--glow-r', r);
    root.style.setProperty('--glow-g', g);
    root.style.setProperty('--glow-b', b);

    // Save the choice
    localStorage.setItem('glowColor', colorName);
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