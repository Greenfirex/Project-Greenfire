export const storyEvents = {
    // --- NEW: The intro story for Chapter 1 ---
    crashIntro: {
        title: "System Failure",
        pages: [
            "You are a crew member aboard the Exploration Vessel Horizon, tasked with scanning potentially habitable worlds in the Kepler-186 system. The fifth planet, Kepler-186f, looks promising.",
            "Suddenly, the ship's alarms blare. A strange energy field from the planet's upper atmosphere is wreaking havoc on all systems. Power fluctuates wildly, and the ship begins an uncontrolled descent.",
            "The crash is violent. You black out, only to awaken to the smell of smoke and the eerie sounds of an alien forest. A quick check of the wreckage confirms your worst fear: you are the only survivor. Your mission has changed from exploration to survival."        ]
    },
	foundBerries: {
        title: "Edible Flora",
        pages: ["Your brief scouting run was fruitful. You've identified a patch of alien flora that appears to be edible, although not particularly nutritious. This should allow you to forage for basic food rations."]
    },
    foundRiver: {
        title: "Water Source",
        pages: ["Not far from the crash, you discovered a stream of clear, running water. With some basic filtering and boiling, it should be safe to drink."]
    },
    foundCave: {
        title: "Shelter",
        pages: ["Finally, you found a small, dry cave recessed into a rock wall. It's not much, but it's a sheltered location, perfect for resting and recovering energy safely."]
    },
	

    // --- Your existing story events ---
    gameStart: {
        title: "First Landing",
        // MODIFIED: Changed 'message' to 'pages' for consistency with the popup system
        pages: [
            "Welcome, Commander. You have successfully established the first off-world science colony on the planet Telos-IV. This world is rich with unique and unknown resources. Your mission is to lead your team, build out the colony, and unlock the scientific potential hidden here. The future of exploration is in your hands."
        ]
    },
    unlockResearch: {
        title: "A Glimmer of Insight",
        // MODIFIED: Changed 'message' to 'pages'
        pages: [
            "We should use our resources to estabilish our first laboratory to analyze Xylite potential. Lets build laboratory and research its properties."
        ]
    },
    unlockXylite: {
        title: "Crystalline Anomaly",
        // MODIFIED: Changed 'message' to 'pages'
        pages: [
            "While excavating common stone, our geological team detected unusual energy readings. They've isolated a new crystalline mineral of unknown potential. It has been designated: Xylite."
        ]
    }
};