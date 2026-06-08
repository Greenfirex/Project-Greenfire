// Minimal stub for content "new" badges.
// Returns empty string — badges are handled inline by character.js.
export function newBadgeHtml(visible) {
    if (!visible) return '';
    return '<span class="action-new-badge" aria-hidden="true">NEW</span>';
}

export function wireClearUiNewBadge(element, options) {
    // No-op stub
}