import { getIngameTimeObject } from '../../core/time.js';
import { addJournalEntry } from '../../sections/journal.js';
import { allActions as _allActions } from '../../data/definitions/allActions.js';
import { recipeActions as _recipeActions } from '../../data/definitions/recipes.js';
import { getItemDefinition } from '../../data/definitions/items.js';
import { getIsPaused, pauseGame, resumeGame } from '../footer.js';
import { isCompactPhoneLandscape } from '../compactMode.js';

let activeStoryEvent = null;
let activeOutcome = null; // optional footer content (rewards/unlocks)

let pausedByThisStoryPopup = false;

let _scrollLock = null;

function lockBackgroundScroll() {
    if (_scrollLock) return;
    try {
        const docEl = document.documentElement;
        const body = document.body;
        if (!docEl || !body) return;

        _scrollLock = {
            body: {
                overflow: body.style.overflow,
                overscrollBehavior: body.style.overscrollBehavior,
                touchAction: body.style.touchAction,
            },
            html: {
                overflow: docEl.style.overflow,
                overscrollBehavior: docEl.style.overscrollBehavior,
                touchAction: docEl.style.touchAction,
            }
        };

        // Double safety: prevent rubber-banding/scroll chaining.
        body.style.overflow = 'hidden';
        docEl.style.overflow = 'hidden';
        body.style.overscrollBehavior = 'none';
        docEl.style.overscrollBehavior = 'none';
        body.style.touchAction = 'none';
        docEl.style.touchAction = 'none';
    } catch {
        /* ignore */
    }
}

function unlockBackgroundScroll() {
    if (!_scrollLock) return;
    try {
        const { body: prevBody, html: prevHtml } = _scrollLock;
        _scrollLock = null;

        const docEl = document.documentElement;
        const body = document.body;
        if (docEl && prevHtml) {
            docEl.style.overflow = prevHtml.overflow;
            docEl.style.overscrollBehavior = prevHtml.overscrollBehavior;
            docEl.style.touchAction = prevHtml.touchAction;
        }
        if (body && prevBody) {
            body.style.overflow = prevBody.overflow;
            body.style.overscrollBehavior = prevBody.overscrollBehavior;
            body.style.touchAction = prevBody.touchAction;
        }
    } catch {
        /* ignore */
    }
}

// Add a single Esc handler that is attached only while the popup is open
let _popupEscHandler = null;
function attachPopupEscHandler(overlayEl) {
    if (_popupEscHandler) return;
    _popupEscHandler = function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // prefer using the existing close button so existing close logic runs
            const closeBtn = (overlayEl && overlayEl.querySelector) ? overlayEl.querySelector('.story-popup-close') : document.querySelector('.story-popup-close');
            if (closeBtn) closeBtn.click();
            else hideStoryPopup();
            e.preventDefault();
        }
    };
    document.addEventListener('keydown', _popupEscHandler);
}
function detachPopupEscHandler() {
    if (_popupEscHandler) {
        document.removeEventListener('keydown', _popupEscHandler);
        _popupEscHandler = null;
    }
}

/**
 * Renders the story event content in the popup (all pages combined).
 */
function renderPopupPage() {
    if (!activeStoryEvent) return;

    const messageEl = document.getElementById('popupMessage');
    const closeBtn = document.getElementById('popupClose');

    const outcomeEl = document.getElementById('popupOutcome');
    if (!messageEl || !closeBtn) return;

    // Apply the project's shared button style
    try {
        closeBtn.classList.add('menu-button', 'story-nav-button');
    } catch (e) { /* ignore in case buttons change */ }
    
    // Combine all pages into paragraphs
    const allPages = activeStoryEvent.pages || [];
    const combinedHTML = allPages.map(page => 
        `<p>${(page || '').replace(/\n/g, '<br><br>')}</p>`
    ).join('');
    
    messageEl.innerHTML = combinedHTML;
    
    // Render outcome footer if present
    if (outcomeEl) {
        const hasRewards = !!(activeOutcome && Array.isArray(activeOutcome.rewards) && activeOutcome.rewards.length);
        const hasItems = !!(activeOutcome && Array.isArray(activeOutcome.items) && activeOutcome.items.length);
        const hasUnlocks = !!(activeOutcome && activeOutcome.unlocks && (
            (Array.isArray(activeOutcome.unlocks.actions) && activeOutcome.unlocks.actions.length) ||
            (Array.isArray(activeOutcome.unlocks.buildings) && activeOutcome.unlocks.buildings.length) ||
            (Array.isArray(activeOutcome.unlocks.sections) && activeOutcome.unlocks.sections.length) ||
            (Array.isArray(activeOutcome.unlocks.jobs) && activeOutcome.unlocks.jobs.length)
        ));
        const hasObjectives = !!(activeOutcome && activeOutcome.objectives && (
            (Array.isArray(activeOutcome.objectives.completed) && activeOutcome.objectives.completed.length) ||
            (Array.isArray(activeOutcome.objectives.newlyActive) && activeOutcome.objectives.newlyActive.length)
        ));
        if (hasRewards || hasItems || hasUnlocks || hasObjectives) {
            const makeList = (arr) => (arr || []).map(v => `<li>${v}</li>`).join('');
            let parts = [];
            if (hasObjectives) {
                const blocks = [];
                const comp = Array.isArray(activeOutcome.objectives.completed) ? activeOutcome.objectives.completed : [];
                const nexts = Array.isArray(activeOutcome.objectives.newlyActive) ? activeOutcome.objectives.newlyActive : [];
                // Show Objective Completed first, then New Objective
                if (comp.length) {
                    const items = comp.map(d => `<li class="completed-objective-item">${d.label}</li>`).join('');
                    blocks.push(`<div class="outcome-objectives-completed"><h4>Objective Completed</h4><ul>${items}</ul></div>`);
                }
                if (nexts.length) {
                    const items = nexts.map(d => `<li>${d.label}</li>`).join('');
                    blocks.push(`<div class="outcome-objectives-new"><h4>New Objective</h4><ul>${items}</ul></div>`);
                }
                parts.push(`<div class="outcome-objectives">${blocks.join('')}</div>`);
            }
            if (hasUnlocks) {
                const blocks = [];

                // Split actions into Upgrades vs non-Upgrades using definitions
                const actionsListRaw = Array.isArray(activeOutcome.unlocks.actions) ? activeOutcome.unlocks.actions.slice() : [];

                // Tile-bound actions are discoverable by simply moving to the tile; don't list them as unlocks.
                const TILE_BOUND_ACTION_IDS = new Set(['searchLabs', 'searchPowerCore', 'exploreCafeteria', 'checkCrewQuarters']);
                const TILE_BOUND_ACTION_NAMES = new Set(['Search: Labs', 'Search: Power Core', 'Explore Cafeteria', 'Check Crew Quarters']);
                const actionsList = actionsListRaw.filter(v => {
                    const s = String(v || '').trim();
                    if (!s) return false;
                    if (TILE_BOUND_ACTION_IDS.has(s)) return false;
                    if (TILE_BOUND_ACTION_NAMES.has(s)) return false;
                    return true;
                });
                let upgradeNames = [];
                let recipeNames = [];
                let regularActionNames = [];
                if (actionsList.length) {
                    const defs = Array.isArray(_allActions) ? _allActions : [];
                    const recipeDefs = Array.isArray(_recipeActions) ? _recipeActions : [];
                    const recipeKeys = new Set();
                    for (const r of recipeDefs) {
                        try {
                            if (r && r.id) recipeKeys.add(String(r.id));
                            if (r && r.name) recipeKeys.add(String(r.name));
                        } catch { /* ignore */ }
                    }
                    const byNameOrId = (val) => defs.find(a => a && (a.name === val || a.id === val));
                    for (const val of actionsList) {
                        const def = byNameOrId(val);
                        if (def && def.category === 'Upgrade') upgradeNames.push(def.name || val);
                        else {
                            const isRecipe = !!(
                                (def && def.category === 'Crafting')
                                || (def && (recipeKeys.has(String(def.id)) || recipeKeys.has(String(def.name || ''))))
                                || recipeKeys.has(String(val || ''))
                            );
                            if (isRecipe) recipeNames.push(def ? (def.name || val) : val);
                            else regularActionNames.push(def ? (def.name || val) : val);
                        }
                    }
                    // Remove duplicates in case of mixed inputs
                    const uniq = (arr) => Array.from(new Set(arr));
                    upgradeNames = uniq(upgradeNames);
                    recipeNames = uniq(recipeNames);
                    regularActionNames = uniq(regularActionNames);
                }

                if (regularActionNames.length) blocks.push(`<div class="unlock-block"><h4>Actions Unlocked</h4><ul>${makeList(regularActionNames)}</ul></div>`);
                if (recipeNames.length) blocks.push(`<div class="unlock-block"><h4>Recipes Unlocked</h4><ul>${makeList(recipeNames)}</ul></div>`);
                if (upgradeNames.length) blocks.push(`<div class="unlock-block"><h4>Upgrades Unlocked</h4><ul>${makeList(upgradeNames)}</ul></div>`);
                if (activeOutcome.unlocks.buildings && activeOutcome.unlocks.buildings.length) blocks.push(`<div class="unlock-block"><h4>Buildings Unlocked</h4><ul>${makeList(activeOutcome.unlocks.buildings)}</ul></div>`);
                if (activeOutcome.unlocks.sections && activeOutcome.unlocks.sections.length) blocks.push(`<div class="unlock-block"><h4>Sections Unlocked</h4><ul>${makeList(activeOutcome.unlocks.sections)}</ul></div>`);
                if (activeOutcome.unlocks.jobs && activeOutcome.unlocks.jobs.length) blocks.push(`<div class="unlock-block"><h4>Jobs Unlocked</h4><ul>${makeList(activeOutcome.unlocks.jobs)}</ul></div>`);
                if (blocks.length) parts.push(`<div class="outcome-unlocks"><div class="outcome-grid">${blocks.join('')}</div></div>`);
            }
            if (hasRewards) {
                const items = activeOutcome.rewards.map(r => `<li>+${r.amount} ${r.resource}</li>`).join('');
                parts.push(`<div class="outcome-rewards"><h4>Rewards</h4><ul>${items}</ul></div>`);
            }
            if (hasItems) {
                const describeItem = (it) => {
                    const id = (typeof it === 'string') ? it : it?.id;
                    const note = (typeof it === 'object' && it && it.note) ? it.note : '';
                    const def = id ? getItemDefinition(id) : null;
                    const name = def?.name || id || 'Unknown item';
                    return `${name}${note ? ` — ${note}` : ''}`;
                };
                const items = activeOutcome.items.map(it => `<li>${describeItem(it)}</li>`).join('');
                parts.push(`<div class="outcome-items"><h4>Items Found</h4><ul>${items}</ul></div>`);
            }
            outcomeEl.innerHTML = parts.join('');
            outcomeEl.classList.remove('hidden');
        } else {
            outcomeEl.innerHTML = '';
            outcomeEl.classList.add('hidden');
        }
    }

}


export function showStoryPopup(event, outcome = null) {
    try { window.dispatchEvent(new CustomEvent('request-hide-tooltip')); } catch (e) { /* ignore */ }
    const storyPopup = document.getElementById('storyPopup');
    const titleEl = document.getElementById('popupTitle');
    const overlay = storyPopup ? storyPopup : document.getElementById('storyPopup'); // keep reference

    if (!storyPopup || !titleEl || !event || !event.pages || event.pages.length === 0) {
        console.debug('showStoryPopup aborted: missing elements or invalid event', { storyPopup, titleEl, event });
        return;
    }

    activeStoryEvent = event;
    activeOutcome = outcome;

    // On mobile, opening a large modal can cause an immediate visual-viewport shift.
    // Lock background scrolling before showing so the app grid doesn't jump.
    lockBackgroundScroll();

    // Pause while the player is reading narrative.
    try {
        pausedByThisStoryPopup = false;
        if (!getIsPaused()) {
            pauseGame(false);
            pausedByThisStoryPopup = true;
        }
    } catch { /* non-fatal */ }

    titleEl.textContent = activeStoryEvent.title;

    // Ensure popup and its overlay live directly under body so stacking contexts don't hide them
    const overlayEl = document.getElementById('storyPopup'); // your overlay element id
    const contentEl = overlayEl ? overlayEl.querySelector('.story-popup-content') : null;

    if (overlayEl && overlayEl.parentElement !== document.body) {
        document.body.appendChild(overlayEl);
    }

    // Populate and show
    renderPopupPage();

    // Set very-high z-index to outrank options and other UI
    if (overlayEl) overlayEl.style.zIndex = '2147483000';
    if (contentEl) contentEl.style.zIndex = '2147483001';

    // Make visible
    try { overlayEl.hidden = false; } catch { /* ignore */ }
    overlayEl.classList.remove('hidden');
    overlayEl.style.display = '';
    try { window.dispatchEvent(new CustomEvent('popup-open')); } catch (e) { /* ignore */ }
    overlayEl.offsetHeight;
    overlayEl.setAttribute('tabindex', '-1');
    // Avoid focus on phone-landscape: iOS Safari may scroll/jump when focusing fixed elements.
    if (!isCompactPhoneLandscape()) {
        try { overlayEl.focus({ preventScroll: true }); } catch (e) {}
    }

    // attach Esc handler now that popup is visible
    attachPopupEscHandler(overlayEl);

    // Record the popup to the shared journal data + UI.
    const id = event.id || event.title || null;
    const text = (Array.isArray(event.pages) ? event.pages.join('\n\n') : (event.pages || event.text || '')) || '';
    // Build entry object (keep same shape as previous localStorage entries)
    const entry = {
        id,
        title: event.title || id || 'Untitled',
        time: Date.now(),
        ingameTime: (function(){ try { return getIngameTimeObject(); } catch (e) { return null; } })(),
        text,
        // Optional: store outcome so Journal re-open can reproduce the same footer.
        outcome: outcome || null,
    };
    // Deduplicate using DOM/localStorage is not necessary — addJournalEntry will append.
    // To preserve previous de-dupe behavior, check existing entries in localStorage first.
    const raw = localStorage.getItem('storyLog');
    const list = raw ? JSON.parse(raw) : [];
    const exists = id ? list.find(x => x.id === id) : list.find(x => x.title === (event.title || id));
    if (!exists) {
        addJournalEntry(entry);
    }

    console.debug('showStoryPopup displayed:', event?.title || event?.id || '<unknown>');
}

function hideStoryPopup() {
    // detach Esc handler immediately so it won't fire during hide steps
    detachPopupEscHandler();

    const storyPopup = document.getElementById('storyPopup');
    if (storyPopup) {
        storyPopup.classList.add('hidden');
        try { storyPopup.hidden = true; } catch { /* ignore */ }
        storyPopup.style.display = 'none';
    }
    activeStoryEvent = null;
    activeOutcome = null;
    try { window.dispatchEvent(new CustomEvent('popup-close')); } catch (e) { /* ignore */ }

    // Restore background scroll/position after the overlay is hidden.
    unlockBackgroundScroll();

    // Resume only if this popup caused the pause.
    try {
        if (pausedByThisStoryPopup && getIsPaused()) {
            resumeGame(false);
        }
    } catch { /* non-fatal */ }
    pausedByThisStoryPopup = false;
}

// setupPopup unchanged except it uses the existing elements
function setupPopup() {
    const storyPopup = document.getElementById('storyPopup');
    const closeBtn = document.getElementById('popupClose');
    const xBtn = storyPopup ? storyPopup.querySelector('.story-popup-close') : null;

    if (!storyPopup || !closeBtn) return;

    closeBtn.addEventListener('click', hideStoryPopup);
    if (xBtn) xBtn.addEventListener('click', hideStoryPopup);
}

document.addEventListener('DOMContentLoaded', setupPopup);