// Lightweight story popup driver
// Uses existing #storyPopup DOM from index.html
// Archives entries to journal via addJournalEntry()

import { addJournalEntry } from '../../sections/journal/journal.js';
import { getIngameTimeObject } from '../../engine/time.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { storyLog } from '../../engine/objectives.js';

let activeStoryEvent = null;
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

    // Game time only advances during actions — no need to pause for popups

    // Ensure popup lives directly under body
    if (overlayEl.parentElement !== document.body) {
        document.body.appendChild(overlayEl);
    }

    renderPopupPage();

    // Entrance animation: add grow-in class, remove after animation completes
    const contentEl = overlayEl.querySelector('.story-popup-content');
    if (contentEl) {
        contentEl.classList.add('popup-entering');
        contentEl.addEventListener('animationend', function onEnd() {
            contentEl.classList.remove('popup-entering');
            contentEl.removeEventListener('animationend', onEnd);
        }, { once: true });
    }

    overlayEl.style.zIndex = '2147483000';
    if (event.transparentBg) {
        overlayEl.classList.add('intro-transparent-bg');
    }
    try { overlayEl.hidden = false; } catch { /* ignore */ }
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = '';
    try { window.dispatchEvent(new CustomEvent('popup-open')); } catch { /* ignore */ }

    attachPopupEscHandler(overlayEl);

    // Archive to journal (deduplicated by id)
    const entry = {
        id: event.id || event.title || null,
        title: event.title || event.id || 'Untitled',
        titleKey: event.titleKey || null,
        time: Date.now(),
        ingameTime: (function () { try { return getIngameTimeObject(); } catch { return null; } })(),
        text: (Array.isArray(event.pages) ? event.pages.join('\n\n') : (event.pages || '')) || '',
        textKeys: event.pageKeys || null,
    };

    // Check for existing entry with same id to avoid duplicates.
    // Use in-memory storyLog (not localStorage) to avoid a stale-data race:
    // on New Game, showStoryPopup fires before resetToDefaultState() clears
    // localStorage, so the old storyLog would still be there and cause a
    // false-positive dedup match, skipping addJournalEntry entirely.
    const existing = (entry.id && Array.isArray(storyLog))
        ? storyLog.find(x => x && x.id === entry.id) || null
        : null;

    if (!existing) {
        addJournalEntry(entry);
        if (event.deferLog) {
            // Store the title so the caller can log it after UI is ready
            event._deferredLogTitle = entry.title;
        } else {
            addLogEntry(t('log_story_entry', { title: entry.title }), LogType.STORY);
        }
    }
}

export function hideStoryPopup() {
    detachPopupEscHandler();

    const onClose = activeStoryEvent?.onClose;
    const overlayEl = document.getElementById('storyPopup');
    if (overlayEl) {
        overlayEl.classList.remove('intro-transparent-bg');
        overlayEl.classList.add('hidden');
        try { overlayEl.hidden = true; } catch { /* ignore */ }
        overlayEl.style.display = 'none';
    }
    activeStoryEvent = null;
    try { window.dispatchEvent(new CustomEvent('popup-close')); } catch { /* ignore */ }


    // Fire the onClose callback if one was provided
    if (typeof onClose === 'function') {
        onClose();
    }
}

function setupPopup() {
    const overlayEl = document.getElementById('storyPopup');
    const closeBtn = document.getElementById('popupClose');
    const xBtn = overlayEl ? overlayEl.querySelector('.story-popup-close') : null;

    if (!overlayEl) return;

    if (closeBtn) closeBtn.addEventListener('click', hideStoryPopup);
    if (xBtn) xBtn.addEventListener('click', hideStoryPopup);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPopup);
} else {
    setupPopup();
}
