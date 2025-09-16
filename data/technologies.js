// A private, unchangeable "master copy" of the original technology data.
const initialTechnologies = [
    // Existing Technologies
    { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [], category: 'Social Tech', description: 'Unlocks advanced technologies with the power of quantum mechanics.' },
    { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Bio Tech', description: 'Allows the creation of materials on a molecular scale.' },
    { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech', description: 'Integrates artificial intelligence to increase efficiency.' },
    
    // --- Mining Technologies ---
    // NEW: Added Basic Storage and Xylite Storage techs.
    { name: 'Basic Storage', duration: 25, isResearched: false, prerequisites: [], category: 'Mining Tech', description: 'Develops techniques for building larger resource containers. Unlocks the Stone Stockpile.' },
    { name: 'Xylite Storage', duration: 60, isResearched: false, prerequisites: ['Basic Storage'], category: 'Mining Tech', description: 'Uses crystalline structures to create advanced, high-capacity silos. Unlocks the Xylite Silo.' },
    { name: 'Automated Drills', duration: 30, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Mining Tech', description: 'Deploys automated drills to increase mining yield.' },
    { name: 'Advanced Sonar', duration: 90, isResearched: false, prerequisites: ['Automated Drills'], category: 'Mining Tech', description: 'Uses advanced sonar to find rich resource veins.' },
    { name: 'Plasma Cutter', duration: 180, isResearched: false, prerequisites: ['Advanced Sonar', 'Nano Fabrication'], category: 'Mining Tech', description: 'Cuts through the toughest materials with plasma.' },
    
    // --- Bio Technologies ---
    { name: 'Xeno-Biology', duration: 45, isResearched: false, prerequisites: ['Nano Fabrication'], category: 'Bio Tech', description: 'Studies alien flora and fauna to unlock new biological resources.' },
    { name: 'Synthetic Crops', duration: 150, isResearched: false, prerequisites: ['Xeno-Biology'], category: 'Bio Tech', description: 'Grows high-yield synthetic crops in any environment.' },
    { name: 'Genetic Engineering', duration: 250, isResearched: false, prerequisites: ['Synthetic Crops', 'AI Integration'], category: 'Bio Tech', description: 'Manipulates genetic code to optimize life forms.' },

    // --- Social Technologies ---
    { name: 'Communication Array', duration: 40, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech', description: 'Establishes a galaxy-wide communication network.' },
    { name: 'Universal Translator', duration: 120, isResearched: false, prerequisites: ['Communication Array'], category: 'Social Tech', description: 'Enables instantaneous translation of all known languages.' },
    { name: 'Galactic Diplomacy', duration: 200, isResearched: false, prerequisites: ['Universal Translator'], category: 'Social Tech', description: 'Allows for complex diplomatic relations with other species.' }
];

// This is the "live" state of technologies that the game will modify.
export let technologies = JSON.parse(JSON.stringify(initialTechnologies));

// This function will be called to properly reset the live data from the master copy.
export function resetTechnologies() {
    technologies.length = 0;
    technologies.push(...JSON.parse(JSON.stringify(initialTechnologies)));
    console.log("Technology data has been reset.");
}