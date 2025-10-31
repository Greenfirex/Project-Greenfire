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
        "The mess hall is a mess of overturned tables and scorched trays, but in the wreckage you find sealed stashes of bottled water and compact energy bars — supplies that will keep you going.",
        "Hidden beneath a collapsed service counter you discover two unconscious crew members. You drag them clear, tend to their wounds, and carry them back to the shelter outside. For now they are safe at the base camp and will recover; their presence will change the days ahead."
    ]
},

cafeteria_salvage: {
    title: 'Salvaged Cooker',
    pages: [
        "Beneath a fallen service bench you find a compact, scorched but repairable cooking rig — insulated plates, a pressurized water tank, and a simple field stove. It will take effort to extract and reinstall, but it could transform how you feed the survivors.",
        "You haul the rig back to the base camp with the help of two rescued crew and a few tools. The cooker is crude but functional; it will let you prepare and preserve rations and treat water more efficiently at camp."
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
        "Resting in camp now restores more energy and helps the group recover faster."
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
        "After scavenging materials and assembling a makeshift charge you return to the sealed access. Heart racing, you set the device against the reinforced seam and take cover. The detonation is a raw, awful thing — metal tears and a pressure wave rolls through the corridor — then silence and light.",
        "The blast succeeds: the seal is blown and the core chamber is exposed. Inside, scorched conduits and cold reactors glint in your headlamp. Among the wreckage you recover power cells and a handful of ship components. The risk was high, but the payoff is immediate and practical.",
        "The breach leaves you with new choices. Emergency power can be restored, with careful work, to bring systems online and simplify further recovery. But... doing so may draw attention from unknown external threats. You must weigh the benefits against the risks."
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
}
