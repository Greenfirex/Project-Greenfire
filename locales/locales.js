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
  "lang_en": "English",
  "lang_cs": "Čeština",

  "title_continue": "Continue",
  "title_new_game": "New Game",
  "title_settings": "Settings",
  "title_changelog": "Changelog",
  "title_exit": "Exit",

  "header_options": "Options",
  "header_save": "Save",
  "header_title": "Title",
  "header_load": "Load",

  "footer_pause": "Pause",
  "footer_resume": "Resume",
  "footer_pause_title": "Pause / Resume game",
  "footer_debug_title": "Toggle x10 resource gains for testing",

  "menu_crash_site": "Crash Site",
  "menu_character": "Character",
  "menu_journal": "Journal",
  "menu_local_area": "Explore",

  "options_language": "Language",
  "options_language_select": "Select language",
  "options_run_background": "Run in background",
  "options_glow_effects": "Enable glow effects on panels",
  "options_confirm_load": "Confirm before load",
  "options_confirm_reset": "Confirm before reset",
  "options_save_management": "Save Management",
  "options_reset_progress": "Reset Progress",
  "options_glow_color": "UI Glow Color",
  "options_glow_intensity": "Glow Intensity",
  "options_title_return": "Other",

  "log_title": "Log Options",
  "log_display": "Display",
  "log_show_timestamps": "Show timestamps",
  "log_typewriter_effect": "Typewriter effect",
  "log_filters": "Filters",
  "log_colors": "Colors",
  "log_reset_colors": "Reset Colors to Default",

  "confirm_lang_change_title": "Change Language",
  "confirm_lang_change_msg": "Changing language will reload the page. Any unsaved progress will be lost. Continue?",
  "confirm_lang_change_confirm": "Change",
  "confirm_lang_change_cancel": "Cancel",

  "confirm_new_game_title": "New Game",
  "confirm_new_game_msg": "Start a new game? This will overwrite your current save.",
  "confirm_new_game_confirm": "New Game",
  "confirm_new_game_cancel": "Cancel",
  "confirm_load_title": "Load Last Save",
  "confirm_load_msg": "Load your last save? Any unsaved progress will be lost.",
  "confirm_load_confirm": "Load",
  "confirm_load_cancel": "Cancel",
  "confirm_reset_title": "Reset Progress",
  "confirm_reset_msg": "Are you sure you want to reset your progress? This cannot be undone.",
  "confirm_reset_confirm": "Reset",
  "confirm_reset_cancel": "Cancel",
  "confirm_discard_title": "Discard Item",
  "confirm_discard_msg": "Discard {item}? This cannot be undone.",
  "confirm_discard_confirm": "Yes",
  "confirm_discard_cancel": "Cancel",
  "confirm_quest_title": "Quest Item",
  "confirm_quest_msg": "Quest items cannot be discarded.",
  "confirm_quest_ok": "OK",
  "confirm_exit_title": "Exit",
  "confirm_exit_msg": "Exit the game?",
  "confirm_exit_confirm": "Exit",
  "confirm_exit_cancel": "Cancel",

  "log_entries": "Log entries:",
  "log_options": "Log Options",

  "info_no_entries": "No journal entries yet.",
  "info_no_objectives": "No objectives available yet.",
  "journal_objectives": "Objectives",
  "journal_journal": "Journal",

  "character_equipment": "Equipment",
  "character_inventory": "Inventory",
  "character_stats": "Stats",
  "character_bag": "Bag",
  "character_use": "Use",
  "character_inventory_tab": "Inventory",
  "character_stats_skills_tab": "Stats & Skills",
  "character_skills": "Skills",

  "objectives_current": "Current Objective",
  "objectives_no_current": "No current objective",
  "objectives_no_steps": "No detailed steps available.",

  "clock_title": "In-game Time",
  "clock_elapsed": "Elapsed since crash",
  "clock_loop": "Total loops",
  "clock_speed": "At current speed ({scale}x): 1 real sec = {minsPerSec} in-game min | 1 real min = {hoursPerMin} in-game hr",
  "clock_time_format": "Day {day}, {hour}:{minute}",

  "action_duration_label": "{minutes} min",
  "action_progress_ongoing": "Ongoing…",
  "action_duration_ongoing": "Ongoing",
  "cat_taxing": "Taxing Action",
  "cat_simple": "Simple Action",
  "cat_rest": "Rest",
  "cat_persistent": "Persistent",
  "cat_refresh": "Refresh",
  "detail_duration": "Duration",
  "detail_costs": "Costs",
  "detail_gains": "Gains",
  "detail_rewards": "Rewards",
  "tag_repeatable": "Repeatable",
  "tag_onetime": "One-time",
  "tag_remaining": "remaining",

  "obj_first_steps_label": "First Steps",
  "obj_first_steps_narrative": "You have survived the crash. The ship is in ruins, and you are alone — or so it seems for now.\\n\\nYour immediate priorities are clear: assess your surroundings, understand your resources, and begin the work of survival.\\n\\nStart by familiarizing yourself with the available sections and panels. The Journal will track your objectives, while the Crash Site and Character screens will be your primary tools for action.",
  "obj_first_steps_step1": "Open the Journal to view your objectives",
  "obj_first_steps_step2": "Explore the Crash Site section",
  "obj_first_steps_step3": "Review your resources in the info panel",

  "popup_welcome_title": "Project Greenfire — Awakening",
  "popup_welcome_page1": "You were deep asleep in your cramped crew quarters aboard the scout ship, drifting through restless dreams of distant stars and forgotten missions. The hum of the ship's systems was a steady lullaby — until it wasn't.\\n\\nA piercing alarm shatters the silence, its shrill wail cutting through the darkness like a blade. Red emergency lights strobe violently across the metal walls, casting jagged shadows that dance and flicker with each pulse. The ship groans around you — a deep, metallic moan that vibrates through the deck plates and into your bones. Something is terribly wrong.\\n\\nYour eyes snap open. Disoriented, heart pounding, you struggle to make sense of the chaos erupting around you. The air is thick with the acrid stench of ozone and smoldering circuitry. Muffled explosions rumble somewhere deep within the ship's superstructure. Status displays on the wall flicker erratically, their readouts a jumble of crimson warning glyphs you can barely process.",
  "popup_welcome_page2": "You swing your legs over the edge of the bunk, your body protesting with every movement. How long were you out? Hours? Days? The chronometer on the wall is frozen at an impossible reading. Nothing about this feels right.\\n\\nThrough the reinforced viewport across the compartment, an unfamiliar vista fills the frame — a pale amber sky streaked with undulating bands of cloud in colors you've never seen outside a spectrograph. A massive, ochre-colored planet looms on the horizon, its surface scarred by what look like ancient impact craters. This is not your destination. This is not even on your star charts.\\n\\nThe ship shudders again. A console across the room sparks violently, showering the deck with embers. You need to move. You need to understand what happened — why the alarms are screaming, where the rest of your crew is, and most pressingly, whether the ship is going to hold together long enough for you to figure any of it out.",
  "popup_welcome_page3": "Your name is Lieutenant Commander. That much you remember — though fragments of your mission briefing slip through your mind like water through fingers. You were sent to investigate anomalous readings in an uncharted sector. A gravitational anomaly. A pull — something vast and inexplicable dragging your ship off course. Then... nothing. A gap in your memory the size of a star system.\\n\\nThe ship around you is damaged but still breathing, much like yourself. Life support is online, barely. Power levels are critical but not catastrophic. Your crew — three souls registered in the ship's manifest — are unaccounted for. The silence from the corridors is perhaps more alarming than the alarms themselves.\\n\\nBut you are alive. And as long as you are breathing, there is work to do. Your training didn't prepare you for this specific scenario — but it did teach you one immutable truth: assess the situation, secure your resources, and survive. The answers will come. They have to.\\n\\nFor now, get up. Move. The galaxy isn't going to wait.",

  "objectives_new_log": "New objective: {name}",
  "objectives_completed_log": "Objective completed: {name}",
  "objectives_reward_log": "Objective reward: {rewards}",

  "log_game_saved": "Game saved.",
  "log_game_loaded": "Game state loaded.",
  "log_new_game_started": "New game started.",
  "log_game_paused": "Game paused.",
  "log_game_resumed": "Game resumed at {speed}x.",
  "log_game_speed_set": "Game speed set to {speed}x.",
  "log_loop_started": "--- Loop Started ({loop}) ---",
  "log_loop_triggered": "Critical resources depleted: {resources}. Starting new loop...",
  "log_rest_full": "You are already fully rested.",
  "log_water_full": "You are not thirsty right now.",
  "log_rest_cap": "You feel fully rested.",
  "log_water_cap": "You are no longer thirsty.",
  "log_action_stopped": "You stop {action}.",
  "log_action_cancelled": "You cancel {action}.",
  "log_effect_removed": "Effect removed: {effect}",
  "log_effect_added": "⚠ {effect} is now active!",
  "log_story_entry": "New journal entry: {title}",

  "pause_overlay_title": "GAME PAUSED",
  "footer_status_paused": "Paused",

  "effects_empty": "No active effects",

  "queue_title": "Action Queue",
  "queue_action_queued": "Queued: {action}",
  "queue_action_removed": "Removed from queue: {action}",
  "queue_remove_tooltip": "Remove from queue",
  "queue_empty": "Queue empty",

  "crash_details": "Details",
  "crash_actions": "Actions",

  "death_title_1": "Just a Bad Dream",
  "death_pages_1": "You jolt awake in your quarters, drenched in cold sweat. The alarm is blaring.\\n\\nIt felt so real... the exhaustion, the hunger, the darkness closing in. But here you are, back in your bunk.\\n\\nJust a nightmare. It had to be.",
  "death_title_2": "Déjà Vu",
  "death_pages_2": "The alarm. Again. The same sequence of events.\\n\\nYou remember dying. You remember waking up here before. This can't be a coincidence.\\n\\nSomething is very wrong.",
  "death_title_3": "The Loop",
  "death_pages_3": "It's happening again. And again.\\n\\nYou're trapped in a time loop. Every death brings you back to this exact moment — the alarm, the crash, the struggle for survival.\\n\\nYou need to find a way to break the cycle.",
  "death_title_loop": "Loop {loop}",
  "death_pages_loop": "Cycle {loop}. You've lived through this {loop} times now.\\n\\nThe patterns are becoming clearer. The mistakes, the choices — you remember them all.\\n\\nThere has to be an exit. A way out of the loop. You just need to find it.",

  "loc_scout_ship_crew_quarters": "Scout Ship — Crew Quarters",
  "loc_scout_ship_crew_quarters_desc": "You wake in the cramped crew quarters of your scout ship. Emergency lighting casts long shadows across the small compartment. The hum of failing systems fills the air. Against the wall stands your <span class=\"poi-highlight\">BUNK</span> — the last safe corner in this wreck. Ahead, a <span class=\"poi-highlight\">TERMINAL</span> flickers with urgent warnings, its screen casting an otherworldly glow. Against the far wall, a sealed <span class=\"poi-highlight\">STORAGE LOCKER</span> holds emergency supplies.",

  "loc_scout_ship_main_area": "Scout Ship — Main Area",
  "loc_scout_ship_main_area_desc": "The ship's main gathering area. Tables and chairs are overturned from the crash. Emergency lights pulse dimly along the ceiling. A <span class=\"poi-highlight\">CAFETERIA</span> counter sits against one wall, and a <span class=\"poi-highlight\">COMMUNICATIONS</span> station occupies the corner.",

  "loc_scout_ship_bridge": "Scout Ship — Bridge",
  "loc_scout_ship_bridge_desc": "The bridge of the scout ship, dark and silent. Consoles line the curved walls, most of them dark. The main viewport is cracked but intact, revealing the pale amber sky outside. A <span class=\"poi-highlight\">NAVIGATION</span> console pulses weakly, while the <span class=\"poi-highlight\">CONTROLS</span> panel sits within arm's reach at center.",

  "loc_scout_ship_workshop": "Scout Ship — Workshop",
  "loc_scout_ship_workshop_desc": "A cramped engineering bay tucked behind the main corridor. A sturdy <span class=\"poi-highlight\">WORKBENCH</span> dominates the center, tools scattered across its surface. Against the far wall, a cluttered <span class=\"poi-highlight\">PROTOTYPE BENCH</span> holds half-finished projects. In the corner, a small <span class=\"poi-highlight\">FABRICATOR</span> hums with residual power, ready to synthesize components.",

  "loc_crew_quarters": "Crew Quarters",
  "loc_gamma_crew_quarters": "Gamma Site — Crew Quarters",
  "loc_gamma_crew_quarters_desc": "The dimly lit crew quarters of Gamma Site. Personal effects are scattered across bunks, suggesting a hasty evacuation. A terminal on the far wall flickers with residual power.",

  "loc_workshop": "Workshop",
  "loc_workshop_desc": "A cramped maintenance room cluttered with tools and partially assembled equipment. The air reeks of ozone and machine oil. Workbenches line the walls, covered in scattered blueprints.",

  "action_wake_up": "Wake Up",
  "action_wake_up_desc": "Shake off the grogginess and climb out of the bunk. Time to assess the situation.",
  "result_wake_up": "You push yourself up, body aching. Emergency lights flash overhead. You are alive and the ship is still intact — barely. Time to figure out what happened.",

  "action_disable_alarm": "Disable Alarm",
  "action_disable_alarm_desc": "Access the terminal overrides and disable the blaring emergency alarm.",
  "result_disable_alarm": "You key in the override codes. The wailing alarm sputters and dies. Blessed silence fills the compartment. The ringing in your ears will fade — eventually.",

  "action_search_bunks": "Search Bunks",
  "action_search_bunks_desc": "Search the crew bunks for supplies and personal logs.",
  "result_search_bunks": "You search the crew bunks, rummaging through scattered personal effects. Beneath a pillow, your fingers brush against something familiar — a worn paperback you'd tucked away and completely forgotten about. Its cracked spine and dog-eared pages feel comforting in your hands.",

  "action_check_terminal": "Check Terminal",
  "action_check_terminal_desc": "Access the flickering terminal for ship status and crew records.",
  "result_check_terminal": "You tap the console and the screen flickers to life, demanding credentials. Muscle memory kicks in — your fingers dance across the keyboard, entering your command codes. The lock screen dissolves with a soft chime. You're in. Ship status: CRITICAL. Crew: 3 survivors detected at Gamma Site. Navigation logs are corrupted. A distress beacon loop plays on repeat.",

  "action_access_logs": "Access Logs",
  "action_access_logs_desc": "Browse the ship's logs and crew manifests stored on the terminal.",
  "result_access_logs": "You access the ship's logs. Most records are corrupted, but fragments remain: coordinates, crew assignments, and a cryptic reference to 'Gamma Site' on the planet below.",

  "action_check_storage": "Check Storage",
  "action_check_storage_desc": "Search the storage locker for emergency supplies.",
  "result_check_storage": "The storage locker contains emergency rations, a med-kit, and a portable scanner. Standard issue for exploration missions.",

  "action_rest": "Rest",
  "action_rest_desc": "Take a brief rest to recover stamina.",

  "action_drink_water": "Drink Water",
  "action_drink_water_desc": "Hydrate yourself to recover drinking water.",

  "action_read_book": "Read Book",
  "action_read_book_desc": "Pick up a worn paperback from the bunk and lose yourself in its pages. A long, quiet activity that passes the time.",
  "result_read_book": "You turn the final page and close the book. Your mind feels a little sharper, a little more at ease despite everything.",

  "action_get_food": "Get Food",
  "action_get_food_desc": "Search the cafeteria stores for edible rations.",
  "result_get_food": "You find some preserved ration packs behind the counter. Not appetizing, but edible.",

  "action_check_comms": "Check Communications",
  "action_check_comms_desc": "Access the comms station and scan for signals or distress calls.",
  "result_check_comms": "You power up the comms station. Static fills most channels, but a faint beacon repeats on loop — a pre-recorded distress signal from the ship itself.",

  "action_check_navigation": "Check Navigation",
  "action_check_navigation_desc": "Review the navigation systems and current position.",
  "result_check_navigation": "The navigation systems show your current position near an uncharted planet. All long-range communications are offline.",

  "action_scan_systems": "Scan Systems",
  "action_scan_systems_desc": "Run a full diagnostic scan of ship systems.",
  "result_scan_systems": "The diagnostic scan reveals multiple system failures. Life support is at 87%, power reserves at 45%. You need to be careful.",

  "action_check_status": "Check Status",
  "action_check_status_desc": "Check the overall status of the ship.",
  "result_check_status": "Overall ship status: CRITICAL. Multiple systems are failing, but the core structure is intact. You have time, but not much.",

  "action_go_workshop": "Visit Workshop",
  "action_go_workshop_desc": "Head to the maintenance workshop to check supplies and equipment.",

  "action_go_crew_quarters": "Return to Crew Quarters",
  "action_go_crew_quarters_desc": "Head back to the crew quarters.",

  "action_go_to_main_area": "Go to Main Area",
  "action_go_to_main_area_desc": "Head to the main gathering area and cafeteria.",

  "action_go_to_bridge": "Go to Bridge",
  "action_go_to_bridge_desc": "Head to the ship's bridge.",

  "action_go_to_crew_quarters": "Return to Crew Quarters",
  "action_go_to_crew_quarters_desc": "Head back to the crew quarters.",

  "action_repair_ship_systems": "Repair Ship Systems",
  "action_repair_ship_systems_desc": "Run diagnostics and patch damaged systems from the workbench. A taxing but rewarding task.",
  "result_repair_ship_systems": "You spend several minutes elbow-deep in wiring harnesses and circuit boards. Several warning indicators flicker from red to amber. Not fixed — but improved.",

  "action_tinker_device": "Tinker with Prototype",
  "action_tinker_device_desc": "Lose yourself in the half-finished gadget on the prototype bench. A long, absorbing project that clears your mind.",
  "result_tinker_device": "Hours slip by as you tweak, solder, and recalibrate. The device isn't functional yet, but the focused work has sharpened your concentration and left you oddly refreshed.",

  "action_fabricate_parts": "Fabricate Parts",
  "action_fabricate_parts_desc": "Use the fabricator to synthesize replacement components from raw stock.",
  "result_fabricate_parts": "The fabricator whirs to life, layering polymer and alloy into precise shapes. A tray of fresh components slides out — exactly what you'd need for field repairs.",

  "poi_workbench": "WORKBENCH",
  "poi_prototype_bench": "PROTOTYPE BENCH",
  "poi_fabricator": "FABRICATOR",

  "action_scavenge_tools": "Scavenge Tools",
  "action_scavenge_tools_desc": "Search the workshop for usable tools and components.",
  "result_scavenge_tools": "You scour the workshop. Several toolkits are still intact. You salvage what you can — a plasma cutter and some spare power cells.",

  "action_repair_kit": "Repair Equipment",
  "action_repair_kit_desc": "Attempt to repair damaged equipment found in the workshop.",
  "result_repair_kit": "Using the salvaged components you manage to repair a damaged enviro-suit. It's not perfect, but it will hold for now.",

  "action_survey_area": "Survey Area",
  "action_survey_area_desc": "Carefully examine the workshop layout for hidden caches.",

  "poi_terminal": "TERMINAL",
  "poi_bunks": "BUNKS",
  "poi_storage": "STORAGE LOCKER",
  "poi_travel": "TRAVEL",
  "poi_other_actions": "Other Actions",
  "poi_cafeteria": "CAFETERIA",
  "poi_communications": "COMMUNICATIONS",
  "poi_navigation": "NAVIGATION",
  "poi_controls": "CONTROLS",

  "poi_bunks_desc": "Your bunk area. Rest, search for supplies, and recover.",
  "poi_terminal_desc": "The ship's data terminal. Check systems and access logs.",
  "poi_storage_desc": "A sealed storage locker. Contains emergency supplies.",
  "poi_travel_desc": "Exit points to other sections of the ship.",

  "res_health": "Health",
  "res_health_desc": "Your physical condition. Passively regenerates over time.",
  "res_stamina": "Stamina",
  "res_stamina_desc": "Your endurance. Passively regenerates over time.",
  "res_xp": "XP",
  "res_food": "Food Rations",
  "res_food_desc": "Personal rations carried while exploring. Depletion causes Hunger penalties.",
  "res_water": "Drinking Water",
  "res_water_desc": "Personal water carried while exploring. Depletion causes Thirst penalties.",
  "res_category_essential": "Essential",
  "res_category_materials": "Materials",
  "res_category_tools": "Tools",
  "res_category_science": "Science",
  "res_category_other": "Other",
  "res_no_data": "No data available.",
  "resource_regen": "Regeneration",
  "resource_gains": "Gains",
  "resource_drain": "Drain",
  "resource_usage": "Usage",
  "resource_net_change": "Net Change",

  "stat_health": "Health",
  "stat_stamina": "Stamina",
  "stat_damage": "Damage",
  "stat_attack_speed": "Attack Speed",
  "stat_hit_chance": "Hit Chance",
  "stat_crit_chance": "Crit Chance",
  "stat_armor": "Armor",
  "stat_evasion": "Evasion",
  "stat_points": "Stat Points",
  "stat_level": "Level",

  "equip_head": "Head",
  "equip_chest": "Chest",
  "equip_legs": "Legs",
  "equip_boots": "Boots",
  "equip_weapon": "Weapon",
  "equip_offhand": "Offhand",
  "equip_accessory": "Accessory",
  "equip_accessory_1": "Accessory 1",
  "equip_accessory_2": "Accessory 2",

  "inventory_use_btn": "Use",
  "inventory_discard_btn": "Discard items",
  "inventory_bag_size": "Bag {rows}×{cols}",

  "buff_stamina_regen": "Stamina Regen",
  "buff_none": "None",
  "buff_herb_tea": "Herb Tea",

  "debuff_hungry": "Hungry",
  "debuff_thirsty": "Thirsty",
  "debuff_hunger": "Hunger",
  "debuff_thirst": "Thirst",
  "debuff_inactive": "Inactive",

  "effects_title": "Active Effects",
  "effect_alarm": "Emergency Alarm",
  "effect_alarm_desc": "The ship's alarm is blaring — the noise is disorienting and makes actions harder. Check the terminal and disable the alarm to restore normal conditions.",
  "effect_hungry_name": "Hungry",
  "effect_hungry_desc": "Your food supplies are depleted. Stamina costs are drastically increased.",
  "effect_thirsty_name": "Thirsty",
  "effect_thirsty_desc": "You have no drinking water left. Stamina costs are severely increased.",
  "effect_exhausted_name": "Exhausted",
  "effect_exhausted_desc": "Completely drained of energy. Your health is now deteriorating.",

  "action_investigate": "Investigate",
  "action_investigate_desc": "Spend energy to study the loop signature and learn from it.",
  "action_stabilize": "Stabilize",
  "action_stabilize_desc": "Use supplies to keep the loop from fragmenting.",
  "action_scan": "Scan",
  "action_scan_desc": "Analyze incoming anomalies and gain experience.",
  "action_drain": "Drain: {drains}",
  "action_duration": "Duration: {duration}s",
  "action_status_ready": "Loop {loop} — Ready for next action.",
  "action_status_active": "Active: {action} — {pct}% complete",
  "log_action_completed": "Completed {action}. Gained {xp} XP."
};

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
