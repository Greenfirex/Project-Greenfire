import { storyLog, getInitialStoryLog, getAllObjectivesWithState, getObjectiveSteps, getTrackedObjectiveId, setTrackedObjective } from '../../engine/objectives.js';
import { saveGameStateQuiet } from '../../engine/saveload.js';
import { t } from '../../locales/locales.js';

export function setupJournalSection(section) {
    if (!section) return;

    const initialTab = (section.dataset && section.dataset.journalActiveTab === 'journal') ? 'journal' : 'objectives';
    section.innerHTML = `
        <div class="journal-tabs" role="tablist" aria-label="Journal and Objectives">
            <button class="journal-tab ${initialTab === 'objectives' ? 'active' : ''}" data-tab="objectives" role="tab" aria-selected="${initialTab === 'objectives' ? 'true' : 'false'}">${t('journal_tab_objectives')}</button>
            <button class="journal-tab ${initialTab === 'journal' ? 'active' : ''}" data-tab="journal" role="tab" aria-selected="${initialTab === 'journal' ? 'true' : 'false'}">${t('journal_tab_journal')}</button>
        </div>
        <div class="content-panel journal-panel">
            <div class="journal-tabpanes">
                <div id="objectivesPane" class="journal-pane ${initialTab === 'objectives' ? 'active' : ''}" role="tabpanel" aria-labelledby="objectives-tab">
                    <div id="objectivesHistoryContainer" class="objectives-history"></div>
                </div>
                <div id="journalPane" class="journal-pane ${initialTab === 'journal' ? 'active' : ''}" role="tabpanel" aria-labelledby="journal-tab">
                    <div id="journalEntriesContainer" class="journal-entries"></div>
                </div>
            </div>
        </div>
    `;

    const journalContainer = section.querySelector('#journalEntriesContainer');
    if (journalContainer) renderJournalEntries(journalContainer);
    if (initialTab === 'objectives') {
        renderObjectivesHistory();
    }

    // Tab switching
    const tabs = Array.from(section.querySelectorAll('.journal-tab'));
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            try { section.dataset.journalActiveTab = target === 'journal' ? 'journal' : 'objectives'; } catch { /* ignore */ }
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

export function renderJournalEntries(container) {
    if (!container) return;
    container.innerHTML = '';
    const entriesToRender = (storyLog || []).slice().reverse();
    if (entriesToRender.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'objectives-empty';
        empty.textContent = 'No journal entries yet.';
        container.appendChild(empty);
        return;
    }
    entriesToRender.forEach(entry => {
        const el = document.createElement('div');
        el.className = 'journal-entry';

        const titleEl = document.createElement('div');
        titleEl.className = 'journal-entry-title';
        titleEl.textContent = entry.titleKey ? t(entry.titleKey) : (entry.title || 'Untitled');

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
        body.textContent = entry.textKeys ? entry.textKeys.map(k => t(k)).join('\n\n') : (entry.text || '');

        el.appendChild(titleEl);
        if (timeEl.textContent) el.appendChild(timeEl);
        el.appendChild(body);
        container.appendChild(el);
    });
}

let selectedObjectiveId = null;

export function renderObjectivesHistory() {
    const host = document.getElementById('objectivesHistoryContainer');
    if (!host) return;
    host.innerHTML = '';
    const all = getAllObjectivesWithState();
    const active = all.filter(o => o.state === 'active');
    const completed = all.filter(o => o.state === 'completed').sort((a,b) => (b.doneAt||0)-(a.doneAt||0));
    const allObjectives = [...active, ...completed];
    
    if (allObjectives.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'objectives-empty';
        empty.textContent = 'No objectives available yet.';
        host.appendChild(empty);
        return;
    }
    
    // Auto-select first objective if none selected
    if (!selectedObjectiveId || !allObjectives.find(o => o.id === selectedObjectiveId)) {
        selectedObjectiveId = allObjectives[0].id;
    }
    
    const container = document.createElement('div');
    container.className = 'objectives-two-column';
    
    // Left column: list of objectives
    const leftPanel = document.createElement('div');
    leftPanel.className = 'objectives-list-panel';
    
    if (active.length > 0) {
        const activeHeader = document.createElement('h3');
        activeHeader.className = 'objectives-section-header';
        activeHeader.textContent = t('objectives_active');
        leftPanel.appendChild(activeHeader);
        
        const activeList = document.createElement('ul');
        activeList.className = 'objectives-list';
        active.forEach(obj => {
            activeList.appendChild(createObjectiveListItem(obj));
        });
        leftPanel.appendChild(activeList);
    }
    
    if (completed.length > 0) {
        const completedHeader = document.createElement('h3');
        completedHeader.className = 'objectives-section-header';
        completedHeader.textContent = 'Completed';
        leftPanel.appendChild(completedHeader);
        
        const completedList = document.createElement('ul');
        completedList.className = 'objectives-list';
        completed.forEach(obj => {
            completedList.appendChild(createObjectiveListItem(obj));
        });
        leftPanel.appendChild(completedList);
    }
    
    const rightPanel = document.createElement('div');
    rightPanel.className = 'objectives-detail-panel';
    renderObjectiveDetails(rightPanel, allObjectives);
    
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
    host.appendChild(container);
}

function createObjectiveListItem(obj) {
    const li = document.createElement('li');
    li.className = 'objectives-list-item';
    if (obj.id === selectedObjectiveId) li.classList.add('selected');
    if (obj.state === 'completed') li.classList.add('completed');
    
    const marker = document.createElement('span');
    marker.className = 'objective-marker';
    marker.textContent = obj.state === 'completed' ? '\u2713' : '\u2022';
    
    const label = document.createElement('span');
    label.className = 'objective-label';
    label.textContent = obj.label;
    
    if (obj.state === 'active') {
        const trackedId = getTrackedObjectiveId();
        const isTracked = trackedId === obj.id;
        
        const trackBtn = document.createElement('button');
        trackBtn.className = 'objective-track-btn';
        trackBtn.textContent = t('objectives_track');
        trackBtn.title = isTracked ? 'Untrack objective' : 'Track objective';
        if (isTracked) trackBtn.classList.add('tracked');
        
        trackBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isTracked) {
                setTrackedObjective(null);
            } else {
                setTrackedObjective(obj.id);
            }
            renderObjectivesHistory();
        });
        
        li.appendChild(marker);
        li.appendChild(label);
        li.appendChild(trackBtn);
    } else {
        li.appendChild(marker);
        li.appendChild(label);
    }
    
    li.addEventListener('click', () => {
        selectedObjectiveId = obj.id;
        renderObjectivesHistory();
    });
    
    return li;
}

function renderObjectiveDetails(panel, allObjectives) {
    panel.innerHTML = '';
    const selected = allObjectives.find(o => o.id === selectedObjectiveId);
    if (!selected) return;
    
    const title = document.createElement('h3');
    title.className = 'objective-detail-title';
    title.textContent = selected.label;
    panel.appendChild(title);
    
    const statusRow = document.createElement('div');
    statusRow.className = 'objective-status-row';
    
    const status = document.createElement('div');
    status.className = 'objective-status';
    status.textContent = selected.state === 'completed' ? t('objectives_completed') : t('objectives_in_progress');
    if (selected.state === 'completed') status.classList.add('completed');
    statusRow.appendChild(status);
    
    if (selected.state === 'active') {
        const trackedId = getTrackedObjectiveId();
        const isTracked = trackedId === selected.id;
        
        if (isTracked) {
            const trackedBadge = document.createElement('div');
            trackedBadge.className = 'objective-status tracked-badge';
            trackedBadge.textContent = t('objectives_tracked');
            statusRow.appendChild(trackedBadge);
        }
    }
    
    panel.appendChild(statusRow);

    const narrative = (selected && typeof selected.narrative === 'string') ? selected.narrative.trim() : '';
    if (narrative) {
        const narrativeWrap = document.createElement('div');
        narrativeWrap.className = 'objective-detail-narrative';
        const markedGlobal = (typeof window !== 'undefined') ? window.marked : null;
        if (markedGlobal && typeof markedGlobal.parse === 'function') {
            narrativeWrap.innerHTML = markedGlobal.parse(narrative);
        } else {
            const paras = narrative.split(/\n\s*\n/g).map(s => s.trim()).filter(Boolean);
            paras.forEach(pTxt => {
                const p = document.createElement('p');
                p.textContent = pTxt;
                narrativeWrap.appendChild(p);
            });
        }
        panel.appendChild(narrativeWrap);
    }
    
    const steps = getObjectiveSteps(selected.id);
    if (steps.length > 0) {
        const stepsHeader = document.createElement('h4');
        stepsHeader.className = 'objective-detail-section-header';
        stepsHeader.textContent = 'Steps';
        panel.appendChild(stepsHeader);
        
        const stepsList = document.createElement('ul');
        stepsList.className = 'objective-detail-steps';
        steps.forEach(st => {
            const sLi = document.createElement('li');
            sLi.className = 'objective-detail-step';
            if (st.done) sLi.classList.add('done');
            
            const marker = document.createElement('span');
            marker.className = 'step-marker';
            marker.textContent = st.done ? '\u2713' : '\u2022';
            
            const label = document.createElement('span');
            label.className = 'step-label';
            label.textContent = st.label + (st.progress && !st.done ? ` (${st.progress})` : '');
            
            sLi.appendChild(marker);
            sLi.appendChild(label);
            stepsList.appendChild(sLi);
        });
        panel.appendChild(stepsList);
    }
    
    if (Array.isArray(selected.reward) && selected.reward.length) {
        const rewardHeader = document.createElement('h4');
        rewardHeader.className = 'objective-detail-section-header';
        rewardHeader.textContent = 'Reward';
        panel.appendChild(rewardHeader);
        
        const rewardEl = document.createElement('div');
        rewardEl.className = 'objective-detail-reward';
        rewardEl.textContent = selected.reward.map(r => `+${r.amount} ${r.resource}`).join(', ');
        panel.appendChild(rewardEl);
    }
    
    const timeBits = [];
    if (typeof selected.firstAt === 'number') timeBits.push(`Started: Day ${Math.floor(selected.firstAt/60/24)}, ${Math.floor((selected.firstAt/60)%24)}h ${selected.firstAt%60}m`);
    if (typeof selected.doneAt === 'number') timeBits.push(`Completed: Day ${Math.floor(selected.doneAt/60/24)}, ${Math.floor((selected.doneAt/60)%24)}h ${selected.doneAt%60}m`);
    if (timeBits.length) {
        const timeHeader = document.createElement('h4');
        timeHeader.className = 'objective-detail-section-header';
        timeHeader.textContent = 'Timeline';
        panel.appendChild(timeHeader);
        
        const tEl = document.createElement('div');
        tEl.className = 'objective-detail-times';
        timeBits.forEach(bit => {
            const p = document.createElement('p');
            p.textContent = bit;
            tEl.appendChild(p);
        });
        panel.appendChild(tEl);
    }
}

export function addJournalEntry(entry) {
    if (!entry || typeof entry !== 'object') return;
    storyLog.push(entry);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('storyLog', JSON.stringify(storyLog));
    }
    // Sync gameState so journal entries survive language-change reloads
    try { saveGameStateQuiet(); } catch (e) { /* non-fatal */ }
    try {
        window.dispatchEvent(new CustomEvent('journal-entry-added', { detail: { entry } }));
    } catch (e) {}
    const container = document.getElementById('journalEntriesContainer');
    if (container) renderJournalEntries(container);
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('journalBtn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openJournal(); });
});

window.addEventListener('gameReset', () => {
    const sec = document.getElementById('journalSection');
    if (!sec) return;
    const container = sec.querySelector('#journalEntriesContainer');
    if (container && typeof renderJournalEntries === 'function') {
        renderJournalEntries(container);
    }
});