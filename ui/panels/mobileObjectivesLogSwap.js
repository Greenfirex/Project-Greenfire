// Mobile (phone-landscape) UX:
// - Footer middle column shows latest log entry + a drawer with log history
// - Left slide-out menu shows current objective + steps (instead of log)
// Desktop layout remains unchanged.

import {
    getVisibleObjectives,
    recomputeObjectives,
    getObjectiveSteps,
    getTrackedObjectiveId,
    getAllObjectivesWithState
} from '../../data/objectives.js';

import { isCompactPhoneLandscape } from '../compactMode.js';

const BODY_CLASS = 'mobile-log-footer-swap';

let compactMql = null;
let isActive = false;

let footerEls = {
    container: null,
    banner: null,
    latestText: null,
    drawer: null,
    drawerHost: null,
    header: null
};

let menuEls = {
    container: null,
    title: null,
    steps: null
};

let logObserver = null;
let menuClassObserver = null;
let objectivesRefreshTimer = null;
let outsidePointerDownHandler = null;

function isCompactMode() {
    return !!isCompactPhoneLandscape();
}

function ensureFooterLogContainer() {
    if (footerEls.container) return footerEls.container;

    const midCol = document.querySelector('#footer .footer-column:nth-child(2)');
    if (!midCol) return null;

    const wrapper = document.createElement('div');
    wrapper.id = 'footerLogContainer';
    wrapper.className = 'footer-log-container';

    const banner = document.createElement('div');
    banner.id = 'footerLogBanner';
    banner.className = 'footer-log-banner';
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.setAttribute('aria-expanded', 'false');
    banner.title = 'Show log history';
    banner.innerHTML = `
        <span class="chevrons" aria-hidden="true">
            <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
            </svg>
        </span>
        <span class="footer-log-label"><em class="footer-log-latest">—</em></span>
    `;

    const drawer = document.createElement('div');
    drawer.id = 'footerLogDrawer';
    drawer.className = 'footer-log-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'footer-log-header';

    const headerTitle = document.createElement('h4');
    headerTitle.className = 'footer-log-title';
    headerTitle.textContent = 'Log entries:';
    header.appendChild(headerTitle);

    const host = document.createElement('div');
    host.id = 'footerLogDrawerHost';
    host.className = 'footer-log-drawer-host';

    drawer.appendChild(header);
    drawer.appendChild(host);

    const glowLeft = document.createElement('div');
    glowLeft.className = 'glow-vert glow-left';
    const glowRight = document.createElement('div');
    glowRight.className = 'glow-vert glow-right';
    drawer.appendChild(glowLeft);
    drawer.appendChild(glowRight);

    wrapper.appendChild(banner);
    wrapper.appendChild(drawer);
    midCol.appendChild(wrapper);

    function setOpen(nextOpen) {
        drawer.classList.toggle('open', !!nextOpen);
        banner.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        drawer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
        if (nextOpen) {
            // Ensure the log stays scrolled to bottom when opened.
            try {
                const logContent = document.getElementById('logContent');
                if (logContent) logContent.scrollTop = logContent.scrollHeight;
            } catch { /* ignore */ }
        }
    }

    function toggleOpen() {
        const nextOpen = !drawer.classList.contains('open');
        setOpen(nextOpen);
    }

    banner.addEventListener('click', toggleOpen);
    banner.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
        }
    });

    footerEls = {
        container: wrapper,
        banner,
        latestText: banner.querySelector('.footer-log-latest'),
        drawer,
        drawerHost: host,
        header
    };

    return wrapper;
}

function ensureMobileObjectivesContainer() {
    if (menuEls.container) return menuEls.container;

    const mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return null;

    const anchor = mainMenu.querySelector('.menu-buttons-container');
    const wrapper = document.createElement('div');
    wrapper.id = 'mobileObjectivesMenu';
    wrapper.className = 'mobile-objectives-menu';

    const title = document.createElement('div');
    title.className = 'mobile-objectives-title';
    title.innerHTML = `Objective: <em class="mobile-objectives-current">—</em>`;

    const steps = document.createElement('div');
    steps.className = 'mobile-objectives-steps';

    wrapper.appendChild(title);
    wrapper.appendChild(steps);

    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement('afterend', wrapper);
    } else {
        mainMenu.appendChild(wrapper);
    }

    menuEls = {
        container: wrapper,
        title,
        steps
    };

    return wrapper;
}

function moveLogOptionsButtonIntoDrawerHeader() {
    const btn = document.getElementById('logOptionsBtn');
    if (!btn) return;
    if (!footerEls.header) return;
    if (btn.parentElement === footerEls.header) return;
    footerEls.header.appendChild(btn);
}

function pickCurrentObjective() {
    const trackedId = getTrackedObjectiveId();

    if (trackedId) {
        const allObjectives = getAllObjectivesWithState();
        const tracked = allObjectives.find(o => o && o.id === trackedId && o.state === 'active');
        if (tracked) return tracked;
    }

    const items = getVisibleObjectives(5);
    const activeFirst = items.find(i => i && !i.completed);
    return activeFirst || items[0] || null;
}

function renderMobileObjectives() {
    if (!menuEls.container) return;

    try { recomputeObjectives(); } catch { /* non-fatal */ }

    const current = pickCurrentObjective();
    const currentTextEl = menuEls.title?.querySelector('.mobile-objectives-current');
    if (currentTextEl) currentTextEl.textContent = current ? current.label : '—';

    if (!menuEls.steps) return;
    menuEls.steps.innerHTML = '';

    if (!current) return;
    const steps = getObjectiveSteps(current.id) || [];

    if (!Array.isArray(steps) || steps.length === 0) {
        const p = document.createElement('div');
        p.className = 'mobile-objectives-empty';
        p.textContent = 'No detailed steps available.';
        menuEls.steps.appendChild(p);
        return;
    }

    const list = document.createElement('ul');
    list.className = 'mobile-objectives-steps-list';

    steps.forEach(step => {
        const li = document.createElement('li');
        li.className = 'mobile-objectives-step';
        if (step?.done) li.classList.add('done');

        const marker = document.createElement('span');
        marker.className = 'step-marker';
        marker.textContent = step?.done ? '✓' : '•';

        const label = document.createElement('span');
        label.className = 'step-label';
        label.textContent = String(step?.label || '') + (step?.progress && !step?.done ? ` (${step.progress})` : '');

        li.appendChild(marker);
        li.appendChild(label);
        list.appendChild(li);
    });

    menuEls.steps.appendChild(list);
}

function startObjectivesRefreshWhileMenuOpen() {
    stopObjectivesRefresh();

    const mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return;
    if (mainMenu.classList.contains('collapsed')) return;

    renderMobileObjectives();
    objectivesRefreshTimer = setInterval(() => {
        const mm = document.getElementById('mainMenu');
        if (!mm || mm.classList.contains('collapsed') || !isActive) {
            stopObjectivesRefresh();
            return;
        }
        renderMobileObjectives();
    }, 750);
}

function stopObjectivesRefresh() {
    if (objectivesRefreshTimer) {
        clearInterval(objectivesRefreshTimer);
        objectivesRefreshTimer = null;
    }
}

function updateFooterLatestFromLog() {
    if (!footerEls.latestText) return;

    const logContent = document.getElementById('logContent');
    if (!logContent) {
        footerEls.latestText.textContent = '—';
        return;
    }

    const last = logContent.lastElementChild;
    if (!last) {
        footerEls.latestText.textContent = '—';
        return;
    }

    const text = (last.textContent || '').trim();
    footerEls.latestText.textContent = text || '—';

    try {
        const color = last.style?.color;
        footerEls.latestText.style.color = color || '';
    } catch { /* ignore */ }
}

function installLogObserver() {
    if (logObserver) return;

    const logContent = document.getElementById('logContent');
    if (!logContent) return;

    logObserver = new MutationObserver(() => {
        updateFooterLatestFromLog();
    });

    logObserver.observe(logContent, { childList: true, subtree: false });
}

function uninstallLogObserver() {
    if (logObserver) {
        try { logObserver.disconnect(); } catch { /* ignore */ }
        logObserver = null;
    }
}

function moveLogSectionIntoFooter() {
    const logSection = document.getElementById('logSection');
    if (!logSection) return;

    ensureFooterLogContainer();
    if (!footerEls.drawerHost) return;

    // Avoid reparenting if already moved.
    if (logSection.parentElement === footerEls.drawerHost) return;

    footerEls.drawerHost.appendChild(logSection);

    // Use the footer drawer header as the single visible header.
    moveLogOptionsButtonIntoDrawerHeader();

    // Ensure latest is correct after move.
    updateFooterLatestFromLog();
    installLogObserver();
}

function moveLogSectionBackToMenu() {
    const logSection = document.getElementById('logSection');
    const mainMenu = document.getElementById('mainMenu');
    if (!logSection || !mainMenu) return;

    const anchor = mainMenu.querySelector('.menu-buttons-container');
    if (anchor && anchor.parentElement) {
        anchor.insertAdjacentElement('afterend', logSection);
    } else {
        mainMenu.appendChild(logSection);
    }
}

function closeFooterDrawer() {
    if (!footerEls.drawer || !footerEls.banner) return;
    footerEls.drawer.classList.remove('open');
    footerEls.banner.setAttribute('aria-expanded', 'false');
    footerEls.drawer.setAttribute('aria-hidden', 'true');
}

function ensureOutsideTapToClose() {
    if (outsidePointerDownHandler) return;
    outsidePointerDownHandler = (e) => {
        if (!isActive) return;
        if (!footerEls.drawer || !footerEls.banner) return;
        if (!footerEls.drawer.classList.contains('open')) return;

        const target = e.target;
        if (!target) return;

        // Ignore taps on the banner or inside the drawer.
        if (footerEls.banner.contains(target)) return;
        if (footerEls.drawer.contains(target)) return;

        closeFooterDrawer();
    };

    // Capture so we close before other handlers if needed.
    document.addEventListener('pointerdown', outsidePointerDownHandler, true);
}

function removeOutsideTapToClose() {
    if (!outsidePointerDownHandler) return;
    document.removeEventListener('pointerdown', outsidePointerDownHandler, true);
    outsidePointerDownHandler = null;
}

function installMenuOpenObserver() {
    if (menuClassObserver) return;

    const mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return;

    menuClassObserver = new MutationObserver(() => {
        if (!isActive) return;
        if (mainMenu.classList.contains('collapsed')) {
            stopObjectivesRefresh();
        } else {
            startObjectivesRefreshWhileMenuOpen();
        }
    });

    menuClassObserver.observe(mainMenu, { attributes: true, attributeFilter: ['class'] });
}

function uninstallMenuOpenObserver() {
    if (menuClassObserver) {
        try { menuClassObserver.disconnect(); } catch { /* ignore */ }
        menuClassObserver = null;
    }
}

function enterCompactMode() {
    if (isActive) return;

    ensureFooterLogContainer();
    ensureMobileObjectivesContainer();

    document.body.classList.add(BODY_CLASS);
    isActive = true;

    moveLogSectionIntoFooter();
    updateFooterLatestFromLog();

    ensureOutsideTapToClose();

    installMenuOpenObserver();

    // Render objectives immediately if menu is open.
    startObjectivesRefreshWhileMenuOpen();
}

function exitCompactMode() {
    if (!isActive) return;

    isActive = false;
    document.body.classList.remove(BODY_CLASS);

    stopObjectivesRefresh();
    uninstallMenuOpenObserver();

    // Put the log back where it started.
    moveLogSectionBackToMenu();
    uninstallLogObserver();

    removeOutsideTapToClose();

    // Close footer drawer if it exists.
    closeFooterDrawer();
}

function syncForCurrentMode() {
    if (isCompactMode()) enterCompactMode();
    else exitCompactMode();
}

function init() {
    syncForCurrentMode();

    // React to centralized compact-mode changes.
    try {
        window.addEventListener('compactmodechange', () => syncForCurrentMode());
    } catch { /* ignore */ }

    // Fallback: some environments might miss the event.
    try {
        window.addEventListener('resize', () => syncForCurrentMode(), { passive: true });
        window.addEventListener('orientationchange', () => syncForCurrentMode(), { passive: true });
        window.visualViewport?.addEventListener('resize', () => syncForCurrentMode(), { passive: true });
    } catch { /* ignore */ }

    // Keep objectives text in sync with model changes.
    window.addEventListener('objectivesChanged', () => {
        if (!isActive) return;
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu && !mainMenu.classList.contains('collapsed')) {
            renderMobileObjectives();
        }
    });

    window.addEventListener('game-state-applied', () => {
        if (!isActive) return;
        updateFooterLatestFromLog();
        renderMobileObjectives();
    });

    window.addEventListener('gameReset', () => {
        if (!isActive) return;
        updateFooterLatestFromLog();
        renderMobileObjectives();
    });

    window.addEventListener('game-resume', () => {
        if (!isActive) return;
        updateFooterLatestFromLog();
        renderMobileObjectives();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
