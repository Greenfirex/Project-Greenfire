# Project Greenfactory

3D tovární hra ve stylu Satisfactory, hratelná ve webu (Vite + Babylon.js).

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5174
```

## Ovládání

| Vstup | Akce |
|---|---|
| **W A S D / šipky** | Pohyb postavy (vzhledem ke kameře) |
| **Tažení levým tlačítkem** | Rotace kamery |
| **Kolečko** | Zoom |
| **Klik na zem** | Postavení stroje na buňku mřížky |
| **M** | Přepnutí typu stavěného stroje |
| **F5** | Uložit |
| **F9** | Načíst |

## Architektura

```
src/
  main.js                    engine, plátno, render loop
  scenes/GameScene.js        orchestrátor — stav světa, delegace na systémy
  systems/                   camera, grid, input, build, save, player
  data/catalogs/             machines, items, saveSchema (jen deklarace)
  ui/hud.js                  DOM HUD nad plátnem
  utils/                     gridMath, storage
  styles/                    global.css, hud.css
```

- Systémy jsou třídy, konstruktor dostane scénu, přístup přes `this.s`.
- Logika stavby je oddělená od renderu (připraveno pro tick-based simulaci).
- Ukládání je obecný sběrač stavu (`saveSystem.registerState`).

## Stav projektu

Funkční: izometrická ortho kamera, mřížka, hover zvýraznění, stavba strojů
(placeholder boxy), hratelná postava s animacemi idle/run (WASD/šipky),
ukládání/načítání do localStorage.

Další kroky: Kenney modely místo boxů, pásy, recepty, tick-based simulace.
