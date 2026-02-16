import { resources, getResourceTooltipHtml, computeResourceRates } from '../core/resources.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';

import { buildings } from '../data/definitions/buildings.js';
import { characterState } from '../data/character.js';
import { gameFlags } from '../data/gameFlags.js';
import { jobs, getJobById, getEffectiveJobRate } from '../data/jobsManager.js';
import { getMorale } from '../data/morale.js';
import { computeRewardEffects } from '../data/upgradeEffects.js';

import { updateBuildingButtonsState, createBuildingButton, rehydrateBuildingButton } from '../ui/components/buildingButtons.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';


const SITE_BUILDING_NAMES = ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'];

let _jobsRootEl = null;

export function getCampsitePaneHtml({ isUnlocked = false } = {}) {
    const lockedText = '<div style="opacity:0.75">Establish a base camp to unlock this tab.</div>';
    return `
        <div class="campsite-layout">
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
                <div class="localmap-card-body" id="campsiteCampResources">${isUnlocked ? '' : lockedText}</div>
            </div>

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
        </div>
    `;
}

export function applyCampsiteBackground(host, isCamp) {
    try { host.classList.toggle('is-campsite', !!isCamp); } catch { /* ignore */ }
}

export function wireCampsiteCollapsibles(host) {
    if (!host) return;

    const syncJobsLayoutCollapsed = () => {
        try {
            const layout = host.querySelector('.campsite-layout');
            const jobsCard = host.querySelector('.campsite-card[data-campsite-panel="jobs"]');
            if (!layout || !jobsCard) return;
            layout.classList.toggle('jobs-collapsed', jobsCard.classList.contains('is-collapsed'));
        } catch { /* ignore */ }
    };

    const syncRightPanelRowCollapses = () => {
        try {
            const layout = host.querySelector('.campsite-layout');
            if (!layout) return;
            const upgrades = host.querySelector('.campsite-card[data-campsite-panel="upgrades"]');
            const buildings = host.querySelector('.campsite-card[data-campsite-panel="buildings"]');
            const upCollapsed = !!(upgrades && upgrades.classList.contains('is-collapsed'));
            const bCollapsed = !!(buildings && buildings.classList.contains('is-collapsed'));
            layout.classList.toggle('upgrades-collapsed', upCollapsed);
            layout.classList.toggle('buildings-collapsed', bCollapsed);
            layout.classList.toggle('all-right-collapsed', upCollapsed && bCollapsed);
        } catch { /* ignore */ }
    };

    const syncCampResourcesRowCollapse = () => {
        try {
            const layout = host.querySelector('.campsite-layout');
            const campCard = host.querySelector('.campsite-card[data-campsite-panel="campresources"]');
            if (!layout || !campCard) return;
            layout.classList.toggle('campresources-collapsed', campCard.classList.contains('is-collapsed'));
        } catch { /* ignore */ }
    };

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

            // Jobs panel collapses horizontally by shrinking the left column.
            if (panelKey === 'jobs') syncJobsLayoutCollapsed();

            // Camp resources shrinks the top row.
            if (panelKey === 'campresources') syncCampResourcesRowCollapse();

            // Right-side panels shrink their rows.
            if (panelKey === 'upgrades' || panelKey === 'buildings') {
                syncRightPanelRowCollapses();
            }
        });
    }

    // Apply layout state after restoring persisted collapses.
    syncJobsLayoutCollapsed();
    syncCampResourcesRowCollapse();
    syncRightPanelRowCollapses();
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
        const cHost = host.querySelector('#campsiteCampResources');
        // Crafting panel removed (Crafting is now its own section)

        if (!isCampsiteUnlocked) {
            const locked = '<div style="opacity:0.75">Establish a base camp to unlock this tab.</div>';
            if (upHost) upHost.innerHTML = locked;
            if (bHost) bHost.innerHTML = locked;
            if (jHost) jHost.innerHTML = locked;
            if (cHost) cHost.innerHTML = locked;
            // Hide idle badge if tab is locked.
            updateCampsiteTabIdleWarning(0, { forceHide: true });
            return;
        }

        if (upHost) upHost.innerHTML = '';
        if (bHost) bHost.innerHTML = '';
        if (jHost) jHost.innerHTML = '';

        // Camp resources row (Water/Provisions snapshot)
        try { updateCampsiteCampResourcesPanel(host); } catch { /* ignore */ }

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

    } catch { /* ignore */ }
}

export function updateCampsiteCampResourcesPanel(root = document) {
    try {
        const host = (root && typeof root.querySelector === 'function')
            ? root.querySelector('#campsiteCampResources')
            : null;
        if (!host) return;

        let row = host.querySelector('.campsite-campresources-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'campsite-campresources-row';
            host.innerHTML = '';
            host.appendChild(row);
        }

        const get = (name) => (resources || []).find(r => r && r.name === name);
        const entries = [
            // Always show camp stockpiles once the Campsite tab is unlocked.
            { key: 'Water', resName: 'Water', label: 'Water', vital: 'water', requireDiscovered: false },
            { key: 'Provisions', resName: 'Provisions', label: 'Provisions', vital: 'food', requireDiscovered: false },

            // Show additional materials once discovered.
            { key: 'Scrap', resName: 'Metal Parts', label: 'Metal Parts', vital: 'material', requireDiscovered: true },
            { key: 'Wire', resName: 'Wire', label: 'Wire', vital: 'material', requireDiscovered: true },
            { key: 'Chemicals', resName: 'Chemicals', label: 'Chemicals', vital: 'material', requireDiscovered: true },
            { key: 'Fabric', resName: 'Fabric', label: 'Fabric', vital: 'material', requireDiscovered: true },
        ];

        // Ensure item nodes exist in the right order.
        for (const entry of entries) {
            let item = row.querySelector(`.campsite-campres-item[data-key="${entry.key}"]`);
            if (!item) {
                item = document.createElement('div');
                item.className = 'campsite-campres-item';
                item.dataset.key = entry.key;
                item.innerHTML = `
                    <div class="campsite-resource-orb" data-vital="${entry.vital}"></div>
                    <div class="campsite-campres-value" aria-hidden="true"></div>
                    <div class="campsite-campres-label"></div>
                `;
                row.appendChild(item);
            }
            const labelEl = item.querySelector('.campsite-campres-label');
            if (labelEl) labelEl.textContent = entry.label;

            // Tooltip: match info panel resource tooltips.
            const orb = item.querySelector('.campsite-resource-orb');
            if (orb && typeof setupTooltip === 'function' && orb.dataset.tooltipWired !== '1') {
                orb.dataset.tooltipWired = '1';
                try { setupTooltip(orb, () => getResourceTooltipHtml(entry.resName)); } catch { /* ignore */ }
            }
        }

        const EPS = 1e-6;

        for (const entry of entries) {
            const item = row.querySelector(`.campsite-campres-item[data-key="${entry.key}"]`);
            if (!item) continue;

            const orb = item.querySelector('.campsite-resource-orb');
            const valEl = item.querySelector('.campsite-campres-value');

            const res = get(entry.resName);
            const isDiscovered = !!(res && res.isDiscovered);
            const shouldShow = !!res && (!entry.requireDiscovered || isDiscovered);
            item.classList.toggle('is-hidden', !shouldShow);

            // Net rate coloring (positive green / negative red / stale white)
            item.classList.remove('is-net-positive', 'is-net-negative', 'is-net-stale');

            if (!shouldShow) {
                try { if (orb) orb.style.setProperty('--fill', `0%`); } catch { /* ignore */ }
                if (valEl) valEl.textContent = '';
                try { item.removeAttribute('title'); } catch { /* ignore */ }
                continue;
            }

            const amt = res.integer ? Math.floor(Number(res.amount) || 0) : (Number(res.amount) || 0);
            const cap = res.integer ? Math.floor(Number(res.capacity) || 0) : (Number(res.capacity) || 0);
            const pct = (cap > 0) ? Math.max(0, Math.min(100, (amt / cap) * 100)) : 0;
            try { if (orb) orb.style.setProperty('--fill', `${pct}%`); } catch { /* ignore */ }

            if (valEl) valEl.textContent = `${amt}${cap > 0 ? `/${cap}` : ''}`;
            // `title` is intentionally not used here; tooltips are handled by the shared tooltip system.

            try {
                const rates = computeResourceRates(entry.resName);
                const net = Number(rates?.netPerSecond ?? 0);
                const isCapped = (cap > 0) && (amt >= (cap - (res.integer ? 0 : EPS)));

                let state = 'stale';
                if (Number.isFinite(net)) {
                    if (Math.abs(net) < EPS) {
                        state = 'stale';
                    } else if (net > 0 && isCapped) {
                        // Not changing because storage is full.
                        state = 'stale';
                    } else if (net > 0) {
                        state = 'positive';
                    } else {
                        state = 'negative';
                    }
                }

                item.classList.toggle('is-net-positive', state === 'positive');
                item.classList.toggle('is-net-negative', state === 'negative');
                item.classList.toggle('is-net-stale', state === 'stale');
            } catch { /* ignore */ }
        }
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
            // Disabled buttons should not trigger job assignment logic.
            if (btn.disabled) return;
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

        // Hide resource-discovery QoL jobs until they are unlocked
        if (job.id === 'labs_scavenger' && job.unlimited !== true) return;
        if (job.id === 'textile_salvager' && job.unlimited !== true) return;

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
                const consumes = Array.isArray(job.consumes) ? job.consumes : [];

                const bonusLabels = [];
                try {
                    const eff = computeRewardEffects(job.id, produces, gameFlags);
                    if (eff && Array.isArray(eff.labels)) bonusLabels.push(...eff.labels);
                } catch { /* ignore */ }

                const lines = [];
                lines.push(`<h4>${job.name}</h4>`);
                const briefDesc = String(desc || '').trim() || (produces && produces !== '—' ? `Produces ${produces} for the camp.` : 'Supports camp operations.');
                lines.push(`<p class="tooltip-description">${briefDesc}</p>`);
                lines.push(`<p>Assigned: ${assigned} / ${slots}</p>`);

                // Produces
                try {
                    const perWorkerEffective = Number(effectiveRate) || 0;
                    const perWorkerBase = Number(baseRate) || 0;
                    const isBoosted = perWorkerEffective > perWorkerBase + 1e-9;
                    const valueCls = `tooltip-amount-produces${isBoosted ? ' is-boosted' : ''}`;
                    lines.push(`<div class="tooltip-section"><h4>Produces</h4><ul class="tooltip-bullets">`);
                    if (produces && produces !== '—') {
                        lines.push(
                            `<li>${produces}: ` +
                            `<span class="${valueCls}">${perWorkerEffective.toFixed(3)}</span>/s ` +
                            `<span class="tooltip-muted">(base ${perWorkerBase.toFixed(3)}/s)</span>` +
                            `</li>`
                        );
                    } else {
                        lines.push(`<li>—</li>`);
                    }
                    lines.push(`</ul></div>`);
                } catch { /* ignore */ }

                // Consumes
                try {
                    const keep = consumes
                        .map(c => ({ resource: c && c.resource ? String(c.resource) : null, rate: Number(c && c.rate) }))
                        .filter(c => c.resource && Number.isFinite(c.rate) && c.rate > 0);
                    if (keep.length) {
                        lines.push(`<div class="tooltip-section"><h4>Consumes</h4><ul class="tooltip-bullets">`);
                        for (const c of keep) {
                            const perWorker = (Number(c.rate) || 0);
                            lines.push(
                                `<li>${c.resource}: ` +
                                `<span class="tooltip-amount-consumes">${perWorker.toFixed(3)}</span>/s</li>`
                            );
                        }
                        lines.push(`</ul></div>`);
                    }
                } catch { /* ignore */ }

                try {
                    const m = getMorale();
                    const moraleDelta = Math.round((m && typeof m.percent === 'number' ? m.percent : 100) - 100);
                    const labels = [];
                    const sign = moraleDelta > 0 ? '+' : '';
                    labels.push(`Morale: ${sign}${moraleDelta}%`);
                    for (const b of bonusLabels) labels.push(b);
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
        if (totalAssigned > 0) {
            addLogEntry(`All ${label} are currently assigned. Remove one from a job first.`, LogType.ERROR);
        } else {
            addLogEntry(`No available ${label} to assign.`, LogType.ERROR);
        }
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
