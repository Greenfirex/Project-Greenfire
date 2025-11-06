// Objectives UI Panel (footer middle)
// - Toggle chip "Objectives ▴" opens a slide-up drawer
// - Shows up to 5 terse, spoiler-lite items
// - Read-only (no clicks)

import { getVisibleObjectives, recomputeObjectives } from './data/objectives.js';

let isOpen = false;
let elements = { container: null, banner: null, drawer: null, list: null, details: null };

function ensureContainer() {
    if (elements.container) return elements.container;
    const midCol = document.querySelector('#footer .footer-column:nth-child(2)');
    if (!midCol) return null;

    const wrapper = document.createElement('div');
    wrapper.id = 'objectivesContainer';
    wrapper.className = 'objectives-container';

    const banner = document.createElement('div');
    banner.id = 'objectivesBanner';
    banner.className = 'objectives-banner';
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.setAttribute('aria-expanded', 'false');
    banner.title = 'Show current objective details';
    banner.innerHTML = `
        <span class="chevrons" aria-hidden="true">
            <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
            </svg>
        </span>
        <span class="current-objective-label">Current Objective: <em class="current-objective-text">—</em></span>`;

    const drawer = document.createElement('div');
    drawer.id = 'objectivesDrawer';
    drawer.className = 'objectives-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    const details = document.createElement('div');
    details.className = 'objective-details';
    const list = document.createElement('ul');
    list.id = 'objectivesList';
    list.className = 'objectives-list';
    details.appendChild(list);
    // Close control (top-right) — double chevron pointing down
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Collapse objectives');
    closeBtn.innerHTML = `
        <svg class="chevrons-icon down" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6 L12 15 L21 6" stroke-linecap="round" />
            <path d="M3 0 L12 9 L21 0" stroke-linecap="round" />
        </svg>`;
    closeBtn.addEventListener('click', () => {
        // Use same toggle logic to close
        if (isOpen) {
            isOpen = false;
            drawer.classList.remove('open');
            banner.setAttribute('aria-expanded', 'false');
            drawer.setAttribute('aria-hidden', 'true');
        }
    });

    drawer.appendChild(closeBtn);
    drawer.appendChild(details);
    // Add vertical glow lines (left & right) to match surrounding panel separators
    const glowLeft = document.createElement('div');
    glowLeft.className = 'glow-vert glow-left';
    const glowRight = document.createElement('div');
    glowRight.className = 'glow-vert glow-right';
    drawer.appendChild(glowLeft);
    drawer.appendChild(glowRight);

    wrapper.appendChild(banner);
    // Drawer now stays scoped to middle footer column only
    wrapper.appendChild(drawer);
    midCol.appendChild(wrapper);

    function toggleOpen() {
        isOpen = !isOpen;
        drawer.classList.toggle('open', isOpen);
        banner.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (isOpen) {
            try { recomputeObjectives(); } catch {}
            renderDetails();
        }
    }
    banner.addEventListener('click', toggleOpen);
    banner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); } });

    elements = { container: wrapper, banner, drawer, list, details };
    return wrapper;
}

function pickCurrentObjective() {
    const items = getVisibleObjectives(5);
    // Choose first active if any; else first incomplete; else most recent completed.
    const activeFirst = items.find(i => !i.completed);
    return activeFirst || items[0] || null;
}

function renderBannerText() {
    if (!elements.banner) return;
    const current = pickCurrentObjective();
    const textEl = elements.banner.querySelector('.current-objective-text');
    if (textEl) textEl.textContent = current ? current.label : '—';
}

function renderDetails() {
    if (!elements.details) return;
    elements.details.innerHTML = '';
    const current = pickCurrentObjective();
    const header = document.createElement('h4');
    header.textContent = current ? current.label : 'No current objective';
    elements.details.appendChild(header);
    if (!current) return;
    // Placeholder guidance text — could evolve into rich hints
    const guidance = document.createElement('p');
    guidance.textContent = 'Steps: Progress this objective by performing its associated action or fulfilling its condition.';
    elements.details.appendChild(guidance);
    // We don't have direct access to defs here; show a generic reward line if available via custom event payload in future.
    // For now, omit reward lookup to keep this module sync-only and avoid dynamic imports.
}

function refreshIfOpen() {
    try { recomputeObjectives(); } catch {}
    renderBannerText();
    if (isOpen) renderDetails();
}

// Public-ish re-render hook
export function refreshObjectivesPanel() {
    ensureContainer();
    refreshIfOpen();
}

// Init on DOM ready or immediately if DOM is already available
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ensureContainer();
        try { recomputeObjectives(); } catch {}
    });
} else {
    ensureContainer();
    try { recomputeObjectives(); } catch {}
}

// Listen for model changes
window.addEventListener('objectivesChanged', () => { refreshIfOpen(); });

// On major lifecycle events, recompute to catch up
window.addEventListener('game-state-applied', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
window.addEventListener('gameReset', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
window.addEventListener('game-resume', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });

// Optional: when new resources are discovered (can unlock objectives), recompute
window.addEventListener('resourceDiscovered', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
