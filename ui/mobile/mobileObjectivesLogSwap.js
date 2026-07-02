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
} from '../../engine/objectives.js';

import { isCompactPhoneLandscape } from './compactMode.js';
import { t } from '../../locales/locales.js';

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

let lastFooterLatestText = null;
let typingTimer = null;
let typingToken = 0;

function setHiddenWithInert(el, hidden) {
    if (!el) return;
    try {
        el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    } catch { /* ignore */ }

    // Prefer `inert` to prevent focus/interaction when hidden.
    // (Supported in modern Chromium + Safari; safe to no-op if unsupported.)
    try {
        el.inert = !!hidden;
    } catch { /* ignore */ }
    try {
        if (hidden) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
    } catch { /* ignore */ }
}

function ensureFocusOutside(el, preferredFocusTarget) {
    try {
        const active = document.activeElement;
        if (!active || !el || !el.contains(active)) return;

        // Move focus to something guaranteed visible.
        if (preferredFocusTarget && typeof preferredFocusTarget.focus === 'function') {
            try { preferredFocusTarget.focus({ preventScroll: true }); }
            catch { try { preferredFocusTarget.focus(); } catch { /* ignore */ } }
        } else {
            try { document.body?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
            try { active.blur?.(); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

function prefersReducedMotion() {
    try {
        return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

function clearTypingTimer() {
    if (typingTimer) {
        clearTimeout(typingTimer);
        typingTimer = null;
    }
}

function animateFooterLatestChange(nextText, nextColor) {
    if (!footerEls.latestText) return;

    const latestEl = footerEls.latestText;
    const labelEl = latestEl.parentElement;

    // If the DOM shape isn't what we expect, fall back to a simple update.
    if (!labelEl) {
        latestEl.textContent = nextText || '—';
        try { latestEl.style.color = nextColor || ''; } catch { /* ignore */ }
        return;
    }

    // Reduced motion: no animations, no typing.
    if (prefersReducedMotion()) {
        clearTypingTimer();
        typingToken++;
        latestEl.classList.remove('footer-log-latest--incoming');
        latestEl.textContent = nextText || '—';
        try { latestEl.style.color = nextColor || ''; } catch { /* ignore */ }
        return;
    }

    const typewriterEnabled = (() => {
        try {
            return !document.body?.classList?.contains('log-typewriter-off');
        } catch {
            return true;
        }
    })();

    const currentText = (latestEl.textContent || '').trim();
    const next = (nextText || '—').trim() || '—';
    if (currentText === next) {
        try { latestEl.style.color = nextColor || ''; } catch { /* ignore */ }
        return;
    }

    // Cancel any in-flight typing.
    clearTypingTimer();
    const token = ++typingToken;

    const outgoingDurationMs = 240;

    // Create an outgoing overlay that slides up and fades.
    if (currentText) {
        try {
            const outgoing = latestEl.cloneNode(true);
            outgoing.classList.add('footer-log-latest--outgoing');
            outgoing.textContent = currentText;
            // Keep the old color while it animates out.
            try { outgoing.style.color = latestEl.style.color || ''; } catch { /* ignore */ }
            labelEl.insertBefore(outgoing, latestEl);

            const cleanup = () => {
                try { outgoing.removeEventListener('animationend', cleanup); } catch { /* ignore */ }
                try { outgoing.remove(); } catch { /* ignore */ }
            };
            outgoing.addEventListener('animationend', cleanup, { once: true });
            // Fallback cleanup if animationend doesn't fire.
            setTimeout(cleanup, outgoingDurationMs + 120);
        } catch { /* ignore */ }
    }

    // Prepare incoming text.
    latestEl.classList.remove('footer-log-latest--incoming');
    // Force a reflow so re-adding the class restarts the animation.
    try { void latestEl.offsetWidth; } catch { /* ignore */ }
    latestEl.classList.add('footer-log-latest--incoming');
    try { latestEl.style.color = nextColor || ''; } catch { /* ignore */ }

    // If typewriter is disabled, just swap the full text after the outgoing line clears.
    if (!typewriterEnabled) {
        latestEl.textContent = '';
        const startDelay = currentText ? outgoingDurationMs : 0;
        typingTimer = setTimeout(() => {
            if (token !== typingToken) return;
            latestEl.textContent = next;
            setTimeout(() => latestEl.classList.remove('footer-log-latest--incoming'), 180);
        }, startDelay);
        return;
    }

    // Typewriter effect (fast). If it's too long, set immediately.
    const maxTypeLen = 140;
    if (next.length > maxTypeLen) {
        latestEl.textContent = next;
        setTimeout(() => latestEl.classList.remove('footer-log-latest--incoming'), 220);
        return;
    }

    latestEl.textContent = '';
    const maxDurationMs = 320;
    const minDelayMs = 8;
    const maxDelayMs = 18;
    const perCharDelay = Math.max(
        minDelayMs,
        Math.min(maxDelayMs, Math.round(maxDurationMs / Math.max(1, next.length)))
    );

    const startTyping = () => {
        if (token !== typingToken) return;

        let i = 0;
        const step = () => {
            if (token !== typingToken) return;

            i++;
            latestEl.textContent = next.slice(0, i);

            if (i >= next.length) {
                typingTimer = null;
                setTimeout(() => latestEl.classList.remove('footer-log-latest--incoming'), 180);
                return;
            }

            typingTimer = setTimeout(step, perCharDelay);
        };

        step();
    };

    // Start typing only after the outgoing line has fully moved up,
    // so the new text appears on the correct row before letters begin.
    const startDelay = currentText ? outgoingDurationMs : 0;
    typingTimer = setTimeout(startTyping, startDelay);
}

function isCompactMode() {
    return !!isCompactPhoneLandscape();
}

function ensureFooterLogContainer() {
    // Always update header in case language changed
    if (footerEls.container) {
        if (footerEls.header) {
            const title = footerEls.header.querySelector('.footer-log-title');
            if (title) title.textContent = t('log_entries');
        }
        return footerEls.container;
    }

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
    setHiddenWithInert(drawer, true);

    const header = document.createElement('div');
    header.className = 'footer-log-header';

    const headerTitle = document.createElement('h4');
    headerTitle.className = 'footer-log-title';
    headerTitle.textContent = t('log_entries');
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
        const willOpen = !!nextOpen;
        if (!willOpen) {
            // Avoid Chrome a11y warning: don't aria-hide a focused subtree.
            ensureFocusOutside(drawer, banner);
        }

        drawer.classList.toggle('open', willOpen);
        banner.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        setHiddenWithInert(drawer, !willOpen);
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
        header,
        setOpen
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
        lastFooterLatestText = '—';
        footerEls.latestText.textContent = '—';
        return;
    }

    // Read _fullText (set by typewriter before clearing) so we get the full
    // text even while the typewriter is mid-animation.
    const text = (last._fullText || last.textContent || '').trim();
    const baseText = text || '—';

    // If timestamps are enabled, include them in the footer preview too.
    let nextText = baseText;
    try {
        const showTs = document.body?.classList?.contains('log-timestamps-on');
        const t = last?.dataset?.time;
        if (showTs && t) nextText = `[${t}] ${baseText}`;
    } catch { /* ignore */ }

    let nextColor = '';
    try { nextColor = last.style?.color || ''; } catch { /* ignore */ }

    // Avoid reanimating the same string when unrelated mutations occur.
    if (lastFooterLatestText === nextText) {
        try { footerEls.latestText.style.color = nextColor || ''; } catch { /* ignore */ }
        return;
    }

    lastFooterLatestText = nextText;
    animateFooterLatestChange(nextText, nextColor);
}

// Refresh the footer preview when log settings change (e.g., timestamps toggled).
try {
    window.addEventListener('log-settings-updated', () => {
        if (!isActive) return;
        updateFooterLatestFromLog();
    });
} catch { /* ignore */ }

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
    if (typeof footerEls.setOpen === 'function') {
        footerEls.setOpen(false);
        return;
    }

    // Fallback: maintain old behavior, but still try to keep focus safe.
    ensureFocusOutside(footerEls.drawer, footerEls.banner);
    footerEls.drawer.classList.remove('open');
    footerEls.banner.setAttribute('aria-expanded', 'false');
    setHiddenWithInert(footerEls.drawer, true);
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
