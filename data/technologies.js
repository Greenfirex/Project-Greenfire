export let technologies = [
    // Existing Technologies
    { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [''], category: 'Social Tech' },
    { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Bio Tech' },
    { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech' },
    { name: 'Testtech', duration: 60, isResearched: false, prerequisites: ['Quantum Computing', 'Nano Fabrication'], category: 'Mining Tech' },

    // New Mining Technologies
    { name: 'Automated Drills', duration: 30, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Mining Tech' },
    { name: 'Advanced Sonar', duration: 90, isResearched: false, prerequisites: ['Automated Drills'], category: 'Mining Tech' },
    { name: 'Plasma Cutter', duration: 180, isResearched: false, prerequisites: ['Advanced Sonar', 'Nano Fabrication'], category: 'Mining Tech' },

    // New Bio Technologies
    { name: 'Xeno-Biology', duration: 45, isResearched: false, prerequisites: ['Nano Fabrication'], category: 'Bio Tech' },
    { name: 'Synthetic Crops', duration: 150, isResearched: false, prerequisites: ['Xeno-Biology'], category: 'Bio Tech' },
    { name: 'Genetic Engineering', duration: 250, isResearched: false, prerequisites: ['Synthetic Crops', 'AI Integration'], category: 'Bio Tech' },

    // New Social Technologies
    { name: 'Communication Array', duration: 40, isResearched: false, prerequisites: ['Quantum Computing'], category: 'Social Tech' },
    { name: 'Universal Translator', duration: 120, isResearched: false, prerequisites: ['Communication Array'], category: 'Social Tech' },
    { name: 'Galactic Diplomacy', duration: 200, isResearched: false, prerequisites: ['Universal Translator'], category: 'Social Tech' }
];