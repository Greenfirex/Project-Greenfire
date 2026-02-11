import { addLogEntry, LogType } from '../core/ingameLog.js';
import { resources } from '../core/resources.js';
import { characterState } from '../data/character.js';
import { gameFlags } from '../data/gameFlags.js';
import { allActions } from '../data/definitions/allActions.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../ui/components/contentNewBadges.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import {
    getCurrentStage,
    tooltipDataForAction,
    canAffordAction,
    getAffordabilityShortfalls,
} from '../data/actionsManager.js';
import { getBlockedStatus } from '../data/unlockRules.js';
import { startAction as startCrashSiteAction } from './crashSite.js';
import {
    setupResearchSection,
    getCurrentResearchingTech,
} from './research.js';

const CRAFTING_CATEGORIES = [
    { key: 'weapons', label: 'Weapons', actionIds: ['craftMetalSpear'] },
    { key: 'accessory', label: 'Accessory', actionIds: ['createBasicTorch', 'craftCanteen'] },
    { key: 'armor', label: 'Armor', actionIds: [] },
    { key: 'quest', label: 'Quest', actionIds: ['makeCrudePrybar', 'fixLongRangeRadio', 'assembleMakeshiftExplosive'] },
    { key: 'consumables', label: 'Consumables', actionIds: ['craftFirstAidKit'] },
];

function isAtBaseCampTile() {
    const lm = characterState?.localMap;
    return !!(lm && Number(lm.x) === 2 && Number(lm.y) === 7);
}

function isWorkbenchDone() {
    try {
        const workbench = (allActions || []).find(a => a && a.id === 'workbench');
        return !!(workbench && (workbench.completed === true || (Array.isArray(workbench.stages) && (workbench.stage || 0) >= workbench.stages.length)));
    } catch {
        return false;
    }
}

function getMaxRewardAmount(rewardEntry) {
    if (!rewardEntry) return 0;
    const amt = rewardEntry.amount;
    if (Array.isArray(amt)) {
        const hi = Number(amt[1]);
        return Number.isFinite(hi) ? hi : 0;
    }
    const n = Number(amt);
    return Number.isFinite(n) ? n : 0;
}

function getCapacityBlockReason(action) {
    try {
        if (!action) return null;

        const stage = getCurrentStage(action);
        const reward = []
            .concat(Array.isArray(action?.reward) ? action.reward : [])
            .concat(Array.isArray(stage?.reward) ? stage.reward : []);

        const rewardEntries = reward.filter(r => r && r.resource && getMaxRewardAmount(r) > 0);
        if (!rewardEntries.length) return null;

        const cappedEntries = rewardEntries.filter(r => {
            const res = resources.find(x => x && x.name === r.resource);
            if (!res) return false;
            const cap = Number(res.capacity);
            if (!Number.isFinite(cap) || cap === Number.POSITIVE_INFINITY) return false;
            const amount = Number(res.amount);
            if (!Number.isFinite(amount)) return false;
            return amount >= cap - 1e-9;
        });

        const allWasted = cappedEntries.length === rewardEntries.length;
        if (!allWasted) return null;

        const names = Array.from(new Set(cappedEntries.map(r => r.resource)));
        if (names.length === 1) return `Storage full: ${names[0]}.`;
        return `Storage full: ${names.join(', ')}.`;
    } catch {
        return null;
    }
}

function updateCraftingButtonsState(root) {
    if (!root) return;
    const buttons = root.querySelectorAll('.image-button[data-action-id]');
    buttons.forEach(btn => {
        const id = btn.dataset.actionId;
        if (!id) return;
        const action = (allActions || []).find(a => a && a.id === id);
        if (!action) return;

        const canAfford = !!canAffordAction(action, resources);
        const blockedMeta = getBlockedStatus(action.id, { actions: allActions, flags: gameFlags, characterState });
        const isBlocked = !!blockedMeta?.blocked;
        const blockedReason = blockedMeta?.reason || '';
        const capReason = getCapacityBlockReason(action);
        const isCapBlocked = !!capReason;

        btn.classList.toggle('unaffordable', !canAfford);
        btn.classList.toggle('blocked-action', isBlocked);
        btn.classList.toggle('capacity-blocked', isCapBlocked);

        if (!canAfford) {
            btn.setAttribute('aria-disabled', 'true');
            btn.dataset.shortfall = getAffordabilityShortfalls(action, resources).join(', ');
        } else {
            delete btn.dataset.shortfall;
        }

        if (isCapBlocked) {
            btn.setAttribute('aria-disabled', 'true');
            btn.title = capReason;
        } else if (isBlocked) {
            btn.setAttribute('aria-disabled', 'true');
            if (blockedReason) btn.title = blockedReason;
        } else if (!canAfford) {
            btn.setAttribute('aria-disabled', 'true');
        } else {
            if (!btn.disabled) btn.removeAttribute('aria-disabled');
        }
    });
}

function selectTab(host, key) {
    const panes = {
        crafting: host.querySelector('[data-pane="crafting"]'),
        research: host.querySelector('[data-pane="research"]'),
    };

    const tabs = {
        crafting: host.querySelector('.journal-tab[data-tab="crafting"]'),
        research: host.querySelector('.journal-tab[data-tab="research"]'),
    };

    for (const k of Object.keys(panes)) {
        if (panes[k]) panes[k].classList.toggle('active', k === key);
    }
    for (const k of Object.keys(tabs)) {
        if (tabs[k]) {
            tabs[k].classList.toggle('active', k === key);
            tabs[k].setAttribute('aria-selected', k === key ? 'true' : 'false');
        }
    }

    try { localStorage.setItem('craftingActiveTab', key); } catch { /* ignore */ }
    try { host.dataset.craftingActiveTab = key; } catch { /* ignore */ }
}

export function setupCraftingSection(craftingSection) {
    if (!craftingSection) craftingSection = document.getElementById('craftingSection');
    if (!craftingSection) return;

    const craftingUnlocked = isWorkbenchDone();
    const researchUnlocked = !!(gameFlags && gameFlags.researchTabUnlocked === true) || !!getCurrentResearchingTech();

    let activeTab = 'crafting';
    try {
        activeTab = craftingSection.dataset.craftingActiveTab || localStorage.getItem('craftingActiveTab') || 'crafting';
    } catch { /* ignore */ }
    if (activeTab !== 'crafting' && activeTab !== 'research') activeTab = 'crafting';
    if (!researchUnlocked && activeTab === 'research') activeTab = 'crafting';

    const researchTabLabel = researchUnlocked ? 'Research' : '???';

    craftingSection.innerHTML = `
        <div class="journal-tabs" role="tablist" aria-label="Crafting and Research">
            <button class="journal-tab ${activeTab === 'crafting' ? 'active' : ''}" data-tab="crafting" role="tab" aria-selected="${activeTab === 'crafting' ? 'true' : 'false'}">Crafting</button>
            <button class="journal-tab ${activeTab === 'research' ? 'active' : ''}" data-tab="research" role="tab" aria-selected="${activeTab === 'research' ? 'true' : 'false'}" ${researchUnlocked ? '' : 'disabled'}>${researchTabLabel}</button>
        </div>
        <div class="content-panel">
            <div class="section-inner crafting-section">
                <div class="crafting-tabpanes">
                    <div class="crafting-pane ${activeTab === 'crafting' ? 'active' : ''}" data-pane="crafting" role="tabpanel">
                        <div class="crafting-actions" data-crafting-actions></div>
                    </div>
                    <div class="crafting-pane ${activeTab === 'research' ? 'active' : ''}" data-pane="research" role="tabpanel">
                        <div class="research-host" data-research-host></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Tab switching
    const tabButtons = Array.from(craftingSection.querySelectorAll('.journal-tab[data-tab]'));
    for (const btn of tabButtons) {
        if (btn.dataset.wired === 'true') continue;
        btn.dataset.wired = 'true';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const key = btn.dataset.tab;
            if (key === 'research' && !researchUnlocked) return;
            selectTab(craftingSection, key);

            // Lazy-render research UI when entering tab
            if (key === 'research') {
                try {
                    const rHost = craftingSection.querySelector('[data-research-host]');
                    if (rHost) setupResearchSection(rHost);
                } catch { /* ignore */ }
            }
        });
    }

    // Crafting actions
    try {
        const actionsHost = craftingSection.querySelector('[data-crafting-actions]');
        if (actionsHost) {
            actionsHost.innerHTML = '';

            if (!craftingUnlocked) {
                const locked = document.createElement('div');
                locked.style.opacity = '0.75';
                locked.textContent = 'Complete the Workbench upgrade to unlock Crafting.';
                actionsHost.appendChild(locked);
            } else {
                const makeActionButton = (actionDef) => {
                    const btn = document.createElement('button');
                    btn.className = 'image-button';
                    btn.dataset.actionId = actionDef.id;
                    btn.dataset.actionInstance = `crafting:${String(actionDef.id)}`;
                    btn.innerHTML = `
                        <div class="action-progress-bar"></div>
                        <span class="building-name">${actionDef.name}</span>
                        ${newBadgeHtml(!!actionDef.uiNew)}
                        <span class="cancel-text">Abort?</span>
                    `;

                    if (actionDef.uiNew) {
                        wireClearUiNewBadge(btn, { legacyObj: actionDef, legacyProp: 'uiNew' });
                    }

                    setupTooltip(btn, () => tooltipDataForAction(actionDef));

                    btn.addEventListener('click', (e) => {
                        e.preventDefault();

                        // Preserve existing gameplay rule: you must be at Base Camp tile to craft.
                        if (!isAtBaseCampTile()) {
                            addLogEntry('You need to be closer to perform this action.', LogType.INFO);
                            return;
                        }

                        const { blocked, reason } = getBlockedStatus(actionDef.id, { actions: allActions, flags: gameFlags, characterState });
                        if (blocked) {
                            if (reason) addLogEntry(String(reason), LogType.INFO);
                            return;
                        }

                        const capReason = getCapacityBlockReason(actionDef);
                        if (capReason) {
                            addLogEntry(String(capReason), LogType.INFO);
                            return;
                        }

                        if (!canAffordAction(actionDef, resources)) {
                            addLogEntry(`Not enough resources to begin: ${actionDef.name}.`, LogType.ERROR);
                            return;
                        }

                        // Use the Crash Site action runner so timing/drain rules stay unified.
                        const actionForUi = Object.assign({}, actionDef, { uiInstanceId: btn.dataset.actionInstance });
                        refreshCurrentTooltip();
                        startCrashSiteAction(actionForUi, craftingSection);
                    });

                    return btn;
                };

                let renderedAny = false;
                for (const cat of CRAFTING_CATEGORIES) {
                    const catWrap = document.createElement('div');
                    catWrap.className = 'crafting-category';
                    catWrap.dataset.categoryKey = cat.key;

                    const title = document.createElement('h3');
                    title.className = 'crafting-category-title';
                    title.textContent = cat.label;
                    catWrap.appendChild(title);

                    const group = document.createElement('div');
                    group.className = 'button-group';

                    for (const id of (cat.actionIds || [])) {
                        const actionDef = (allActions || []).find(a => a && a.id === id);
                        if (!actionDef || !actionDef.isUnlocked) continue;
                        group.appendChild(makeActionButton(actionDef));
                    }

                    if (!group.childElementCount) {
                        const empty = document.createElement('div');
                        empty.className = 'crafting-category-empty';
                        empty.style.opacity = '0.75';
                        empty.textContent = 'No recipes available yet.';
                        catWrap.appendChild(empty);
                    } else {
                        catWrap.appendChild(group);
                        renderedAny = true;
                    }

                    actionsHost.appendChild(catWrap);
                }

                if (!renderedAny) {
                    const empty = document.createElement('div');
                    empty.style.opacity = '0.75';
                    empty.textContent = 'No crafting actions available yet.';
                    actionsHost.appendChild(empty);
                }

                updateCraftingButtonsState(craftingSection);
            }
        }
    } catch { /* ignore */ }

    // Research tab host
    try {
        if (researchUnlocked) {
            const rHost = craftingSection.querySelector('[data-research-host]');
            if (rHost) setupResearchSection(rHost);
        }
    } catch { /* ignore */ }

    // Ensure tab visibility state matches selected key
    selectTab(craftingSection, activeTab);

    // Expose for mobile popover switching
    if (typeof window !== 'undefined') {
        window.setupCraftingSection = setupCraftingSection;
    }
}

// Keep crafting UI responsive to resource changes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resources-updated', () => {
        try {
            const host = document.getElementById('craftingSection');
            if (!host) return;
            updateCraftingButtonsState(host);
        } catch { /* ignore */ }
    });
}
