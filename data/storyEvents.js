export const storyEvents = {
    // --- NEW: The intro story for Chapter 1 ---
    crashIntro: {
        title: 'Chapter I - Waking to Ash',
    pages: [
        "I am Lieutenant Commander — second in command aboard the scout vessel Vinea-IV, deployed by Starfleet Command on a terraforming reconnaissance. Our objective was simple and vital: scan this sector, assess viability, and send our findings back to Command. We were not prepared for ruin.",
        "Everything happened during a routine surface scan. A sudden, high‑velocity impact ripped through the hull. Sensors registered nothing beforehand — no heat signature — just a sudden strike from some kind of projectile. Systems failed. Alarms consumed the bridge. Fire and smoke filled the corridors.",
        "I came to coughing, throat full of ash, with flames swallowing the hull where the blast tore a jagged hole. From that breach I crawled into air that smelled of ozone and scorched metal. I do not yet know how many of my crew survived. I do not know whether Command still has a lock on us.",
        "My mission suddenly changed to bare survival. Your first duty is twofold: find survivors — any crew you can reach and pull from the wreckage — and secure your own survival. Save as many as I can and find out what happened. Maybe the ship could be salvaged and we can hope to call for extraction."
    ]
    },
	foundBerries: {
        title: "Edible Flora",
        pages: ["While searching for an alternate route into the ship you discovered a small patch of edible berries. They're modest, but nutritious — you gather what you can to stave off hunger for now."]
    },
    foundRiver: {
        title: "Water Source",
        pages: ["Not far from the crash, you discovered a stream of clear, running water. With some basic filtering and boiling, it should be safe to drink."]
    },
    foundCave: {
        title: "Shelter",
        pages: [
            "You make it away from the blaze and crawl into a small, dry cave recessed in the rock. Completely exhausted, you collapse and let the quiet settle in. For now this shelter is safe — you can rest here and recover before pressing on."
        ]
    },
    reentryFailed: {
        title: 'Entry Denied — Forward Hull Collapsed',
        pages: [
            "You forced your way toward the forward section, smoke clawing at your lungs and heat blistering the plating. For a moment you thought you'd make it — then the structure gave. A shower of burning debris collapsed inward, sealing the corridor with twisted metal.",
            "Flames still lick the breach and smoke roils in pockets beyond reach. The instability and heat make any further entry impossible without heavy equipment. Whatever was in the forward section — gear, consoles, possibly crew — is out of reach for now.",
            "It is harsh but clear: that route is closed. Your priority remains to secure survivors and stabilise a safe working area. Mark the collapse, keep distance from the forward hull, and look for alternate routes and resources to mount a future recovery."
        ]
    },
    alternateAccessFound: {
        title: 'A Narrow Way Home',
        pages: [
            "After gaining your bearings and securing a place to rest, you push onward with a simple goal: get back to the ship by any means necessary.",
            "Between wreckage and scorched rock you find what looks like a maintenance conduit and a collapsed service corridor. It is cramped and unstable, but it runs toward the heart of the ship. The route is risky — falling debris, heat pockets, and tight squeezes — yet it may be the only way to reach intact compartments.",
            "You mark the route and plan carefully. This will not be a quick dash; preparation and caution will be required. For now, you have hope: an alternate path exists, one that might let you reach the ship and search for survivors or vital equipment.",
            "Unfortunately, the passage is blocked by heavy debris. You'll need to find a way to clear it before proceeding."
        ]
    },
enteredShipChoices: {
    title: 'Three Ways Forward',
    pages: [
        "You wedge the prybar beneath the seam and heave. The hull groans and a section gives; a scar of cold metal yawns open. You climb into the breach and your boots scrape across scorched decking.",
        "The ship’s interior is dead quiet and the corridors branch ahead. You can: (1) sweep the south corridor toward engineering and power nodes; (2) take the north corridor toward supply caches and workshops; or (3) press toward the bridge to try and restore systems.",
        "Something else stirs in the dark — a faint sound nearby, like muffled movement or coughing. You can investigate it now, or focus on one of the three routes. Choose carefully — selecting an action will advance that path and reveal its findings."
    ]
},

investigate_sound_found: {
    title: 'A Quiet Hope',
    pages: [
        "You move cautiously toward the noise, keeping your light low. Behind a collapsed panel you find two survivors — shaken and bruised, but alive. You help them to their feet and bring them to safety.",
        "They can be counted among your people now. For a moment the wreck feels less hopeless."
    ]
},
basecamp_established: {
    title: 'Base Camp Established',
    pages: [
        "You have established a rudimentary base camp. This central location allows you to organise survivors, assign simple tasks, and coordinate recovery efforts.",
        "Crew Management is now available — assign survivors to jobs and prioritize tasks from there. Assigned crew will help with routine resource collection and management, improving efficiency and freeing you to focus on exploration and repairs."
    ]
},
bridge_dark: {
    title: 'The Bridge is Dark',
    pages: [
        "You force your way toward the bridge. Panels hang loose and consoles are dark; the room is a maze of collapsed equipment and brittle wiring.",
        "The comms and nav cores are within reach, but the path is treacherous. Restoring emergency power here could change everything — proceed with caution."
    ]
},
south_found_power: {
    title: 'Power Fragments',
    pages: [
        "You force your way through a buckled corridor and find the crippled remains of a power conduit. Panels hang loose and sparking lines run cold, but there are intact junctions and salvaged bus bars you can use.",
        "With these parts you could jury-rig emergency lighting or boost a relay — but it will cost energy and components."
    ]
},
north_found_armory: {
    title: 'Storeroom Cache',
    pages: [
        "A collapsed alcove hides a small cache of tool parts and sealed kits. Nothing pristine, but with some work you can fashion useful implements — pry tools, clamps, and replacement fasteners.",
        "This could open crafting options and let you access stubborn seams elsewhere in the ship."
    ]
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
    },
	
};