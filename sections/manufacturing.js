export function setupManufacturingSection(manufacturingSection) {
    if (!manufacturingSection) {
        // A fallback to find the element if it's not passed in
        manufacturingSection = document.getElementById('manufacturingSection');
    }
    if (!manufacturingSection) { return; } // Exit if the element can't be found

    // Set the placeholder content
    manufacturingSection.innerHTML = `<h2>Manufacturing</h2><p>Feature coming soon...</p>`;
}