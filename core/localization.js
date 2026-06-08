const LANGUAGE_STORAGE_KEY = 'gameLanguage';
const DEFAULT_LANGUAGE = 'en';

const TRANSLATIONS = {
    en: {
        english: 'English',
        czech: 'Čeština',
        // Title screen
        continue: 'Continue',
        newGame: 'New Game',
        settings: 'Settings',
        changelog: 'Changelog',
        exit: 'Exit',
        // Options menu
        language: 'Language',
        runInBackground: 'Run in background',
        glowEffects: 'Enable UI Glow Effects',
        reduceMotion: 'Reduce motion',
        confirmBeforeLoad: 'Confirm before load',
        confirmBeforeReset: 'Confirm before reset',
        saveManagement: 'Save Management',
        // Header
        options: 'Options',
        save: 'Save',
        title: 'Title',
        load: 'Load',
        pause: 'Pause',
        resume: 'Resume',
        // Footer
        pauseTitle: 'Pause / Resume game',
        debugTitle: 'Toggle x10 resource gains for testing',
        // Menu sections
        crashSite: 'Crash Site',
        character: 'Character',
        journal: 'Journal',
    },
    cs: {
        english: 'English',
        czech: 'Čeština',
        // Title screen
        continue: 'Pokračovat',
        newGame: 'Nová hra',
        settings: 'Nastavení',
        changelog: 'Seznam změn',
        exit: 'Konec',
        // Options menu
        language: 'Jazyk',
        runInBackground: 'Běh na pozadí',
        glowEffects: 'Zapnout vizuální efekty',
        reduceMotion: 'Omezit animace',
        confirmBeforeLoad: 'Potvrdit před načtením',
        confirmBeforeReset: 'Potvrdit před resetem',
        saveManagement: 'Správa uložených her',
        // Header
        options: 'Možnosti',
        save: 'Uložit',
        title: 'Titulka',
        load: 'Načíst',
        pause: 'Pauza',
        resume: 'Pokračovat',
        // Footer
        pauseTitle: 'Pauza / Pokračování hry',
        debugTitle: 'Přepnout x10 zisky zdrojů',
        // Menu sections
        crashSite: 'Místo havárie',
        character: 'Postava',
        journal: 'Deník',
    }
};

export function getSelectedLanguage() {
    try {
        const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const lang = String(raw || DEFAULT_LANGUAGE).trim();
        return Object.prototype.hasOwnProperty.call(TRANSLATIONS, lang) ? lang : DEFAULT_LANGUAGE;
    } catch (e) {
        return DEFAULT_LANGUAGE;
    }
}

export function setLanguage(language) {
    const lang = String(language || DEFAULT_LANGUAGE).trim();
    const active = Object.prototype.hasOwnProperty.call(TRANSLATIONS, lang) ? lang : DEFAULT_LANGUAGE;
    document.documentElement.lang = active;
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, active);
    } catch (e) {
        console.warn('Could not persist language selection', e);
    }

    // Notify all UI elements to refresh
    try {
        window.dispatchEvent(new CustomEvent('language-changed', { detail: { language: active } }));
    } catch { /* ignore */ }

    return active;
}

export function t(key, fallback = '') {
    const lang = getSelectedLanguage();
    const translations = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANGUAGE];
    return String(translations[key] || fallback || key);
}

export function getAvailableLanguages() {
    return Object.keys(TRANSLATIONS).map(code => ({
        code,
        label: TRANSLATIONS[code][code === 'en' ? 'english' : 'czech'] || code
    }));
}