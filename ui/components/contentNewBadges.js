import { saveGameStateQuiet } from '../../core/saveload.js';

// Content-level "NEW" markers (the little "!" next to actions/tech/buildings).
// This module is intentionally separate from menu-level badges (see `ui/menuBadges.js`).

export function getUiNewKey(kind, id) {
    const k = String(kind || '').trim();
    const v = String(id || '').trim();
    return `${k}:${v}`;
}

// Keep semantics simple and safe:
// an element is "new" only when its backing runtime flag is set (e.g. obj.uiNew === true).
// We do not infer "new" from missing keys, otherwise everything would be new on fresh games.
export function isUiNew(_key, legacyUiNew = false) {
    return !!legacyUiNew;
}

export function markUiSeen(_key) {
    // No-op for now; we use explicit runtime flags (uiNew) for correctness.
}

export function newBadgeHtml(isNewValue) {
    return isNewValue ? '<span class="action-new-badge" aria-hidden="true">!</span>' : '';
}

export function wireClearUiNewBadge(el, { key, legacyObj, legacyProp = 'uiNew', selector = '.action-new-badge' } = {}) {
    if (!el) return;

    // Avoid double-wiring if a renderer reuses DOM nodes.
    if (el.dataset && el.dataset.uiNewClearWired === 'true') return;
    try { if (el.dataset) el.dataset.uiNewClearWired = 'true'; } catch { /* ignore */ }

    const clear = () => {
        // Mark as seen (no-op currently, but kept for forward compatibility)
        if (key) markUiSeen(key);

        // Clear legacy flag if present
        try {
            if (legacyObj && legacyProp && legacyObj[legacyProp]) legacyObj[legacyProp] = false;
        } catch { /* ignore */ }

        // Remove badge from DOM
        try { el.querySelector(selector)?.remove(); } catch { /* ignore */ }

        // Persist UI state quietly
        try { saveGameStateQuiet(); } catch { /* ignore */ }
    };

    // Use addEventListener so touch handlers can be passive.
    // This removes Chrome's "Violation" warning about scroll-blocking listeners.
    el.addEventListener('mouseenter', clear);
    el.addEventListener('focus', clear);
    el.addEventListener('pointerdown', clear, { passive: true });
    el.addEventListener('touchstart', clear, { passive: true });
}
