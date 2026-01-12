import { resources } from '../core/resources.js';
import { jobs, getJobById, getEffectiveJobRate } from '../data/jobsManager.js';
import { upgradeEffects } from '../data/upgradeEffects.js';
import { getMorale } from '../data/morale.js';
import { gameFlags } from '../data/gameFlags.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';

// Render the Crew Management section (basic info for now)
export function setupCrewManagementSection(sectionEl) {
    if (!sectionEl) return;
    
    // Determine labels based on chapter
    const isChapter2 = gameFlags.chapter === 2;
    const crewLabel = isChapter2 ? 'Crew Members' : 'Survivors';
    const instructionText = isChapter2 
        ? 'Assign crew members to manage colony operations and resource production.'
        : 'Assign survivors to job slots unlocked by buildings on the Crash Site.';
    
    sectionEl.innerHTML = `
        <div class="content-panel">
            <div class="section-inner crew-section">
                <h2>Crew Management</h2>
                <div class="crew-summary">
                    <p>Current ${crewLabel.toLowerCase()}: <strong id="crewCount">0</strong></p>
                    <p class="crew-note">${instructionText}</p>
                </div>
                <div id="crewJobsContainer" class="crew-jobs" style="margin-top:12px;"></div>
            </div>
        </div>
    `;
    // setup delegated pointerdown handler once (works reliably during fast DOM updates)
    const jobsContainer = document.getElementById('crewJobsContainer');
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
    updateCrewSection();
}

// Called every tick / when resources update to refresh the displayed values
export function updateCrewSection() {
    const countEl = document.getElementById('crewCount');
    if (!countEl) return;
    
    // Handle both "Survivors" (Chapter 1) and "Crew Members" (Chapter 2)
    let survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
    const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    countEl.textContent = survivorsCount;

    // compute total assigned across all real jobs
    const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
    const idle = Math.max(0, survivorsCount - totalAssigned);

    updateCrewMenuIdleWarning(survivorsCount, idle);

    const jobsContainer = document.getElementById('crewJobsContainer');
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
    idleRow.innerHTML = `
        <div class="job-name"><strong>Idle</strong></div>
        <div class="job-controls"></div>
        <div class="job-count"><span class="idle-count">${idle}</span></div>
        <div class="job-controls"></div>
    `;
    jobsContainer.appendChild(idleRow);

    // Job rows
    jobs.forEach(job => {
        // Hide Wire Collector job until the upgrade is completed
        if (job.id === 'wire_collector' && !gameFlags.wireScavengingOrganized) {
            return;
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

        // --- Setup tooltip for this job row (dynamic) ---
        if (typeof setupTooltip === 'function') {
            // prefer attaching to the name column for discoverability
            const tooltipTarget = nameCol;
            const tooltipGetter = () => {
                const produces = job.produces || '—';
                const baseRate = (typeof job.rate === 'number') ? job.rate : 0;
                const effectiveRate = getEffectiveJobRate(job);
                const assigned = job.assigned || 0;
                const slots = (job.unlimited === true || job.slots === Number.POSITIVE_INFINITY) ? '∞' : (job.slots || 0);
                const desc = job.description || '';

                // collect active upgrade labels that affect this job/resource
                const bonuses = [];
                // Only show upgrades that explicitly target jobs here.
                // Action-only or resource-wide upgrades (eff.actions == null)
                // should not appear on per-job tooltips.
                for (let i = 0; i < upgradeEffects.length; i++) {
                    const eff = upgradeEffects[i];
                    if (!eff || !eff.flag) continue;
                    if (!gameFlags[eff.flag]) continue;
                    if (!eff.resources || !eff.resources.includes(produces)) continue;
                    // Require the upgrade to explicitly list actions for job tooltips
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
                // highlight effective per-worker rate and show base in smaller text
                const isBoosted = (typeof effectiveRate === 'number' && typeof baseRate === 'number') ? (effectiveRate > baseRate + 1e-9) : false;
                const rateClass = isBoosted ? 'reward-amount boosted' : 'reward-amount';
                lines.push(`<div><em>Per worker:</em> <span class="${rateClass}">${effectiveRate.toFixed(3)}</span>/s <small style="color:#bbb"> (base ${baseRate}/s)</small></div>`);
                lines.push(`<div><em>Assigned:</em> ${assigned} / ${slots}</div>`);
                // Build a unified Modifiers section including Morale and any upgrades affecting this job
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
                } catch (e) {
                    // ignore tooltip modifier errors
                }
                return lines.join('');
            };
            try { setupTooltip(tooltipTarget, tooltipGetter); } catch (e) { /* ignore */ }
        }
    });
}

function incrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    
    // Handle both "Survivors" (Chapter 1) and "Crew Members" (Chapter 2)
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
    updateCrewSection();
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }
}

function decrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    if ((job.assigned || 0) <= 0) return;
    job.assigned = Math.max(0, (job.assigned || 0) - 1);
    
    // Determine label based on current resource name
    let survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) survivors = resources.find(r => r.name === 'Crew Members');
    const label = survivors?.name === 'Crew Members' ? 'crew member' : 'survivor';
    addLogEntry(`Removed 1 ${label} from ${job.name}.`, LogType.INFO);
    updateCrewSection();
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }
}

function updateCrewMenuIdleWarning(totalSurvivors, idleSurvivors) {
    const btn = document.querySelector('.menu-button[data-section="crewManagementSection"]');
    if (!btn) return;
    const badge = btn.querySelector('.menu-button-warning');
    if (!badge) return;

    const shouldShow = (Number(totalSurvivors) > 0) && (Number(idleSurvivors) > 0);
    badge.classList.toggle('is-hidden', !shouldShow);
}