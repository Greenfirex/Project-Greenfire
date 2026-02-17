import { addLogEntry, LogType } from '../core/ingameLog.js';
import { resources } from '../core/resources.js';
import { characterState, countItemInBag, computeCarryCapacity } from '../data/character.js';
import { gameFlags } from '../data/gameFlags.js';
import { allActions } from '../data/definitions/allActions.js';
import { getItemDefinition } from '../data/definitions/items.js';
import { getItemIdForResourceName, isInventoryAliasResourceName } from '../data/inventoryAliases.js';
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
import { updateCampsiteCampResourcesPanel, wireCampsiteCollapsibles } from './campsite.js';

const CRAFTING_CATEGORIES = [
    { key: 'weapons', label: 'Weapons', actionIds: ['craftMetalSpear'] },
    { key: 'accessory', label: 'Accessory', actionIds: ['createBasicTorch', 'craftCanteen'] },
    { key: 'armor', label: 'Armor', actionIds: [] },
    { key: 'quest', label: 'Quest', actionIds: ['makeCrudePrybar', 'fixLongRangeRadio', 'assembleMakeshiftExplosive', 'craftPowerCells'] },
    { key: 'consumables', label: 'Consumables', actionIds: ['craftHerbTea', 'craftFirstAidKit', 'craftBottledWater', 'craftPackagedFood'] },
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
            // Inventory-backed "resources" (e.g., Power Cells): check bag space.
            if (isInventoryAliasResourceName(r.resource)) {
                const itemId = getItemIdForResourceName(r.resource);
                if (!itemId) return false;

                const maxAmt = getMaxRewardAmount(r);
                if (maxAmt <= 0) return false;

                const def = getItemDefinition(itemId);
                const isStackable = !!def?.stackable;
                const have = countItemInBag(itemId, characterState);
                const cap = computeCarryCapacity(characterState);
                const emptySlots = Math.max(0, (cap.total ?? 0) - (cap.used ?? 0));

                if (isStackable) {
                    // Stackable: ok if we already have a stack, else need one empty slot.
                    return !(have > 0 || emptySlots > 0);
                }

                // Non-stack: need one slot per item.
                return emptySlots < maxAmt;
            }

            // Normal resource capacity check.
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

        const canAfford = !!canAffordAction(action, resources, characterState);
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
            btn.dataset.shortfall = getAffordabilityShortfalls(action, resources, characterState).join(', ');
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

    const campUnlocked = !!(characterState?.localMap && characterState.localMap.baseCampEstablished === true);
    const campLockedText = '<div style="opacity:0.75">Establish a base camp to view camp resources.</div>';

    craftingSection.innerHTML = `
        <div class="journal-tabs" role="tablist" aria-label="Crafting and Research">
            <button class="journal-tab ${activeTab === 'crafting' ? 'active' : ''}" data-tab="crafting" role="tab" aria-selected="${activeTab === 'crafting' ? 'true' : 'false'}">Crafting</button>
            <button class="journal-tab ${activeTab === 'research' ? 'active' : ''}" data-tab="research" role="tab" aria-selected="${activeTab === 'research' ? 'true' : 'false'}" ${researchUnlocked ? '' : 'disabled'}>${researchTabLabel}</button>
        </div>
        <div class="content-panel">
            <div class="section-inner crafting-section">
                <div class="crafting-tabpanes">
                    <div class="crafting-pane ${activeTab === 'crafting' ? 'active' : ''}" data-pane="crafting" role="tabpanel">
                        <div class="crafting-campresources" aria-label="Camp Resources">
                            <div class="localmap-card campsite-card campsite-card--campresources" data-campsite-panel="campresources">
                                <div class="localmap-card-header">
                                    <h3>Camp Resources</h3>
                                    <button type="button" class="campsite-collapse-btn" aria-label="Collapse Camp Resources panel" aria-expanded="true">
                                        <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                            <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                                            <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                                        </svg>
                                    </button>
                                </div>
                                <div class="localmap-card-body" id="campsiteCampResources">${campUnlocked ? '' : campLockedText}</div>
                            </div>
                        </div>
                        <div class="crafting-actions" data-crafting-actions></div>
                        <div class="localmap-card campsite-card campsite-card--actions" data-campsite-panel="actions" aria-label="Actions">
                            <div class="localmap-card-header">
                                <h3>Actions</h3>
                                <button type="button" class="campsite-collapse-btn" aria-label="Collapse Actions panel" aria-expanded="true">
                                    <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                                        <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                                    </svg>
                                </button>
                            </div>
                            <div class="localmap-card-body">
                                <div class="campsite-actions" data-crafting-nav-actions></div>
                            </div>
                        </div>
                    </div>
                    <div class="crafting-pane ${activeTab === 'research' ? 'active' : ''}" data-pane="research" role="tabpanel">
                        <div class="research-host" data-research-host></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Camp resources panel (reuses Campsite UI + tooltips)
    try { wireCampsiteCollapsibles(craftingSection); } catch { /* ignore */ }
    try { if (campUnlocked) updateCampsiteCampResourcesPanel(craftingSection); } catch { /* ignore */ }

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

                        if (!canAffordAction(actionDef, resources, characterState)) {
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

    // Navigation actions strip (Visit/Leave Camp)
    try {
        const navHost = craftingSection.querySelector('[data-crafting-nav-actions]');
        if (navHost) {
            navHost.innerHTML = '';
            const group = document.createElement('div');
            group.className = 'button-group';

            const mkNavBtn = ({ id, label, description, onClick }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'image-button';
                btn.dataset.actionId = String(id || 'utility');
                btn.dataset.actionInstance = `crafting:utility:${String(id || 'utility')}`;
                btn.innerHTML = `
                    <div class="action-progress-bar"></div>
                    <span class="building-name">${String(label || '')}</span>
                    <span class="cancel-text">Abort?</span>
                `;
                setupTooltip(btn, () => ({ id: String(id || 'utility'), name: String(label || ''), description: String(description || '') }));
                if (typeof onClick === 'function') btn.addEventListener('click', onClick);
                group.appendChild(btn);
                return btn;
            };

            const openCrashSite = (tabKey) => {
                try { localStorage.setItem('crashSiteActiveTab', tabKey); } catch { /* ignore */ }
                try {
                    const btn = document.querySelector('.menu-button[data-section="crashSiteSection"]');
                    if (btn) btn.click();
                } catch { /* ignore */ }
            };

            mkNavBtn({
                id: 'visitCamp',
                label: 'Visit camp',
                description: 'Open the Campsite tab.',
                onClick: (e) => { e.preventDefault(); openCrashSite('camp'); }
            });

            mkNavBtn({
                id: 'leaveCamp',
                label: 'Leave camp',
                description: 'Return to the local map.',
                onClick: (e) => { e.preventDefault(); openCrashSite('map'); }
            });

            navHost.appendChild(group);
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
            try { updateCampsiteCampResourcesPanel(host); } catch { /* ignore */ }
        } catch { /* ignore */ }
    });
}
