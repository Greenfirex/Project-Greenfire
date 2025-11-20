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
        "The ship’s interior is dead quiet and the corridors branch ahead. You can: (1) sweep the south corridor toward a junction that leads to the cafeteria and crew quarters; (2) take the north corridor toward the labs and the power core; or (3) head for the bridge to check communications and navigation systems.",
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

tasks_for_survivors_completed: {
    title: 'Camp Organized — Ready to Explore',
    pages: [
        "With the base camp now properly organized and survivors assigned to essential tasks, you feel the momentum of recovery beginning to take hold. Water collection and scrap gathering proceed steadily, and the foraging teams have begun to supplement your rations.",
        "The survivors are settled and productive — they understand their roles and can maintain basic operations while you focus on broader objectives. The camp hums with quiet efficiency: a foundation from which to launch deeper exploration of the ship.",
        "Now that your people are secure and organized, it's time to refocus on the ship itself. There are still survivors unaccounted for, vital systems to restore, and tools that could aid in your eventual rescue. The corridors ahead hold answers — and perhaps hope."
    ]
},

// Triggered when the "Improve base camp" objective completes (all listed upgrades installed)
base_camp_improved: {
    title: 'Base Camp — Systems Integrated',
    pages: [
        "Piece by piece the rough encampment has become a functioning base. Crude foraging tools boost gathering, a steady campfire lifts morale, scavenger rigs streamline scrap recovery, and a salvaged cooking unit turns raw finds into reliable sustenance.",
        "Shelters are up — insulated tents break the worst of the chill — and rain catchers feed purification units that cycle clean water into storage. Survivors move with practiced rhythm now; tasks are understood, hand‑offs are smooth, and downtime actually restores strength.",
        "This is no longer a fragile staging area. It is a stable platform for longer operations and deeper exploration. You can afford broader objectives: stockpiling for endurance, investigating signals, and pushing into higher‑risk compartments. The wreck is still dangerous, but now you face it with infrastructure and purpose."
    ]
},

// Triggered when Stockpile resources objective completes (resource goals reached)
stockpile_resources_secured: {
    title: 'Reserves Stabilized — Supply Lines Holding',
    pages: [
        "Food, water, scrap, chemicals, wire, fabric — the critical reserves now sit at sustainable levels. Collection cycles are efficient and storage areas feel ordered instead of desperate.",
        "Crew no longer hover anxiously over dwindling numbers. Confidence replaces ration panic and repair work proceeds without constant triage. The camp can weather delays, pursue exploration, and absorb setbacks.",
        "With endurance secured the path opens toward broader goals: infrastructural refinement, distant signals, and deeper ship salvage. Another pillar of survival is locked in — now leverage it." 
    ]
},

south_corridor_entry: {
    title: 'South Corridor — New Access',
    pages: [
        "You pry and squeeze past collapsed plating and heat-scorched rails until a clearer path opens. Beyond the obstruction are two side compartments: a mess hall lined with crushed tables and a block of crew berths.",
        "You can search these compartments for salvage and survivors — the cafeteria may hide food and water rations, and the crew quarters may contain parts that could aid survivors. Choose a location to investigate."
    ]
},

south_explore_cafeteria: {
    title: 'Mess Hall — Supplies and Survivors',
    pages: [
    "The mess hall is a mess of overturned tables and scorched trays, but in the wreckage you find sealed stashes of bottled water and compact stamina bars — supplies that will keep you going.",
        "Hidden beneath a collapsed service counter you discover two unconscious crew members. You drag them clear, tend to their wounds, and carry them back to the shelter outside. For now they are safe at the base camp and will recover; their presence will change the days ahead."
    ]
},

south_check_quarters: {
    title: 'Crew Quarters — Personal Effects',
    pages: [
        "The crew berths are cramped and personal lockers hang open. Amidst torn bedding and charred lockers you find a handful of spare fasteners, a compact tool roll, and one survivor who sheltered in a locker.",
        "The items are modest, but combined with scavenged parts they may let you patch systems or improve survivor comfort. The extra pair of hands could help with delicate repairs."
    ]
},

tents_installed: {
    title: 'Shelter Established',
    pages: [
        "With enough fabric and some basic framing you and the survivors construct several simple tents at the base camp. They provide sheltered rest and make recovery more reliable.",
    "Resting in camp now restores more stamina and helps the group recover faster."
    ]
},

north_corridor_found_branches: {
    title: 'North Corridor — New Leads',
    pages: [
        "You push into the northern passage and find the air stale with dust and coolant. The corridor splits quickly: one arm runs toward a cluster of research labs, the other slopes down toward the ship's power core. Both lines of travel promise salvage — and both carry risk.",
        "A lone survivor, bruised and coughing, staggers from a side alcove clutching a scorched medkit. You help him to his feet, give him some water, then send him back to the base camp to recover and tend to the others.",
        "Beyond immediate salvage, the power core offers more than parts: restoring even partial power could bring up emergency systems — lighting, limited comms and ventilation — that would greatly improve search and rescue operations. Getting inside might change the game for recovery efforts."
    ]
},

powercore_locked_attempt: {
    title: 'Reinforced Doors — A Frustrating Barrier',
    pages: [
        "You arrive at the power core access and find a pair of heavy, reinforced doors — the sort meant to survive boarding and blast. You set to work with pry bars and crude tools, levering at seams and searching for weak points. Sparks fly; the metal groans, but the mechanism will not yield.",
        "Without the ship's power the locking servos remain jammed and encrypted failsafes do their job: keep everything sealed. Your crude tools are capable of noise and effort, not miracles. For now you must step back and consider another approach.",
        "This attempt revealed the problem but not the solution. Somewhere in the wreckage there may be explosives or salvageable components that could open the core by force — but such solutions are dangerous and costly."
    ]
},

powercore_breached: {
    title: 'Breach at the Core',
    pages: [
        "You have swept the accessible sections of the ship — the cafeteria, crew quarters, and nearby compartments. All survivors you could find are accounted for and safe at base camp. With everyone secured, you judge it safe to risk the explosive breach at the power core.",
        "Heart racing, you set the makeshift charge against the reinforced seam and take cover. The detonation is raw and violent — metal tears, a pressure wave rolls through the corridor — then silence. The blast succeeds: the seal is blown and the core chamber is exposed.",
        "Inside, scorched conduits and cold reactors glint in your headlamp. Among the wreckage you recover power cells and ship components. The risk was high, but knowing your people are safe makes it acceptable. Emergency power can now be restored — carefully — to bring systems online and simplify further recovery."
    ]
},

found_labs_cache: {
    title: 'Research Labs — Salvage and Secrets',
    pages: [
        "The labs are a study in frozen chaos: instruments half-melted, readouts fractured, and metal racks tipped over. Yet tucked into a sealed locker you find intact circuit modules, vials of stable reagents, and a battered datapad whose last entries hold experimental notes.",
        "Among the salvaged items is a cache of chemical compounds — useful for repairs and certain craft projects — and evidence of ongoing experiments into propulsion catalysts. You also find two surviving technicians, groggy but alive, who can be coaxed back to the camp to help with repairs.",
        "This area offers both immediate practical gains and long-term opportunity. The reagents and data may unlock new crafting or research options; the surviving technicians may speed future engineering work if you can keep them alive."
    ]
},

bridge_lift_no_power: {
    title: 'Bridge Access — Dead Lift',
    pages: [
        "You follow signage toward the bridge and reach a recessed access well. A heavy personnel lift sits dead in its shaft — no glow on the panel, no sound from the motors.",
        "You consider using force, but the framing and blast shielding were designed to resist breaches. Blasting through here would collapse the shaft and seal the route for good.",
        "Conclusion: without ship power, the lift won’t move. You'll need to restore emergency power elsewhere before you can reach the bridge."
    ]
},

emergency_power_restored: {
    title: 'Emergency Power Online',
    pages: [
        "You bridge scorched conduits with fresh wire and jack recovered power cells into the emergency busses. One by one, indicators wink from red to amber.",
        "A low hum builds. Emergency lighting kicks in, ventilation coughs to life, and system panels accept basic input. Not full power, but enough to move and work.",
        "With this, sealed access ways — including the bridge lift — should cycle again. Proceed, but expect glitches and limited capacity."
    ]
},

bridge_after_power: {
    title: 'Bridge — Access Regained',
    pages: [
        "You return to the bridge access. The lift panel glows weakly now; you call it down and the doors grind open. Inside, debris and soot coat the floor, but the car moves.",
        "At the bridge level, emergency lighting draws long shadows across dead consoles. Some subsystems respond to touch. You can begin the long work of bringing systems back."
    ]
},
comms_fixed_distress: {
    title: 'Distress Signal Sent',
    pages: [
        "You gut the least-destroyed comms console, splice scorched bundles, and bridge missing circuits with salvaged wire. A power cell hums at the edge of tolerance as you force the rig to life.",
        "The carrier locks. A narrowband distress packet crawls outward — slow, because subspace relays are beyond repair with current tools. Without a proper subspace field the signal must ride conventional bands and chained amplification scattering across the sector.",
        "Help will come, but not soon. Minutes of work just bought you days — maybe weeks — of waiting. You decide on the only rational response: build reserves and organise base camp. Survivors will need stability, and shortages during a long wait could be fatal."
    ]
},
// Smoke sighting after both base camp improvements and stockpiling complete
stockpile_complete_smoke_sighting: {
    title: 'A Distant Signal',
    pages: [
        "The camp has transformed. Shelters stand insulated against the elements, water flows through purification systems, and stockpiles of food and supplies line the storage areas. Survivors move with confidence and purpose — the chaotic scramble for survival has given way to organized efficiency.",
        "You take a moment near the perimeter to review the progress. The camp is no longer fragile — it's a functioning base, capable of sustaining your people through the wait for rescue.",
        "That's when something catches your eye: a thin pillar of smoke rising steadily from the treeline in the distance. It's controlled, deliberate — not wildfire or natural combustion. That smoke could only mean one thing: another escape pod landing site.",
        "There may be more survivors out there, waiting. You mark the direction and prepare to investigate.",
        "New action unlocked: Investigate Distant Smoke."
    ]
},
// New: Investigate distant smoke — escape pod survivors and a warning
investigate_distant_smoke: {
    title: 'Smoke on the Horizon',
    pages: [
        "Across the treeline a thin pillar of smoke spirals into the sky. You push through scrub and shattered branches until you find the source — an escape pod half-buried and hissing.",
        "Inside you find two survivors — shaken, dehydrated, but alive. You stabilize them and begin the walk back to camp. They add hands, hope, and new stories to the fire.",
        "As you approach camp with the two survivors, one of your crew runs toward you, breathless and excited. Between gasps he delivers urgent news: the radio you repaired has received a signal — encrypted, but definitely a transmission. Command protocols, officer-grade cipher.",
        "As second in command, you have the authority and training to decrypt military transmissions. This could be Starfleet Command responding to your distress call, or another survivor with access to secure channels. You need to get to the radio immediately and break that encryption."
    ]
},

decrypt_radio_message: {
    title: 'Encrypted Transmission',
    pages: [
        "You sit at the makeshift console and begin the decryption process. The cipher is definitely Starfleet Command — high-priority military protocol. Your fingers work through the familiar patterns, peeling back layers of encryption.",
        "The message materializes: Multiple sectors under coordinated attack. Unknown hostiles — fast, organized, devastating. Entire fleets are being engaged. Starfleet Command is overwhelmed, scrambling to mount a defense across the galaxy.",
        "The nearest vessel that could render aid — the USS Horizon — was en route to your coordinates but went silent mid-transit. Assumed engaged or destroyed. Command cannot promise extraction. You are on your own for the foreseeable future.",
        "Then comes a classified addendum, eyes-only for command staff: Your captain was on a covert mission. Details were compartmentalized. With the captain confirmed dead, Command directs you — as acting commanding officer — to search the captain's quarters for an encrypted data drive containing mission specifics.",
        "The message ends with a grim directive: maintain operational security, sustain your crew, and retrieve that intel. Whatever the captain was hiding, Command believes it matters now more than ever. You delete the transmission from the log and keep this to yourself. The crew doesn't need more fear — they need leadership."
    ]
},
// Chapter II Begins (triggered after checking captain's quarters)
chapter2_intro: {
    title: 'Chapter II - Shadows Beyond the Perimeter',
    pages: [
        "You force open the sealed door to the captain's quarters. The room is untouched by fire but thick with ash and silent grief. Personal effects lie scattered — a coffee mug, star charts, a framed photo of a family you'll never meet.",
        "Behind a false panel in the captain's desk you find what Command mentioned: a compact encrypted data drive, military-grade cipher. You pocket it carefully. With the captain dead and no master decryption key, unlocking its contents may prove impossible. Whatever secret mission brought you here remains locked away — for now.",
        "You step back into the corridor and take stock. The message from Command was clear: you are on your own. The Horizon is gone. No rescue is coming. Survival is no longer about waiting for extraction — it's about building something that can endure.",
        "Your crew has stabilized food and water. The base camp is functional. But the forest is not empty. You've seen the tracks, heard movement in the dark. Whatever inhabits this world is watching, and it won't ignore your presence forever.",
        "You return to camp with a new resolve. The mission has changed. Secure the perimeter. Expand your capabilities. Fortify what you've built. Your scientist approaches you with urgency — he wants to establish a basic outdoor lab. Those strange crystals scattered across the landscape have caught his attention. He believes they may be significant, perhaps even critical.",
        "Chapter II begins. New priorities: research the unknown, strengthen defenses, and prepare for what comes next."
    ]
},
}
