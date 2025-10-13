import { startImpactTimer } from './eventManager.js';

let activeStoryEvent = null;
let currentPageIndex = 0;

/**
 * Renders a specific page of a story event in the popup.
 */
function renderPopupPage() {
    if (!activeStoryEvent) return;

    const message = activeStoryEvent.message[currentPageIndex];
    document.getElementById('popupMessage').textContent = message;

    // Update paging info and button text
    const pagingEl = document.getElementById('popupPaging');
    const nextBtn = document.getElementById('popupNext');
    
    pagingEl.textContent = `${currentPageIndex + 1} / ${activeStoryEvent.message.length}`;
    
    // If it's the last page, change "Next" to "Close"
    if (currentPageIndex === activeStoryEvent.message.length - 1) {
        nextBtn.textContent = 'Close';
    } else {
        nextBtn.textContent = 'Next';
    }

    // Hide "Previous" button on the first page
    document.getElementById('popupPrev').style.visibility = (currentPageIndex === 0) ? 'hidden' : 'visible';
}

export function showStoryPopup(event) {
    const storyPopup = document.getElementById('storyPopup');
    if (!storyPopup || !event) return;

    activeStoryEvent = event; // Store the active event
    currentPageIndex = 0;

    document.getElementById('popupTitle').textContent = activeStoryEvent.title;
    storyPopup.classList.remove('hidden');
    renderPopupPage();
}

function hideStoryPopup() {
    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
    }

    // If we just closed the intro story, start the impact timer!
    if (activeStoryEvent && activeStoryEvent.title === "Project Greenfire") {
        startImpactTimer();
    }
    activeStoryEvent = null;
}

function setupPopup() {
    const nextBtn = document.getElementById('popupNext');
    const prevBtn = document.getElementById('popupPrev');

    nextBtn.addEventListener('click', () => {
        if (currentPageIndex < activeStoryEvent.message.length - 1) {
            currentPageIndex++;
            renderPopupPage();
        } else {
            hideStoryPopup(); // Close the popup if on the last page
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            renderPopupPage();
        }
    });

    // Close button still works instantly
    const closeBtn = document.querySelector('.popup-close');
    closeBtn.addEventListener('click', hideStoryPopup);
}

window.addEventListener('load', setupPopup);