// Localization engine — domain-split JSON translations
// To add a new language: create locales/<code>/ with identical JSON key sets.

import { preloader } from '../ui/system/preloader.js';

const LANGUAGE_STORAGE_KEY = 'gameLanguage';
const DEFAULT_LANGUAGE = 'en';

// All translations loaded at startup. Keys are language codes.
const loaded = {};

// Current active language translations (merged flat dictionary).
let activeDictionary = {};

// ==========================================================================
// Embedded English dictionary — always available, no fetch needed
// ==========================================================================
loaded['en'] = {
    "action_access_logs": "Access Logs",
    "action_access_logs_desc": "Browse the ship's logs and crew manifests stored on the terminal.",
    "action_assess_supplies": "Assess Supplies",
    "action_assess_supplies_desc": "Take stock of the cafeteria's remaining food and water reserves.",
    "action_debug_taxing": "Debug Taxing Action",
    "action_debug_taxing_desc": "10-second taxing action to test resource drains.",
    "action_disable_alarm": "Disable Alarm",
    "action_disable_alarm_desc": "Access the terminal overrides and disable the blaring emergency alarm.",
    "action_drink_water": "Drink Water",
    "action_drink_water_desc": "Drink the water that's left in the broken recycler. Not clean, but it'll quench your thirst.",
    "action_duration_label": "{minutes} min",
    "action_duration_ongoing": "Ongoing",
    "action_end_loop": "End Loop",
    "action_end_loop_confirm": "Really end this loop?",
    "action_end_loop_confirm_cancel": "Cancel",
    "action_end_loop_confirm_ok": "End",
    "action_enter_known_credentials": "Log In (Known Password)",
    "action_enter_known_credentials_bridge": "Log In (Known Password)",
    "action_enter_known_credentials_bridge_desc": "Enter the password you already know from the crew quarters terminal.",
    "action_enter_known_credentials_desc": "Enter the password you already know from using it on the other terminal.",
    "action_fabricate_parts": "Fabricate Parts",
    "action_fabricate_parts_desc": "Use the fabricator to synthesize replacement components from raw stock.",
    "action_go_crew_quarters": "Return to Crew Quarters",
    "action_go_crew_quarters_desc": "Head back to the crew quarters.",
    "action_go_to_bridge": "Go to Bridge",
    "action_go_to_bridge_desc": "Head to the ship's bridge.",
    "action_go_to_crew_quarters": "Return to Crew Quarters",
    "action_go_to_crew_quarters_desc": "Head back to the crew quarters.",
    "action_go_to_main_area": "Go to Main Area",
    "action_go_to_main_area_desc": "Head to the main gathering area and cafeteria.",
    "action_go_workshop": "Visit Workshop",
    "action_go_workshop_desc": "Head to the maintenance workshop to check supplies and equipment.",
    "action_grab_bottled_water": "Grab Water Bottle",
    "action_grab_bottled_water_desc": "Snatch a sealed bottle of water from the cafeteria supplies.",
    "action_grab_proviant": "Grab Provisions",
    "action_grab_proviant_desc": "Grab a few remaining ration packs from the cafeteria. There isn't much left.",
    "action_grab_tools": "Grab Tools",
    "action_grab_tools_desc": "Take a basic set of repair tools from the workshop.",
    "action_hack_bridge_terminal": "Hack Terminal",
    "action_hack_bridge_terminal_desc": "Spend time bypassing the engineering terminal's security on the bridge.",
    "action_hack_terminal": "Hack Terminal",
    "action_hack_terminal_desc": "Spend time bypassing the terminal's security. A long, focused task that will eventually grant full access.",
    "action_check_bridge_terminal": "Check Terminal",
    "action_check_bridge_terminal_desc": "Try to log into the engineering terminal on the bridge.",
    "action_check_comms": "Check Communications",
    "action_check_comms_desc": "Access the comms station and scan for signals or distress calls.",
    "action_check_navigation": "Check Navigation",
    "action_check_navigation_desc": "Review the navigation systems and current position.",
    "action_check_reactor_status": "Check Reactor Status",
    "action_check_reactor_status_desc": "Run a detailed diagnostic of the ship's reactor and power systems.",
    "action_check_status": "Check Status",
    "action_check_status_desc": "Check the overall status of the ship.",
    "action_check_storage": "Check Storage",
    "action_check_storage_desc": "Search the storage locker for emergency supplies.",
    "action_check_terminal": "Check Terminal",
    "action_check_terminal_desc": "Try to log into the terminal. From there you should be able to disable that annoying alarm and maybe figure out why it went off.",
    "action_optimize_reactor": "Optimize Reactor",
    "action_optimize_reactor_desc": "Shut down non-essential systems and reconfigure power distribution to reduce fuel consumption. Requires terminal access.",
    "action_optimize_reactor_remote": "Optimize Reactor Remotely",
    "action_optimize_reactor_remote_desc": "You already know the reactor is dying. Through the terminal in your quarters you can run the optimization — you know the right parameters by heart.",
    "action_progress_ongoing": "Ongoing…",
    "action_read_book": "Read Book",
    "action_read_book_desc": "Pick up a worn paperback from the bunk and lose yourself in its pages. A long, quiet activity that passes the time.",
    "action_repair_kit": "Repair Equipment",
    "action_repair_kit_desc": "Attempt to repair damaged equipment found in the workshop.",
    "action_repair_recycler": "Repair Recycler",
    "action_repair_recycler_desc": "The water recycler in the cafeteria is broken. If you could fix it, it might replenish the water supply.",
    "action_repair_ship_systems": "Repair Ship Systems",
    "action_repair_ship_systems_desc": "Run diagnostics and patch damaged systems from the workbench. A taxing but rewarding task.",
    "action_rest": "Rest",
    "action_rest_desc": "Take a brief rest to recover stamina.",
    "action_scavenge_tools": "Scavenge Tools",
    "action_scavenge_tools_desc": "Search the workshop for usable tools and components.",
    "action_search_bunks": "Search Bunk",
    "action_search_bunks_desc": "Search your bunk and the surrounding area — maybe something useful can be found.",
    "action_search_for_login_note": "Search for Login Note",
    "action_search_for_login_note_desc": "Search the workbench area for a sticky note with terminal login credentials.",
    "action_survey_area": "Survey Area",
    "action_survey_area_desc": "Carefully examine the workshop layout for hidden caches.",
    "action_tinker_device": "Tinker with Prototype",
    "action_tinker_device_desc": "Lose yourself in the half-finished gadget on the prototype bench. A long, absorbing project that clears your mind.",
    "action_use_bridge_terminal_login": "Use Login Note",
    "action_use_bridge_terminal_login_desc": "Use the found login credentials to access the engineering terminal on the bridge.",
    "action_use_terminal_login": "Use Login Note",
    "action_use_terminal_login_desc": "Use the found login credentials to access the terminal immediately.",
    "action_wake_up": "Wake Up",
    "action_wake_up_desc": "Shake off the grogginess and climb out of the bunk. Time to assess the situation.",
    "area_food": "Food Stock",
    "area_fuel": "Fuel",
    "area_o2": "O2",
    "area_supplies": "Area Supplies",
    "area_water": "Water Stock",
    "cat_persistent": "Persistent",
    "cat_refresh": "Refresh",
    "cat_rest": "Rest",
    "cat_simple": "Simple Action",
    "cat_taxing": "Taxing Action",
    "clock_elapsed": "Elapsed since crash",
    "clock_loop": "Total loops",
    "clock_speed": "At current speed ({scale}x): 1 real sec = {minsPerSec} in-game min | 1 real min = {hoursPerMin} in-game hr",
    "clock_time_format": "Day {day}, {hour}:{minute}",
    "clock_title": "In-game Time",
    "confirm_lang_change_cancel": "Cancel",
    "confirm_lang_change_confirm": "Change",
    "confirm_lang_change_msg": "Changing language will reload the page. Any unsaved progress will be lost. Continue?",
    "confirm_lang_change_title": "Change Language",
    "crash_actions": "Actions",
    "crash_details": "Details",
    "death_pages_1": "You jolt awake in your quarters, drenched in cold sweat. The alarm is blaring.\n\nYou... died? At least it seemed like it. The exhaustion, the hunger, the darkness closing in — it was so real. But here you are, back in your bunk.\n\nWas that just a dream? It had to be... right?",
    "death_pages_2": "The alarm. Again. The same sequence of events.\n\nYou remember dying. You remember waking up here before. This can't be a coincidence.\n\nSomething is very wrong.",
    "death_pages_3": "It's happening again. And again.\n\nYou're trapped in a time loop. Every death brings you back to this exact moment — the alarm, the crash, the struggle for survival.\n\nYou need to find a way to break the cycle.",
    "death_pages_loop": "Cycle {loop}. You've lived through this {loop} times now.\n\nThe patterns are becoming clearer. The mistakes, the choices — you remember them all.\n\nThere has to be an exit. A way out of the loop. You just need to find it.",
    "death_pages_manual_reset": "But not this time either... your own choice changed nothing. You close your eyes hoping it's over — and then open them in the same quarters. Again. Right back to the beginning.",
    "death_title_1": "Just a Bad Dream",
    "death_title_2": "Déjà Vu",
    "death_title_3": "The Loop",
    "death_title_loop": "Loop {loop}",
    "detail_costs": "Costs",
    "detail_duration": "Duration",
    "detail_gains": "Gains",
    "detail_rewards": "Rewards",
    "effects_empty": "No active effects",
    "footer_debug_title": "Toggle x10 resource gains for testing",
    "footer_pause": "Pause",
    "footer_pause_title": "Pause / Resume game",
    "footer_resume": "Resume",
    "footer_status_paused": "Paused",
    "header_load": "Load",
    "header_options": "Options",
    "header_save": "Save",
    "header_title": "Title",
    "character_bag": "Bag",
    "character_equipment": "Equipment",
    "character_inventory": "Inventory",
    "character_inventory_tab": "Inventory",
    "character_skills": "Skills",
    "character_stats": "Stats",
    "character_stats_skills_tab": "Stats & Skills",
    "character_use": "Use",
    "info_no_entries": "No journal entries yet.",
    "info_no_objectives": "No objectives available yet.",
    "info_resources": "Resources",
    "journal_journal": "Journal",
    "journal_objectives": "Objectives",
    "lang_cs": "Čeština",
    "lang_en": "English",
    "loc_crew_quarters": "Crew Quarters",
    "loc_gamma_crew_quarters": "Gamma Site — Crew Quarters",
    "loc_gamma_crew_quarters_desc": "The dimly lit crew quarters of Gamma Site. Personal effects are scattered across bunks, suggesting a hasty evacuation. A terminal on the far wall flickers with residual power.",
    "loc_scout_ship_bridge": "Scout Ship — Bridge",
    "loc_scout_ship_bridge_desc": "The bridge of the scout ship, dark and silent. Consoles line the curved walls, most of them dark. The main viewport is cracked but intact, revealing the pale amber sky outside. A <span class=\"poi-highlight\">NAVIGATION</span> console pulses weakly, while the <span class=\"poi-highlight\">CONTROLS</span> panel sits within arm's reach at center. At the rear, an access hatch leads to <span class=\"poi-highlight\">ENGINEERING</span> — the heart of the ship's systems.",
    "loc_scout_ship_crew_quarters": "Scout Ship — Crew Quarters",
    "loc_scout_ship_crew_quarters_desc": "You wake in the cramped crew quarters of your scout ship. Emergency lighting casts long shadows across the small compartment. The hum of failing systems fills the air. Against the wall stands your <span class=\"poi-highlight\">BUNK</span> — the last safe corner in this wreck. Ahead, a <span class=\"poi-highlight\">TERMINAL</span> flickers with urgent warnings, its screen casting an otherworldly glow. Against the far wall, a sealed <span class=\"poi-highlight\">STORAGE LOCKER</span> holds emergency supplies.",
    "loc_scout_ship_main_area": "Scout Ship — Main Area",
    "loc_scout_ship_main_area_desc": "The ship's main gathering area. Tables and chairs are overturned from the crash. Emergency lights pulse dimly along the ceiling. A <span class=\"poi-highlight\">CAFETERIA</span> counter sits against one wall, and a <span class=\"poi-highlight\">COMMUNICATIONS</span> station occupies the corner.",
    "loc_scout_ship_workshop": "Scout Ship — Workshop",
    "loc_scout_ship_workshop_desc": "A cramped engineering bay tucked behind the main corridor. A sturdy <span class=\"poi-highlight\">WORKBENCH</span> dominates the center, tools scattered across its surface. Against the far wall, a cluttered <span class=\"poi-highlight\">PROTOTYPE BENCH</span> holds half-finished projects. In the corner, a small <span class=\"poi-highlight\">FABRICATOR</span> hums with residual power, ready to synthesize components.",
    "loc_workshop": "Workshop",
    "loc_workshop_desc": "A cramped maintenance room cluttered with tools and partially assembled equipment. The air reeks of ozone and machine oil. Workbenches line the walls, covered in scattered blueprints.",
    "log_action_cancelled": "You cancel {action}.",
    "log_action_completed": "{action} completed.",
    "log_action_stopped": "You stop {action}.",
    "log_auto_drink": "Auto-drink: Used Bottled Water (+{amount} Water)",
    "log_auto_eat": "Auto-eat: Used Packaged Food (+{amount} Food)",
    "log_colors": "Colors",
    "log_death": "💀 You have died. Health reached 0.",
    "log_display": "Display",
    "log_effect_added": "⚠ {effect} is now active!",
    "log_effect_removed": "Effect removed: {effect}",
    "log_end_loop_hint": "Yeah... you've thought about it too, haven't you? Why not just end it on your own terms? Maybe you'll get out of this mess. Maybe you won't wake up at all. Press again if you're ready to risk it.",
    "log_entries": "Log entries:",
    "log_filters": "Filters",
    "log_fuel_depleted": "The reactor runs dry. Lights flicker and die. Life support switches to reserve power — oxygen levels begin dropping.",
    "log_fuel_depletion_same_time": "The reactor died at exactly the same time as before. Down to the minute. This can't be coincidence.",
    "log_game_loaded": "Game state loaded.",
    "log_game_paused": "Game paused.",
    "log_game_resumed": "Game resumed at {speed}x.",
    "log_game_saved": "Game saved.",
    "log_game_speed_set": "Game speed set to {speed}x.",
    "log_loop_started": "--- Loop Started ({loop}) ---",
    "log_loop_triggered": "Critical resources depleted: {resources}. Starting new loop...",
    "log_need_item": "You need {item} to do this.",
    "log_need_terminal_login": "You need terminal access to make the necessary system changes. Without it, you can't reconfigure the reactor.",
    "log_new_game_started": "New game started.",
    "log_o2_depleted": "Oxygen reserves depleted. No breathable air remains.",
    "log_options": "Log Options",
    "log_oxygen_same_time_warning": "Oxygen reserves are draining… just like last time. You have {minutes} minutes of air remaining — same as the previous loop.",
    "log_reactor_terminal_hint": "As you work, you realize — this interface isn't tied to a specific console. Next time you could do this from any terminal on the ship.",
    "log_received_item": "Received: {item}",
    "log_recycler_need_tools": "You know what to do now, but you'll need proper tools. Time to find a basic repair kit.",
    "log_recycler_no_idea": "You examine the recycler from every angle. It's a complex machine and you have no idea where to start. Maybe a manual would help...",
    "log_recycler_remember": "You remember exactly how this works. Last time it took forever, but now you know what you're doing.",
    "log_reset_colors": "Reset Colors to Default",
    "log_rest_cap": "You feel fully rested.",
    "log_rest_full": "You are already fully rested.",
    "log_show_timestamps": "Show timestamps",
    "log_story_entry": "New journal entry: {title}",
    "log_title": "Log Options",
    "log_typewriter_effect": "Typewriter effect",
    "log_used_item": "Used: {item}.",
    "log_water_cap": "You are no longer thirsty.",
    "log_water_full": "You are not thirsty right now.",
    "menu_crash_site": "Crash Site",
    "menu_character": "Character",
    "menu_journal": "Journal",
    "menu_local_area": "Explore",
    "menu_main_menu": "Main Menu",
    "obj_first_steps_label": "Escape Into the Unknown",
    "obj_first_steps_narrative": "You did it. Against all odds, the Vagabond is yours — a stolen scout ship carrying you away from Katarnis VII and a lifetime of unjust labor. But freedom has come at a steep price.\n\nThe ship is barely holding together. Systems are failing, navigation data is wiped, and you lack the training to fix any of it. Somewhere in the blackness ahead, a gravitational anomaly tugs at the hull — as if something has been waiting.\n\nYour first priority is simple: get your bearings and survive the next hour.",
    "obj_first_steps_step1": "Wake up and assess your surroundings",
    "obj_first_steps_step2": "Disable the blaring alarm (optional)",
    "obj_first_steps_step3": "Check the terminal for ship status",
    "obj_first_steps_step4": "Search the storage locker for supplies",
    "obj_first_steps_step5": "Find your way to the bridge",
    "objectives_completed_log": "Objective completed: {name}",
    "objectives_current": "Current Objective",
    "objectives_new_log": "New objective: {name}",
    "objectives_no_current": "No current objective",
    "objectives_no_steps": "No detailed steps available.",
    "objectives_reward_log": "Objective reward: {rewards}",
    "options_confirm_load": "Confirm before load",
    "options_confirm_reset": "Confirm before reset",
    "options_glow_color": "UI Glow Color",
    "options_glow_effects": "Enable glow effects on panels",
    "options_glow_intensity": "Glow Intensity",
    "options_language": "Language",
    "options_language_select": "Select language",
    "options_reset_progress": "Reset Progress",
    "options_run_background": "Run in background",
    "options_save_management": "Save Management",
    "options_title_return": "Other",
    "pause_overlay_title": "GAME PAUSED",
    "personal_resources": "Personal",
    "poi_bunks": "BUNK",
    "poi_bunks_desc": "Your bunk area. Rest, search for supplies, and recover.",
    "poi_cafeteria": "CAFETERIA",
    "poi_communications": "COMMUNICATIONS",
    "poi_controls": "CONTROLS",
    "poi_engineering": "ENGINEERING",
    "poi_fabricator": "FABRICATOR",
    "poi_navigation": "NAVIGATION",
    "poi_other_actions": "Other Actions",
    "poi_prototype_bench": "PROTOTYPE BENCH",
    "poi_storage": "STORAGE LOCKER",
    "poi_storage_desc": "A sealed storage locker. Contains emergency supplies.",
    "poi_terminal": "TERMINAL",
    "poi_terminal_desc": "The ship's data terminal. Check systems and access logs.",
    "poi_travel": "TRAVEL",
    "poi_travel_desc": "Exit points to other sections of the ship.",
    "poi_workbench": "WORKBENCH",
    "popup_welcome_page1": "The year is 2249. For crimes you did not commit, you were sentenced to a lifetime of hard labor in the Katarnis VII mining colony — a frozen rock circling a dying gas giant on the edge of charted space. The trial was a formality. Your poverty was your guilt.\n\nBut you refused to break. Over months of quiet observation, you learned every crack in the colony's routines. The guards grew indifferent. The supervisors lazy. One night, during a shift change, the opportunity came — a lone scout vessel, the SFC-47 Vagabond, left briefly unguarded near the maintenance bay.\n\nWith nothing but a stolen access card and a lifetime of desperation, you boarded her, fired her engines, and hurled yourself into the void before anyone could raise the alarm.",
    "popup_welcome_page2": "Freedom was never meant to feel this fragile. The Vagabond is a light reconnaissance ship — stripped-down, fast, and never designed for deep-space travel. Her navigational data was wiped by colony security protocols. Her systems are failing one by one, and you lack the training to repair them. Every warning light is a language you were never taught to read.\n\nYou are alone. No charts. No heading. Only the cold hum of a dying ship and the silent stars beyond the viewport.\n\nSupplies are already running thin. The onboard storage locker holds a few days' worth of rations and water — barely enough to survive. Every decision you make from here will be a matter of life and death.",
    "popup_welcome_page3": "And yet, somewhere in the blackness ahead, something stirs. A gravitational anomaly. An energy signature that matches nothing in the ship's corrupted memory banks. It pulls at the Vagabond like an invisible current — gentle, but insistent. As if something has been waiting.\n\nYou can't explain it. Perhaps the ship is too broken to give you accurate readings. Perhaps exhaustion is clouding your judgment. But deep in your bones, you feel it: this is not an accident. This is where you were meant to be.\n\nYou are a fugitive on a stolen ship, a dying vessel, and no plan. But whatever lies ahead in this uncharted sector — it will remember your name.\n\nGet up. Move. Survive. The stars are waiting.",
    "popup_welcome_title": "Awakening",
    "queue_action_queued": "Queued: {action}",
    "queue_action_removed": "Removed from queue: {action}",
    "queue_empty": "Queue empty",
    "queue_remove_tooltip": "Remove from queue",
    "queue_title": "Action Queue",
    "result_access_logs": "You access the ship's logs. Most records are corrupted, but fragments remain: coordinates, crew assignments, and a cryptic reference to 'Gamma Site' on the planet below.",
    "result_assess_supplies": "You take stock of the cafeteria supplies. Food has almost completely run out — barely a few ration packs remain. The water recycler is dead. In the fridge, however, you find two sealed bottles of clean water. At least something.",
    "result_debug_taxing": "Debug taxing action complete.",
    "result_disable_alarm": "You key in the override codes. The wailing alarm sputters and dies. Blessed silence fills the compartment. The ringing in your ears will fade — eventually.",
    "result_enter_known_credentials": "You enter the known password and the screen dissolves with a soft chime. You're in — the password works on this terminal too.",
    "result_enter_known_credentials_bridge": "You enter the known password. The login screen dissolves instantly — access granted.",
    "result_enter_known_credentials_bridge_loop2": "You type in the password without thinking. It's become muscle memory at this point. The login screen dissolves instantly — access granted.",
    "result_enter_known_credentials_loop2": "You type in the password without thinking. It's become muscle memory at this point. The screen dissolves with a soft chime. You're in.",
    "result_fabricate_parts": "The fabricator whirs to life, layering polymer and alloy into precise shapes. A tray of fresh components slides out — exactly what you'd need for field repairs.",
    "result_go_to_bridge": "You head to the ship's bridge.",
    "result_go_to_crew_quarters": "You return to the crew quarters.",
    "result_go_to_main_area": "You head to the main area.",
    "result_go_to_workshop": "You head to the workshop.",
    "result_grab_bottled_water": "You grab a sealed bottle of water from the cafeteria counter. Clean and cool — it will come in handy.",
    "result_grab_tools": "You rummage through the workbench and find a set of repair tools. Exactly what you needed.",
    "result_hack_bridge_terminal": "After painstaking trial and error, you finally crack the engineering terminal's authentication. The system welcomes you with a soft chime — and you won't forget the login now.",
    "result_hack_terminal": "After painstaking trial and error, you finally crack the terminal's authentication. The system welcomes you with a soft chime. You're in — and you won't forget the login now.",
    "result_check_bridge_terminal": "You tap the engineering console. The screen flickers to the ship system login screen. Without credentials you can't proceed. Maybe you could try hacking it.",
    "result_check_bridge_terminal_first_has_login": "You tap the engineering console. The login screen looks familiar — you try the password you already know. It works. The system lets you in.",
    "result_check_bridge_terminal_known": "You tap the console. You enter the credentials with confidence — you know them by now. The system lets you in with a soft chime.",
    "result_check_bridge_terminal_loop1": "You tap the console… and freeze. Your fingers move before your mind catches up — you already know the password. You don't know how you know. A chill runs through you. Better just type it in.",
    "result_check_bridge_terminal_loop2": "You don't even hesitate. The password is already beneath your fingertips — you've done this so many times it's automatic. All that's left is to type it in.",
    "result_check_comms": "You power up the comms station. Static fills most channels, but a faint beacon repeats on loop — a pre-recorded distress signal from the ship itself.",
    "result_check_navigation": "The navigation systems show your current position near an uncharted planet. All long-range communications are offline.",
    "result_check_reactor_status": "The reactor scan reveals critical fuel depletion — only {fuel} units remain. At current burn rate you have roughly {minutes} minutes before the reactor goes cold. Without power, life support will fail and oxygen reserves will drain rapidly.",
    "result_check_reactor_status_known": "Just like in that dream… was it ever a dream? Everything is exactly the same — the readings, the fuel gauge, the sinking feeling in your chest. This isn't possible. And yet here you are, staring at the same numbers. You have {minutes} minutes before the reactor dies. Again.",
    "result_check_reactor_status_loop2": "Unfortunately your prediction came true, the fuel status is exactly what you thought. {fuel} units of fuel, {minutes} minutes until darkness. You knew it before you even got out of bed.",
    "result_check_status": "Overall ship status: CRITICAL. Multiple systems are failing, but the core structure is intact. You have time, but not much.",
    "result_check_storage": "The storage locker contains emergency rations, a med-kit, and a portable scanner. Standard issue for exploration missions.",
    "result_check_terminal": "You tap the console and the screen flickers to life, demanding credentials. You tried a few random passwords but no luck. Fortunately, you have some experience with this operating system and should be able to hack into the terminal — it'll just take a while. Oh, and you noticed a sticky note on the monitor — \"workshop\". Maybe the login can be found there?",
    "result_check_terminal_first_has_login": "You tap the unfamiliar console. The login screen looks identical to the other terminal — the password you already have might work. You enter it. The screen dissolves with a soft chime. You're in.",
    "result_check_terminal_known": "You tap the console. You already know the password — you type it in with confidence. The screen dissolves with a soft chime. You're in.",
    "result_check_terminal_loop1": "You tap the console… and freeze. Your fingers move before your mind catches up — you already know the password. You don't know how you know. A chill runs through you. Better just type it in.",
    "result_check_terminal_loop2": "You don't even hesitate. The password is already beneath your fingertips — you've done this so many times the routine is automatic. All that's left is to type it in.",
    "result_optimize_reactor": "You sit at the engineering console and scroll through the list of active systems. Section by section, you shut down everything that isn't absolutely critical — cabin heating for empty quarters, backup comms arrays, lab equipment. Fuel consumption drops visibly. You've bought precious extra time.",
    "result_optimize_reactor_known": "You know exactly what to look for. In seconds you flip the necessary switches. Fuel consumption drops once again.",
    "result_optimize_reactor_remote": "You log into the terminal and enter the familiar commands. Even remotely, you can tell the fuel consumption dropped — the display indicators confirm it.",
    "result_read_book": "You turn the final page and close the book. You've picked up some basic repair techniques. Maybe you could handle small fixes now.",
    "result_repair_kit": "Using the salvaged components you manage to repair a damaged enviro-suit. It's not perfect, but it will hold for now.",
    "result_repair_recycler_first": "After twenty minutes of tinkering inside the machine, a quiet hum finally starts. Water begins to drip from the spout — slowly at first, then a steady stream. The recycler is working again.",
    "result_repair_recycler_remember": "Familiar routine. Your hands remember every step. In half the time, the recycler is back online.",
    "result_repair_ship_systems": "You spend several minutes elbow-deep in wiring harnesses and circuit boards. Several warning indicators flicker from red to amber. Not fixed — but improved.",
    "result_scavenge_tools": "You scour the workshop. Several toolkits are still intact. You salvage what you can — a plasma cutter and some spare power cells.",
    "result_search_bunks": "You rummage through the bunk. Beneath the pillow, your fingers brush against something unexpected — a worn repair manual. 'Scout Ship Maintenance for Complete Idiots.' Someone from the crew must have left it here. This could come in handy.",
    "result_search_for_login_note": "You rummage through the clutter on the workbench. Tucked under a coffee-stained schematic, you find a sticky note: \"terminal — user: crew01 / pass: vagabond47\". This could be useful back at terminal.",
    "result_tinker_device": "Hours slip by as you tweak, solder, and recalibrate. The device isn't functional yet, but the focused work has sharpened your concentration and left you oddly refreshed.",
    "result_use_bridge_terminal_login": "You enter the credentials from the sticky note into the engineering console. The lock screen dissolves instantly. You're in.",
    "result_use_terminal_login": "You enter the credentials from the sticky note. The lock screen dissolves instantly. You're in — terminal access granted.",
    "result_wake_up": "You push yourself up, body aching. You are alive and the ship is still intact — barely. However just as you put your feet on the ground from the bed a loud red alert started howling across the ship, time to check what is happening.",
    "result_wake_up_loop1": "You push yourself up, body aching... but something feels off. The alarm — it started at exactly the same moment, just as your feet touched the floor. A strange sense of familiarity you can't explain. You shake it off. Time to figure out what happened.",
    "result_wake_up_loop2": "You bolt upright, heart racing before the alarm even sounds — and right on cue, it blares. Exactly when you expected. This can't be coincidence. The same ship. The same moment. If this day is repeating itself, you realize the reactor died at the exact same instant every time. If I'm truly trapped in some kind of time loop, I have exactly {minutes} minutes before it happens again. I'll have to figure out a solution or go insane.",
    "result_wake_up_loop3": "You bolt upright. There's no point in checking the fuel status anymore, you know exactly how it looks. {fuel} units of fuel, {minutes} minutes until the reactor dies. Every time the same. Every time the same end.",
    "tag_onetime": "One-time",
    "tag_remaining": "remaining",
    "tag_repeatable": "Repeatable",
    "tag_travel": "Travel",
    "title_continue": "Continue",
    "title_exit": "Exit",
    "title_changelog": "Changelog",
    "title_new_game": "New Game",
    "title_settings": "Settings"
};;;;;;;;;

// ==========================================================================
// Public API
// ==========================================================================

export function getSelectedLanguage() {
    try {
        const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const lang = String(raw || DEFAULT_LANGUAGE).trim();
        return loaded[lang] ? lang : DEFAULT_LANGUAGE;
    } catch {
        return DEFAULT_LANGUAGE;
    }
}

export function setLanguage(language) {
    const lang = String(language || DEFAULT_LANGUAGE).trim();
    const active = loaded[lang] ? lang : DEFAULT_LANGUAGE;

    activeDictionary = loaded[active] || loaded[DEFAULT_LANGUAGE] || {};
    document.documentElement.lang = active;

    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, active);
    } catch (e) {
        console.warn('Could not persist language selection', e);
    }

    // Reload the page so all UI components pick up the new language.
    // Set a session flag so the preloader can be suppressed on this reload.
    try {
        sessionStorage.setItem('langReload', '1');
    } catch { /* ignore */ }
    location.reload();
    return active;
}

/** Translate a key. Accepts optional {placeholder} substitutions. */
export function t(key, vars) {
    let raw = activeDictionary[key];
    if (raw === undefined) {
        raw = loaded['en'][key];
    }
    let str = String(raw ?? key);

    if (vars && typeof vars === 'object') {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replaceAll(`{${k}}`, String(v ?? ''));
        }
    }
    return str;
}

export function getAvailableLanguages() {
    return Object.keys(loaded).map(code => ({
        code,
        label: loaded[code]?.['lang_' + code] || loaded['en']?.['lang_' + code] || code
    }));
}

let _initComplete = false;
export function isInitComplete() {
    return _initComplete;
}

export function isReady() {
    return !!activeDictionary && Object.keys(activeDictionary).length > 0;
}

// ==========================================================================
// Init — apply saved language, load Czech from JSON files
// ==========================================================================

activeDictionary = loaded[DEFAULT_LANGUAGE] || {};
const saved = getSelectedLanguage();
if (saved !== DEFAULT_LANGUAGE) {
    // Will switch after Czech loads
}

async function loadLanguage(code) {
    const files = ['ui', 'confirm', 'actions', 'resources', 'character', 'effects'];
    const dict = {};

    for (const file of files) {
        try {
            const response = await fetch(`./locales/${code}/${file}.json`);
            if (!response.ok) continue;
            const data = await response.json();
            Object.assign(dict, data);
        } catch {
            // Missing JSON files are non-fatal
        }
    }

    return dict;
}

(async function init() {
    // Register with preloader — translations contribute 20% of total load weight.
    preloader.register('locales', 20);

    // Load Czech json files (English is already embedded)
    preloader.progress('locales', 0.1, 'Loading translations...');
    loaded['cs'] = await loadLanguage('cs');

    preloader.progress('locales', 0.9, 'Applying translations...');

    // Apply saved language
    const lang = getSelectedLanguage();
    activeDictionary = loaded[lang] || loaded[DEFAULT_LANGUAGE] || {};
    document.documentElement.lang = lang;

    // Notify that translations are ready
    try {
        window.dispatchEvent(new CustomEvent('language-changed', { detail: { language: lang } }));
    } catch { /* ignore */ }

    _initComplete = true;
    preloader.progress('locales', 1, lang === 'cs' ? 'Překlady načteny' : 'Translations ready');
})();
