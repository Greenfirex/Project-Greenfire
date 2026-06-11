import { characterState, getUnspentStatPoints } from '../../sections/character/character.js';
import { resources } from '../../engine/resources.js';

const MENU_NEW_ITEM_PREFIX = 'uiMenuNew:';

export const MENU_SECTIONS = [
    'crashSiteSection',
    'characterSection',
    'journalSection'
];

let _initialized = false;
let _pollIntervalId = null;
let _listenersInstalled = false;

function setMenuNewItemBadgeVisible(sectionId, visible) {
    const btn = document.querySelector(`.menu-button[data-section="${sectionId}"]`);
    const badge = btn ? btn.querySelector('.menu-button-warning') : null;
    if (!badge) return;
    badge.classList.toggle('is-hidden', !visible);
}

function safeLocalStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeLocalStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function getCurrentSectionId() {
    return safeLocalStorageGet('currentSection');
}

function getStorageKeyForSection(sectionId) {
    return `${MENU_NEW_ITEM_PREFIX}${sectionId}`;
}

export function setMenuNewItemFlag(sectionId, visible) {
    if (!sectionId) return;
    safeLocalStorageSet(getStorageKeyForSection(sectionId), visible ? 'true' : 'false');
    setMenuNewItemBadgeVisible(sectionId, visible);
}

export function refreshMenuNewItemFlagFromStorage(sectionId) {
    if (!sectionId) return;
    const visible = safeLocalStorageGet(getStorageKeyForSection(sectionId)) === 'true';
    setMenuNewItemBadgeVisible(sectionId, visible);
}

export function refreshAllMenuNewItemFlagsFromStorage() {
    for (const sectionId of MENU_SECTIONS) {
        refreshMenuNewItemFlagFromStorage(sectionId);
    }
}

function pollMenuNewBadges() {
    const current = getCurrentSectionId();

    // Character: any unseen inventory item (bagUiNew) OR unspent stat points.
    try {
        const hasNewInventory = !!(characterState && Array.isArray(characterState.bagUiNew) && characterState.bagUiNew.some(v => !!v));
        let unspent = 0;
        try {
            const xp = Array.isArray(resources) ? resources.find(r => r && r.name === 'XP') : null;
            const totalXp = xp ? Number(xp.amount) : 0;
            unspent = getUnspentStatPoints(totalXp, characterState);
        } catch { unspent = 0; }

        if (current !== 'characterSection' && (hasNewInventory || unspent > 0)) {
            setMenuNewItemFlag('characterSection', true);
        }
    } catch { /* ignore */ }
}

function installMenuBadgeListeners() {
    if (_listenersInstalled) return;
    if (typeof window === 'undefined') return;

    window.addEventListener('inventory-item-added', () => {
        try {
            const current = getCurrentSectionId();
            if (current === 'characterSection') return;
        } catch { /* ignore */ }
        setMenuNewItemFlag('characterSection', true);
    });

    _listenersInstalled = true;
}

export function initMenuBadges({ pollIntervalMs = 500 } = {}) {
    if (_initialized) return;
    _initialized = true;

    refreshAllMenuNewItemFlagsFromStorage();
    installMenuBadgeListeners();

    try {
        _pollIntervalId = setInterval(() => {
            try { pollMenuNewBadges(); } catch { /* ignore */ }
        }, Math.max(100, Number(pollIntervalMs) || 500));
    } catch { /* ignore */ }
}