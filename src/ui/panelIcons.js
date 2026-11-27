// Ikony tlačítek oken — jednoduchá kresba jednou linkou, barvu bere z textu tlačítka.
const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const PANEL_ICONS = {
  bag: icon('<path d="M10 4.5a2 2 0 0 1 4 0V6"/><path d="M6.5 10a5.5 5 0 0 1 11 0v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"/><path d="M6.5 12.5h11"/><rect x="9.5" y="15" width="5" height="3.5" rx="1"/><path d="M6.5 14H4.5v4.5h2M17.5 14h2v4.5h-2"/>'),
  journal: icon('<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6.5V20"/>'),
  bestiary: icon('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 3v18"/><path d="M11 9l1.5 6M13.5 8l1.5 7M16 9l1 5"/>'),
  map: icon('<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'),
  craft: icon('<g transform="rotate(-40 12 12)"><rect x="6" y="2.5" width="12" height="5.5" rx="1"/><path d="M10.8 8v12.5a1.2 1.2 0 0 0 2.4 0V8"/></g>'),
};
