// Jednorázové upozornění, že systému chybí propojení na výšku země — místo tichého výsledku nula.
const warned = new Set();

export function warnMissingWiring(who) {
  const key = String(who || 'neznámé');
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[propojení] chybí ${key} — počítá se s 0, což je tiše špatně.`);
}
