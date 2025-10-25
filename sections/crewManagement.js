import { resources } from '../resources.js';

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
                    <p class="crew-note">More crew features coming soon.</p>
                </div>
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
    const amount = survivors ? Math.max(0, Math.floor(survivors.amount)) : 0;
    countEl.textContent = amount;
}