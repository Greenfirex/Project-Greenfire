// Panel Collapse/Expand functionality for main menu and info panel

let leftPanelCollapsed = false;
let rightPanelCollapsed = false;

function syncRootPanelClasses() {
    const root = document.documentElement;
    if (!root) return;

    root.classList.toggle('left-panel-collapsed', leftPanelCollapsed);
    root.classList.toggle('right-panel-collapsed', rightPanelCollapsed);
}

function isCompactPhoneLandscape() {
    try {
        return window.matchMedia('(max-width: 600px), (max-width: 900px) and (max-height: 450px)').matches;
    } catch {
        return false;
    }
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
    // Restore saved state
    const mainMenuCollapsedRaw = localStorage.getItem('mainMenuCollapsed');
    const infoPanelCollapsedRaw = localStorage.getItem('infoPanelCollapsed');

    const savedMainMenuCollapsed = mainMenuCollapsedRaw === 'true';
    let savedInfoPanelCollapsed = infoPanelCollapsedRaw === 'true';

    // Phone-landscape default: collapse the right panel unless the player has already chosen otherwise.
    if (isCompactPhoneLandscape() && infoPanelCollapsedRaw === null) {
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

export { initPanelCollapse, toggleMainMenuCollapse, toggleInfoPanelCollapse };
