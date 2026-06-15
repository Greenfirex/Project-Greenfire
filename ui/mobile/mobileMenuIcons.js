// Mobile quick section navigation icons
// - Shows a vertical icon rail when the left menu (#mainMenu) is collapsed
// - Mirrors the existing unlocked menu buttons so players can switch sections without expanding

import { isCompactPhoneLandscape as isCompactPhoneLandscapeShared } from './compactMode.js';
import { characterState, getUnspentStatPoints } from '../../sections/character/character.js';
import { resources } from '../../engine/resources.js';

// --- Stubs for systems moved to backup during refactor ---
const jobs = [];
const buildings = [];
const allActions = [];
const gameFlags = {};

function isCompactPhoneLandscape() {
    return !!isCompactPhoneLandscapeShared();
}

function abbrevFromLabel(label) {
    const s = String(label || '').trim();
    if (!s) return '?';

    const words = s.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    const letters = s.replace(/[^a-zA-Z0-9]/g, '');
    if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
    return letters.slice(0, 1).toUpperCase();
}

function svgForSection(sectionId) {
        // Inline SVG icons (stroke-based, uses currentColor)
        // Keep them tiny/simple; these are constants (no user input).
        const icons = {
                locationsSection: `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
</svg>`,
                craftingSection: `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 21V10l6 3V10l6 3V10l6 3v8H3z" />
    <path d="M7 21v-4" />
    <path d="M11 21v-4" />
    <path d="M15 21v-4" />
</svg>`,
                characterSection: `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
</svg>`,
                journalSection: `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 4h10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2V6a2 2 0 0 1 2-2z" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
</svg>`
        };

        return icons[sectionId] || '';
}

function ensureRail(mainMenu) {
    if (!mainMenu) return null;
    let rail = mainMenu.querySelector('.mobile-menu-icons');
    if (!rail) {
        rail = document.createElement('div');
        rail.className = 'mobile-menu-icons';
        rail.setAttribute('role', 'navigation');
        rail.setAttribute('aria-label', 'Quick section navigation');
        // Keep it above the rotated label and other chrome.
        mainMenu.appendChild(rail);
    }
    return rail;
}

function ensurePopover() {
    let pop = document.querySelector('.mobile-menu-popover');
    if (!pop) {
        pop = document.createElement('div');
        pop.className = 'mobile-menu-popover';
        pop.setAttribute('role', 'menu');
        pop.setAttribute('aria-hidden', 'true');
        document.body.appendChild(pop);
    }
    return pop;
}

let _openPopoverFor = null;

function closePopover() {
    const pop = document.querySelector('.mobile-menu-popover');
    if (!pop) return;
    pop.innerHTML = '';
    pop.style.display = 'none';
    pop.setAttribute('aria-hidden', 'true');
    if (_openPopoverFor) {
        try { _openPopoverFor.setAttribute('aria-expanded', 'false'); } catch { /* ignore */ }
    }
    _openPopoverFor = null;
}

function openPopover(anchorButton, items) {
    const pop = ensurePopover();

    // Toggle behavior
    if (_openPopoverFor === anchorButton && pop.style.display !== 'none') {
        closePopover();
        return;
    }

    pop.innerHTML = '';
    for (const item of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mobile-menu-popover-item';
        btn.setAttribute('role', 'menuitem');

        const labelSpan = document.createElement('span');
        labelSpan.className = 'mobile-menu-popover-item-label';
        labelSpan.textContent = item.label;
        btn.appendChild(labelSpan);

        if (item.hasWarn) {
            const badge = document.createElement('span');
            badge.className = 'action-new-badge';
            badge.textContent = '!';
            badge.setAttribute('aria-hidden', 'true');
            btn.appendChild(badge);
        }

        btn.disabled = !!item.disabled;
        if (item.disabled && item.disabledReason) btn.title = item.disabledReason;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (btn.disabled) return;
            closePopover();
            try { item.onSelect?.(); } catch { /* ignore */ }
        });
        pop.appendChild(btn);
    }

    // Position near the anchor, but never under the header.
    const r = anchorButton.getBoundingClientRect();
    const header = document.getElementById('header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0;

    const padding = 8;
    let left = Math.round(r.right + padding);
    let top = Math.round(Math.max(r.top - 6, headerBottom + 6));

    pop.style.display = 'flex';
    pop.setAttribute('aria-hidden', 'false');

    // After it has size, clamp into viewport.
    const pr = pop.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (left + pr.width > vw - 6) left = Math.max(6, vw - pr.width - 6);
    if (top + pr.height > vh - 6) top = Math.max(headerBottom + 6, vh - pr.height - 6);

    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;

    _openPopoverFor = anchorButton;
    try { anchorButton.setAttribute('aria-expanded', 'true'); } catch { /* ignore */ }
}

function getCharacterTabWarnMeta() {
    let gearWarn = false;
    let statsWarn = false;

    try {
        gearWarn = !!(characterState && Array.isArray(characterState.bagUiNew) && characterState.bagUiNew.some(v => !!v));
    } catch { gearWarn = false; }

    try {
        const xp = Array.isArray(resources) ? resources.find(r => r && r.name === 'XP') : null;
        const totalXp = xp ? Number(xp.amount) : 0;
        const unspent = getUnspentStatPoints(totalXp, characterState);
        statsWarn = unspent > 0;
    } catch { statsWarn = false; }

    return { gearWarn, statsWarn };
}

function getCrashSiteCampTabWarnMeta() {
    // This badge is for the Crash Site > Campsite tab (not the standalone Colony section).
    // Show it when there are idle workers to assign OR newly-unlocked camp buildings/upgrades.
    let idleWarn = false;
    let newBuildingWarn = false;
    let newUpgradeWarn = false;

    try {
        const lm = characterState?.localMap;
        const isCampsiteUnlocked = !!(lm && lm.baseCampEstablished === true);
        if (!isCampsiteUnlocked) return { campWarn: false };

        let survivors = Array.isArray(resources) ? resources.find(r => r && r.name === 'Survivors') : null;
        if (!survivors) survivors = Array.isArray(resources) ? resources.find(r => r && r.name === 'Crew Members') : null;
        const survivorsCount = survivors ? Math.max(0, Math.floor(Number(survivors.amount) || 0)) : 0;
        const totalAssigned = Array.isArray(jobs) ? jobs.reduce((sum, j) => sum + (j?.assigned || 0), 0) : 0;
        const idle = Math.max(0, survivorsCount - totalAssigned);
        idleWarn = idle > 0;
    } catch { idleWarn = false; }

    try {
        // Campsite shows a small subset of "site" buildings before Colony unlock.
        const SITE_BUILDING_NAMES = ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'];
        newBuildingWarn = Array.isArray(buildings)
            && buildings.some(b => b && b.uiNew && b.isUnlocked === true && SITE_BUILDING_NAMES.includes(b.name));
    } catch { newBuildingWarn = false; }

    try {
        newUpgradeWarn = Array.isArray(allActions)
            && allActions.some(a => a && a.uiNew && a.isUnlocked === true && a.category === 'Upgrade');
    } catch { newUpgradeWarn = false; }

    return { campWarn: !!(idleWarn || newBuildingWarn || newUpgradeWarn) };
}

function selectCrashSiteTab(tabKey) {
    const wanted = tabKey === 'camp' ? 'camp' : 'map';

    // Ensure Locations section is active first.
    const locationsBtn = document.querySelector('#mainMenu .menu-button[data-section="locationsSection"]');
    if (locationsBtn) locationsBtn.click();

    // Tab buttons are built by setupCrashSiteSection(); give it a frame.
    let attempts = 0;
    const tryClick = () => {
        attempts++;
        const host = document.getElementById('locationsSection');
        const tab = host ? host.querySelector(`.location-tab[data-tab="${CSS.escape(wanted)}"]`) : null;
        if (tab) {
            if (tab.disabled) return;
            tab.click();
            return;
        }
        if (attempts < 8) {
            requestAnimationFrame(tryClick);
        }
    };
    requestAnimationFrame(tryClick);
}

function getCraftingTabMeta() {
    return {
        craftingLabel: 'Crafting'
    };
}

function selectCraftingTab(tabKey) {
    closePopover();
    try { localStorage.setItem('craftingActiveTab', String(tabKey)); } catch { /* ignore */ }

    const btn = document.querySelector('#mainMenu .menu-button[data-section="craftingSection"]');
    if (btn) btn.click();

    try {
        const sectionEl = document.getElementById('craftingSection');
        if (sectionEl) sectionEl.dataset.craftingActiveTab = String(tabKey);
        if (typeof window !== 'undefined' && typeof window.setupCraftingSection === 'function' && sectionEl) {
            window.setupCraftingSection(sectionEl);
        }
    } catch { /* ignore */ }
}

function getLocationTabMeta() {
    const host = document.getElementById('locationsSection');
    const campTab = host ? host.querySelector('.location-tab[data-tab="camp"]') : null;
    const mapTab = host ? host.querySelector('.location-tab[data-tab="map"]') : null;

    const mapLabel = mapTab ? (mapTab.textContent || 'Local map').trim() : 'Local map';

    let campLabel = 'Campsite';
    let campDisabled = false;
    if (campTab) {
        campDisabled = !!campTab.disabled;
        const labelEl = campTab.querySelector('.location-tab-label');
        campLabel = (labelEl ? labelEl.textContent : campTab.textContent || 'Campsite').trim();
    }

    return {
        mapLabel,
        campLabel: campLabel || (campDisabled ? '???' : 'Campsite'),
        campDisabled
    };
}

function selectJournalTab(tabKey) {
    const wanted = tabKey === 'journal' ? 'journal' : 'objectives';

    // Persist desired tab on the section element so setupJournalSection (which re-runs on show)
    // can initialize the correct pane without a flash.
    try {
        const sectionEl = document.getElementById('journalSection');
        if (sectionEl) sectionEl.dataset.journalActiveTab = wanted;
    } catch { /* ignore */ }

    // Ensure Journal section is active first.
    const journalBtn = document.querySelector('#mainMenu .menu-button[data-section="journalSection"]');
    if (journalBtn) journalBtn.click();

    // Tab buttons are rebuilt by setupJournalSection(); only click after the re-render.
    let attempts = 0;
    const tryClick = () => {
        attempts++;
        const host = document.getElementById('journalSection');
        const tab = host ? host.querySelector(`.journal-tab[data-tab="${CSS.escape(wanted)}"]`) : null;
        if (tab) {
            if (tab.disabled) return;
            tab.click();
            return;
        }
        if (attempts < 8) {
            requestAnimationFrame(tryClick);
        }
    };
    requestAnimationFrame(tryClick);
}

function selectCharacterTab(tabKey) {
    const wanted = tabKey === 'stats' ? 'stats' : 'gear';

    // Persist desired tab so setupCharacterSection can initialize without flashing.
    try {
        const sectionEl = document.getElementById('characterSection');
        if (sectionEl) sectionEl.dataset.characterActiveTab = wanted;
    } catch { /* ignore */ }

    // Ensure Character section is active first.
    const characterBtn = document.querySelector('#mainMenu .menu-button[data-section="characterSection"]');
    if (characterBtn) characterBtn.click();

    // Tab buttons are built by setupCharacterSection(); only click after the re-render.
    let attempts = 0;
    const tryClick = () => {
        attempts++;
        const host = document.getElementById('characterSection');
        const tab = host ? host.querySelector(`.character-tab[data-tab="${CSS.escape(wanted)}"]`) : null;
        if (tab) {
            if (tab.disabled) return;
            tab.click();
            return;
        }
        if (attempts < 8) requestAnimationFrame(tryClick);
    };
    requestAnimationFrame(tryClick);
}

function getJournalTabMeta() {
    const host = document.getElementById('journalSection');
    const objectivesTab = host ? host.querySelector('.journal-tab[data-tab="objectives"]') : null;
    const journalTab = host ? host.querySelector('.journal-tab[data-tab="journal"]') : null;

    const objectivesLabel = objectivesTab ? (objectivesTab.textContent || 'Objectives').trim() : 'Objectives';
    const journalLabel = journalTab ? (journalTab.textContent || 'Journal').trim() : 'Journal';

    return {
        objectivesLabel,
        journalLabel,
        objectivesDisabled: !objectivesTab,
        journalDisabled: !journalTab
    };
}

function readMenuButtons() {
    const container = document.querySelector('#mainMenu .menu-buttons-container');
    if (!container) return [];

    const buttons = Array.from(container.querySelectorAll('.menu-button[data-section]'));
    return buttons
        .filter(btn => !btn.classList.contains('hidden'))
        .map(btn => {
            const sectionId = btn.getAttribute('data-section');
            const labelEl = btn.querySelector('.menu-button-label');
            const label = labelEl ? labelEl.textContent : (btn.textContent || '').trim();
            const warnEl = btn.querySelector('.menu-button-warning');
            const hasWarn = !!(warnEl && !warnEl.classList.contains('is-hidden'));
            const isActive = btn.classList.contains('active');
            return { sectionId, label, hasWarn, isActive };
        })
        .filter(x => !!x.sectionId);
}

function renderRail() {
    const mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return;

    const rail = ensureRail(mainMenu);
    if (!rail) return;

    // Only do work in compact mode (landscape phones). CSS also gates visibility,
    // but this avoids unnecessary observers doing heavy work on desktop.
    if (!isCompactPhoneLandscape()) {
        rail.innerHTML = '';
        return;
    }

    const items = readMenuButtons();

    rail.innerHTML = '';
    for (const item of items) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mobile-menu-icon-btn';
        if (item.isActive) b.classList.add('active');
        b.dataset.section = item.sectionId;
        b.setAttribute('aria-label', item.label || item.sectionId);
        b.title = item.label || '';

        const svg = svgForSection(item.sectionId);
        const iconWrap = document.createElement('span');
        iconWrap.className = 'mobile-menu-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        if (svg) {
            iconWrap.innerHTML = svg;
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'mobile-menu-icon-text';
            fallback.textContent = abbrevFromLabel(item.label);
            iconWrap.appendChild(fallback);
        }
        b.appendChild(iconWrap);

        if (item.hasWarn) {
            const badge = document.createElement('span');
            badge.className = 'mobile-menu-icon-badge';
            badge.textContent = '!';
            badge.setAttribute('aria-hidden', 'true');
            b.appendChild(badge);
        }

        b.addEventListener('click', (e) => {
            e.preventDefault();

            // Locations section has no tabs now.
            if (item.sectionId === 'locationsSection') {
                const btn = document.querySelector('#mainMenu .menu-button[data-section="locationsSection"]');
                if (btn) btn.click();
                return;
            }

            // Journal has in-section tabs (Objectives / Journal). In compact mode we hide the tabs
            // to free space and provide switching via the same popover mechanic as Crash Site.
            if (item.sectionId === 'journalSection') {
                const meta = getJournalTabMeta();
                openPopover(b, [
                    {
                        label: meta.objectivesLabel || 'Objectives',
                        disabled: !!meta.objectivesDisabled,
                        disabledReason: meta.objectivesDisabled ? 'Unavailable' : '',
                        onSelect: () => selectJournalTab('objectives')
                    },
                    {
                        label: meta.journalLabel || 'Journal',
                        disabled: !!meta.journalDisabled,
                        disabledReason: meta.journalDisabled ? 'Unavailable' : '',
                        onSelect: () => selectJournalTab('journal')
                    }
                ]);
                return;
            }

            // Character now has in-section tabs (Gear / Stats). In compact mode we use
            // the same popover mechanic as Crash Site + Journal.
            if (item.sectionId === 'characterSection') {
                const meta = getCharacterTabWarnMeta();
                openPopover(b, [
                    { label: 'Gear', hasWarn: !!meta.gearWarn, onSelect: () => selectCharacterTab('gear') },
                    { label: 'Stats', hasWarn: !!meta.statsWarn, onSelect: () => selectCharacterTab('stats') }
                ]);
                return;
            }

            // Crafting has no tabs now.
            if (item.sectionId === 'craftingSection') {
                selectCraftingTab('crafting');
                return;
            }

            closePopover();

            const original = document.querySelector(`#mainMenu .menu-button[data-section="${CSS.escape(item.sectionId)}"]`);
            if (original) {
                original.click();
                return;
            }
            // Fallback if something changed
            try {
                if (typeof window.showSection === 'function') window.showSection(item.sectionId);
            } catch { /* ignore */ }
        });

        rail.appendChild(b);
    }
}

function initMobileMenuIcons() {
    const mainMenu = document.getElementById('mainMenu');
    if (!mainMenu) return;

    // Initial render
    renderRail();

    // Popover close behavior
    document.addEventListener('click', (e) => {
        const pop = document.querySelector('.mobile-menu-popover');
        if (!pop || pop.style.display === 'none') return;
        const target = e.target;
        if (_openPopoverFor && (target === _openPopoverFor || _openPopoverFor.contains(target))) return;
        if (pop.contains(target)) return;
        closePopover();
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePopover();
    });

    // Keep in sync with unlocks/badges/active state.
    // Observe:
    // - the menu button container for children
    // - each menu button's class changes (hidden/active)
    // - warning badge visibility
    try {
        const container = document.querySelector('#mainMenu .menu-buttons-container');
        if (!container) return;

        const obs = new MutationObserver(() => {
            // Batch DOM mutations into a single render.
            try { renderRail(); } catch { /* ignore */ }
        });

        obs.observe(container, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });

        // Re-render on compact-mode changes (rotate, PWA mode, etc)
        try {
            window.addEventListener('compactmodechange', () => renderRail());
            window.addEventListener('resize', () => renderRail(), { passive: true });
            window.addEventListener('orientationchange', () => renderRail(), { passive: true });
            window.visualViewport?.addEventListener('resize', () => renderRail(), { passive: true });
        } catch { /* ignore */ }

        // Re-render when collapsing/expanding (class changes on #mainMenu)
        try {
            const menuObs = new MutationObserver(() => renderRail());
            menuObs.observe(mainMenu, { attributes: true, attributeFilter: ['class'] });
        } catch { /* ignore */ }
    } catch {
        // ignore
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenuIcons);
} else {
    initMobileMenuIcons();
}
