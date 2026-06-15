// Content "new" badge helpers.
// Used by location actions, character inventory, and menu sections.
import { markActionSeen } from '../../engine/gameFlags.js';

/**
 * Returns HTML for a "NEW" badge indicator if visible is true.
 * The badge shows "!" for compact use in action buttons.
 */
export function newBadgeHtml(visible) {
    if (!visible) return '';
    return '<span class="action-new-badge" aria-hidden="true">!</span>';
}

/**
 * Wires an element so the "new" badge is cleared when the player hovers
 * or focuses the element. Also supports a click-based clear via legacyObj.
 * @param {Element} element - The DOM element containing the badge
 * @param {Object} options - { legacyObj, legacyProp, actionId }
 *   - actionId: the action ID to mark as seen (preferred)
 *   - legacyObj/legacyProp: fallback for older callers (sets obj[prop] = false)
 */
export function wireClearUiNewBadge(element, options = {}) {
    if (!element) return;
    const { actionId, legacyObj, legacyProp } = options;

    function clearBadge() {
        const badge = element.querySelector('.action-new-badge');
        if (badge) {
            badge.remove();
            element.classList.remove('has-new-badge');
        }
        // Mark as seen in game flags
        if (actionId) {
            markActionSeen(actionId, true);
        }
        // Legacy fallback
        if (legacyObj && legacyProp && legacyObj[legacyProp]) {
            legacyObj[legacyProp] = false;
        }
    }

    // Clear on hover or focus (first interaction)
    element.addEventListener('mouseenter', clearBadge, { once: true });
    element.addEventListener('focus', clearBadge, { once: true });
}
