import { resources, getInitialResources, resetResources } from './resources.js';
import { technologies, resetTechnologies } from './data/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from './data/buildings.js'; 
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from './sections/research.js';
import { activatedSections, setActivatedSections, getInitialActivatedSections } from './main.js';
import { showStoryPopup } from './popup.js';
import { resetIngameTime, getTotalIngameMinutes, setTotalIngameMinutes } from './time.js';
import { storyEvents } from './data/storyEvents.js';
import { allActions as salvageActions } from './data/allActions.js';
import { jobs } from './data/jobs.js';
import { addLogEntry, LogType } from './log.js';
import { gameFlags, resetGameFlags, applySavedGameFlags } from './data/gameFlags.js';
import { storyLog, resetStoryLog, applySavedStoryLog, getInitialStoryLog, renderJournalEntries } from './sections/journal.js';

export function saveGameState() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game saved.', LogType.INFO);
}

export function getGameState() {
    return {
        resources: resources,
        technologies: technologies,
        jobs: jobs,
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
        activatedSections: activatedSections,
        buildings: buildings,
        salvageActions: salvageActions,
        gameFlags: { ...gameFlags },
        storyLog: Array.isArray(storyLog) ? storyLog : getInitialStoryLog(),
        ingameTimeMinutes: (typeof getTotalIngameMinutes === 'function') ? getTotalIngameMinutes() : undefined,
        timeScale: (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1,
        paused: (typeof localStorage !== 'undefined') ? (localStorage.getItem('gamePaused') === 'true') : false
    };
}

export function applyGameState(gameState) {
    if (!gameState) return;

    // --- restore ingame time (if present) before starting any timers ---
    if (typeof gameState.ingameTimeMinutes === 'number' && typeof setTotalIngameMinutes === 'function') {
        setTotalIngameMinutes(gameState.ingameTimeMinutes);
        // also keep localStorage in sync
        try { localStorage.setItem('ingameTimeMinutes', String(gameState.ingameTimeMinutes)); } catch (e) { /* ignore */ }
    }

    // Restore simple game flags (persisted upgrades / toggles)
    if (gameState.gameFlags) {
        // use helper to apply saved flags (keeps default keys and live reference)
        applySavedGameFlags(gameState.gameFlags);
    }

    // Restore journal / story log into the live storyLog and update UI if present.
    // (No try/catch per request; assume browser env for DOM/localStorage.)
    if (Array.isArray(gameState.storyLog)) {
        applySavedStoryLog(gameState.storyLog);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('storyLog', JSON.stringify(gameState.storyLog));
        }
        const journalContainer = document.getElementById('journalEntriesContainer');
        if (journalContainer && typeof renderJournalEntries === 'function') {
            renderJournalEntries(journalContainer);
        }
    } else {
        // ensure live story log exists and storage is consistent
        resetStoryLog();
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('storyLog', JSON.stringify(storyLog));
        }
    }

    // --- Smart Loading for Resources ---
    const defaultResources = getInitialResources();
    defaultResources.forEach(defaultResource => {
        const savedResource = (gameState.resources || []).find(r => r.name === defaultResource.name);
        if (savedResource) {
            Object.assign(defaultResource, savedResource);
        }
    });
    resources.length = 0;
    resources.push(...defaultResources);

    // --- Smart Loading for Buildings ---
    const defaultBuildings = getInitialBuildings();
    if (gameState.buildings) {
        defaultBuildings.forEach(defaultBuilding => {
            const savedBuilding = gameState.buildings.find(b => b.name === defaultBuilding.name);
            if (savedBuilding) {
                Object.assign(defaultBuilding, savedBuilding);
            }
        });
        buildings.length = 0;
        buildings.push(...defaultBuildings);
    }

    // --- Smart-loading for actions ---
    if (gameState.salvageActions) {
        salvageActions.forEach(defaultAction => {
            const savedAction = gameState.salvageActions.find(a => a.id === defaultAction.id);
            if (savedAction) {
                               // Protect certain design-time fields from being overwritten by old saves.
                // For example, we removed Survivors cost from 'salvageCookingEquipment' — don't restore it.
                if (defaultAction.id === 'salvageCookingEquipment') {
                    const copy = { ...savedAction };
                    delete copy.cost;
                    Object.assign(defaultAction, copy);
                } else {
                    Object.assign(defaultAction, savedAction);
                }
            }
        });
    }

    // --- Smart-loading for jobs (crew assignments) ---
    if (gameState.jobs) {
        jobs.forEach(job => {
            const savedJob = gameState.jobs.find(j => j.id === job.id || j.name === job.name);
            if (savedJob) {
                Object.assign(job, savedJob);
            }
        });
    }

    // --- Smart Loading for Technologies ---
    if (gameState.technologies) {
        technologies.forEach(tech => {
            const savedTech = gameState.technologies.find(t => t.name === tech.name);
            if (savedTech) {
                Object.assign(tech, savedTech);
            }
        });
    }

        // --- Persist UI/runtime settings into localStorage so main.js can pick them up later ---
    try {
        if (typeof gameState.timeScale !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('gameTimeScale', String(gameState.timeScale));
        }
        if (typeof gameState.paused !== 'undefined' && typeof localStorage !== 'undefined') {
            localStorage.setItem('gamePaused', gameState.paused ? 'true' : 'false');
        }
    } catch (e) {
        console.warn('applyGameState: could not persist runtime settings', e);
    }

    // --- Load the rest of the game state ---
    setResearchProgress(gameState.researchProgress ?? 0);
    setCurrentResearchingTech(gameState.currentResearchingTech);
    setResearchInterval(null);
    setCurrentResearchStartTime(0);
    setActivatedSections(gameState.activatedSections ?? getInitialActivatedSections());

    const techName = getCurrentResearchingTech();
    if (techName) {
        const tech = technologies.find(t => t.name === techName);
        if (tech) {
            const cancelButton = document.querySelector('.cancel-button');
            const elapsedTime = (getResearchProgress() / 100) * tech.duration * 1000;
            setCurrentResearchStartTime(Date.now() - elapsedTime);
            resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime());
        }
    }
    // Notify other subsystems (UI) that the game state has been applied so they
    // can refresh immediately (for example, the header clock should update).
    try { window.dispatchEvent(new CustomEvent('game-state-applied')); } catch (e) { /* ignore */ }
    // Explicitly refresh the header clock by calling the exported helper from
    // `headeroptions.js`. Use a dynamic import to avoid introducing a static
    // circular module dependency at load time.
    try {
        import('./headeroptions.js').then(mod => {
            if (mod && typeof mod.refreshClock === 'function') {
                mod.refreshClock();
            }
        }).catch(() => { /* ignore failures */ });
    } catch (e) { /* ignore */ }
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
            addLogEntry('Game state loaded.', LogType.INFO);
        } catch (e) {
            addLogEntry('Failed to parse saved game state.', LogType.ERROR);
            resetToDefaultState();
        }
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
    addLogEntry('Game state reset.', LogType.INFO);

    try {
        localStorage.removeItem('storyLog');
        localStorage.removeItem('logEntries');
    } catch (e) { /* ignore storage errors */ }
 
         try {
         import('./data/actions.js').then(mod => {
             if (mod && typeof mod.resetActionsToDefaults === 'function') {
                 mod.resetActionsToDefaults();
             }
         }).catch(() => { /* ignore */ });
     } catch (e) { /* ignore */ }

    // Ensure in-game clock resets to Day 0 Hour 1 before showing intro popup so
    // any generated journal entries / popups use the correct timestamp.
    try { resetIngameTime(); } catch (e) { console.warn('resetIngameTime failed', e); }

    const event = storyEvents.crashIntro;
    showStoryPopup(event);
    addLogEntry('You survived... somehow. (Click to read)', LogType.STORY, {
        onClick: () => showStoryPopup(event)
    });

    resetResources();
    resetBuildings();
    resetTechnologies();
    resetGameFlags();
    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    setActivatedSections(getInitialActivatedSections());

    // (resetIngameTime already called above before showing intro popup)

    // Best-effort: clear any active crash-site action or loop if those helpers are available
    try {
        if (typeof setActiveCrashSiteAction === 'function') setActiveCrashSiteAction(null);
    } catch (e) { /* ignore */ }
    try {
        if (typeof stopCrashSiteLoop === 'function') stopCrashSiteLoop();
    } catch (e) { /* ignore */ }

    // Persist the freshly reset default to storage so subsequent loads use it
    try { saveGameState(); } catch (e) { console.warn('saveGameState failed', e); }

    try { window.dispatchEvent(new CustomEvent('gameReset')); } catch (e) { /* ignore */ }
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    try { window.dispatchEvent(new CustomEvent('gameReset')); } catch (e) { /* ignore */ }
    localStorage.clear();
    location.reload();
}

const ENC_PREFIX = 'ENC2:';
const APP_KEY_B64 = 'q1s8Z6v9Yp3rT4m8uV2x7a0nB5cHkL2f9dR0yPq3sM8='; // 32 random bytes, base64

// --- Helpers (keep existing array/base64 helpers if present) ---
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

// Import the application key for AES-GCM (256-bit)
async function getAppCryptoKey() {
    const raw = base64ToArrayBuffer(APP_KEY_B64);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Encrypt / Decrypt using the embedded application key
async function encryptStringWithAppKey(plainText) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM 12-byte IV
    const key = await getAppCryptoKey();
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText));
    // Compose: iv(12) + cipher
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

/* === Export / Import functions updated to use the embedded app key (no prompts) === */

// Export current save to clipboard (always encrypted by default)
export async function exportSaveToClipboard() {
    const json = JSON.stringify(getGameState());
    try {
        const encrypted = await encryptStringWithAppKey(json);
        const payload = ENC_PREFIX + encrypted;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(payload);
            addLogEntry('Save exported to clipboard.', LogType.SUCCESS);
        } else {
            const importTextarea = document.getElementById('importSaveText');
            if (importTextarea) importTextarea.value = payload;
            addLogEntry('Save placed into import box (copy manually).', LogType.INFO);
        }
    } catch (e) {
        addLogEntry('Export failed: ' + (e.message || e), LogType.ERROR);
        return Promise.reject(e);
    }
}

// Import save from a string (auto-detects ENC2: and uses embedded app key)
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
                    addLogEntry(
                        'Import failed: scrambled data could not be decrypted. Data may be corrupted.',
                        LogType.ERROR
                    );
                    console.debug('Decryption failure:', e);
                    return false;
                }
                throw e;
            }
        } else {
            // Treat as base64-encoded JSON (legacy)
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
        console.debug('Import error details:', e);
        return false;
    }
}

/* === Wire DOM buttons to new export/import behavior (no password UI) === */
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportSaveButton');
    const importBtn = document.getElementById('importSaveButton');
    const importTextarea = document.getElementById('importSaveText');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportSaveToClipboard().catch(() => {});
        });
    }

    if (importBtn && importTextarea) {
        importBtn.addEventListener('click', async () => {
            const text = importTextarea.value.trim();
            const ok = await importSaveFromText(text);
            if (ok) {
                // Try to close the options menu via its close button (preferred)
                const closeBtn = document.querySelector('#optionsMenu .options-menu-close, .options-menu-close');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    // Fallback: hide the options menu element directly
                    const optionsMenuEl = document.getElementById('optionsMenu');
                    if (optionsMenuEl) optionsMenuEl.style.display = 'none';
                }

                // Give UI a short moment to settle, then reload to apply imported state cleanly
                setTimeout(() => location.reload(), 200);
            }
        });
    }
});

// Auto-save when the app is paused (e.g. tab hidden and run-in-background disabled)
window.addEventListener('game-pause', () => {
    try {
        saveGameState();
        if (typeof addLogEntry === 'function' && typeof LogType !== 'undefined') {
            addLogEntry('Auto-saved on pause.', LogType.INFO);
        }
    } catch (e) {
        console.warn('Auto-save on pause failed', e);
    }
});

