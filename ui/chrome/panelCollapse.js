// Panel Collapse/Expand functionality for main menu and info panel

import { isCompactPhoneLandscape } from '../mobile/compactMode.js';

let leftPanelCollapsed = false;
let rightPanelCollapsed = false;

function syncRootPanelClasses() {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle('left-panel-collapsed', leftPanelCollapsed);
    root.classList.toggle('right-panel-collapsed', rightPanelCollapsed);
}

function updateGameAreaSize() {
    const gameArea = document.getElementById('gameArea');
    if (!gameArea) return;

    gameArea.classList.remove('expanded-left', 'expanded-right', 'expanded-both');

    if (leftPanelCollapsed && rightPanelCollapsed) {
        gameArea.classList.add('expanded-both');
    } else if (leftPanelCollapsed) {
        gameArea.classList.add('expanded-left');
    } else if (rightPanelCollapsed) {
        gameArea.classList.add('expanded-right');
    }
}

function toggleMainMenuCollapse() {
    const mainMenu = document.getElementById('mainMenu');
    const btn = document.getElementById('mainMenuCollapseBtn');
    if (!mainMenu || !btn) return;

    leftPanelCollapsed = !leftPanelCollapsed;
    mainMenu.classList.toggle('collapsed', leftPanelCollapsed);
    btn.title = leftPanelCollapsed ? 'Expand menu' : 'Collapse menu';

    syncRootPanelClasses();
    
    updateGameAreaSize();
    
    // Persist state
    localStorage.setItem('mainMenuCollapsed', leftPanelCollapsed ? 'true' : 'false');
}

function toggleInfoPanelCollapse() {
    const infoPanel = document.getElementById('infoPanel');
    const btn = document.getElementById('infoPanelCollapseBtn');
    if (!infoPanel || !btn) return;

    rightPanelCollapsed = !rightPanelCollapsed;
    infoPanel.classList.toggle('collapsed', rightPanelCollapsed);
    btn.title = rightPanelCollapsed ? 'Expand info panel' : 'Collapse info panel';

    syncRootPanelClasses();
    
    updateGameAreaSize();
    
    // Persist state
    localStorage.setItem('infoPanelCollapsed', rightPanelCollapsed ? 'true' : 'false');
}

function initPanelCollapse() {
    let compact = false;
    try { compact = isCompactPhoneLandscape(); } catch { /* ignore */ }

    // Fallback: treat small-height viewports as compact even if JS detection fails
    if (!compact && window.innerHeight <= 800) {
        compact = true;
    }

    // Desktop default: always start expanded.
    // (Ignore any persisted collapse state so desktop layout is consistent.)
    if (!compact) {
        leftPanelCollapsed = false;
        rightPanelCollapsed = false;

        try {
            localStorage.setItem('mainMenuCollapsed', 'false');
            localStorage.setItem('infoPanelCollapsed', 'false');
        } catch { /* ignore */ }

        try {
            const mainMenu = document.getElementById('mainMenu');
            const infoPanel = document.getElementById('infoPanel');
            const leftBtn = document.getElementById('mainMenuCollapseBtn');
            const rightBtn = document.getElementById('infoPanelCollapseBtn');
            if (mainMenu) mainMenu.classList.remove('collapsed');
            if (infoPanel) infoPanel.classList.remove('collapsed');
            if (leftBtn) leftBtn.title = 'Collapse menu';
            if (rightBtn) rightBtn.title = 'Collapse info panel';
        } catch { /* ignore */ }

        syncRootPanelClasses();
        updateGameAreaSize();

        // Attach event listeners
        const mainMenuBtn = document.getElementById('mainMenuCollapseBtn');
        const infoPanelBtn = document.getElementById('infoPanelCollapseBtn');

        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', toggleMainMenuCollapse);
        }

        if (infoPanelBtn) {
            infoPanelBtn.addEventListener('click', toggleInfoPanelCollapse);
        }
        return;
    }

    // Restore saved state
    const mainMenuCollapsedRaw = localStorage.getItem('mainMenuCollapsed');
    const infoPanelCollapsedRaw = localStorage.getItem('infoPanelCollapsed');

    const savedMainMenuCollapsed = mainMenuCollapsedRaw === 'true';
    let savedInfoPanelCollapsed = infoPanelCollapsedRaw === 'true';

    // Phone-landscape default: collapse the right panel unless the player has already chosen otherwise.
    if (compact && infoPanelCollapsedRaw === null) {
        savedInfoPanelCollapsed = true;
        try {
            localStorage.setItem('infoPanelCollapsed', 'true');
        } catch {
            /* ignore */
        }
    }

    if (savedMainMenuCollapsed) {
        leftPanelCollapsed = true;
        const mainMenu = document.getElementById('mainMenu');
        const btn = document.getElementById('mainMenuCollapseBtn');
        if (mainMenu) mainMenu.classList.add('collapsed');
        if (btn) btn.title = 'Expand menu';
    }

    if (savedInfoPanelCollapsed) {
        rightPanelCollapsed = true;
        const infoPanel = document.getElementById('infoPanel');
        const btn = document.getElementById('infoPanelCollapseBtn');
        if (infoPanel) infoPanel.classList.add('collapsed');
        if (btn) btn.title = 'Expand info panel';
    }

    syncRootPanelClasses();
    updateGameAreaSize();

    // Attach event listeners
    const mainMenuBtn = document.getElementById('mainMenuCollapseBtn');
    const infoPanelBtn = document.getElementById('infoPanelCollapseBtn');

    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', toggleMainMenuCollapse);
    }

    if (infoPanelBtn) {
        infoPanelBtn.addEventListener('click', toggleInfoPanelCollapse);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initPanelCollapse);

// ==========================================================================
// Swipe gestures for compact mode (phone-landscape)
// ==========================================================================

let _swipeStartX = 0;
let _swipeStartY = 0;
const SWIPE_THRESHOLD = 50;   // minimum horizontal distance for swipe
const SWIPE_EDGE_ZONE = 0.20; // 20% from screen edge

function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    let compact = false;
    try { compact = isCompactPhoneLandscape(); } catch { /* ignore */ }
    if (!compact) return;
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
}

function onTouchEnd(e) {
    let compact = false;
    try { compact = isCompactPhoneLandscape(); } catch { /* ignore */ }
    if (!compact) return;
    if (!_swipeStartX) return;

    const dx = (e.changedTouches[0]?.clientX || 0) - _swipeStartX;
    const dy = (e.changedTouches[0]?.clientY || 0) - _swipeStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Must be primarily horizontal
    if (absDx < SWIPE_THRESHOLD || absDx < absDy * 1.5) return;

    const vw = window.innerWidth;
    const startFraction = _swipeStartX / vw;

    // Swipe right from left edge → expand left panel
    if (dx > 0 && startFraction < SWIPE_EDGE_ZONE) {
        if (leftPanelCollapsed) {
            e.preventDefault();
            toggleMainMenuCollapse();
        }
    }

    // Swipe left from right edge → expand right panel
    if (dx < 0 && startFraction > (1 - SWIPE_EDGE_ZONE)) {
        if (rightPanelCollapsed) {
            e.preventDefault();
            toggleInfoPanelCollapse();
        }
    }

    // Swipe left on expanded left panel → collapse
    if (dx < 0 && !leftPanelCollapsed) {
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu && !mainMenu.classList.contains('collapsed')) {
            // Only if touch started within the expanded panel
            const menuRect = mainMenu.getBoundingClientRect();
            if (_swipeStartX >= menuRect.left && _swipeStartX <= menuRect.right) {
                e.preventDefault();
                toggleMainMenuCollapse();
            }
        }
    }

    // Swipe right on expanded right panel → collapse
    if (dx > 0 && !rightPanelCollapsed) {
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel && !infoPanel.classList.contains('collapsed')) {
            const panelRect = infoPanel.getBoundingClientRect();
            if (_swipeStartX >= panelRect.left && _swipeStartX <= panelRect.right) {
                e.preventDefault();
                toggleInfoPanelCollapse();
            }
        }
    }

    _swipeStartX = 0;
    _swipeStartY = 0;
}

document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchend', onTouchEnd, { passive: false });

export { initPanelCollapse, toggleMainMenuCollapse, toggleInfoPanelCollapse };
