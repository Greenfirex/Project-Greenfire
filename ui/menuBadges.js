import { buildings } from '../data/definitions/buildings.js';
import { gameFlags } from '../data/gameFlags.js';
import { technologies } from '../data/definitions/technologies.js';
import { allActions as allActionsAggregate } from '../data/definitions/allActions.js';
import { CRASH_SITE_MAP_BOUND_ACTION_IDS } from '../data/definitions/crashSiteMapBoundActionIds.js';
import { characterState, getUnspentStatPoints } from '../data/character.js';
import { resources } from '../core/resources.js';

const MENU_NEW_ITEM_PREFIX = 'uiMenuNew:';

const LEGACY_CHARACTER_MENU_NEW_ITEM_KEY = 'uiCharacterMenuNewItem';
const LEGACY_JOURNAL_MENU_NEW_ITEM_KEY = 'uiJournalMenuNewItem';
const LEGACY_COLONY_MENU_NEW_ITEM_KEY = 'uiColonyMenuNewItem';

export const MENU_SECTIONS = [
    'crashSiteSection',
    'colonySection',
    'craftingSection',
    'shipyardSection',
    'galaxyMapSection',
    'encryptedDriveSection',
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
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* ignore */
    }
}

function safeLocalStorageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        /* ignore */
    }
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

export function setColonyMenuNewItemFlag(visible) {
    setMenuNewItemFlag('colonySection', visible);
}

export function refreshMenuNewItemFlagFromStorage(sectionId) {
    if (!sectionId) return;
    const visible = safeLocalStorageGet(getStorageKeyForSection(sectionId)) === 'true';
    setMenuNewItemBadgeVisible(sectionId, visible);
}

function migrateLegacyMenuBadgeKeys() {
    // One-time migration: old per-section keys -> unified prefix keys.
    // This lets us delete redundant read paths while keeping player state.
    const legacyToSection = [
        [LEGACY_CHARACTER_MENU_NEW_ITEM_KEY, 'characterSection'],
        [LEGACY_JOURNAL_MENU_NEW_ITEM_KEY, 'journalSection'],
        [LEGACY_COLONY_MENU_NEW_ITEM_KEY, 'colonySection']
    ];

    for (const [legacyKey, sectionId] of legacyToSection) {
        const legacyVal = safeLocalStorageGet(legacyKey);
        if (legacyVal === 'true') {
            safeLocalStorageSet(getStorageKeyForSection(sectionId), 'true');
        }
        if (legacyVal !== null) {
            safeLocalStorageRemove(legacyKey);
        }
    }
}

export function refreshAllMenuNewItemFlagsFromStorage() {
    migrateLegacyMenuBadgeKeys();
    for (const sectionId of MENU_SECTIONS) {
        refreshMenuNewItemFlagFromStorage(sectionId);
    }
}

function pollMenuNewBadges() {
    const current = getCurrentSectionId();

    // Crash Site: any action flagged uiNew
    try {
        const hasNonTileNewAction = Array.isArray(allActionsAggregate)
            && allActionsAggregate.some(a => a && a.uiNew && !CRASH_SITE_MAP_BOUND_ACTION_IDS.has(String(a.id)));
        if (current !== 'crashSiteSection' && hasNonTileNewAction) {
            setMenuNewItemFlag('crashSiteSection', true);
        }
    } catch {
        /* ignore */
    }

    // Research (tabbed under Crafting): any tech flagged uiNew
    try {
        const researchUnlocked = !!(gameFlags && gameFlags.researchTabUnlocked === true);
        if (researchUnlocked && current !== 'craftingSection' && Array.isArray(technologies) && technologies.some(t => t && t.uiNew)) {
            setMenuNewItemFlag('craftingSection', true);
        }
    } catch {
        /* ignore */
    }

    // Colony: any building flagged uiNew, or colony-specific action flags
    try {
        const hasBuildingNew = Array.isArray(buildings) && buildings.some(b => b && b.uiNew);
        const hasColonyActionNew = !!gameFlags.cargoBayRouteUiNew;
        if (current !== 'colonySection' && (hasBuildingNew || hasColonyActionNew)) {
            setMenuNewItemFlag('colonySection', true);
        }
    } catch {
        /* ignore */
    }

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
    } catch {
        /* ignore */
    }
}

function installMenuBadgeListeners() {
    if (_listenersInstalled) return;
    if (typeof window === 'undefined') return;

    window.addEventListener('inventory-item-added', () => {
        try {
            const current = getCurrentSectionId();
            if (current === 'characterSection') return;
        } catch {
            /* ignore */
        }
        setMenuNewItemFlag('characterSection', true);
    });

    // Mark the Journal menu button only when objectives become newly active (new quests).
    window.addEventListener('objectivesNewlyActive', (ev) => {
        try {
            const newlyActive = ev?.detail?.newlyActive;
            if (!Array.isArray(newlyActive) || !newlyActive.length) return;

            // Persist the most recent newly-active objective so the Journal can auto-select it
            // the next time the player opens the Journal section.
            try {
                const last = newlyActive[newlyActive.length - 1];
                const id = last && last.id;
                if (id) safeLocalStorageSet('journalAutoSelectObjectiveId', String(id));
            } catch {
                /* ignore */
            }

            const current = getCurrentSectionId();
            if (current === 'journalSection') return;
            setMenuNewItemFlag('journalSection', true);
        } catch {
            /* ignore */
        }
    });

    _listenersInstalled = true;
}

export function initMenuBadges({ pollIntervalMs = 500 } = {}) {
    if (_initialized) return;
    _initialized = true;

    refreshAllMenuNewItemFlagsFromStorage();
    installMenuBadgeListeners();

    // Keep section menu badges in sync with newly unlocked UI elements.
    // This is intentionally low-cadence and lightweight.
    try {
        _pollIntervalId = setInterval(() => {
            try {
                pollMenuNewBadges();
            } catch {
                /* ignore */
            }
        }, Math.max(100, Number(pollIntervalMs) || 500));
    } catch {
        /* ignore */
    }
}
