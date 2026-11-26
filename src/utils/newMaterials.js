// Hlídání nových materiálů scény — vrátí funkci, která při každém zavolání vydá materiály vzniklé od minula.
// Babylon nové materiály hlásí až se zpožděním, takže kdo je musí upravit před prvním kreslením, ptá se tudy.
export function newMaterialsOf(scene) {
  let newest = -1;
  return () => {
    const known = newest;
    const found = [];
    for (const material of scene.materials) {
      if (material.uniqueId <= known) continue;
      newest = Math.max(newest, material.uniqueId);
      found.push(material);
    }
    return found;
  };
}
