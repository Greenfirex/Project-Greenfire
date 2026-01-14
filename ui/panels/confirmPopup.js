// Small confirmation popup (reuses Story popup styling)
// Returns a Promise<boolean> resolving to true for confirm, false for cancel.

let _active = false;
let _resolve = null;
let _escHandler = null;

function ensureOverlay() {
    let overlay = document.getElementById('confirmPopup');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'confirmPopup';
    // Reuse story popup overlay styling so it matches the game.
    overlay.className = 'story-popup-overlay hidden';

    overlay.innerHTML = `
        <div class="story-popup-content confirm-popup-content" role="dialog" aria-modal="true" aria-label="Confirmation">
            <div class="story-popup-header">
                <h2 id="confirmPopupTitle">Confirm</h2>
            </div>
            <div class="story-popup-body">
                <div class="story-popup-text">
                    <div id="confirmPopupMessage"></div>
                </div>
            </div>
            <div class="story-popup-nav confirm-popup-nav">
                <button type="button" class="menu-button story-nav-button" data-confirm-cancel>Cancel</button>
                <button type="button" class="menu-button story-nav-button" data-confirm-ok>Yes</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Click outside content cancels
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cancel();
        }
    });

    const cancelBtn = overlay.querySelector('[data-confirm-cancel]');
    const okBtn = overlay.querySelector('[data-confirm-ok]');
    cancelBtn?.addEventListener('click', (e) => { e.preventDefault(); cancel(); });
    okBtn?.addEventListener('click', (e) => { e.preventDefault(); confirmOk(); });

    return overlay;
}

function attachEsc(overlayEl) {
    if (_escHandler) return;
    _escHandler = (e) => {
        if (!_active) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            cancel();
        }
    };
    document.addEventListener('keydown', _escHandler);
}

function detachEsc() {
    if (_escHandler) {
        document.removeEventListener('keydown', _escHandler);
        _escHandler = null;
    }
}

function hide() {
    const overlay = document.getElementById('confirmPopup');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.display = 'none';
    }
    detachEsc();
    try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }
}

function finish(result) {
    if (!_active) return;
    _active = false;

    const r = _resolve;
    _resolve = null;

    hide();

    if (typeof r === 'function') {
        try { r(!!result); } catch (e) { /* ignore */ }
    }
}

function cancel() {
    finish(false);
}

function confirmOk() {
    finish(true);
}

export function showConfirmPopup({
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Yes',
    cancelText = 'Cancel',
} = {}) {
    // If a confirm is already open, refuse to open another.
    if (_active) return Promise.resolve(false);

    try { window.dispatchEvent(new CustomEvent('request-hide-tooltip')); } catch (e) { /* ignore */ }

    const overlay = ensureOverlay();
    const titleEl = overlay.querySelector('#confirmPopupTitle');
    const msgEl = overlay.querySelector('#confirmPopupMessage');
    const cancelBtn = overlay.querySelector('[data-confirm-cancel]');
    const okBtn = overlay.querySelector('[data-confirm-ok]');

    if (titleEl) titleEl.textContent = String(title || 'Confirm');
    if (msgEl) msgEl.textContent = String(message || 'Are you sure?');
    if (cancelBtn) cancelBtn.textContent = String(cancelText || 'Cancel');
    if (okBtn) okBtn.textContent = String(confirmText || 'Yes');

    // Ensure it lives directly under body so stacking contexts don't hide it
    if (overlay.parentElement !== document.body) {
        document.body.appendChild(overlay);
    }

    // Put it above story/combat popups if needed
    overlay.style.zIndex = '2147483200';
    const contentEl = overlay.querySelector('.confirm-popup-content');
    if (contentEl) contentEl.style.zIndex = '2147483201';

    overlay.classList.remove('hidden');
    overlay.style.display = '';
    try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }

    overlay.setAttribute('tabindex', '-1');
    try { overlay.focus({ preventScroll: true }); } catch (e) { /* ignore */ }

    attachEsc(overlay);

    _active = true;

    return new Promise((resolve) => {
        _resolve = resolve;
        // Prefer focusing the Cancel button so accidental Enter doesn't delete items
        try { cancelBtn?.focus?.({ preventScroll: true }); } catch (e) { /* ignore */ }
    });
}
