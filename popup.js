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

    // MODIFIED: Use the 'pages' array
    messageEl.textContent = activeStoryEvent.pages[currentPageIndex];
    pagingEl.textContent = `${currentPageIndex + 1} / ${activeStoryEvent.pages.length}`;
    
    // MODIFIED: Check against the length of the 'pages' array
    if (currentPageIndex === activeStoryEvent.pages.length - 1) {
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
    
    // MODIFIED: Check for the 'pages' property instead of 'message'
    if (!storyPopup || !titleEl || !event || !event.pages || event.pages.length === 0) return;

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

    // Check if the intro story was the one being closed, then start the timer
    if (activeStoryEvent && activeStoryEvent.title === "Project Greenfire - Déjà Vu") {
        startImpactTimer();
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
    const closeBtn = storyPopup ? storyPopup.querySelector('.story-popup-close') : null;

    if (!storyPopup || !nextBtn || !prevBtn || !closeBtn) return;

    nextBtn.addEventListener('click', () => {
        if (!activeStoryEvent) return;
        // MODIFIED: Check against the length of the 'pages' array
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

// This should be DOMContentLoaded to ensure elements exist before setup
document.addEventListener('DOMContentLoaded', setupPopup);