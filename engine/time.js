// Simple in-game time manager
// Time only advances during actions (action-driven, not continuous).
// Ratio: 1 real second = 1 in-game minute.
import { t } from '../locales/locales.js';

const STORAGE_KEY = 'ingameTimeMinutes';
let totalIngameMinutes = 0; // default: day 0, 00:00

/** Load saved time or default */
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) totalIngameMinutes = Number(raw);
    } catch (e) {
        // ignore
    }
}

/** Persist time */
function save() {
    try {
        localStorage.setItem(STORAGE_KEY, String(Math.floor(totalIngameMinutes)));
    } catch (e) {
        // ignore
    }
}

// Return structured in-game time object { day, hour, minute }
export function getIngameTimeObject() {
    const mins = Math.max(0, Math.floor(totalIngameMinutes || 0));
    const day = Math.floor(mins / (60 * 24));
    const hour = Math.floor((mins % (60 * 24)) / 60);
    const minute = mins % 60;
    return { day, hour, minute };
}

// Convenience string formatter: "Day X, HH:MM"
export function getIngameTimeString() {
    const to = getIngameTimeObject();
    return t('clock_time_format', {
        day: to.day,
        hour: String(to.hour).padStart(2, '0'),
        minute: String(to.minute).padStart(2, '0')
    });
}

/**
 * Advance in-game time by real seconds.
 * 1 real second = 1 in-game minute.
 * Called progressively during action ticks.
 */
export function advanceIngameTimeBySeconds(realSeconds) {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;
    totalIngameMinutes += realSeconds;
    save();
}

// --- Raw getters/setters for saveload ---
export function getTotalIngameMinutes() {
    return Math.max(0, Math.floor(totalIngameMinutes || 0));
}
export function setTotalIngameMinutes(mins) {
    totalIngameMinutes = Number(mins) || 0;
    save();
}

/** Reset to day 0, 00:00 */
export function resetIngameTime() {
    setTotalIngameMinutes(0);
}

/** Initialize — loads saved time, no continuous loop. */
export function initTimeManager() {
    load();
}