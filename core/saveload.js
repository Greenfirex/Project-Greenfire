import { resources, getInitialResources, resetResources } from './resources.js';
import { activatedSections, setActivatedSections, getInitialActivatedSections } from './main.js';
import { resetIngameTime, getTotalIngameMinutes, setTotalIngameMinutes } from './time.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { gameFlags, resetGameFlags, applySavedGameFlags } from '../data/gameFlags.js';
import { storyLog, getInitialStoryLog } from '../data/objectives.js';
import { resetActiveActions, getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { characterState, applySavedCharacterState, getCharacterStateForSave, resetCharacterState } from '../features/character/character.js';
import { getObjectivesStatus, setObjectivesStatus, resetObjectives } from '../data/objectives.js';

function reconcileActivatedSectionsAfterLoad() {
    try {
        const next = { ...getInitialActivatedSections(), ...(activatedSections || {}) };
        setActivatedSections(next);

        try {
            if (typeof window !== 'undefined' && typeof window.applyActivatedSections === 'function') {
                window.applyActivatedSections();
            }
        } catch { /* ignore */ }
    } catch { /* non-fatal */ }
}

export function saveGameState() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game saved.', LogType.INFO);
}

export function saveGameStateQuiet() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
}

export function getGameState() {
    return {
        saveVersion: SAVE_VERSION,
        resources,
        activatedSections,
        gameFlags: { ...gameFlags },
        storyLog: Array.isArray(storyLog) ? storyLog : getInitialStoryLog(),
        ingameTimeMinutes: getTotalIngameMinutes(),
        timeScale: window.TIME_SCALE ? Number(window.TIME_SCALE) : 1,
        paused: localStorage.getItem('gamePaused') === 'true',
        activeCrashSiteAction: getActiveCrashSiteAction(),
        characterState: (function(){ try { return getCharacterStateForSave(); } catch { return null; } })(),
        objectivesStatus: (function(){ try { return getObjectivesStatus(); } catch { return []; } })()
    };
}

const SAVE_VERSION = 2; // Increment this when save format changes incompatibly

export function applyGameState(gameState) {
    if (!gameState) return;

    // Detect incompatible old saves: if the save has salvageActions/recipeActions/upgradeActions
    // or buildings/jobs/technologies, it's from the old game and must be discarded.
    const hasLegacyData = !!(gameState.salvageActions || gameState.recipeActions || gameState.upgradeActions
        || gameState.buildings || gameState.jobs || gameState.technologies);
    if (hasLegacyData || (typeof gameState.saveVersion === 'number' && gameState.saveVersion < SAVE_VERSION)) {
        console.warn('[saveload] Incompatible legacy save detected — starting fresh.');
        localStorage.removeItem('gameState');
        resetToDefaultState();
        return;
    }

    // Restore ingame time
    if (typeof gameState.ingameTimeMinutes === 'number') {
        setTotalIngameMinutes(gameState.ingameTimeMinutes);
        localStorage.setItem('ingameTimeMinutes', String(gameState.ingameTimeMinutes));
    }

    // Restore game flags
    if (gameState.gameFlags) {
        applySavedGameFlags(gameState.gameFlags);
    }

    // Restore journal/story log
    if (Array.isArray(gameState.storyLog)) {
        storyLog.length = 0;
        storyLog.push(...gameState.storyLog);
        localStorage.setItem('storyLog', JSON.stringify(gameState.storyLog));
    } else {
        storyLog.length = 0;
        storyLog.push(...getInitialStoryLog());
        localStorage.setItem('storyLog', JSON.stringify(storyLog));
    }

    // Restore character state
    try {
        if (gameState.characterState && typeof gameState.characterState === 'object') {
            applySavedCharacterState(gameState.characterState);
            localStorage.setItem('characterStateV1', JSON.stringify(gameState.characterState));
        } else {
            resetCharacterState();
            localStorage.setItem('characterStateV1', JSON.stringify(getCharacterStateForSave()));
        }
    } catch { /* non-fatal */ }

    // Smart loading: merge saved data into fresh defaults
    const defaultResources = getInitialResources();

    defaultResources.forEach(defaultResource => {
        const savedResource = (gameState.resources || []).find(r => r.name === defaultResource.name);
        if (savedResource) {
            Object.assign(defaultResource, savedResource);
        }
    });

    resources.length = 0;
    resources.push(...defaultResources);

    // Persist UI/runtime settings
    if (typeof gameState.timeScale !== 'undefined') {
        localStorage.setItem('gameTimeScale', String(gameState.timeScale));
    }
    if (typeof gameState.paused !== 'undefined') {
        localStorage.setItem('gamePaused', gameState.paused ? 'true' : 'false');
    }

    setActivatedSections(gameState.activatedSections ?? getInitialActivatedSections());
    reconcileActivatedSectionsAfterLoad();

    // Restore objectives
    try {
        if (Array.isArray(gameState.objectivesStatus)) {
            setObjectivesStatus(gameState.objectivesStatus);
            localStorage.setItem('objectivesStatusV1', JSON.stringify(gameState.objectivesStatus));
        }
    } catch { /* non-fatal */ }

    // Restore active crash site action
    if (gameState.activeCrashSiteAction) {
        setActiveCrashSiteAction(gameState.activeCrashSiteAction);
    }

    // Notify subsystems
    window.dispatchEvent(new CustomEvent('game-state-applied'));

    // Refresh header clock
    import('../ui/chrome/header.js').then(mod => {
        if (mod?.refreshClock) {
            mod.refreshClock();
        }
    });
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');

    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '';
    }

    if (savedGameState) {
        try {
            const gameState = JSON.parse(savedGameState);
            applyGameState(gameState);
        } catch (e) {
            console.warn('[saveload] Failed to parse saved game state — starting fresh.', e);
            localStorage.removeItem('gameState');
            resetToDefaultState();
            return;
        }
        addLogEntry('Game state loaded.', LogType.INFO);
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
    addLogEntry('New game started.', LogType.INFO);

    localStorage.removeItem('storyLog');
    localStorage.removeItem('logEntries');
    localStorage.removeItem('objectivesStatusV1');
    localStorage.removeItem('characterStateV1');

    resetIngameTime();
    resetResources();
    resetGameFlags();
    storyLog.length = 0;
    storyLog.push(...getInitialStoryLog());
    resetActiveActions();
    resetCharacterState();
    resetObjectives();

    setActivatedSections(getInitialActivatedSections());

    saveGameState();
    window.dispatchEvent(new CustomEvent('gameReset'));
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    window.dispatchEvent(new CustomEvent('gameReset'));
    localStorage.clear();
    location.reload();
}

const ENC_PREFIX = 'ENC2:';
const APP_KEY_B64 = 'q1s8Z6v9Yp3rT4m8uV2x7a0nB5cHkL2f9dR0yPq3sM8=';

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function getAppCryptoKey() {
    const raw = base64ToArrayBuffer(APP_KEY_B64);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptStringWithAppKey(plainText) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getAppCryptoKey();
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText));
    const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.byteLength);
    return arrayBufferToBase64(combined.buffer);
}

async function decryptStringWithAppKey(base64Combined) {
    const combined = new Uint8Array(base64ToArrayBuffer(base64Combined));
    if (combined.byteLength < 13) throw new Error('Invalid encrypted data');
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const key = await getAppCryptoKey();
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const dec = new TextDecoder();
    return dec.decode(plainBuffer);
}

export async function exportSaveToClipboard() {
    const json = JSON.stringify(getGameState());
    try {
        const encrypted = await encryptStringWithAppKey(json);
        const payload = ENC_PREFIX + encrypted;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(payload);
            addLogEntry('Save exported to clipboard.', LogType.SUCCESS);
            return { method: 'clipboard' };
        } else {
            const importTextarea = document.getElementById('importSaveText');
            if (importTextarea) importTextarea.value = payload;
            addLogEntry('Save placed into import box (copy manually).', LogType.INFO);
            return { method: 'importBox' };
        }
    } catch (e) {
        addLogEntry('Export failed: ' + (e.message || e), LogType.ERROR);
        return Promise.reject(e);
    }
}

export async function importSaveFromText(text) {
    if (!text) {
        addLogEntry('Import text is empty.', LogType.ERROR);
        return false;
    }

    try {
        let json;
        const trimmed = text.trim();

        if (trimmed.startsWith(ENC_PREFIX)) {
            const encryptedPart = trimmed.slice(ENC_PREFIX.length);
            try {
                json = await decryptStringWithAppKey(encryptedPart);
            } catch (e) {
                if (e && (e.name === 'OperationError' || e.name === 'InvalidAccessError')) {
                    addLogEntry('Import failed: scrambled data could not be decrypted.', LogType.ERROR);
                    return false;
                }
                throw e;
            }
        } else {
            const ab = base64ToArrayBuffer(trimmed);
            json = new TextDecoder().decode(ab);
        }

        const parsed = JSON.parse(json);
        applyGameState(parsed);
        localStorage.setItem('gameState', JSON.stringify(parsed));
        addLogEntry('Save imported successfully.', LogType.SUCCESS);
        return true;
    } catch (e) {
        addLogEntry('Import failed: ' + (e.message || e), LogType.ERROR);
        return false;
    }
}

/* Wire DOM buttons */
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportSaveButton');
    const importBtn = document.getElementById('importSaveButton');
    const importTextarea = document.getElementById('importSaveText');

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const statusEl = document.getElementById('saveMgmtStatus');
            try {
                const result = await exportSaveToClipboard();
                if (statusEl) {
                    statusEl.textContent =
                        result && result.method === 'clipboard'
                            ? 'Exported to clipboard.'
                            : 'Clipboard unavailable — save placed into the import box (copy manually).';
                }
            } catch {
                if (statusEl) statusEl.textContent = 'Export failed.';
            }
        });
    }

    if (importBtn && importTextarea) {
        importBtn.addEventListener('click', async () => {
            const text = importTextarea.value.trim();
            const ok = await importSaveFromText(text);
            if (ok) {
                const closeBtn = document.querySelector('#optionsMenu .options-menu-close, .options-menu-close');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    const optionsMenuEl = document.getElementById('optionsMenu');
                    if (optionsMenuEl) {
                        try { optionsMenuEl.classList.add('hidden'); } catch { /* ignore */ }
                        try { optionsMenuEl.hidden = true; } catch { /* ignore */ }
                        try { optionsMenuEl.style.display = ''; } catch { /* ignore */ }
                        try { window.dispatchEvent(new CustomEvent('popup-close')); } catch { /* ignore */ }
                    }
                }
                setTimeout(() => location.reload(), 200);
            }
        });
    }
});