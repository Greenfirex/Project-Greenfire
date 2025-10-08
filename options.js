// A map of color names to their RGB values
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    white:  '224, 224, 224', // ADD THIS
    black:  '0, 0, 0'          // ADD THIS
};

/**
 * Sets the UI glow color by updating CSS variables.
 * @param {string} colorName - The name of the color (e.g., 'green').
 */
export function setGlowColor(colorName) {
    const rgb = colorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    // FIXED: Target document.body instead of document.documentElement
    const root = document.body; 
    root.style.setProperty('--glow-r', r);
    root.style.setProperty('--glow-g', g);
    root.style.setProperty('--glow-b', b);

    localStorage.setItem('glowColor', colorName);

    // --- Force the animation to restart on all glowing elements ---
    // FIXED: Added #mainContainer to restart the separator line animations
    const animatedElements = document.querySelectorAll('#header, #footer, #mainMenu, #infoPanel, #mainContainer');
    
    animatedElements.forEach(element => {
        // Temporarily remove the animation
        element.style.animation = 'none';
        // Trigger a browser reflow (a standard trick)
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