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
  "options_language": "Language",
  "options_language_select": "Select language",
  "options_title": "Options",
  "options_settings": "Settings",
  "options_run_background": "Run in background",
  "options_glow_effects": "Enable glow effects on panels",
  "options_confirm_load": "Confirm before load",
  "options_confirm_reset": "Confirm before reset",
  "options_save_management": "Save Management",
  "options_glow_color": "UI Glow Color",
  "options_glow_intensity": "Glow Intensity",
  "options_reset_progress": "Reset Progress",
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
  "action_search_bunks": "Search Bunks",
  "action_search_bunks_desc": "Look through crew bunks for supplies and personal logs.",
  "action_check_terminal": "Check Terminal",
  "action_check_terminal_desc": "Access the flickering terminal for ship status and crew logs.",
  "action_rest": "Rest",
  "action_rest_desc": "Take a short break to recover Stamina.",
  "action_scavenge_tools": "Scavenge Tools",
  "action_scavenge_tools_desc": "Search the workshop for usable tools and parts.",
  "action_repair_kit": "Repair Equipment",
  "action_repair_kit_desc": "Attempt to repair damaged equipment found in the workshop.",
  "action_survey_area": "Survey Area",
  "action_survey_area_desc": "Carefully survey the workshop layout for hidden compartments.",
  "action_drain": "Drain: {drains}",
  "action_duration": "Duration: {duration}s",
  "action_status_ready": "Loop {loop} — Ready for next action.",
  "action_status_active": "Active: {action} — {pct}% complete",
  "log_action_completed": "Completed {action}. Gained {xp} XP.",
  "log_loop_started": "Loop {loop} started. Resources have been partially restored.",
  "log_loop_triggered": "Loop triggered: {resources} depleted.",
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
  "objectives_current": "Current Objective",
  "objectives_no_current": "No current objective",
  "objectives_no_steps": "No detailed steps available.",
  "clock_title": "In-game Time",
  "clock_elapsed": "Elapsed since crash",
  "clock_speed": "At current speed ({scale}x): 1 real sec = {minsPerSec} in-game min | 1 real min = {hoursPerMin} in-game hr",
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
  "menu_local_area": "Explore",
  "crash_details": "Details",
  "crash_actions": "Actions",
  "loc_scout_ship_crew_quarters": "Scout Ship — Crew Quarters",
  "loc_scout_ship_crew_quarters_desc": "You wake in the cramped crew quarters of your scout ship, emergency lighting casting long shadows across the compact space. The hum of failing systems fills the air. To your left, narrow bunks are stacked against the wall. Ahead, a flickering TERMINAL blinks with urgent warnings, its screen casting an eerie glow. Along the far wall, a row of STORAGE LOCKERS stands sealed, their status lights dark. The ship groans around you—systems failing, alarms muted but not silent. Everything feels wrong. You need to assess the situation.",
  "loc_scout_ship_main_area": "Scout Ship — Main Area",
  "loc_scout_ship_main_area_desc": "The main area of your scout ship serves as both cafeteria and common space. Compact tables are bolted to the floor, and a small food dispenser hums quietly in the corner. A COMMUNICATIONS console sits against one wall, its screens dark. The air is stale, recycled by struggling environmental systems. This is where the crew would gather—if there was a crew.",
  "loc_scout_ship_bridge": "Scout Ship — Bridge",
  "loc_scout_ship_bridge_desc": "The bridge is the nerve center of your scout ship. NAVIGATION displays line the forward console, though most are dark or flickering. The CONTROLS are within arm's reach, but the ship's systems are in disarray. Through the viewport, the alien planet looms, a constant reminder of how far from home you are.",
  "action_wake_up": "Wake Up",
  "action_wake_up_desc": "Shake off the grogginess and get out of the bunk. Time to assess the situation.",
  "result_wake_up": "You pull yourself upright, your body aching. The emergency lights flicker overhead. You're alive, and the ship is still intact—barely. Time to figure out what happened.",
  "loc_gamma_crew_quarters": "Gamma Site — Crew Quarters",
  "loc_gamma_crew_quarters_desc": "The dimly lit crew quarters of Gamma Site. Personal effects are scattered across bunks, suggesting a hasty evacuation. A terminal on the far wall flickers with residual power.",
  "loc_workshop": "Workshop",
  "loc_workshop_desc": "A cluttered maintenance bay filled with tools and partially assembled equipment. The air smells of ozone and machine oil. Workbenches line the walls, covered in scattered blueprints.",
  "action_go_workshop": "Visit Workshop",
  "action_go_workshop_desc": "Head to the maintenance workshop to check for supplies and equipment.",
  "action_go_crew_quarters": "Return to Crew Quarters",
  "action_go_crew_quarters_desc": "Go back to the crew quarters.",
  "character_inventory_tab": "Inventory",
  "character_stats_skills_tab": "Stats & Skills",
  "character_skills": "Skills",
  "poi_terminal": "TERMINAL",
  "poi_bunks": "BUNKS",
  "poi_storage": "STORAGE LOCKER",
  "poi_cafeteria": "CAFETERIA",
  "poi_communications": "COMMUNICATIONS",
  "poi_navigation": "NAVIGATION",
  "poi_controls": "CONTROLS",
  "poi_travel": "TRAVEL",
  "poi_other_actions": "Other Actions",
  "action_access_logs": "Access Logs",
  "action_access_logs_desc": "Review ship logs and crew manifests stored in the terminal.",
  "action_check_storage": "Check Storage",
  "action_check_storage_desc": "Search the storage locker for emergency supplies.",
  "action_go_to_main_area": "Go to Main Area",
  "action_go_to_main_area_desc": "Head to the main area and cafeteria.",
  "action_go_to_crew_quarters": "Return to Crew Quarters",
  "action_go_to_crew_quarters_desc": "Head back to the crew quarters.",
  "action_go_to_bridge": "Go to Bridge",
  "action_go_to_bridge_desc": "Head to the ship's bridge.",
  "action_get_food": "Get Food",
  "action_get_food_desc": "Get some food from the dispenser.",
  "action_check_comms": "Check Communications",
  "action_check_comms_desc": "Check the communications console for any signals.",
  "action_check_navigation": "Check Navigation",
  "action_check_navigation_desc": "Review the navigation systems and current position.",
  "action_scan_systems": "Scan Systems",
  "action_scan_systems_desc": "Run a full diagnostic scan of ship systems.",
  "action_check_status": "Check Status",
  "action_check_status_desc": "Check the overall status of the ship.",
  "result_search_bunks": "You search through the crew bunks. Among scattered personal effects, you find a few useful items and a tattered logbook. The entries stop abruptly — mid-sentence.",
  "result_get_food": "You grab some food from the dispenser. It's not appetizing, but it's sustenance.",
  "result_check_comms": "The communications console crackles with static. You catch fragments of a distress signal, but the source is unclear.",
  "result_check_navigation": "The navigation systems show your current position near an uncharted planet. All long-range communications are offline.",
  "result_scan_systems": "The diagnostic scan reveals multiple system failures. Life support is at 87%, power reserves at 45%. You need to be careful.",
  "result_check_status": "Overall ship status: CRITICAL. Multiple systems are failing, but the core structure is intact. You have time, but not much.",
  "result_check_terminal": "The terminal flickers to life. Ship status: CRITICAL. Crew complement: 3 survivors detected in Gamma Site. Navigation logs are corrupted. A looping distress signal plays on repeat.",
  "result_access_logs": "You access the ship's logs. Most entries are corrupted, but fragments remain: coordinates, crew assignments, and a cryptic reference to 'Gamma Site' on the planet below.",
  "result_check_storage": "The storage locker contains emergency rations, a medkit, and a handheld scanner. Standard issue for scout missions.",
  "result_scavenge_tools": "You rummage through the workshop. Several toolkits are still intact. You salvage what you can — a plasma cutter and some spare power cells.",
  "result_repair_kit": "Using scavenged parts, you manage to repair a damaged enviro-suit. It's not perfect, but it'll hold for now.",
  "log_game_saved": "Game saved.",
  "log_game_loaded": "Game state loaded.",
  "log_new_game_started": "New game started.",
  "log_game_paused": "Game paused.",
  "log_game_resumed": "Game resumed at {speed}x.",
  "log_game_speed_set": "Game speed set to {speed}x.",
  "clock_time_format": "Day {day}, {hour}:{minute}",
  "action_duration_label": "{minutes} min",
  "pause_overlay_title": "GAME PAUSED",
  "footer_status_paused": "Paused",
  "options_title": "Options",
  "options_settings": "Settings",
  "options_title_return": "Other",
  "options_glow_color": "UI Glow Color",
  "options_glow_intensity": "Glow Intensity",
  "confirm_lang_change_title": "Change Language",
  "confirm_lang_change_msg": "Changing language will reload the page. Any unsaved progress will be lost. Continue?",
  "confirm_lang_change_confirm": "Change",
  "confirm_lang_change_cancel": "Cancel",
  "log_title": "Log Options",
  "log_display": "Display",
  "log_show_timestamps": "Show timestamps",
  "log_typewriter_effect": "Typewriter effect",
  "log_filters": "Filters",
  "log_colors": "Colors",
  "log_reset_colors": "Reset Colors to Default",
  "action_disable_alarm": "Disable Alarm",
  "action_disable_alarm_desc": "Access the terminal overrides and disable the blaring emergency alarm.",
  "result_disable_alarm": "You key in the override codes. The wailing alarm sputters and dies. Blessed silence fills the compartment. The ringing in your ears will fade — eventually.",
  "action_drink_water": "Drink Water",
  "action_drink_water_desc": "Hydrate yourself to recover drinking water.",
  "action_scavenge_tools": "Scavenge Tools",
  "action_scavenge_tools_desc": "Search the workshop for usable tools and components.",
  "action_repair_kit": "Repair Equipment",
  "action_repair_kit_desc": "Attempt to repair damaged equipment found in the workshop.",
  "action_survey_area": "Survey Area",
  "action_survey_area_desc": "Carefully examine the workshop layout for hidden caches.",
  "log_effect_removed": "Effect removed: {effect}",
  "queue_title": "Action Queue",
  "queue_action_queued": "Queued: {action}",
  "queue_action_removed": "Removed from queue: {action}",
  "queue_remove_tooltip": "Remove from queue",
  "queue_empty": "Queue empty",
  "effects_title": "Active Effects",
  "effect_alarm": "Emergency Alarm",
  "effect_alarm_desc": "The ship's alarm is blaring — the noise is disorienting and makes actions harder. Check the terminal and disable the alarm to restore normal conditions."
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
