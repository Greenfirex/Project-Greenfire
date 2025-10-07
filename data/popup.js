/**
 * Shows the story popup with a specific title and message.
 */
export function showStoryPopup(title, message) {
    // FIXED: Find the elements right when the function is called.
    const storyPopup = document.getElementById('storyPopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupMessage = document.getElementById('popupMessage');

    if (!storyPopup || !popupTitle || !popupMessage) {
        console.error("Popup HTML elements not found!");
        return;
    }

    popupTitle.textContent = title;
    popupMessage.textContent = message;
    storyPopup.classList.remove('hidden');
}

/**
 * Hides the story popup.
 */
function hideStoryPopup() {
    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
    }
}

// This function sets up the close buttons and should only run once the page is loaded.
function setupPopupClosers() {
    const storyPopup = document.getElementById('storyPopup');
    const popupCloseButton = storyPopup ? storyPopup.querySelector('.popup-close') : null;

    if (storyPopup && popupCloseButton) {
        popupCloseButton.addEventListener('click', hideStoryPopup);
        storyPopup.addEventListener('click', (event) => {
            if (event.target === storyPopup) {
                hideStoryPopup();
            }
        });
    } else {
        console.error("Could not attach popup close listeners.");
    }
}

// Run the setup function after the page has fully loaded.
window.addEventListener('load', setupPopupClosers);