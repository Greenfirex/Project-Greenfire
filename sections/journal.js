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
    // initial render
    renderJournalEntries(section.querySelector('#journalEntriesContainer'));
}

function renderJournalEntries(container) {
    if (!container) return;
    let entries = [];
    try {
        const raw = localStorage.getItem('storyLog');
        entries = raw ? JSON.parse(raw) : [];
    } catch (e) { entries = []; }

    if (!entries || entries.length === 0) {
        container.innerHTML = '<p class="muted">No journal entries yet.</p>';
        return;
    }

    container.innerHTML = '';
    entries.slice().reverse().forEach(entry => {
        const el = document.createElement('div');
        el.className = 'journal-entry';

        const titleEl = document.createElement('div');
        titleEl.className = 'journal-entry-title';
        titleEl.textContent = entry.title || 'Untitled';

        const timeEl = document.createElement('div');
        timeEl.className = 'journal-entry-time';
        // If entry.ingameTime is a structured object saved at creation, format Day/Hour.
        if (entry && entry.ingameTime && typeof entry.ingameTime.day !== 'undefined') {
            try {
                const d = entry.ingameTime.day;
                const h = String(entry.ingameTime.hour).padStart(2, '0');
                timeEl.textContent = `Day ${d}, Hour ${h}`;
            } catch (e) {
                timeEl.textContent = getIngameTimeString();
            }
        } else {
            // fallback: current in-game time string or realtime timestamp
            try {
                timeEl.textContent = getIngameTimeString();
            } catch (e) {
                timeEl.textContent = new Date(entry.time).toLocaleString();
            }
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