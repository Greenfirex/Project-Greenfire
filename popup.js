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

    messageEl.textContent = activeStoryEvent.pages[currentPageIndex];
    pagingEl.textContent = `${currentPageIndex + 1} / ${activeStoryEvent.pages.length}`;
    if (currentPageIndex === activeStoryEvent.pages.length - 1) {
        nextBtn.textContent = 'Close';
    } else {
        nextBtn.textContent = 'Next';
    }
    prevBtn.style.visibility = (currentPageIndex === 0) ? 'hidden' : 'visible';
}

export function showStoryPopup(event) {
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
    if (contentEl && contentEl.parentElement !== document.body) {
        // keep content inside overlay; ensure overlay is direct child of body
        // (we've already appended overlayEl to body, so content remains inside it)
    }

    // Populate and show
    renderPopupPage();

    // Set very-high z-index to outrank options and other UI
    if (overlayEl) overlayEl.style.zIndex = '2147483000';
    if (contentEl) contentEl.style.zIndex = '2147483001';

    // Make visible
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = '';
    // force a reflow so browser applies stacking and transitions immediately
    // eslint-disable-next-line no-unused-expressions
    overlayEl.offsetHeight;

    // focus for accessibility and to ensure it's active on some browsers
    overlayEl.setAttribute('tabindex', '-1');
    try { overlayEl.focus({ preventScroll: true }); } catch (e) {}

    console.debug('showStoryPopup displayed:', event?.title || event?.id || '<unknown>');
}

function hideStoryPopup() {
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