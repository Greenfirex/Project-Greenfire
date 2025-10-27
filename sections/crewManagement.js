import { resources } from '../resources.js';
import { jobs, getJobById } from '../data/jobs.js';
import { addLogEntry, LogType } from '../log.js';

// Render the Crew Management section (basic info for now)
export function setupCrewManagementSection(sectionEl) {
    if (!sectionEl) return;
    // Mirror the other sections by using the shared .content-panel wrapper
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
    updateCrewSection();
}

// Called every tick / when resources update to refresh the displayed values
export function updateCrewSection() {
    const countEl = document.getElementById('crewCount');
    if (!countEl) return;
    const survivors = resources.find(r => r.name === 'Survivors');
    const free = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    countEl.textContent = free;

    const jobsContainer = document.getElementById('crewJobsContainer');
    if (!jobsContainer) return;
    jobsContainer.innerHTML = '';

    jobs.forEach(job => {
        const wrapper = document.createElement('div');
        wrapper.className = 'crew-job';
        wrapper.style.marginBottom = '8px';

        const title = document.createElement('div');
        title.innerHTML = `<strong>${job.name}</strong> — Slots: ${job.assigned}/${job.slots}`;
        wrapper.appendChild(title);

        const controls = document.createElement('div');
        controls.style.marginTop = '4px';

        const assignBtn = document.createElement('button');
        assignBtn.className = 'small-button';
        assignBtn.textContent = 'Assign';
        assignBtn.disabled = (free <= 0 || job.assigned >= job.slots);
        assignBtn.onclick = () => {
            assignToJob(job.id);
        };

        const unassignBtn = document.createElement('button');
        unassignBtn.className = 'small-button';
        unassignBtn.style.marginLeft = '6px';
        unassignBtn.textContent = 'Unassign';
        unassignBtn.disabled = (job.assigned <= 0);
        unassignBtn.onclick = () => {
            unassignFromJob(job.id);
        };

        controls.appendChild(assignBtn);
        controls.appendChild(unassignBtn);
        wrapper.appendChild(controls);

        const note = document.createElement('div');
        note.className = 'job-note';
        note.style.fontSize = '0.9em';
        note.style.color = '#cfcfcf';
        note.textContent = job.slots > 0 ? `Unlocked by building: ${job.building}` : 'Locked — build the corresponding structure on the Crash Site.';
        wrapper.appendChild(note);

        jobsContainer.appendChild(wrapper);
    });
}

function assignToJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    const survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors || Math.floor(survivors.amount) <= 0) {
        addLogEntry('No available survivors to assign.', LogType.ERROR);
        return;
    }
    if (job.assigned >= job.slots) {
        addLogEntry('No open job slots available.', LogType.ERROR);
        return;
    }

    survivors.amount = Math.max(0, Math.floor(survivors.amount) - 1);
    job.assigned = (job.assigned || 0) + 1;
    addLogEntry(`Assigned 1 survivor to ${job.name}.`, LogType.INFO);
    updateCrewSection();
}

function unassignFromJob(jobId) {
    const job = getJobById(jobId);
    if (!job) return;
    if (job.assigned <= 0) {
        addLogEntry('No assigned survivors to remove from this job.', LogType.ERROR);
        return;
    }
    const survivors = resources.find(r => r.name === 'Survivors');
    if (!survivors) return;

    job.assigned -= 1;
    survivors.amount = Math.min(survivors.capacity, (survivors.amount || 0) + 1);
    addLogEntry(`Unassigned 1 survivor from ${job.name}.`, LogType.INFO);
    updateCrewSection();
}