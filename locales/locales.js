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
  "options_glow_effects": "Enable UI Glow Effects",
  "options_reduce_motion": "Reduce motion",
  "options_combat_start_paused": "Combat starts paused",
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
  "popup_welcome_page1": "Darkness. Then pain — sharp and hot across your ribs. The air tastes of ozone and burned circuitry. Alarms warble somewhere far away, muffled by collapsed bulkheads.",
  "popup_welcome_page2": "You are alive. The ship is not. Through a jagged tear in the hull you can see alien sky — pale amber, streaked with unfamiliar cloud patterns. Nothing outside looks like home.",
  "popup_welcome_page3": "Your name is Lieutenant Commander. Your mission logs are corrupted. Your crew status is unknown. But you are still breathing — and that means there is work to do.\\n\\nFind survivors. Secure resources. Learn what brought you here. And above all: survive.",
  "objectives_new_log": "New objective: {name}",
  "objectives_completed_log": "Objective completed: {name}",
  "objectives_reward_log": "Objective reward: {rewards}"
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
    const files = ['ui', 'confirm', 'actions', 'resources', 'character'];
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
