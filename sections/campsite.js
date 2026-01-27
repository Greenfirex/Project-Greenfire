import { resources } from '../core/resources.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';

import { buildings } from '../data/definitions/buildings.js';
import { characterState } from '../data/character.js';
import { gameFlags } from '../data/gameFlags.js';
import { jobs, getJobById, getEffectiveJobRate } from '../data/jobsManager.js';
import { upgradeEffects } from '../data/upgradeEffects.js';
import { getMorale } from '../data/morale.js';

import { updateBuildingButtonsState, createBuildingButton, rehydrateBuildingButton } from '../ui/components/buildingButtons.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import { allActions } from '../data/definitions/allActions.js';


const SITE_BUILDING_NAMES = ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'];

let _jobsRootEl = null;

export function getCampsitePaneHtml({ isUnlocked = false } = {}) {
    const lockedText = '<div style="opacity:0.75">Establish a base camp to unlock this tab.</div>';
    return `
        <div class="campsite-layout">
            <div class="localmap-card campsite-card campsite-card--jobs" data-campsite-panel="jobs">
                <div class="localmap-card-header">
                    <h3>Jobs</h3>
                    <button type="button" class="campsite-collapse-btn" aria-label="Collapse Jobs panel" aria-expanded="true">
                        <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                            <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
                <div class="localmap-card-body" id="campsiteJobs">${isUnlocked ? '' : lockedText}</div>
            </div>

            <div class="localmap-card campsite-card campsite-card--upgrades" data-campsite-panel="upgrades">
                <div class="localmap-card-header">
                    <h3>Upgrades</h3>
                    <button type="button" class="campsite-collapse-btn" aria-label="Collapse Upgrades panel" aria-expanded="true">
                        <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                            <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
                <div class="localmap-card-body" id="campsiteUpgrades">${isUnlocked ? '' : lockedText}</div>
            </div>

            <div class="localmap-card campsite-card campsite-card--buildings" data-campsite-panel="buildings">
                <div class="localmap-card-header">
                    <h3>Buildings</h3>
                    <button type="button" class="campsite-collapse-btn" aria-label="Collapse Buildings panel" aria-expanded="true">
                        <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                            <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
                <div class="localmap-card-body" id="campsiteBuildings">${isUnlocked ? '' : lockedText}</div>
            </div>

            <div class="localmap-card campsite-card campsite-card--crafting is-hidden" data-campsite-panel="crafting">
                <div class="localmap-card-header">
                    <h3>Crafting</h3>
                    <button type="button" class="campsite-collapse-btn" aria-label="Collapse Crafting panel" aria-expanded="true">
                        <svg class="chevrons-icon" width="22" height="16" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M3 12 L12 3 L21 12" stroke-linecap="round" />
                            <path d="M3 18 L12 9 L21 18" stroke-linecap="round" />
                        </svg>
                    </button>
                </div>
                <div class="localmap-card-body" id="campsiteCrafting">${isUnlocked ? '' : lockedText}</div>
            </div>
        </div>
        <div id="salvageActionsContainer" class="campsite-actions"></div>
    `;
}

export function applyCampsiteBackground(host, isCamp) {
    try { host.classList.toggle('is-campsite', !!isCamp); } catch { /* ignore */ }
}

export function wireCampsiteCollapsibles(host) {
    if (!host) return;

    const getCollapseKey = (panelKey) => `campsitePanelCollapsed.${String(panelKey)}`;
    const readCollapsed = (panelKey) => {
        try { return localStorage.getItem(getCollapseKey(panelKey)) === 'true'; } catch { return false; }
    };
    const writeCollapsed = (panelKey, isCollapsed) => {
        try { localStorage.setItem(getCollapseKey(panelKey), isCollapsed ? 'true' : 'false'); } catch { /* ignore */ }
    };

    const cards = Array.from(host.querySelectorAll('.campsite-card[data-campsite-panel]'));
    for (const card of cards) {
        const panelKey = card.dataset.campsitePanel;
        if (!panelKey) continue;

        const btn = card.querySelector('.campsite-collapse-btn');
        if (!btn) continue;

        const collapsed = readCollapsed(panelKey);
        card.classList.toggle('is-collapsed', collapsed);
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        try {
            const labelBase = String(panelKey).charAt(0).toUpperCase() + String(panelKey).slice(1);
            btn.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${labelBase} panel`);
        } catch { /* ignore */ }

        if (btn.dataset.wired === 'true') continue;
        btn.dataset.wired = 'true';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const nowCollapsed = !card.classList.contains('is-collapsed');
            card.classList.toggle('is-collapsed', nowCollapsed);
            btn.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
            try {
                const labelBase = String(panelKey).charAt(0).toUpperCase() + String(panelKey).slice(1);
                btn.setAttribute('aria-label', `${nowCollapsed ? 'Expand' : 'Collapse'} ${labelBase} panel`);
            } catch { /* ignore */ }
            writeCollapsed(panelKey, nowCollapsed);
        });
    }
}

export function renderCampsitePanels(host, { availableActions = [], createActionButton = null } = {}) {
    if (!host) return;

    try {
        const lm = characterState?.localMap;
        const isCampsiteUnlocked = !!(lm && lm.baseCampEstablished === true);
        const atBaseCampTile = !!(lm && Number(lm.x) === 2 && Number(lm.y) === 7);

        const upHost = host.querySelector('#campsiteUpgrades');
        const bHost = host.querySelector('#campsiteBuildings');
        const jHost = host.querySelector('#campsiteJobs');
        const cHost = host.querySelector('#campsiteCrafting');

        const craftingCard = host.querySelector('.campsite-card[data-campsite-panel="crafting"]');
        const workbench = (allActions || []).find(a => a && a.id === 'workbench');
        const workbenchDone = !!(workbench && (workbench.completed === true || (Array.isArray(workbench.stages) && (workbench.stage || 0) >= workbench.stages.length)));

        if (!isCampsiteUnlocked) {
            const locked = '<div style="opacity:0.75">Establish a base camp to unlock this tab.</div>';
            if (upHost) upHost.innerHTML = locked;
            if (bHost) bHost.innerHTML = locked;
            if (jHost) jHost.innerHTML = locked;
            if (cHost) cHost.innerHTML = locked;
            if (craftingCard) craftingCard.classList.add('is-hidden');
            // Hide idle badge if tab is locked.
            updateCampsiteTabIdleWarning(0, { forceHide: true });
            return;
        }

        if (upHost) upHost.innerHTML = '';
        if (bHost) bHost.innerHTML = '';
        if (jHost) jHost.innerHTML = '';
        if (cHost) cHost.innerHTML = '';

        if (craftingCard) {
            const shouldHide = !workbenchDone;
            const wasHidden = craftingCard.classList.contains('is-hidden');
            craftingCard.classList.toggle('is-hidden', shouldHide);

            // When Crafting first unlocks, ensure it starts expanded (not collapsed).
            // Persist a small flag in localMap state so we only do this once per save.
            try {
                const shouldAutoExpand = !!(workbenchDone && wasHidden && lm && typeof lm === 'object' && lm.craftingPanelShown !== true);
                if (shouldAutoExpand) {
                    craftingCard.classList.remove('is-collapsed');
                    const btn = craftingCard.querySelector('.campsite-collapse-btn');
                    if (btn) {
                        btn.setAttribute('aria-expanded', 'true');
                        btn.setAttribute('aria-label', 'Collapse Crafting panel');
                    }
                    try { localStorage.setItem('campsitePanelCollapsed.crafting', 'false'); } catch { /* ignore */ }
                    lm.craftingPanelShown = true;
                }
            } catch { /* ignore */ }
        }

        // Upgrades
        try {
            const uGroup = document.createElement('div');
            uGroup.className = 'button-group';
            const upgradeActions = Array.isArray(availableActions)
                ? availableActions.filter(a => a && a.category === 'Upgrade')
                : [];
            if (typeof createActionButton === 'function') {
                upgradeActions.forEach(action => createActionButton(action, uGroup));
            } else {
                const note = document.createElement('div');
                note.style.opacity = '0.75';
                note.textContent = 'Upgrades unavailable (UI wiring missing).';
                uGroup.appendChild(note);
            }
            if (upHost) upHost.appendChild(uGroup);
        } catch { /* ignore */ }

        // Buildings
        try {
            const colonyUnlocked =
                (gameFlags && Number(gameFlags.chapter) >= 2) ||
                (typeof window !== 'undefined' && window.activatedSections && window.activatedSections.colonySection);
            const buildGroup = document.createElement('div');
            buildGroup.className = 'button-group';
            if (!colonyUnlocked) {
                const siteBuildings = buildings.filter(b => SITE_BUILDING_NAMES.includes(b.name) && b.isUnlocked === true);
                siteBuildings.forEach(bld => {
                    const btn = createBuildingButton(bld, buildGroup);
                    rehydrateBuildingButton(btn, bld.name);
                });
            } else {
                const note = document.createElement('div');
                note.style.opacity = '0.75';
                note.textContent = 'Construction moved to Colony.';
                buildGroup.appendChild(note);
            }
            if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
            if (bHost) bHost.appendChild(buildGroup);
        } catch { /* ignore */ }

        // Jobs
        try {
            if (jHost) {
                setupCampsiteJobsPanel(jHost, { embedded: true });
                try { updateCampsiteJobsPanel(); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        // Crafting (unlocked by Workbench upgrade)
        try {
            if (workbenchDone && cHost) {
                const group = document.createElement('div');
                group.className = 'button-group';

                const craftingActionIds = [
                    'createBasicTorch',
                    'makeCrudePrybar',
                    'craftMetalSpear',
                    'fixLongRangeRadio',
                ];

                // Always show crafting buttons once unlocked.
                // If the player is not standing on Base Camp (B7), block starting them and log a hint.
                if (!atBaseCampTile) {
                    group.addEventListener('click', (e) => {
                        try {
                            const btn = e.target && e.target.closest ? e.target.closest('button') : null;
                            if (!btn || !group.contains(btn)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            try { e.stopImmediatePropagation(); } catch { /* ignore */ }
                            addLogEntry('You need to be closer to perform this action.', LogType.INFO);
                        } catch { /* ignore */ }
                    }, true);
                }

                if (typeof createActionButton === 'function') {
                    craftingActionIds.forEach(id => {
                        const a = (allActions || []).find(x => x && x.id === id);
                        if (!a || !a.isUnlocked) return;
                        createActionButton(a, group);
                    });
                } else {
                    const note = document.createElement('div');
                    note.style.opacity = '0.75';
                    note.textContent = 'Crafting unavailable (UI wiring missing).';
                    group.appendChild(note);
                }

                cHost.appendChild(group);
            }
        } catch { /* ignore */ }
    } catch { /* ignore */ }
}

export function setupCampsiteJobsPanel(sectionEl, { embedded = false } = {}) {
    if (!sectionEl) return;
    _jobsRootEl = sectionEl;

    // Determine labels based on chapter
    const isChapter2 = gameFlags.chapter === 2;
    const crewLabel = isChapter2 ? 'Crew Members' : 'Survivors';
    const instructionText = isChapter2
        ? 'Assign crew members to manage colony operations and resource production.'
        : 'Assign survivors to job slots unlocked by buildings on the Crash Site.';

    if (embedded) {
        sectionEl.innerHTML = `
            <div class="campsite-jobs">
                <div class="crew-summary">
                    <p>Current ${crewLabel.toLowerCase()}: <strong class="crewCount">0</strong></p>
                    <p class="crew-note">${instructionText}</p>
                </div>
                <div class="crewJobsContainer crew-jobs" style="margin-top:12px;"></div>
            </div>
        `;
    } else {
        sectionEl.innerHTML = `
            <div class="content-panel">
                <div class="section-inner campsite-jobs">
                    <h2>Campsite</h2>
                    <div class="crew-summary">
                        <p>Current ${crewLabel.toLowerCase()}: <strong class="crewCount">0</strong></p>
                        <p class="crew-note">${instructionText}</p>
                    </div>
                    <div class="crewJobsContainer crew-jobs" style="margin-top:12px;"></div>
                </div>
            </div>
        `;
    }

    // setup delegated pointerdown handler once (works reliably during fast DOM updates)
    const jobsContainer = sectionEl.querySelector('.crewJobsContainer');
    if (jobsContainer && !jobsContainer._delegationAdded) {
        jobsContainer.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !jobsContainer.contains(btn)) return;
            const jobId = btn.dataset.jobId;
            const action = btn.dataset.action; // 'inc' or 'dec'
            if (!jobId || !action) return;

            e.preventDefault();
            if (jobsContainer._handling) return;
            jobsContainer._handling = true;
            try {
                if (action === 'inc') incrementJob(jobId);
                else if (action === 'dec') decrementJob(jobId);
            } finally {
                setTimeout(() => { jobsContainer._handling = false; }, 50);
            }
        }, { passive: false });
        jobsContainer._delegationAdded = true;
    }

    updateCampsiteJobsPanel();
}

export function updateCampsiteJobsPanel() {
    const root = _jobsRootEl || document;
    const countEl = root.querySelector('.crewCount');
    if (!countEl) return;

    // Handle both "Survivors" (Chapter 1) and "Crew Members" (Chapter 2)
    let survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
    const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    countEl.textContent = survivorsCount;

    const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
    const idle = Math.max(0, survivorsCount - totalAssigned);

    updateCampsiteTabIdleWarning(idle);

    const jobsContainer = root.querySelector('.crewJobsContainer');
    if (!jobsContainer) return;
    jobsContainer.innerHTML = '';

    // Header row (table-like)
    const header = document.createElement('div');
    header.className = 'crew-job crew-header';
    header.innerHTML = `
        <div class="job-name">Job</div>
        <div class="job-controls">−</div>
        <div class="job-count">Assigned / Slots</div>
        <div class="job-controls">+</div>
    `;
    jobsContainer.appendChild(header);

    // Idle row
    const idleRow = document.createElement('div');
    idleRow.className = 'crew-job idle-row';
    const showIdleWarn = Number(idle) > 0;
    idleRow.innerHTML = `
        <div class="job-name">
            ${showIdleWarn ? '<span class="idle-warning-badge" aria-hidden="true">!</span>' : ''}
            <strong>Idle</strong>
        </div>
        <div class="job-controls"></div>
        <div class="job-count"><span class="idle-count">${idle}</span></div>
        <div class="job-controls"></div>
    `;
    jobsContainer.appendChild(idleRow);

    // Job rows
    jobs.forEach(job => {
        // Hide Wire Collector job until the upgrade is completed
        if (job.id === 'wire_collector' && !gameFlags.wireScavengingOrganized) return;

        // Hide Scientist job until at least one Field Lab is built.
        if (job.id === 'scientist') {
            const hasFieldLab = Array.isArray(buildings) && buildings.some(b => b && b.name === 'Field Lab' && Number(b.count) > 0);
            if (!hasFieldLab) return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'crew-job';
        wrapper.dataset.jobId = job.id;

        const nameCol = document.createElement('div');
        nameCol.className = 'job-name';
        nameCol.textContent = job.name;
        wrapper.appendChild(nameCol);

        const decCol = document.createElement('div');
        decCol.className = 'job-controls';
        const decBtn = document.createElement('button');
        decBtn.className = 'arrow-button';
        decBtn.dataset.jobId = job.id;
        decBtn.dataset.action = 'dec';
        decBtn.ariaLabel = `Decrease assigned for ${job.name}`;
        decBtn.textContent = '‹';
        decBtn.disabled = ((job.assigned || 0) <= 0);
        decCol.appendChild(decBtn);
        wrapper.appendChild(decCol);

        const countCol = document.createElement('div');
        countCol.className = 'job-count';
        const slotsText = (job.unlimited === true || job.slots === Number.POSITIVE_INFINITY) ? '∞' : (job.slots || 0);
        countCol.innerHTML = `<span class="assigned-count">${job.assigned || 0}</span> / <span class="slots-count">${slotsText}</span>`;
        wrapper.appendChild(countCol);

        const incCol = document.createElement('div');
        incCol.className = 'job-controls';
        const incBtn = document.createElement('button');
        incBtn.className = 'arrow-button';
        incBtn.dataset.jobId = job.id;
        incBtn.dataset.action = 'inc';
        incBtn.ariaLabel = `Increase assigned for ${job.name}`;
        incBtn.textContent = '›';
        const atSlotLimit = !(job.unlimited === true) && (job.slots !== undefined) && ((job.assigned || 0) >= (job.slots || 0));
        incBtn.disabled = (idle <= 0) || atSlotLimit;
        incCol.appendChild(incBtn);
        wrapper.appendChild(incCol);

        jobsContainer.appendChild(wrapper);

        // Tooltip
        if (typeof setupTooltip === 'function') {
            const tooltipTarget = nameCol;
            const tooltipGetter = () => {
                const produces = job.produces || '—';
                const baseRate = (typeof job.rate === 'number') ? job.rate : 0;
                const effectiveRate = getEffectiveJobRate(job);
                const assigned = job.assigned || 0;
                const slots = (job.unlimited === true || job.slots === Number.POSITIVE_INFINITY) ? '∞' : (job.slots || 0);
                const desc = job.description || '';

                const bonuses = [];
                for (let i = 0; i < upgradeEffects.length; i++) {
                    const eff = upgradeEffects[i];
                    if (!eff || !eff.flag) continue;
                    if (!gameFlags[eff.flag]) continue;
                    if (!eff.resources || !eff.resources.includes(produces)) continue;
                    if (!eff.actions || !Array.isArray(eff.actions) || eff.actions.length === 0) continue;
                    const matches = eff.actions.some(a => {
                        if (!a) return false;
                        const av = String(a).toLowerCase().replace(/\s+/g, '');
                        return av === String(job.id).toLowerCase().replace(/\s+/g, '');
                    });
                    if (!matches) continue;
                    if (eff.label) bonuses.push(eff.label);
                }

                const lines = [];
                lines.push(`<strong>${job.name}</strong>`);
                if (desc) lines.push(`<div style="margin-top:6px">${desc}</div>`);
                lines.push(`<div style="margin-top:6px"><em>Produces:</em> ${produces}</div>`);
                const isBoosted = (typeof effectiveRate === 'number' && typeof baseRate === 'number') ? (effectiveRate > baseRate + 1e-9) : false;
                const rateClass = isBoosted ? 'reward-amount boosted' : 'reward-amount';
                lines.push(`<div><em>Per worker:</em> <span class="${rateClass}">${effectiveRate.toFixed(3)}</span>/s <small style="color:#bbb"> (base ${baseRate}/s)</small></div>`);
                lines.push(`<div><em>Assigned:</em> ${assigned} / ${slots}</div>`);
                try {
                    const m = getMorale();
                    const moraleDelta = Math.round((m && typeof m.percent === 'number' ? m.percent : 100) - 100);
                    const labels = [];
                    const sign = moraleDelta > 0 ? '+' : '';
                    labels.push(`Morale: ${sign}${moraleDelta}%`);
                    for (const b of bonuses) labels.push(b);
                    if (labels.length) {
                        lines.push(`<div class="tooltip-section"><h4>Modifiers</h4><ul class="tooltip-bonuses">${labels.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul></div>`);
                    }
                } catch {
                    // ignore
                }
                return lines.join('');
            };
            try { setupTooltip(tooltipTarget, tooltipGetter); } catch { /* ignore */ }
        }
    });
}

// Lightweight idle warning updater that does not require the Jobs panel DOM.
// Called from the main loop so the Campsite tab badge stays accurate.
export function updateCampsiteIdleWarnings() {
    try {
        const lm = characterState?.localMap;
        const isCampsiteUnlocked = !!(lm && lm.baseCampEstablished === true);
        if (!isCampsiteUnlocked) {
            updateCampsiteTabIdleWarning(0, { forceHide: true });
            return;
        }

        let survivors = resources.find(r => r.name === 'Survivors');
        if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
        const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
        const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
        const idle = Math.max(0, survivorsCount - totalAssigned);
        updateCampsiteTabIdleWarning(idle);
    } catch {
        /* ignore */
    }
}

function incrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;

    let survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
    const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
    const idle = Math.max(0, survivorsCount - totalAssigned);

    if (idle <= 0) {
        const label = survivors?.name === 'Crew Members' ? 'crew members' : 'survivors';
        addLogEntry(`No available ${label} to assign.`, LogType.ERROR);
        return;
    }
    if (!(job.unlimited === true) && (typeof job.slots === 'number') && ((job.assigned || 0) >= (job.slots || 0))) {
        addLogEntry('No open job slots available.', LogType.ERROR);
        return;
    }

    job.assigned = (job.assigned || 0) + 1;
    const label = survivors?.name === 'Crew Members' ? 'crew member' : 'survivor';
    addLogEntry(`Assigned 1 ${label} to ${job.name}.`, LogType.INFO);
    updateCampsiteJobsPanel();
    try { refreshCurrentTooltip(); } catch { /* ignore */ }
}

function decrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    if ((job.assigned || 0) <= 0) return;
    job.assigned = Math.max(0, (job.assigned || 0) - 1);

    let survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
    const label = survivors?.name === 'Crew Members' ? 'crew member' : 'survivor';
    addLogEntry(`Removed 1 ${label} from ${job.name}.`, LogType.INFO);
    updateCampsiteJobsPanel();
    try { refreshCurrentTooltip(); } catch { /* ignore */ }
}

function updateCampsiteTabIdleWarning(idleSurvivors, { forceHide = false } = {}) {
    try {
        const crash = document.getElementById('crashSiteSection');
        if (!crash) return;

        const tab = crash.querySelector('.crashsite-tab[data-tab="camp"]');
        if (!tab) return;
        if (tab.disabled) return;

        const shouldShow = !forceHide && (Number(idleSurvivors) > 0);

        let badge = tab.querySelector('.campsite-idle-warning');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'action-new-badge campsite-idle-warning';
            badge.textContent = '!';

            const labelEl = tab.querySelector('.crashsite-tab-label');
            if (labelEl && labelEl.parentNode) {
                labelEl.insertAdjacentElement('afterend', badge);
            } else {
                tab.appendChild(badge);
            }
        }

        badge.style.display = shouldShow ? '' : 'none';
        // A11y hint without being spammy.
        if (shouldShow) {
            tab.setAttribute('title', 'You have idle crew to assign');
        } else {
            // Only clear if we set it.
            if (tab.getAttribute('title') === 'You have idle crew to assign') tab.removeAttribute('title');
        }
    } catch {
        /* ignore */
    }
}
