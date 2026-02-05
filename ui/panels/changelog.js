document.addEventListener('DOMContentLoaded', () => {
    const changelogBtn = document.getElementById('changelogBtn');
    const changelogPopup = document.getElementById('changelogPopup');
    const closeBtn = changelogPopup?.querySelector('.changelog-close');
    const changelogBody = document.getElementById('changelogBody');

    let changelogLoaded = false; // Use a simple flag

    async function loadChangelog() {
        if (changelogLoaded) return; // Only load the content once
        
        try {
            const response = await fetch('./CHANGELOG.md');
            if (!response.ok) { // Check if the file was found
                throw new Error('Changelog.md not found');
            }
            const markdownText = await response.text();
            changelogBody.innerHTML = marked.parse(markdownText);
            changelogLoaded = true; // Set the flag
        } catch (error) {
            changelogBody.innerHTML = 'Error: Could not load changelog.';
            console.error('Error fetching changelog:', error);
        }
    }

    function showChangelog() {
        if (!changelogPopup) return;

        // Ensure popup is a direct child of <body> to avoid stacking-context issues
        if (changelogPopup.parentElement !== document.body) {
            document.body.appendChild(changelogPopup);
        }

        // Make visible (CSS controls sizing/stacking)
        changelogPopup.classList.remove('hidden');
        try { changelogPopup.style.removeProperty('display'); } catch { /* ignore */ }
        try { changelogPopup.style.removeProperty('z-index'); } catch { /* ignore */ }

        // Force reflow so the browser paints it immediately
        // eslint-disable-next-line no-unused-expressions
        changelogPopup.offsetHeight;

        // Load content (only first time)
        loadChangelog();
        // announce popup open so other systems (tooltips) can disable
        try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
    }

    changelogBtn?.addEventListener('click', () => {
        showChangelog();
    });

    closeBtn?.addEventListener('click', () => {
        changelogPopup.classList.add('hidden');
        try { changelogPopup.style.removeProperty('display'); } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
    });

    changelogPopup?.addEventListener('click', (e) => {
        if (e.target === changelogPopup) {
            changelogPopup.classList.add('hidden');
            try { changelogPopup.style.removeProperty('display'); } catch { /* ignore */ }
            try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
        }
    });
});