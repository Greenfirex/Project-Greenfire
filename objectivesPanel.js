// Objectives UI Panel (footer middle)
// - Toggle chip "Objectives ▴" opens a slide-up drawer
// - Shows up to 5 terse, spoiler-lite items
// - Read-only (no clicks)

import { getVisibleObjectives, recomputeObjectives } from './data/objectives.js';

let isOpen = false;
let elements = { container: null, toggle: null, drawer: null, list: null };

function ensureContainer() {
    if (elements.container) return elements.container;
    const midCol = document.querySelector('#footer .footer-column:nth-child(2)');
    if (!midCol) return null;

    const wrapper = document.createElement('div');
    wrapper.id = 'objectivesContainer';
    wrapper.className = 'objectives-container';

    const toggle = document.createElement('button');
    toggle.id = 'objectivesToggle';
    toggle.className = 'header-link objectives-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.title = 'Show current objectives';
    toggle.textContent = 'Objectives ▴';

    const drawer = document.createElement('div');
    drawer.id = 'objectivesDrawer';
    drawer.className = 'objectives-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    const list = document.createElement('ul');
    list.id = 'objectivesList';
    list.className = 'objectives-list';
    drawer.appendChild(list);

    wrapper.appendChild(toggle);
    wrapper.appendChild(drawer);
    midCol.appendChild(wrapper);

    toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        drawer.classList.toggle('open', isOpen);
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.textContent = isOpen ? 'Objectives ▾' : 'Objectives ▴';
        drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (isOpen) {
            try { recomputeObjectives(); } catch {}
            renderList();
        }
    });

    elements = { container: wrapper, toggle, drawer, list };
    return wrapper;
}

function renderList() {
    if (!elements.list) return;
    const items = getVisibleObjectives(5);
    elements.list.innerHTML = '';

    if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'objective-empty';
        li.textContent = 'No objectives right now.';
        elements.list.appendChild(li);
        return;
    }

    items.forEach(obj => {
        const li = document.createElement('li');
        li.className = 'objective-item' + (obj.completed ? ' completed' : '');
        const marker = document.createElement('span');
        marker.className = 'objective-marker';
        marker.textContent = obj.completed ? '✓' : '•';
        const label = document.createElement('span');
        label.className = 'objective-label';
        label.textContent = obj.label;
        li.appendChild(marker);
        li.appendChild(label);
        elements.list.appendChild(li);
    });
}

function refreshIfOpen() {
    if (!isOpen) return;
    try { recomputeObjectives(); } catch {}
    renderList();
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
window.addEventListener('objectivesChanged', () => {
    // If closed, just update the toggle text (no need for now). If open, re-render.
    refreshIfOpen();
});

// On major lifecycle events, recompute to catch up
window.addEventListener('game-state-applied', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
window.addEventListener('gameReset', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
window.addEventListener('game-resume', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });

// Optional: when new resources are discovered (can unlock objectives), recompute
window.addEventListener('resourceDiscovered', () => { try { recomputeObjectives(); } catch {} refreshIfOpen(); });
