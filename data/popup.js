// popup.js

let isPopupClosable = false;

/**
 * Shows the story popup with a specific title and message.
 */
export function showStoryPopup(title, message) {
    const storyPopup = document.getElementById('storyPopup');
    const popupTitle = document.getElementById('popupTitle');
    const popupMessage = document.getElementById('popupMessage');

    if (!storyPopup || !popupTitle || !popupMessage) {
        console.error("Popup HTML elements not found!");
        return;
    }

    // When the popup appears, make the overlay unclosable for a short time.
    isPopupClosable = false;

    popupTitle.textContent = title;
    popupMessage.textContent = message;
    storyPopup.classList.remove('hidden');

    // After a 1.5-second delay, make the overlay closable.
    setTimeout(() => {
        isPopupClosable = true;
    }, 1500);
}

/**
 * Hides the popup, but only if the delay has passed. (For the overlay click)
 */
function hidePopupWithDelay() {
    if (!isPopupClosable) {
        return; // Ignore the click if the delay isn't over
    }
    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
    }
}

/**
 * Hides the popup instantly, ignoring any delay. (For the '×' button)
 */
function forceHidePopup() {
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
        // The '×' button calls the instant close function.
        popupCloseButton.addEventListener('click', forceHidePopup);
        
        // The overlay background calls the delayed close function.
        storyPopup.addEventListener('click', (event) => {
            if (event.target === storyPopup) {
                hidePopupWithDelay();
            }
        });
    } else {
        console.error("Could not attach popup close listeners.");
    }
}

window.addEventListener('load', setupPopupClosers);