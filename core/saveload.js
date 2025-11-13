import { resources, getInitialResources, resetResources } from './resources.js';
import { technologies, resetTechnologies } from '../data/definitions/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from '../data/definitions/buildings.js'; 
import { setResearchProgress, getResearchProgress, getCurrentResearchingTech, setCurrentResearchingTech, setResearchInterval, getResearchInterval, getCurrentResearchStartTime, setCurrentResearchStartTime, resumeOngoingResearch } from '../sections/research.js';
import { activatedSections, setActivatedSections, getInitialActivatedSections } from './main.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { resetIngameTime, getTotalIngameMinutes, setTotalIngameMinutes } from './time.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { allActions as salvageActions } from '../data/definitions/allActions.js';
import { jobs, resetJobs } from '../data/jobsManager.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { gameFlags, resetGameFlags, applySavedGameFlags } from '../data/gameFlags.js';
import { storyLog, resetStoryLog, applySavedStoryLog, getInitialStoryLog, renderJournalEntries } from '../sections/journal.js';
import { resetObjectives, recomputeObjectives, getObjectivesStatus, setObjectivesStatus } from '../data/objectives.js';
import { resetActiveActions, getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { resetMoraleModifiers, listMoraleModifiers, setMoraleModifier } from '../data/morale.js';
import { resetWeather } from '../data/weather.js';

export function saveGameState() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game saved.', LogType.INFO);
}

export function getGameState() {
    return {
        resources,
        technologies,
        jobs,
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
        researchStartTime: getCurrentResearchStartTime(),
        activatedSections,
        buildings,
        salvageActions,
        gameFlags: { ...gameFlags },
        storyLog: Array.isArray(storyLog) ? storyLog : getInitialStoryLog(),
        ingameTimeMinutes: getTotalIngameMinutes(),
        timeScale: window.TIME_SCALE ? Number(window.TIME_SCALE) : 1,
        paused: localStorage.getItem('gamePaused') === 'true',
        activeCrashSiteAction: getActiveCrashSiteAction(),
        moraleModifiers: listMoraleModifiers(),
        // Persist narrative objectives alongside the main save so they don't drift
        objectivesStatus: (function(){ try { return getObjectivesStatus(); } catch { return []; } })()
    };
}

export function applyGameState(gameState) {
    if (!gameState) return;

    // Restore ingame time before starting any timers
    if (typeof gameState.ingameTimeMinutes === 'number') {
        setTotalIngameMinutes(gameState.ingameTimeMinutes);
        localStorage.setItem('ingameTimeMinutes', String(gameState.ingameTimeMinutes));
    }

    // Restore game flags (persisted upgrades/toggles)
    if (gameState.gameFlags) {
        applySavedGameFlags(gameState.gameFlags);
    }

    // Restore journal/story log
    if (Array.isArray(gameState.storyLog)) {
        applySavedStoryLog(gameState.storyLog);
        localStorage.setItem('storyLog', JSON.stringify(gameState.storyLog));
        const journalContainer = document.getElementById('journalEntriesContainer');
        if (journalContainer) {
            renderJournalEntries(journalContainer);
        }
    } else {
        resetStoryLog();
        localStorage.setItem('storyLog', JSON.stringify(storyLog));
    }

    // Smart loading: merge saved data into fresh defaults to preserve forward compatibility
    const defaultResources = getInitialResources();
    defaultResources.forEach(defaultResource => {
        const savedResource = (gameState.resources || []).find(r => r.name === defaultResource.name);
        if (savedResource) {
            Object.assign(defaultResource, savedResource);
        }
    });
    resources.length = 0;
    resources.push(...defaultResources);

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

    if (gameState.salvageActions) {
        salvageActions.forEach(defaultAction => {
            const savedAction = gameState.salvageActions.find(a => a.id === defaultAction.id);
            if (savedAction) {
                // Protect design-time fields from old saves (e.g., removed Survivors cost from salvageCookingEquipment)
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

    if (gameState.jobs) {
        jobs.forEach(job => {
            const savedJob = gameState.jobs.find(j => j.id === job.id || j.name === job.name);
            if (savedJob) {
                Object.assign(job, savedJob);
            }
        });
    }

    if (gameState.technologies) {
        technologies.forEach(tech => {
            const savedTech = gameState.technologies.find(t => t.name === tech.name);
            if (savedTech) {
                Object.assign(tech, savedTech);
            }
        });
    }

    // Persist UI/runtime settings
    if (typeof gameState.timeScale !== 'undefined') {
        localStorage.setItem('gameTimeScale', String(gameState.timeScale));
    }
    if (typeof gameState.paused !== 'undefined') {
        localStorage.setItem('gamePaused', gameState.paused ? 'true' : 'false');
    }

    // Restore research state
    setResearchProgress(gameState.researchProgress ?? 0);
    setCurrentResearchingTech(gameState.currentResearchingTech);
    setResearchInterval(null);
    setCurrentResearchStartTime(gameState.researchStartTime ?? 0);
    setActivatedSections(gameState.activatedSections ?? getInitialActivatedSections());

    // Restore objectives from composite save (keeps them in sync with other state)
    try {
        if (Array.isArray(gameState.objectivesStatus)) {
            setObjectivesStatus(gameState.objectivesStatus);
            // Mirror into the objectives' own storage for forward compatibility
            localStorage.setItem('objectivesStatusV1', JSON.stringify(gameState.objectivesStatus));
        } else {
            // If not present (older save), leave current objectives as-is
        }
    } catch { /* non-fatal */ }

    // Restore active crash site action
    if (gameState.activeCrashSiteAction) {
        setActiveCrashSiteAction(gameState.activeCrashSiteAction);
    }

    // Restore morale modifiers
    if (Array.isArray(gameState.moraleModifiers)) {
        resetMoraleModifiers();
        gameState.moraleModifiers.forEach(mod => {
            if (mod.id && typeof mod.delta === 'number') {
                setMoraleModifier(mod.id, mod.delta, mod.label);
            }
        });
    }

    // Resume ongoing research if present
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

    // Notify subsystems that game state has been applied
    window.dispatchEvent(new CustomEvent('game-state-applied'));
    
    // Refresh header clock (dynamic import to avoid circular dependency)
    import('../ui/header.js').then(mod => {
        if (mod?.refreshClock) {
            mod.refreshClock();
        }
    });
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    
    // Clear log content on load
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '';
    }

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        applyGameState(gameState);
        addLogEntry('Game state loaded.', LogType.INFO);
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
    addLogEntry('Game state reset.', LogType.INFO);

    // Clear persisted state from localStorage
    localStorage.removeItem('storyLog');
    localStorage.removeItem('logEntries');
    localStorage.removeItem('objectivesStatusV1');

    // PRIORITY 1: Reset core game state first (data layer)
    resetIngameTime();
    resetResources();
    resetBuildings();
    resetTechnologies();
    resetGameFlags();
    resetStoryLog();
    resetJobs();
    resetActiveActions();
    resetMoraleModifiers();
    resetWeather();
    
    // PRIORITY 2: Reset research state
    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    
    // PRIORITY 3: Reset UI sections
    setActivatedSections(getInitialActivatedSections());

    // PRIORITY 4: Reset objectives and capture first objective for intro popup
    resetObjectives({ suppressEvent: true });
    const snapshot = recomputeObjectives();
    let introOutcome = null;
    if (snapshot && Array.isArray(snapshot.newlyActive) && snapshot.newlyActive.length) {
        introOutcome = { objectives: { newlyActive: snapshot.newlyActive } };
    }

    // PRIORITY 5: Show intro story popup (after all state is clean)
    const event = storyEvents.crashIntro;
    showStoryPopup(event, introOutcome);
    addLogEntry('You survived... somehow. (Click to read)', LogType.STORY, {
        onClick: () => showStoryPopup(event, introOutcome)
    });

    // PRIORITY 6: Persist clean state and broadcast reset event
    saveGameState();
    window.dispatchEvent(new CustomEvent('gameReset'));
    
    // Final recompute to ensure any listeners are synced
    recomputeObjectives();
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    window.dispatchEvent(new CustomEvent('gameReset'));
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

