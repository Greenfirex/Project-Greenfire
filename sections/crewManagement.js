import { resources } from '../resources.js';
import { jobs, getJobById } from '../data/jobs.js';
import { addLogEntry, LogType } from '../log.js';
import { setupTooltip } from '../tooltip.js';

// Render the Crew Management section (basic info for now)
export function setupCrewManagementSection(sectionEl) {
    if (!sectionEl) return;
    sectionEl.innerHTML = `
        <div class="content-panel">
            <div class="section-inner crew-section">
                <h2>Crew Management</h2>
                <div class="crew-summary">
                    <p>Current survivors: <strong id="crewCount">0</strong></p>
                    <p class="crew-note">Assign survivors to job slots unlocked by buildings on the Crash Site.</p>
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
    const survivors = resources.find(r => r.name === 'Survivors');
    const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    countEl.textContent = survivorsCount;

    // compute total assigned across all real jobs
    const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
    const idle = Math.max(0, survivorsCount - totalAssigned);

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
        countCol.innerHTML = `<span class="assigned-count">${job.assigned || 0}</span> / <span class="slots-count">${job.slots || 0}</span>`;
        wrapper.appendChild(countCol);

        const incCol = document.createElement('div');
        incCol.className = 'job-controls';
        const incBtn = document.createElement('button');
        incBtn.className = 'arrow-button';
        incBtn.dataset.jobId = job.id;
        incBtn.dataset.action = 'inc';
        incBtn.ariaLabel = `Increase assigned for ${job.name}`;
        incBtn.textContent = '›';
        incBtn.disabled = (idle <= 0 || (job.assigned || 0) >= (job.slots || 0));
        incCol.appendChild(incBtn);
        wrapper.appendChild(incCol);

        const note = document.createElement('div');
        note.className = 'job-note';
        note.textContent = job.slots > 0 ? `Unlocked by: ${job.building}` : 'Locked — build structure on Crash Site.';
        // place note as full-width element below row
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'crew-job-wrapper';
        rowWrapper.appendChild(wrapper);
        rowWrapper.appendChild(note);

        jobsContainer.appendChild(rowWrapper);

        // --- Setup tooltip for this job row (dynamic) ---
        if (typeof setupTooltip === 'function') {
            // prefer attaching to the name column for discoverability
            const tooltipTarget = nameCol;
            const tooltipGetter = () => {
                const produces = job.produces || '—';
                const rate = (typeof job.rate === 'number') ? job.rate : 0;
                const assigned = job.assigned || 0;
                const slots = job.slots || 0;
                const desc = job.description || '';

                // Build simple HTML tooltip (the tooltip system should accept HTML)
                const lines = [];
                lines.push(`<strong>${job.name}</strong>`);
                if (desc) lines.push(`<div style="margin-top:6px">${desc}</div>`);
                lines.push(`<div style="margin-top:6px"><em>Produces:</em> ${produces}</div>`);
                lines.push(`<div><em>Per worker:</em> ${rate}/s</div>`);
                lines.push(`<div><em>Assigned:</em> ${assigned} / ${slots}</div>`);
                return lines.join('');
            };
            try { setupTooltip(tooltipTarget, tooltipGetter); } catch (e) { /* ignore */ }
        }
    });
}

function incrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    const survivors = resources.find(r => r.name === 'Survivors');
    const survivorsCount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
    const idle = Math.max(0, survivorsCount - totalAssigned);

    if (idle <= 0) {
        addLogEntry('No available survivors to assign.', LogType.ERROR);
        return;
    }
    if ((job.assigned || 0) >= (job.slots || 0)) {
        addLogEntry('No open job slots available.', LogType.ERROR);
        return;
    }

    job.assigned = (job.assigned || 0) + 1;
    addLogEntry(`Assigned 1 survivor to ${job.name}.`, LogType.INFO);
    updateCrewSection();
}

function decrementJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    if ((job.assigned || 0) <= 0) {
        addLogEntry('No assigned survivors to remove from this job.', LogType.ERROR);
        return;
    }

    job.assigned -= 1;
    addLogEntry(`Unassigned 1 survivor from ${job.name}.`, LogType.INFO);
    updateCrewSection();
}