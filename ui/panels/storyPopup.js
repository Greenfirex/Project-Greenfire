// Lightweight story popup driver
// Uses existing #storyPopup DOM from index.html
// Archives entries to journal via addJournalEntry()

import { addJournalEntry } from '../../sections/journal.js';
import { getIsPaused, pauseGame, resumeGame } from '../chrome/footer.js';
import { getIngameTimeObject } from '../../core/time.js';

let activeStoryEvent = null;
let pausedByThisStoryPopup = false;
let _popupEscHandler = null;

function attachPopupEscHandler(overlayEl) {
    if (_popupEscHandler) return;
    _popupEscHandler = function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const closeBtn = overlayEl ? overlayEl.querySelector('.story-popup-close') : document.querySelector('.story-popup-close');
            if (closeBtn) closeBtn.click();
            else hideStoryPopup();
            e.preventDefault();
        }
    };
    document.addEventListener('keydown', _popupEscHandler);
}

function detachPopupEscHandler() {
    if (_popupEscHandler) {
        document.removeEventListener('keydown', _popupEscHandler);
        _popupEscHandler = null;
    }
}

function renderPopupPage() {
    if (!activeStoryEvent) return;

    const messageEl = document.getElementById('popupMessage');
    const titleEl = document.getElementById('popupTitle');
    const outcomeEl = document.getElementById('popupOutcome');

    if (!messageEl) return;

    if (titleEl) {
        titleEl.textContent = activeStoryEvent.title || '';
    }

    const pages = activeStoryEvent.pages || [];
    const combinedHTML = pages.map(page =>
        `<p>${(page || '').replace(/\n/g, '<br><br>')}</p>`
    ).join('');

    messageEl.innerHTML = combinedHTML;

    // Hide outcome footer by default (no rewards/unlocks for basic welcome popup)
    if (outcomeEl) {
        outcomeEl.innerHTML = '';
        outcomeEl.classList.add('hidden');
    }
}

export function showStoryPopup(event) {
    if (!event || !event.pages || event.pages.length === 0) {
        console.debug('showStoryPopup aborted: missing pages', { event });
        return;
    }

    try { window.dispatchEvent(new CustomEvent('request-hide-tooltip')); } catch { /* ignore */ }

    const overlayEl = document.getElementById('storyPopup');
    if (!overlayEl) return;

    activeStoryEvent = event;

    // Pause while the player reads
    try {
        pausedByThisStoryPopup = false;
        if (!getIsPaused()) {
            pauseGame(false);
            pausedByThisStoryPopup = true;
        }
    } catch { /* non-fatal */ }

    // Ensure popup lives directly under body
    if (overlayEl.parentElement !== document.body) {
        document.body.appendChild(overlayEl);
    }

    renderPopupPage();

    overlayEl.style.zIndex = '2147483000';
    try { overlayEl.hidden = false; } catch { /* ignore */ }
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = '';
    try { window.dispatchEvent(new CustomEvent('popup-open')); } catch { /* ignore */ }

    attachPopupEscHandler(overlayEl);

    // Archive to journal (deduplicated by id)
    const entry = {
        id: event.id || event.title || null,
        title: event.title || event.id || 'Untitled',
        time: Date.now(),
        ingameTime: (function () { try { return getIngameTimeObject(); } catch { return null; } })(),
        text: (Array.isArray(event.pages) ? event.pages.join('\n\n') : (event.pages || '')) || '',
    };

    // Check for existing entry with same id to avoid duplicates
    const existing = (function () {
        try {
            const raw = localStorage.getItem('storyLog');
            const list = raw ? JSON.parse(raw) : [];
            return entry.id ? list.find(x => x.id === entry.id) : null;
        } catch { return null; }
    })();

    if (!existing) {
        addJournalEntry(entry);
    }
}

function hideStoryPopup() {
    detachPopupEscHandler();

    const overlayEl = document.getElementById('storyPopup');
    if (overlayEl) {
        overlayEl.classList.add('hidden');
        try { overlayEl.hidden = true; } catch { /* ignore */ }
        overlayEl.style.display = 'none';
    }
    activeStoryEvent = null;
    try { window.dispatchEvent(new CustomEvent('popup-close')); } catch { /* ignore */ }

    try {
        if (pausedByThisStoryPopup && getIsPaused()) {
            resumeGame(false);
        }
    } catch { /* non-fatal */ }
    pausedByThisStoryPopup = false;
}

function setupPopup() {
    const overlayEl = document.getElementById('storyPopup');
    const closeBtn = document.getElementById('popupClose');
    const xBtn = overlayEl ? overlayEl.querySelector('.story-popup-close') : null;

    if (!overlayEl) return;

    if (closeBtn) closeBtn.addEventListener('click', hideStoryPopup);
    if (xBtn) xBtn.addEventListener('click', hideStoryPopup);
}

document.addEventListener('DOMContentLoaded', setupPopup);