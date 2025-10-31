import { getIngameTimeString } from '../time.js';

export function setupJournalSection(section) {
    if (!section) return;
    section.innerHTML = `
        <div class="content-panel">
            <div class="journal-header">
                <h2>Journal</h2>
            </div>
            <div id="journalEntriesContainer" class="journal-entries"></div>
        </div>
    `;
    // ensure we render from the live storyLog
    const container = section.querySelector('#journalEntriesContainer');
    if (container) renderJournalEntries(container);

    // If the rest of the function previously pushed entries to localStorage,
    // prefer pushing to the live storyLog instead. (Keep rest of code unchanged.)
}

// Minimal, data-style API for the journal (mirror pattern used by data/buildings.js and data/gameFlags.js)
export function getInitialStoryLog() {
    // Return the canonical initial journal entries (empty by default).
    return [];
}

// live storyLog array that other modules can import and mutate
export let storyLog = getInitialStoryLog();

// Reset the live story log back to defaults (keeps same reference)
export function resetStoryLog() {
    storyLog.length = 0;
    storyLog.push(...getInitialStoryLog());
}

// Apply saved story log (replace contents of live array)
export function applySavedStoryLog(savedEntries) {
    storyLog.length = 0;
    if (Array.isArray(savedEntries)) storyLog.push(...savedEntries);
}

// Ensure renderJournalEntries is exported so saveload can refresh the UI after loading
export function renderJournalEntries(container) {
    if (!container) return;
    container.innerHTML = '';
    // Render newest first to match previous behavior (reverse chronological)
    const entriesToRender = (storyLog || []).slice().reverse();
    entriesToRender.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'journal-entry';

        const titleEl = document.createElement('div');
        titleEl.className = 'journal-entry-title';
        titleEl.textContent = entry.title || 'Untitled';

        const timeEl = document.createElement('div');
        timeEl.className = 'journal-entry-time';
        if (entry && entry.ingameTime && typeof entry.ingameTime.day !== 'undefined') {
            const d = entry.ingameTime.day;
            const h = String(entry.ingameTime.hour).padStart(2, '0');
            timeEl.textContent = `Day ${d}, Hour ${h}`;
        } else {
            timeEl.textContent = '';
        }

        const body = document.createElement('div');
        body.className = 'journal-entry-body';
        body.textContent = entry.text || '';

        el.appendChild(titleEl);
        if (timeEl.textContent) el.appendChild(timeEl);
        el.appendChild(body);
        container.appendChild(el);
    });
}

// New helper: add a journal entry (updates live storyLog, localStorage, and UI)
export function addJournalEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    storyLog.push(entry);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('storyLog', JSON.stringify(storyLog));
    }
    const container = document.getElementById('journalEntriesContainer');
    if (container) renderJournalEntries(container);
}

// wire main-menu button
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('journalBtn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openJournal(); });
});

// Refresh journal when the game is reset (keeps UI in sync)
window.addEventListener('gameReset', () => {
    const sec = document.getElementById('journalSection');
    if (!sec) return;
    const container = sec.querySelector('#journalEntriesContainer');
    if (container && typeof renderJournalEntries === 'function') {
        renderJournalEntries(container);
    }
});