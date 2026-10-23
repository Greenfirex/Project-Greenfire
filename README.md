# Project Greenfactory

3D tovární hra ve stylu Satisfactory, hratelná ve webu (Vite + Babylon.js).

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5174
```

Při startu běží přes obrazovku načítání reálné počítadlo dokončených dílů (dlaždice mapy,
stromy a kameny, postava, její animace, nástroje, příprava ukládání). Mapa se začne
vykreslovat dřív, než doběhnou všechny modely; vstup je zamčený, dokud obrazovka nezmizí.

## Ovládání

| Vstup | Akce |
|---|---|
| **W A S D / šipky** | Pohyb postavy (vzhledem ke kameře), Shift = běh |
| **Tažení myší** | Rotace kamery |
| **Kolečko** | Zoom |
| **1–5** | Výběr předmětu v ruce (plán, sekera, krumpáč, pochodeň) |
| **Levé tlačítko u stromu / rudy / kamene** | Těžení (podržet = opakovat) |
| **Klik na zem s plánem v ruce** | Postavení stroje na buňku |
| **M** | Přepnutí typu stavěného stroje |
| **R** | Otočení stroje (pod kurzorem, nebo u stavby budoucího) |
| **Pravé tlačítko ×2 na stroj** | Bourání (první klik označí, druhý zbourá) |
| **E** | Zapálit / zrušit táborák |
| **G** | Zobrazit / skrýt mřížku |
| **N** | Posun času o 6 hodin |
| **P** | Pauza / pokračovat (ztmaví obrazovku, zastaví celou hru) |
| **F1** | Editor mapy (zóny, dlaždice, výšky) — také tlačítkem 🧱 nahoře uprostřed |
| **F2** | Vývojářské nástroje (rychlost času 1×/2×/5×/10×, pauza času) — také tlačítkem 🐞 |
| **O** | Možnosti (kvalita, stíny, FPS, hlasitost) |
| **F5 / F9** | Uložit / načíst |

## Architektura

```
src/
  main.js                    engine, plátno, render loop
  scenes/GameScene.js        orchestrátor — stav světa, delegace na systémy
  systems/                   camera, grid, terrain, deco, build, gather,
                             inventory, heldItem, player, input, editor,
                             campfire, glow, dayNight, sim, audio, save
  data/catalogs/             stroje, předměty, dekorace, mapy, uložený stav
  data/maps/                 generátor mapy a editovatelné rozvržení
  effects/                   oheň (táborák, pochodeň)
  ui/                        DOM HUD panely nad plátnem
  utils/                     výpočty mřížky, načítání modelů, ukládání do prohlížeče
  styles/                    global.css, hud.css, editor.css
```

- Systémy jsou třídy, konstruktor dostane scénu, přístup přes `this.s`.
- Simulace běží v pevném ticku (10× za sekundu) a o obsahu mechanik nic neví;
  mechaniky se hlásí přes `simSystem.subscribe`.
- Ukládání je obecný sběrač stavu (`saveSystem.registerState`).

## Stav projektu

Funkční: izometrická ortho kamera, navazování na postavu, mřížka s hover
zvýrazněním, hratelná postava s animacemi (idle/run/jízda nástrojem), sběr
dřeva a kamene včetně kácení stromů, batoh, modelem nahrazené stroje z Kenney
kitu, rotace a bourání strojů, táborák s ohněm a svícením, oheň pochodně,
denní cyklus se stíny, lesní zvuky a kroky podle povrchu, panel možností,
editor mapy (zóny, cesty, výšky, undo) a ukládání/načítání do prohlížeče.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů) a
suroviny pro výrobu (železná a měděná ruda, ingoty). Stroj má v savu připravený
stav (co má uvnitř, co vyrobil, jak daleko je ve výrobě), ale výroba v něm
zatím neběží.

Další kroky: výroba ve strojích a plnění batohu, výběr a stav stroje kliknutím,
výroba předmětů z batohu.

## Editor mapy

Mapa je uložená jako hotový seznam dlaždic a objektů v souboru
(`src/data/maps/<mapa>/map.json`) — žádný recept, ze kterého by se dopočítávala.
Co v souboru chybí, ve hře neexistuje: chybějící buňka znamená díru bez trávy,
přes kterou se nedá chodit. Výška terénu je uložená u každé dlaždice zvlášť.

V editoru (F1) jsou tři druhy práce: **zóny** vyplní označené buňky rostlinami
a objekty, **výška** zvedá dlaždice, **plocha** přidává a odebírá samotné buňky
mapy — mazání plochou udělá v mapě skutečnou díru. Klikací tlačítka výšky
v panelu určují, jak vysoko se dlaždice pokládají; tlačítkem **Vyhladit**
se srovnají schody do okolí.

Soubor mapy je jediný zdroj pravdy: hra při startu vždycky přečte
`src/data/maps/<mapa>/map.json` ze souboru na disku, žádnou jinou mapu v kódu
nemá. Tlačítko **Uložit mapu** v panelu editoru (F1) zapíše hotovou mapu rovnou
do toho souboru — pomáhá s tím vývojový server (`vite.mapSaver.js`). Po uložení
se hra sama obnoví, takže vidíš přesně to, co je v souboru, a mapa je připravená
k commitu.

Když vývojový server neběží nebo jde o zabalenou verzi hry, soubor zapsat nejde
a hra mapu místo toho stáhne jako `map.json`; ten pak polož do projektu ručně.

### Cesty

Cesta je samostatná **vrstva** mapy (`path`), ne dlaždice: každý záznam má jen
pozici (`cx`, `cz`) a styl (`dirt`/`stone`/`wood` = hlína/kámen/dřevo), **žádný
`key`** — na rozdíl od podlahy a dekorací se cesta nepoznává podle klíče, ale
podle toho, že je ve vrstvě `path` (viz `src/data/maps/areaShape.js`).

Vykresluje ji `src/systems/pathSystem.js` podle toho, kolik sousedních buněk je
taky cesta:

- **rovinka** (2 protilehlí sousedé) → rovný pás,
- **zatáčka** (2 sousedé do pravého úhlu) → zaoblený roh,
- **křížení / rozcestí T** (3–4 sousedé) → sjednocení vodorovného a svislého pásu;
  u „T" je chybějící rameno uťaté přesně na hraně buňky, aby nečouhalo do trávy.

Šířka cesty je **deterministická funkce světových souřadnic** (`pathHalfWidth`),
ne náhodná — proto se plynule vlní (cesta vypadá jako vyšlapaná pěšinka), ale
zároveň se sousední segmenty na hranici buňky potkají se stejnou šířkou, takže
nikde nevznikají schody ani díry. Amplituda toho kolísání je nastavená v té samé
funkci na konci souboru.

V editoru se cesta kreslí brushem **Cesta** (má tlačítka pro volbu stylu hlina/
kámen/dřevo). Zvýraznění „už tady cesta je" funguje na vrstvu `path`, ne na klíč,
takže funguje stejně pro cestu nakreslenou v editoru i pro tu načtenou ze souboru.

