// A private, unchangeable "master copy" of the original technology data.
const initialTechnologies = [
    // DURATIONS HAVE BEEN REDUCED, AND COSTS ARE SET TO 20 STONE FOR TESTING
    { name: 'Quantum Computing', duration: 0.5, isResearched: false, prerequisites: [], category: 'Social Tech', cost: [{ resource: 'Stone', amount: 20 },{ resource: 'Xylite', amount: 5 }], description: 'Unlocks advanced technologies...' },
    { name: 'Nano Fabrication', duration: 1.5, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Bio Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Allows the creation of materials...' },
    { name: 'AI Integration', duration: 2, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Integrates artificial intelligence...' },
    
    // --- Mining Technologies ---
    { name: 'Basic Storage', duration: 2.5, isResearched: false, prerequisites: [], category: 'Mining Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Unlocks the Stone Stockpile.' },
    { name: 'Xylite Storage', duration: 6, isResearched: false, prerequisites: ['Basic Storage'], category: 'Mining Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Unlocks the Xylite Silo.' },
    { name: 'Automated Drills', duration: 3, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Mining Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Deploys automated drills...' },
    { name: 'Advanced Sonar', duration: 9, isResearched: false, prerequisites: ['Automated Drills'], category: 'Mining Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Uses advanced sonar...' },
    { name: 'Plasma Cutter', duration: 18, isResearched: false, prerequisites: ['Advanced Sonar', 'Nano Fabrication'], category: 'Mining Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Cuts through the toughest materials...' },
    
    // --- Bio Technologies ---
    { name: 'Xeno-Biology', duration: 4.5, isResearched: false, prerequisites: ['Nano Fabrication'], category: 'Bio Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Studies alien flora and fauna...' },
    { name: 'Synthetic Crops', duration: 15, isResearched: false, prerequisites: ['Xeno-Biology'], category: 'Bio Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Grows high-yield synthetic crops...' },
    { name: 'Genetic Engineering', duration: 25, isResearched: false, prerequisites: ['Synthetic Crops', 'AI Integration'], category: 'Bio Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Manipulates genetic code...' },

    // --- Social Technologies ---
    { name: 'Communication Array', duration: 4, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Establishes a galaxy-wide communication network.' },
    { name: 'Universal Translator', duration: 12, isResearched: false, prerequisites: ['Communication Array'], category: 'Social Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Enables instantaneous translation...' },
    { name: 'Galactic Diplomacy', duration: 20, isResearched: false, prerequisites: ['Universal Translator'], category: 'Social Tech', cost: [{ resource: 'Stone', amount: 20 }], description: 'Allows for complex diplomatic relations...' },
    { 
        name: 'Starship Construction', 
        duration: 12, 
        isResearched: false, 
        prerequisites: ['Nano Fabrication', 'AI Integration'], 
        category: 'Social Tech', 
        cost: [{ resource: 'Stone', amount: 20 }],
        description: 'Unlocks the Shipyard...' 
    },
    { 
        name: 'Stellar Cartography', 
        duration: 18, 
        isResearched: false, 
        prerequisites: ['Starship Construction', 'Communication Array'], 
        category: 'Social Tech', 
        cost: [{ resource: 'Stone', amount: 20 }],
        description: 'Enables deep space exploration...' 
    },
];

// This is the "live" state of technologies that the game will modify.
export let technologies = JSON.parse(JSON.stringify(initialTechnologies));

// This function will be called to properly reset the live data from the master copy.
export function resetTechnologies() {
    technologies.length = 0;
    technologies.push(...JSON.parse(JSON.stringify(initialTechnologies)));
    console.log("Technology data has been reset.");
}