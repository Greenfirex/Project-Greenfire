import { getIngameTimeString } from '../core/time.js';
import { getAllObjectivesWithState, getObjectiveSteps } from '../data/objectives.js';

export function setupJournalSection(section) {
    if (!section) return;
    section.innerHTML = `
        <div class="journal-tabs" role="tablist" aria-label="Journal and Objectives">
            <button class="journal-tab active" data-tab="journal" role="tab" aria-selected="true">Journal</button>
            <button class="journal-tab" data-tab="objectives" role="tab" aria-selected="false">Objectives</button>
        </div>
        <div class="content-panel journal-panel">
            <div class="journal-tabpanes">
                <div id="journalPane" class="journal-pane active" role="tabpanel" aria-labelledby="journal-tab">
                    <div id="journalEntriesContainer" class="journal-entries"></div>
                </div>
                <div id="objectivesPane" class="journal-pane" role="tabpanel" aria-labelledby="objectives-tab">
                    <div id="objectivesHistoryContainer" class="objectives-history"></div>
                </div>
            </div>
        </div>
    `;

    const journalContainer = section.querySelector('#journalEntriesContainer');
    if (journalContainer) renderJournalEntries(journalContainer);
    renderObjectivesHistory();

    // Tab switching
    const tabs = Array.from(section.querySelectorAll('.journal-tab'));
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => {
                t.classList.toggle('active', t === tab);
                t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
            });
            const panes = section.querySelectorAll('.journal-pane');
            panes.forEach(p => {
                const isMatch = (p.id === (target === 'journal' ? 'journalPane' : 'objectivesPane'));
                p.classList.toggle('active', isMatch);
            });
            if (target === 'objectives') {
                renderObjectivesHistory();
            }
        });
    });
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

// Render objectives history (active + completed + locked optionally hidden)
export function renderObjectivesHistory() {
    const host = document.getElementById('objectivesHistoryContainer');
    if (!host) return;
    host.innerHTML = '';
    const all = getAllObjectivesWithState();
    // Separate by state
    const active = all.filter(o => o.state === 'active');
    const completed = all.filter(o => o.state === 'completed').sort((a,b) => (b.doneAt||0)-(a.doneAt||0));
    // Show currently active at top, then completed chronologically (newest first)
    const makeSection = (title, items, emptyText) => {
        const wrap = document.createElement('div');
        wrap.className = 'objectives-history-section';
        const h = document.createElement('h3');
        h.textContent = title;
        wrap.appendChild(h);
        if (!items.length) {
            const empty = document.createElement('p');
            empty.className = 'objectives-empty';
            empty.textContent = emptyText;
            wrap.appendChild(empty);
            return wrap;
        }
        const list = document.createElement('ul');
        list.className = 'objectives-history-list';
        items.forEach(obj => {
            const li = document.createElement('li');
            li.className = 'objectives-history-item';
            if (obj.state === 'completed') li.classList.add('completed');
            const label = document.createElement('div');
            label.className = 'objective-history-label';
            label.textContent = obj.label;
            li.appendChild(label);
            // steps (show progress + completion markers)
            if (obj.state === 'active' || obj.state === 'completed') {
                const steps = getObjectiveSteps(obj.id);
                if (steps.length) {
                    const stepsUl = document.createElement('ul');
                    stepsUl.className = 'objective-history-steps';
                    steps.forEach(st => {
                        const sLi = document.createElement('li');
                        sLi.className = 'objective-history-step';
                        if (st.done) sLi.classList.add('done');
                        sLi.textContent = st.label + (st.progress && !st.done ? ` (${st.progress})` : '');
                        stepsUl.appendChild(sLi);
                    });
                    li.appendChild(stepsUl);
                }
            }
            // reward (XP)
            if (Array.isArray(obj.reward) && obj.reward.length) {
                const rewardEl = document.createElement('div');
                rewardEl.className = 'objective-history-reward';
                rewardEl.textContent = obj.reward.map(r => `+${r.amount} ${r.resource}`).join(', ');
                li.appendChild(rewardEl);
            }
            // timestamps
            const timeBits = [];
            if (typeof obj.firstAt === 'number') timeBits.push(`started @ ${Math.floor(obj.firstAt/60)}h ${obj.firstAt%60}m`);
            if (typeof obj.doneAt === 'number') timeBits.push(`completed @ ${Math.floor(obj.doneAt/60)}h ${obj.doneAt%60}m`);
            if (timeBits.length) {
                const tEl = document.createElement('div');
                tEl.className = 'objective-history-times';
                tEl.textContent = timeBits.join(' | ');
                li.appendChild(tEl);
            }
            list.appendChild(li);
        });
        wrap.appendChild(list);
        return wrap;
    };
    host.appendChild(makeSection('Active Objectives', active, 'No active objectives.'));
    host.appendChild(makeSection('Completed Objectives', completed, 'No objectives completed yet.'));
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