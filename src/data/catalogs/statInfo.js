// Popisky statů postavy pro pravý panel; čísla a výpočty zůstávají v systémech.
export const PLAYER_STAT_INFO = {
  health: {
    label: 'Zdraví',
    icon: '❤',
    text: 'Kolik ran vydržíš, než se probudíš na startu. Pomalu se doplňuje pořád, i v boji.',
  },
  stamina: {
    label: 'Výdrž',
    icon: '⚡',
    text: 'Ubývá během běhu, útoku a sekání. Doplní se po chvíli klidu.',
  },
  attack: {
    label: 'Útok',
    icon: '⚔',
    text: 'Šance, že rána zasáhne. Vyšší útok překonává obranu cíle.',
  },
  defense: {
    label: 'Obrana',
    icon: '🛡',
    text: 'Ztěžuje nepříteli zásah. Není to totéž jako zbroj.',
  },
  armor: {
    label: 'Zbroj',
    icon: '🪖',
    text: 'Po resistitě odečte z fyzického poškození pevný počet. Minimum je 1.',
  },
  damage: {
    label: 'Rána',
    icon: '💥',
    text: 'Rozsah poškození, které udělíš. Kritický zásah ho zdvojnásobí.',
  },
};
