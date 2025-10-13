import { startImpactTimer } from './eventManager.js';

let activeStoryEvent = null;
let currentPageIndex = 0;

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

    messageEl.textContent = activeStoryEvent.message[currentPageIndex];
    pagingEl.textContent = `${currentPageIndex + 1} / ${activeStoryEvent.message.length}`;
    
    if (currentPageIndex === activeStoryEvent.message.length - 1) {
        nextBtn.textContent = 'Close';
    } else {
        nextBtn.textContent = 'Next';
    }

    prevBtn.style.visibility = (currentPageIndex === 0) ? 'hidden' : 'visible';
}

/**
 * Shows the story popup with the data from a story event object.
 */
export function showStoryPopup(event) {
    const storyPopup = document.getElementById('storyPopup');
    const titleEl = document.getElementById('popupTitle');
    
    if (!storyPopup || !titleEl || !event || !event.message) return;

    activeStoryEvent = event;
    currentPageIndex = 0;

    titleEl.textContent = activeStoryEvent.title;
    storyPopup.classList.remove('hidden');
    renderPopupPage();
}

/**
 * Hides the story popup and performs any necessary cleanup.
 */
function hideStoryPopup() {
    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
    }
    activeStoryEvent = null; // Clear the active event
}

/**
 * Sets up the event listeners for the popup's controls.
 */
function setupPopup() {
    const storyPopup = document.getElementById('storyPopup');
    const nextBtn = document.getElementById('popupNext');
    const prevBtn = document.getElementById('popupPrev');
    const closeBtn = storyPopup ? storyPopup.querySelector('.popup-close') : null;

    if (!storyPopup || !nextBtn || !prevBtn || !closeBtn) return;

    nextBtn.addEventListener('click', () => {
        if (!activeStoryEvent) return;
        if (currentPageIndex < activeStoryEvent.message.length - 1) {
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

window.addEventListener('load', setupPopup);