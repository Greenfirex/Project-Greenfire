import { getIngameTimeObject, getIngameTimeString } from './time.js';

let activeStoryEvent = null;
let currentPageIndex = 0;

// Add a single Esc handler that is attached only while the popup is open
let _popupEscHandler = null;
function attachPopupEscHandler(overlayEl) {
    if (_popupEscHandler) return;
    _popupEscHandler = function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // prefer using the existing close button so existing close logic runs
            const closeBtn = (overlayEl && overlayEl.querySelector) ? overlayEl.querySelector('.story-popup-close') : document.querySelector('.story-popup-close');
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

/**
 * Renders a specific page of a story event in the popup.
 */
function renderPopupPage() {
    if (!activeStoryEvent) return;

    const messageEl = document.getElementById('popupMessage');
    const pagingEl = document.getElementById('popupPaging');
    const nextBtn = document.getElementById('popupNext');
    const prevBtn = document.getElementById('popupPrev');

    if (!messageEl || !pagingEl || !nextBtn || !prevBtn) return;

    // Apply the project's shared button style so popup nav matches the rest of the UI
    try {
        nextBtn.classList.add('menu-button', 'story-nav-button');
        prevBtn.classList.add('menu-button', 'story-nav-button');
    } catch (e) { /* ignore in case buttons change */ }
    
    // use innerHTML with pre-wrap in CSS to preserve paragraph spacing
    // If you want markdown support, replace the next line with: messageEl.innerHTML = marked(activeStoryEvent.pages[currentPageIndex]);
    messageEl.innerHTML = (activeStoryEvent.pages[currentPageIndex] || '').replace(/\n/g, '<br><br>');
    pagingEl.textContent = `${currentPageIndex + 1} / ${activeStoryEvent.pages.length}`;
    if (currentPageIndex === activeStoryEvent.pages.length - 1) {
        nextBtn.textContent = 'Close';
    } else {
        nextBtn.textContent = 'Next';
    }
    prevBtn.style.visibility = (currentPageIndex === 0) ? 'hidden' : 'visible';
}

export function showStoryPopup(event) {
    try { window.dispatchEvent(new CustomEvent('request-hide-tooltip')); } catch (e) { /* ignore */ }
    const storyPopup = document.getElementById('storyPopup');
    const titleEl = document.getElementById('popupTitle');
    const overlay = storyPopup ? storyPopup : document.getElementById('storyPopup'); // keep reference

    if (!storyPopup || !titleEl || !event || !event.pages || event.pages.length === 0) {
        console.debug('showStoryPopup aborted: missing elements or invalid event', { storyPopup, titleEl, event });
        return;
    }

    activeStoryEvent = event;
    currentPageIndex = 0;

    titleEl.textContent = activeStoryEvent.title;

    // Ensure popup and its overlay live directly under body so stacking contexts don't hide them
    const overlayEl = document.getElementById('storyPopup'); // your overlay element id
    const contentEl = overlayEl ? overlayEl.querySelector('.story-popup-content') : null;

    if (overlayEl && overlayEl.parentElement !== document.body) {
        document.body.appendChild(overlayEl);
    }

    // Populate and show
    renderPopupPage();

    // Set very-high z-index to outrank options and other UI
    if (overlayEl) overlayEl.style.zIndex = '2147483000';
    if (contentEl) contentEl.style.zIndex = '2147483001';

    // Make visible
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = '';
    overlayEl.offsetHeight;
    overlayEl.setAttribute('tabindex', '-1');
    try { overlayEl.focus({ preventScroll: true }); } catch (e) {}

    // attach Esc handler now that popup is visible
    attachPopupEscHandler(overlayEl);

    try {
        const raw = localStorage.getItem('storyLog');
        const list = raw ? JSON.parse(raw) : [];
        const id = event.id || event.title || null;
        const text = (Array.isArray(event.pages) ? event.pages.join('\n\n') : (event.pages || event.text || '')) || '';
        // dedupe by id/title
        const exists = id ? list.find(x => x.id === id) : list.find(x => x.title === (event.title || id));
        if (!exists) {
            list.push({
                id,
                title: event.title || id || 'Untitled',
                time: Date.now(),
                // store structured in-game time object (day/hour/minute) for exact timestamping
                ingameTime: (() => { try { return getIngameTimeObject(); } catch(e){ return null; } })(),
                text
            });
            localStorage.setItem('storyLog', JSON.stringify(list));
        }
    } catch (e) { /* ignore storage errors */ }

    console.debug('showStoryPopup displayed:', event?.title || event?.id || '<unknown>');
}

function hideStoryPopup() {
    // detach Esc handler immediately so it won't fire during hide steps
    detachPopupEscHandler();

    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
        storyPopup.style.display = 'none';
    }
    activeStoryEvent = null;
}

// setupPopup unchanged except it uses the existing elements
function setupPopup() {
    const storyPopup = document.getElementById('storyPopup');
    const nextBtn = document.getElementById('popupNext');
    const prevBtn = document.getElementById('popupPrev');
    const closeBtn = storyPopup ? storyPopup.querySelector('.story-popup-close') : null;

    if (!storyPopup || !nextBtn || !prevBtn || !closeBtn) return;

    nextBtn.addEventListener('click', () => {
        if (!activeStoryEvent) return;
        if (currentPageIndex < activeStoryEvent.pages.length - 1) {
            currentPageIndex++;
            renderPopupPage();
        } else {
            hideStoryPopup();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (!activeStoryEvent || currentPageIndex <= 0) return;
        currentPageIndex--;
        renderPopupPage();
    });

    closeBtn.addEventListener('click', hideStoryPopup);
}

document.addEventListener('DOMContentLoaded', setupPopup);