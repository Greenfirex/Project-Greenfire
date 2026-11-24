// Dolní lišta — společné místo, kam se skládají ukazatele s lištou nástrojů (uprostřed)
// a tlačítka oken (vpravo). Každá část si sem jen vloží svůj prvek.
const AREAS = ['center', 'buttons'];

export function dockArea(name) {
  let dock = document.getElementById('hud-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'hud-dock';
    dock.id = 'hud-dock';
    for (const area of AREAS) {
      const part = document.createElement('div');
      part.className = `hud-dock__${area}`;
      dock.appendChild(part);
    }
    (document.getElementById('hud-layer') || document.body).appendChild(dock);
  }
  return dock.querySelector(`.hud-dock__${name}`) || dock;
}
