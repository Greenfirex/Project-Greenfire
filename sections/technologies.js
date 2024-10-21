export let technologies = [
  { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] }, // No prerequisites
  { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'] },
  { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'] },
  { name: 'Testtech', duration: 60, isResearched: false, prerequisites: ['Quantum Computing', 'Nano Fabrication'] }
];