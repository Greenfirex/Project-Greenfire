// A map for the main UI glow
const colorMap = {
    green:  '105, 240, 174',
    blue:   '64, 196, 255',
    purple: '171, 71, 188',
    gold:   '255, 215, 0',
    white:  '224, 224, 224',
    black:  '0, 0, 0'
};

// NEW: A separate map for the active button glow
const activeColorMap = {
    white:  '255, 255, 255',
    cyan:   '0, 188, 212',
    lime:   '205, 220, 57',
    red:    '244, 67, 54'
};

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

export function setActiveGlowColor(colorName) {
    const rgb = activeColorMap[colorName];
    if (!rgb) { return; }

    const [r, g, b] = rgb.split(', ');
    const root = document.body;
    root.style.setProperty('--active-glow-r', r);
    root.style.setProperty('--active-glow-g', g);
    root.style.setProperty('--active-glow-b', b);

    localStorage.setItem('activeGlowColor', colorName);
}

export function initOptions() {
    // Setup for main UI glow
    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            setGlowColor(swatch.dataset.color);
        });
    });

    // NEW: Setup for active button glow
    const activeColorSwatches = document.querySelectorAll('.color-swatch-active');
    activeColorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            setActiveGlowColor(swatch.dataset.color);
        });
    });
}