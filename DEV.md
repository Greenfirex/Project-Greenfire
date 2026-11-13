# Vývoj projektu Greenfire

Technický průvodce projektem: jak se hra skládá, kde co v kódu je, co je hotové
a co následuje. Co hra je, jak se ovládá a jaké má licence, popisuje
[README.md](README.md); aktuální úkoly jsou v [TODO.md](TODO.md).

## Architektura

```
src/
  main.js                    engine, plátno, render loop
  scenes/                    herní scéna — GameScene.js (orchestrátor) a její části:
                             sceneWorld (stavba světa a přestavby), sceneCombat (tvorové
                             a souboj), sceneGathering (sběr), sceneSteps (kroky a stopy),
                             sceneEquipment (výbava a staty z ní), sceneSettings (společná čísla)
  systems/
    core/                    sim, save, input, interaction, camera, grid, navigation
    terrain/                 terrain + části (materials, bridges, caves, mass, picking,
                             settings), ladicí pohledy (terrainDebug), hmota (runVolume,
                             runBlocks), pluginy blend/relief/caustic/wet/grass, cliffSurface,
                             cliffVine
    water/                   water, waterBodies, waterFalls, waterShader, waterfallShader, waterSettings, waveSpray, fish
    flora/                   flora, grassShader, treeWind
    creatures/               creature, footprint, sandBurst, bestiary
    player/                  player, attack, stats, heldItem, inventory, equipment, portrait
    gathering/               gather, harvest, felling
    world/                   deco, decoHighlight, campfire, loot, path, reveal, sight
    atmosphere/              dayNight, lighting (světla a stíny), sky, audio
    materials/               modelRim, modelSaturation (pluginy materiálů modelů)
  editor/                    editor mapy (editorMode + části history, layoutEdits, heights,
                             area, joinBridge, brushApply, query, settings), panely, štětce
  data/catalogs/             předměty, dekorace, mapy, tvorové, uložený stav
  data/maps/                 tvar oblasti, nastavení výšek a soubor mapy
  effects/                   oheň (táborák, pochodeň)
  ui/                        DOM HUD panely nad plátnem
  utils/                     výpočty mřížky, šum (noise), načítání modelů, ukládání do prohlížeče
  styles/                    global.css, hud.css, editor.css
```

- Vzhled oken: barvy, písma (Marcellus SC nadpisy, Nunito Sans text) a cesty
  k obrázkům rámu jsou proměnné v `global.css`. Rám okna se kreslí přes
  `border-image` (9 dílů, roztahuje se); drahokam nahoře je zvlášť, aby se nedeformoval.
  Obrázky z Gemini leží v `_sources/ui-frame/`, `node tools/prepareUiFrames.cjs`
  z nich odstraní purpurové pozadí a uloží je do `public/assets/ui/frame/`.

- Systémy jsou třídy, konstruktor dostane scénu, přístup přes `this.s`.
- Velké soubory (scéna, terén, editor) jsou rozdělené na **části** připojené přes
  `Object.assign` (pravidla v `.clinerules`). Editor kódu (VS Code) části nevidí
  a hlásí „Property … may not exist" — to není chyba.
- Simulace běží v pevném ticku (10× za sekundu) a o mechanikách nic neví;
  mechaniky se hlásí přes `simSystem.subscribe`.
- Ukládání je obecný sběrač stavu; vlastníci se připojují přes
  `saveSystem.register` (`serialize`, `apply`, `defaultState`).
- Načtení savu hru znovu spustí a stav se navrství na čerstvě postavený svět —
  proto je u načtení vidět načítací obrazovka. Samo se nic nenačítá.

### Dvě otázky na výšku

- **Výška země** (`terrainSystem.heightAt`, `heightAtCell`) — kde je terén.
  Berou ji dekorace, cesty, voda a tráva.
- **Co je pode mnou** (`terrainSystem.walkHeightAt`) — na čem se dá stát,
  včetně mostu. Berou ji hráč, tvorové, kurzor a kamera.

Žádný systém si výšku nepočítá sám z dat mapy — dostane ji od scény jako
`groundHeightAt`. Chybějící propojení se ozve do konzole (`utils/missingWiring.js`),
místo aby se tiše počítalo s nulou (nula je platná výška a chyba by se schovala).

## Kde co je

- `src/data/maps/layoutStore.js` — rozsah výšek, krok, předvolby.
- `src/editor/editorMode.js`, `mapEditor.js`, `editorHud.js` — editor, výběr, panely;
  `heightPanel.js`, `areaPanel.js`, `brushPanel.js` — okna Výška, Plocha a štětce.
- `src/systems/core/gridSystem.js`, `inputSystem.js` — hover, levé/pravé tažení.
- `src/systems/core/navigationSystem.js` — kudy se dá chodit, přechody mezi patry, strop nad hlavou.
- `src/utils/terrainField.js` — výškový model (spojitá výška mezi buňkami).
- `src/systems/terrain/terrainSystem.js` — terén, hrana, útesy, mosty, prolnutí povrchů;
  `terrainMass.js` a `runVolume.js` — hmota terénu.
- `src/utils/terrainRuns.js` — pruhy skály a vzduchu ve sloupcích buněk.
- `src/utils/bridgeShape.js` — tvar skalního mostu.
- `src/utils/gridPath.js` — hledání cesty tvorů po buňkách (A*).
- `src/systems/water/waterSystem.js`, `waterShader.js` — hladina a její program;
  `src/utils/waterWaves.js` — čísla a výpočet vln.
- `src/systems/atmosphere/` — `skySystem.js` (obloha), `lightingSystem.js` (slunce,
  mlha, světlo jeskyně, stíny), `audioSystem.js` (kroky, příboj, oheň, ambient, hudba).
- `src/systems/world/pathSystem.js` — cesty; `src/systems/player/playerSystem.js` — hráč;
  `src/systems/core/cameraSystem.js` — kamera.
- `src/data/catalogs/brushes.js` — štětce; `decorations.js` — písek a povrchy.
- `src/data/maps/glade/map.json` — aktuální mapa.

## Stav projektu

Hotové je jádro hratelného ostrova: izometrická kamera, postava s animacemi
a staty, sběr dřeva a kamene, batoh a okna postavy, táborák a pochodeň, denní
cyklus se stíny, zvuky podle povrchu, ukládání do prohlížeče, editor mapy
a svět kolem toho — terén se skutečnou hmotou, útesy, mosty, jeskyně s patry,
voda s vlnami a pěnou, ryby, tráva, keře, kameny a palmy, truhly a kostlivci
s kořistí a první předmět na hlavu.

Tvorové: kajmanka, písečný běs a Koa'tiki — toulání, dvě zóny pozornosti,
honička s návratem domů, kousnutí, smrt, tělo s kořistí a respawn. Chodí a vidí
podle stejných pravidel jako hráč (schod, skála v cestě pohledu), jen na kratší
dohled, a po ztrátě hráče jdou na místo, kde ho viděli naposledy. Panel tvora
ukazuje statistiky odemčené počtem zabití (`bestiarySystem.js`), okno bestiáře je na B.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů). Okno Výroba
(`craftingWindow.js`, klávesa V) je zatím jen prázdný panel. Rozpracované a plánované
věci jsou v `TODO.md`.

## Klíčová rozhodnutí (nevrátit omylem)

- Výšky jsou v metrech, krok 0,25 m, rozsah −15 až +24 m; předvolby −15, −10, −5,
  0, 5, 10, 15, 20 a 24 m (`layoutStore.js`). Krok, výška schodu a hranice útesu
  jsou tři oddělená čísla: postava i tvor vylezou schod do 0,55 m (`STEP_LIMIT`),
  hranice útesu je 2,0 m (`AUTO_CLIFF_STEP`). Přes hranu útesu se svah nepřelévá —
  kdyby některá cesta přestala být průchozí, je to tohle číslo.
- Mapa má verzi 10 (`MAP_VERSION` v `src/data/catalogs/mapFile.js`). Mapa starší
  než 10 se při načtení převede na krok 0,25 m (`quantizeMapFileHeights`).
  Hladina vody je nepovinné číslo a verzi nemění, stejně jako nepovinný seznam jezer.
- Hráčova výška se dopočítá z terénu; sav drží jen x, z, natočení a patro.
- `Effect.PersistentMode = true` (`src/main.js`): engine nikdy nemaže programy pro
  grafickou kartu. Bez toho konzole po přepočtu v editoru hlásila
  `glGetProgramiv: Program object expected` — program se smazal, i když ho materiál
  ještě používal.
- Materiály s vlastním programem (voda, tráva) se mažou bez obrázků:
  `dispose(false, false)`, u meshe `mesh.dispose(false, false)`. Drží totiž i sdílené
  mapy rentgenu a dohledu; smazání „i s obrázky“ je zahodí všem a voda i tráva se
  tiše přestanou kreslit (materiál nikdy nebude připravený).
- Výškový panel je samostatné okno; hlavní HUD výšky neobsahuje.
- Výběr buněk: hover + levé přidá + pravé kliknutí odebere; 0 m srovnává.
- Střed buňky zůstává přesný; kraj mapy a díry berou výšku nejbližší buňky.
- Terén se dělí podle povrchů; cesty jsou jemné a 2,5 cm nad zemí.
- Pláž je štětec, ne razítko: mění jen existující buňky a svah staví prstenci po
  0,25 m. Plynulý okraj = jeden prstenec písku navíc. Novou zem z prázdna umí jen
  Herní plocha. V pánvi pláže mizí objekty a tráva.
- Hranice povrchů jsou rovné. Tráva se u okraje prolíná do písku, písek do trávy ne.
- Kopce a stupně se staví výškami, ne skládáním skalních bloků.
- Označená buňka je plošina: drží rovnou výšku a kde je soused níž, stojí stěna.
  Stejně vysoký soused se napojí plynule.

## Terén

Terén má **skutečnou hmotu**: každá buňka drží seznam plných pruhů skály (od–do)
v krocích 0,25 m, mezi nimi je vzduch (`utils/terrainRuns.js`, `buildColumnAir`,
`terrainSystem.solidRunsAt`). Pruhy se odvozují ze stávajících dat mapy. Viditelný
vršek zůstává hladká plocha (pohyb, tráva a voda se nemění), hmota k ní dodává
boky, stěny jeskyní a stropy (`terrainMass.js`, `runVolume.js`).

- **Boky terénu:** nahoře pás v materiálu buňky (na útesu 0,25 m, na měkkém schodu
  `SURFACE_DEPTH` 1 m), pod ním skála. Bok je rozřezaný na pláty po 0,25 m, každý
  s vlastním výřezem textury, aby se obrázek netáhl a mezi buňkami nevznikaly švy.
  Pás má stěnovou hliněnou texturu obarvenou barvou buňky (půdorysná textura na
  svislé ploše dělá pruhy). Skála dostává odstín podle výšky (`wallTint`: mech
  nahoře, tma u paty).
- **Horní hrana boku** bere výšku stejnými pravidly jako okraj hladké plochy
  (`edgeHeightAt`), jinak se okraje rozcházejí o centimetry.
- **Obrys útesu se vlní** v půdorysu do ±0,16 m; jediný zdroj je `cliffShifts`,
  bere ho povrch i bok. Rohy buněk zůstávají pevné.
- **Okraj mapy** končí `EDGE_DEPTH` (2 m) pod povrchem; zvenčí je pod ním prázdno.
- **Na hraně útesu rostou rostliny:** kotvy (`EDGE_ANCHOR_DEPTH`) berou tráva
  (`addShelfGrass`) i liany (`CliffVineSystem`, model `cliff_vine.glb`, zkrácená
  podle výšky stěny, pod 0,6 m se nedává). Ve větru se zatím nehýbe.
- **Skalní kusy na útesech** (`terrain/cliffDressSystem.js`): stěna se nemění, jen
  se obalí překrývajícími se kameny (kamenné útesy) nebo hroudami (hliněné), recepty
  `cliff_stone_*` a `cliff_clod_*` v `rocks.js`. Pod kusy zůstává celá stěna, takže
  nevznikají díry. Seznam stran dává `terrainMass.cliffFaces()`; strana nad vchodem
  dostane jen řadu nad otvorem. Kusy u volného konce stěny se zúží a přitisknou, na
  vnějším rohu stojí menší zapuštěný kus (jinak převisy). Horní řada má občas mech
  (`cliffMossPlugin.js`, zezelená jen plocha mířící vzhůru). Občas je ve stěně
  římsa — převrácený plochý kus s mechem, na který se sází podrost jako na hranu
  (`shelfGrassAnchors` ve scéně). Kusy jsou hromadné kopie po oblastech; každá má
  vlastní kopii tvaru (`makeGeometryUnique`), sdílený tvar si pozice přepisuje.
- **Ladicí pohledy** (`terrain/terrainDebug.js`): `?solid` ukáže pruhy jako kostky,
  `?corners` obarví rohy útesů (červená roh, modrá vnitřní kout, žlutá diagonála).

**Zkoušeno a zamítnuto** (nezkoušet znovu bez nového nápadu):

- reliéf stěn (posun bodů dělal díry u hrany i u paty),
- zaoblení rohů (vykrojení, vyboulení i řez dna; nedá se sladit s vyhlazením země),
- nahnutí normál na horní hraně (u svislé stěny dělá tmavý pruh),
- procedurální kůže útesů s římsami — odstraněná; s ní zmizelo i dolícování mostů
  ke skále, mosty navazují jen na břehy.

Další fáze objemového terénu jsou v `TODO.md`.

## Jeskyně a patra

Rozhodnuto: skutečná patra v jedné mapě (ne kulisa ani samostatná mapa — ta zůstává
vhodná pro jiné vnitřky, třeba dům, přes registr `src/data/catalogs/maps.js`).

**Model sloupců:**

- Buňka může mít víc pochozích ploch nad sebou; každá má výšku a případně strop
  (`ceilY`). Strop je údaj plochy, ne dopočet z plochy nad ní.
- Číslo patra (0, −1, −2 …) je **jmenovka, ne pořadí** a nikdy se nepřečíslovává
  (rozbilo by mapy, spoje i savy). Pořadí si buňka spočítá z výšek.
- Mezi plochami se chodí **jen po spoji** (sekce `connectors` v mapě: odkud, kam,
  druh; v mapě je zatím jen `passage` a kód druhy nerozlišuje). Spoj znamená i díru ve stropě
  či podlaze a vynechanou stěnu. V buňkách spoje neplatí stěnová kolize útesu.
- Světlá výška aspoň 2,6 m (postava měří 2,0 m, `MODEL_HEIGHT` v `playerSystem.js`), výchozí 3,0 m.
- „Jsem pod střechou" se odvozuje ze stropu nade mnou, neukládá se.
- Kde jeskynní buňka sousedí s venkovní ve stejné výšce (do 0,6 m), vznikne sama
  průchozí díra. Podlahy ve vchodu na sebe navážou jen ve stejné výšce, jinak
  vznikne schod (rampy a schody se zatím nekreslí).

**Hotovo:** data a dotazy, geometrie (podlahy, stropy, stěny, šachty, vchody),
pohyb hráče po patrech i přes spoj, tma v jeskyni a jeskynní zvuk. Jeskyni svítí
vlastní slabé světlo; obloha je z ní vyloučená a slunce se v materiálu tlumí podle
mapy vchodů (`revealPlugin.js`, `CUSTOM_LIGHT{X}_COLOR` jen pro směrové světlo), takže
obloha i slunce pronikají jen vchodem a asi 3 buňky dovnitř slábnou. Světlo oblohy
u vchodu je stejné jako venku (`revealSystem.setSkyLight`) a dopadá od otvoru, takže
je vidět reliéf podlahy. Stěny a strop jeskyně vrhají stín od slunce i táboráku; do map
stínů (i do mapy dohledu) se skála kreslí z obou stran (`utils/bothSidesMaterial.js`),
jinak by ji některé strany krychle i slunce viděly odvrácenou stranou a světlo by
prošlo. Postava a tvorové zůstávají osvětlení normálně. Když je
hráč pod stropem, schovají se přesně stropní dlaždice nad jeskyní (`overCave`,
samostatný mesh `_roof`) a skryjí se dekorace i tráva na těch buňkách. Strop je zeshora neviditelný.
Terén výš než podlaha, na které hráč stojí, zmizí v celém rozsahu stejně jako
v editoru pater (`revealColumn`), nezávisle na natočení kamery. Co z okolí je
vidět, řeší dohled postavy (níž); bez dohledu (editor pater) zůstává
jen osvětlené okolí vchodu podle mapy `caveLightMap` a tma od 8–14 m.

Táborák má vlastní stín do všech stran (`campfireFire.js`). Stín vrhají jen boky,
stěny a stropy (`metadata.volume`), ploché podlahy ne, jinak by se pod ostrým úhlem
kreslily pruhy. Stín se překresluje jednou za 1,5 s, ne každý snímek. Terén mimo
dosah je z ohně vyloučený. Materiály země jsou blízko limitu 16 textur, proto je
Půda jen z jedné textury a další textura na zemi se musí pohlídat. Nejhorší
materiál země dnes používá 15 textur (včetně mapy dohledu).

**Dohled postavy** (`world/sightSystem.js`, výpočet v `utils/revealGlsl.js`). Z očí
postavy (`PLAYER_EYE_HEIGHT`) kreslí neviditelné bodové světlo krychlovou mapu
vzdáleností; stín vrhá jen skalní hmota (`metadata.volume`). Mapa se čte stejně jako
stín táboráku a překresluje se při každém posunu očí. Pravidla:
- Pod zemí: co zakryje skála nebo je dál než 14 m, ztmavne a zešedne (jeskyně
  tušeně, povrch úplně do černa, takže ven je vidět jen otvorem); modely se
  mimo dohled rozplynou a tvorové se schovají celí (paprsek `sceneCombat.seesCreature`).
- Venku: od ~15 m (z vyvýšeného místa až o 10 m dál) přibývá oparu v barvě mlhy
  (nejvýš 60 %) a černobílé. Opar dostane i zem výrazně výš než postava. Skála venku
  zemi ani dekorace nezakrývá (za rohem by se kreslily pruhy mlhy); jen tvor na vyšší
  zemi za skálou zmizí (`sceneCombat.creatureFogAt`).
  Tvorové se v oparu rozplynou, dekorace jen zešednou.
- Země se testuje o 0,6 m výš (za nízkým schodem není tma); modely podle své paty
  (`vRevealBase`), ne podle bodu modelu, aby koruny stromů nezahalil.
- Volba Ostrost dohledu: jednoduchá (mapa 256) / plná (512). Vypnout dohled ve hře
  nejde, protože bez něj je vidět skrz skálu (tvorové, tma v jeskyni, zvýraznění).

**Prstenec skály při řezu** (`runVolume.js`, kind `ringWall`/`ringCap`): kolem jeskyně
se kreslí jedno políčko skály (i po úhlopříčce) od podlahy do výšky řezu
(`REVEAL_CUT_ABOVE_FLOOR`); poklička kopíruje terén a v řezu se usekne, boky se zaoblí
jako útesy. Je vidět jen při otevřeném řezu, nevrhá stín, neblokuje dohled
a dohled ho neztmavuje. Část, za kterou z pohledu kamery leží jeskyně, se schová
(`revealCaveAhead`). S dohledem řez schová všechen terén nad podlahou, i u vchodu.
V jeskyni se kolize počítá celým tělem postavy (ne jen středem), aby oči nevlezly do
stěny. Oheň pod zemí svítí vždy naplno. Stěny jeskyně se kreslí odvrácenou stranou
(blízká stěna ke kameře tak zmizí) a Babylon pak pro světlo stranu neotočí, proto mají
směr ploch (normály) otočený do jeskyně už v datech (`terrainMass.js`).

Zkušební jeskyně v Glade: 4×4 buňky pod plošinou u spawnu, vchod ve skalní stěně
na buňce −6,−10.

**Pozor:** editor ukládá to, co má otevřená stránka. Když se mapa změní mimo hru,
obnov stránku (F5) — jinak uložení starý stav vrátí (takhle jednou zmizel vchod).

## Voda

Jedna hladina pro celou mapu, uložená jako nepovinné číslo v souboru mapy; jen se
kreslí a nic v mapě nemění. Kde je terén pod ní, je voda. V editoru se zapíná
tlačítkem Voda a ladí po 0,25 m.

- Vlastní program pro ortografickou kameru — Babylon WaterMaterial dělá na ortho
  kameře bílé pruhy a zrcadlové fleky.
- **Vlny:** do ~6 m od břehu běží hřebeny podle vzdálenosti od břehu (sledují
  obrys ostrova, stáčí se kolem mysů), od ~24 m dál volné vlnění z pěti směrů;
  mezi tím se plynule míchají. Výšku tlumí hloubka. Fáze se láme po celých
  periodách, takže hladina necukne. Jemné vlnky jsou jen v programu (síť na ně
  nemá vrcholy) a mizí, když jsou na obrazovce menší než ~18 pixelů.
- **Útes vs. pláž** se pozná podle sklonu: kde země u vody stoupá aspoň o 1,2 m,
  vlna se rozbije a stříká a krajková pěna se vypne.
- **Pěna** jde ze stejných vln, posouvá se jedním společným směrem (aby se vzorek
  na zakřiveném pobřeží nedeformoval) a nikdy se nekreslí nad suchou zemí.
- **Odraz** z odrazové sondy nad středem vody (terén a objekty; obloha je barva).
  Síla zrcadlení se počítá z hladké vlny, ne z vlnek.
- Hloubka z terénu pod hladinou: mělko prosvítá, hloubka tmavne; kaustika na dně,
  v noci tmavší hladina. Hustota sítě podle kvality: 0,5 / 1 / 2 m.
- **Mokrý pruh** na zemi u vody: nízko nad hladinou a zároveň blízko moře či jezera.
  Vzdálenost od vody je v zeleném kanálu mapy suchých jam (`waterSystem.limitToOcean`,
  dosah `SEA_DISTANCE_REACH`), čte se plynule mezi buňkami.

### Jezera a řeky (vodní plochy)

Mimo moře jsou dva druhy vodních ploch; obě skládá scéna (`sceneWorld.waterBodies`)
a výsledek dává vodě i terénu. Každá buňka plochy má svou výšku hladiny, směr
a rychlost proudu a sílu peřejí; jezero je plocha se stejnou výškou a bez proudu.

- **Jezero:** v mapě `lakes: [{ cx, cz, level }]` — buňka, odkud se voda rozlévá, a výška
  hladiny. Voda se rozlije do sousedních buněk níž než hladina (`src/utils/lakeFill.js`).
  Když doteče na kraj mapy, jezero přeteče a nekreslí se.
- **Řeka:** v mapě `rivers: [{ cells: [[cx, cz, hladina], …], width, ground: [[cx, cz, výška], …] }]`, pořadí buněk je
  směr proudu (`src/utils/riverPlan.js`), `ground` je výška země před vykopáním koryta
  (řeky nakreslené dřív ji nemají — jejich koryto se zasype odhadem 0,25 m nad bývalou
  hladinu, `riverRestore`, protože hladina se vždy držela tolik pod břehem). Hladinu spočítá editor při kreslení: po proudu
  nikdy nestoupá a drží se 0,25 m pod nejnižším sousedním břehem (políčka o 2 m a víc
  níž — pod útesem — se nepočítají); proti přetečení na svah stačí `SHORE_SPILL`
  (hlídat víc sousedů stahovalo hladinu na svazích zbytečně hluboko). Koryto se vyhloubí jako
  obyčejná úprava výšek. Hloubka se volí jako rozmezí od–do zvlášť pro mělkou
  (0,25–0,5 m, přebrodí se) a hlubokou (0,75–2,5 m) řeku; rozdílné hodnoty se podél
  toku plynule střídají (šum po zhruba 5 buňkách, `depthAlong`). Buňky řeky
  v jezeře nebo v moři se nekreslí — tam už je jiná voda. Moře je jen to, co je spojené
  s otevřeným mořem (`limitToOcean`). Buňka řeky s hladinou nad mořem moře zastaví, i když
  má dno pod ním, takže moře koryto nezaplaví. Hladina řeky nikdy neklesne pod moře —
  u ústí se s ním srovná a tam řeka přejde v moře. Končí-li tah v jiné řece nebo jezeře,
  hladina nové řeky po celé délce neklesne pod jejich hladinu v místě napojení
  (odbočka, která se zase spojí, do řeky vteče, ne „vyleze“). Kde je terén nižší než
  ta hladina, stojí voda nad zemí — editor to po Aplikovat napíše.
- Plochy kreslí `waterBodies.js` (část WaterSystem): výška a proud se po 0,5 m vyhladí,
  takže řeka klesá plynule. Program vody je stejný jako u moře, bez vln a příboje
  (`swellScale` 0) a bez odrazu okolí (zrcadlí se jen rovina moře).
- Proud: pěna a čeření se posouvají po proudu dvěma obrazy, které se střídají po
  `FLOW_CYCLE` sekundách, takže se textura časem neroztahuje. Peřeje (pěna navíc) jsou
  tam, kde hladina klesá víc než o 0,2 m na buňku.
- Kde přesně voda je, určuje maska v modrém kanálu mapy hloubky, takže voda nepřeleze
  hřbet za břehem. Mimo své buňky smí voda nejvýš 0,75 m (`SHORE_SPILL`), jen na svah břehu. U útesu se hloubka protáhne do skály (`extendIntoCliffs`, sdílí
  i moře), aby voda dotekla až ke stěně. Podle masky odpovídá `waterSystem.bodyAt`.
- Pro terén je výška hladiny v modrém kanálu mapy suchých jam (krok 0,25 m,
  0 = žádná plocha), i 3 buňky kolem břehu kvůli mokrému pruhu. Kaustika se kreslí jen
  v buňkách plochy, mokrý pruh jen na zemi zhruba ve výšce hladiny.
- Hloubka, brodění, šplouchání a zákaz vstupu do hloubky platí stejně jako u moře.
- Ryby a sprej jsou jen u moře. Zvuk má moře, řeka, vodopád i jezero — každý vlastní
  smyčku, hlasitost podle vzdálenosti (`waterSystem.waterDistancesAt`,
  `audioSystem.setWaterDistances`, dosahy ve `WATER_LOOPS`).
- **Vodopád** vznikne sám tam, kde hladina řeky mezi dvěma buňkami trasy klesne aspoň
  o hranici útesu (`AUTO_CLIFF_STEP`, 2 m; `riverFalls`). Při plánování se buňky pod
  útesem nepočítají jako břeh horního toku, jinak by řeka před hranou vykopala kaňon.
  Hladina se přes výškový rozdíl nad 1 m nevyhlazuje, takže horní tůň je rovná až
  k hraně. Kreslí ho `waterFalls.js` (část WaterSystem) a `waterfallShader.js`:
  clona s pruhy stékajícími dolů v oblouku od skály, vířící pěna na dolní hladině
  a mlha z částic. Funguje i pád do jezera nebo do moře. Stěna útesu pod vodopádem se
  neobkládá kameny ani terasami (`sceneWorld.waterfallFaces`), jinak by prolézaly clonou.
- V editoru štětec Jezero (Terén): klik do prohlubně ji naplní po okraj, klik na jezero
  zvedne hladinu o 0,25 m, pravé tlačítko ji sníží, v režimu Mazat jezero zmizí.
  Splynou-li dvě jezera, zůstane jedno.
- Štětec Řeka (Terén): tah od pramene k ústí je návrh, Aplikovat ho postaví; volí se šířka 1 nebo 3 buňky a hloubka.
  Pravé tlačítko nebo Mazat řeku smaže i se zasypáním koryta. Tah přes existující řeku
  (aspoň 2 společná políčka) zakreslený úsek nahradí: staré koryto se tam zasype,
  vykope se nové a zbytek staré řeky zůstane jako samostatné kusy. Tah proti proudu
  staré řeky se otočí po proudu, jinak by řeka tekla do kopce a vyhloubila kaňon.
- Buňky řek jsou pro jezero zeď (`fillLake` s `blocked`): jezero se korytem nevylije,
  řeka z něj vyteče ve výšce hladiny, kterou si vzala při kreslení. Změní-li se
  potom hladina jezera, vznikne mezi nimi schod — řeku je pak třeba nakreslit znovu.

## Postava

Model `public/assets/characters/castaway/castaway.glb` má kostru i animace v GLB;
nástroj se přichytí na kost `RightHand`. Mapování animací a nastavení modelu jsou
v `src/data/catalogs/modelCatalog.js`, načtení a přepínání v `playerSystem.js`.

Nový svět začíná na buňce **−1, −16**, hráč leží a vstane po stisku WASD nebo šipek.
Uložená hra vstávání přeskočí. Když dojde zdraví, hráč se probudí na startu.

Zdraví, výdrž, zbroj a resistity drží `playerStatsSystem.js`, čísla jsou
v `src/data/catalogs/player.js`, proužky kreslí `src/ui/vitalsBar.js`. Výdrž ubírá
běh, útok a máchnutí do stromu či kamene; doplňuje se po prodlevě, kterou restartuje
i kousnutí. Při prázdné výdrži postava přejde do chůze a běh povolí až nad mezí —
Shift je potřeba pustit a stisknout znovu (jinak by kmitala). Útočit jde i bez výdrže.

Poškození je rozsah (`bite: [3, 5]`, pěst `[4, 8]`). Losuje ho `rollDamage`
v `combatRoll.js`. `defense` rozhoduje o zásahu, `armor` snižuje jen fyzické
poškození pevným číslem a resistity ho snižují procenty (strop 75 %). Pořadí je
los → kritický násobek → resistita → zbroj → nejméně 1. Typy poškození a výchozí
nuly drží `src/data/catalogs/damage.js`.

Okno **Postava a batoh** otevírá **I** i **C** a jde tahat myší. Vlevo drží výbavu
a staty (zdraví, výdrž, obranu, útok, zbroj, rozsah rány a dva sloupce resistit),
uprostřed batoh s počtem obsazených políček a vpravo detail předmětu. Najetí na
stat ukáže vpravo jeho hodnotu a popis. Předmět má tagy odvozené z druhu a nástroje
(klacek je Produkt i Zbraň), krátký popis a u zbraně typ poškození, rozsah a bonus
útoku. Ikony předmětů mohou být PNG obrázky z `public/assets/ui/items/`; bez nich
se použije emoji.

**Batoh a lišta:** batoh má pevná políčka (`INVENTORY_SLOTS`, mřížka 6 sloupců).
Každý druh předmětu leží na jednom políčku, `inventorySystem.slots` pamatuje kde;
přetažením se políčka prohodí. Nový předmět jde na první volné políčko, vypotřebovaný
políčko uvolní. Lištu dole (`HOTBAR_SLOTS`) drží `heldItemSystem.bar` (klíče nástrojů).
Na lištu jde jen předmět, ke kterému existuje nástroj (`toolForItem`); přetáhne se
z batohu, mezi sloty se prohazuje, pravé tlačítko nebo přetažení zpět do batohu ho
z lišty sundá. První kus nového nástroje se na lištu přidá sám (`GameScene.receiveItems`).
Každý nástroj má `item`; pochodeň je předmět a leží v truhlách.

**Vybavení:** předmět s `slot` (zatím `pirate_hat` na hlavu) se přetáhne z batohu
na slot v okně postavy, zpět ho sundá přetažení do batohu (`dragTypes.js`). Co má
hráč na sobě drží `equipmentSystem.js` (ukládá se), propojení dělá
`sceneEquipment.js`. Model na hlavě sedí na uzlu odvozeném z kostí `Head`,
`head_end` a `headfront`; velikost, výška, posun vpřed a natočení jsou v `wear`
u předmětu. Ostatní sloty zatím nic neumí.
`bonus` u předmětu (např. `{ defense: 1 }`) se sečte přes nasazené věci (`gearBonus`)
a `playerStatsSystem.setGear` ho přičte k základu z `player.js`; nic z toho se
neukládá, po načtení se přepočítá z výbavy. Náhled v okně postavy (zeleně lepší,
červeně horší) počítá `previewStats`: u oblečení výměnu v jeho slotu, u zbraně držení
v ruce. `weight` u předmětu a `carryWeight` v `player.js` se zatím jen ukazují
(`carriedLoad`, počítá batoh i výbavu), přetížení nemá žádný důsledek.

**Nástroje v ruce.** Nástroj může mít vlastní `grip`; úchop se počítá vůči ruce, takže
jde s rukou i při úderu.
- Pochodeň (`props/torch/torch.glb`, `upright`): po animaci se předpaží paže, sevřou
  prsty a pochodeň stojí svisle (`holdUpright`, `turnBone`, `closeFist`). Její světlo
  existuje od startu a jen se ztlumí — přidání světla by přepočítalo materiály celého
  světa (bliknutí). Výměna nástroje ve stoje se odehraje sáhnutím (`toolSwapLeft`).
- Klacek (`TOOL_TYPES.club`, `weapon`: poškození, prodleva, animace, zvuk zásahu):
  úchop `fist` (`holdInFist`) vede klacek středem pěsti podél osy ruky; `tilt` ho
  nakloní, `hold` je místo úchopu. `wrist` zamkne zápěstí (`lockWrist`), během úderu
  a sbírání se zámek plynule uvolní (`WRIST_BLEND`). Na zemi leží osm tvarů větví
  (`club_a`–`club_h`), v ruce je `props/club/stick.glb`; opracovaný `club.glb` čeká na výrobu.
- Nástroj je na liště zamčený, dokud hráč jeho předmět nemá v batohu (`GameScene.ownsTool`).

**Animace — pasti:**
- Každá animace začíná s pánví v klidové poloze kostry (`settleRoot`), jinak postava
  při přepnutí sklouzne; `PLAYER_ANIM_ROOTLESS` mají pánev přišpendlenou úplně.
- Údery se hrají jednou, ne ve smyčce (`STRIKE_HOLD` by pustila úder znovu). Kolik
  z úderu se přehraje a kdy je zásah, drží `STRIKE_PLAY_SHARE` a `STRIKE_IMPACT_SHARE`;
  `animLength` vrací skutečnou délku úseku (rychlost už započítá). Bez zbraně se
  střídá pěst a kop, se zbraní se máchá jako sekyrou.
- Natáčení kostí: `turnBone` umí víc natočení jedné kosti za snímek (sčítají se);
  `restoreBones` na začátku snímku vrátí kosti, které animace nepřepsala, jinak by
  `aimBone` měřil minulé natočení a paže by kmitaly.
- Ve stoji `relaxIdle` přitáhne paže k tělu (`IDLE_*`), `updateGlance` občas otočí hlavu.
- Výřezy animací (`PLAYER_ANIM_RANGES`) a rychlosti (`PLAYER_ANIM_SPEEDS`) jsou
  v `modelCatalog.js`. Ladí se ve fotoateliéru:
  `node tools/capture.cjs player strike --tool club --view side2`.

**Sbírání a kořist.** Sbírání (`pickUp`) hraje jen dřep k zemi; předmět se vezme na konci
dřepu a postava se narovná prolnutím (`RISE_BLEND`). `reachDown` předkloní záda
(`REACH_BEND`) a natočí paži k zemi (`aimBone`), protože animace sahá jen ke kolenům.
Okno kořisti (truhla, kostlivec, mrtvý tvor) se otevírá vždy stejně: postava dojde
(`walkTo`, skončí i když se přestane přibližovat — `AUTO_WALK_STUCK`), dřepne si
(`kneeling`) a natáhne ruce (`reachTarget`); dokud je okno otevřené, přehrabuje se
(`rummageOffset`) a tělo se přisune až o `LOOT_LEAN` (posouvá se jen `rig`, kolize ne).
Pohyb klávesami dřep zruší. Truhla si spočítá čelo (`lootSystem.shapeOf`), jde se vždy
před víko (`standSpot`) a sahá kousek dovnitř (`reachPoint`, `REACH_INSIDE`); kostlivec
a tvor čelo nemají. Truhla, ve které něco zůstalo, se po zavření zaklapne, prázdná
zůstane otevřená (`settle` po načtení). Překážka truhly (`deriveBlocked`) stojí
i s posunem `backToEdge`, jinak by k ní postava nedošla.

Modely z Meshy se před vložením zmenšují (textury WebP 1024, nekovový materiál);
nahraný model ztratí posun svých dílů, proto pohyblivé díly (víko truhly) mají osu
otáčení spočítanou až ve hře z tvaru dílu.

Živá postava v okně postavy (`portraitSystem`): dvojník hráče, kopie hierarchie pod
`playerSystem.root` (`instantiateHierarchy`, sdílí model a materiály) s vlastní kopií
kostry a vlastní kopií animace `idle`. Bez nástroje v ruce (`handSlot`), klobouk má.
Stojí na místě hráče, otočený ke kameře okna, a je jen ve vrstvě `PORTRAIT_LAYER`.
Hlavní kamera ho proto nevidí. Když se počet dílů hráče změní (nasazení, nástroj),
dvojník se postaví znovu. Při otevřeném okně jde do `scene.activeCameras` hlavní
kamera a za ní druhá, která vidí jen tuto vrstvu.
Druhá kamera kreslí do výřezu pod rámečkem okna ve dvojnásobné velikosti (vyhlazení
hran, hra nemá MSAA), výřez se smaže do průhledna a po vykreslení se zkopíruje
(`drawImage`) do `<canvas>` v okně. Kopie místo „díry“ v okně, protože pozadí okna by
plátno hry zakrylo. Po vykreslení se `scene.activeCamera` vrací na hlavní kameru,
jinak by klikání a voda počítaly s portrétní. Druhá kamera prochází jen díly postavy
(vlastní `getActiveMeshCandidates`).

## Klikání ve světě

Levé tlačítko rozhoduje podle toho, co je **pod kurzorem** — žádné „vezmi nejbližší".
Mimo dosah se nestane nic; držené tlačítko akci opakuje.

Rozhoduje `src/systems/core/interactionSystem.js` podle priority registrovaných
operací (registrace v `GameScene.registerInteractions`):

| priorita | operace | co udělá |
| --- | --- | --- |
| 100 | tvor | útok |
| 90 | mrtvola | sebrat kořist |
| 50 | těžená věc | máchnutí (kácení, těžba, sběr) |
| 45 | truhla, kostlivec | otevřít / prohledat |
| 40 | táborák | zapálit |

**Truhly a kostlivci** (`world/lootSystem.js`): dekorace s `loot` se otevře (E nebo
klik) do okna kořisti (`ui/lootWindow.js`): klik na předmět ho vezme, E nebo „Vzít vše"
vezme zbytek. Co hráč nechá, zůstane v truhle i v savu (`remaining`); mrtvola tvora
drží zbytek, dokud se nepropadne. Okno se zavře při odchodu dál než dosah ruky
+ 1,2 m (nebo vzdálenost při otevření + 1,2 m). Víko truhly (`lid`) se
zvedne kolem zadní horní hrany. `backToEdge` posune předmět zády ke kraji buňky
podle natočení ze štětce (R).

**Bez nástroje** jde sbírat jen to, co má `byHand` (houby, mušle, kokosy, klacky).
Stromy jen sekerou, kameny jen krumpáčem (`gatherSystem.canHarvest`). Sekera a krumpáč
zatím ve hře nejsou (modely KayKit vyřazené), takže stromy a kameny teď opracovat nejde.

**Víc věcí na buňce**: na jedné buňce smí ležet víc věcí ke sběru (palma a kokos).
Sběr, zlatý obrys i popiska berou tu, která je nejblíž bodu pod kurzorem. Sebrání
označí jen tu věc (`gatherSystem.markTaken(anchor)`), uvolnění místa
(`decoSystem.releaseCell`) se týká jen věcí, které blokují cestu, nebo stromů. Evidence
sebraných věcí (`harvestSystem`) si drží buňku i druh věci, takže dorůstání po
3 dnech vrátí správný kus.

**Dosah rukou** je v katalogu postavy (`handReach`: 2,6 m vodorovně, nejvýš 1 m výš
nebo níž) a čte ho sběr, truhly i táborák (ten má vlastní vodorovný dosah 3,2 m).
Přes útes tak nejde kácet, otevírat ani zapalovat.

Každá operace dodá `pick(context)` (vrátí `{ ref, inReach, detail? }` nebo `null`)
a `act(target)`. Nápověda u kurzoru i klik používají stejné rozhodnutí. Nová
operace = jeden nový řádek v registraci.

## Tvorové (NPC)

Každý tvor má **jeden vlastní soubor** v `src/data/catalogs/creatures/` (data, tiery
a rig pohromadě) a řádek v `index.js` (`CREATURE_TYPES`). Obecné věci (spawn, stavy,
ikony, obrysy, tooltip, ukládání) řeší `src/systems/creatures/creatureSystem.js`
a o kostech nic neví. Model a `CREDITS.txt` patří do `public/assets/creatures/<kind>/`.
Jak postavit nového tvora, všechna pole a rozhraní rigu popisuje
[manuál pro tvory](src/data/catalogs/creatures/README.md).

- Tvor ve hře je jen ten zapsaný v mapě; každý je zároveň **spawní místo**
  a po `respawnDays` herních dnech se obnoví. Počet tvorů určuje mapa.
- Tělo leží přes tři minuty a jde z něj sebrat kořist, pak se propadne.
- **Stav živý/mrtvý není v mapě**, patří do savu. **`kind` a `tier` jsou v savu** —
  nepřejmenovávat; při přejmenování tierů zvednout `SAVE_VERSION`.
- Zásah: útok² proti obraně², ohraničeno na 5–95 %. Kdo útok zahájí, dokončí ho.
  Citlivý zásah se odvozuje sám: (šance − 50 %) × 0,75, strop 40 %, poškození ×2.
- Poškození je rozsah; losuje se až po zásahu. Hráč pak uplatní resistitu podle typu
  a u fyzického poškození odečte zbroj. Minimum je 1.
- Kopírovat model přes `LoadAssetContainerAsync` + `instantiateModelsToScene`;
  ruční `clone()` rozbije kostru.
- Ladicí čísla patří do souboru tvora, ne do systému.

## Editor mapy

Otevírá se **F2**, hra pod ním běží dál (**P** pauza). Umí zóny (rostliny, objekty,
cesty, pláž, útes, most, tvorové), výšky, razítko Herní plochy a vodu; ukládá přímo
do `src/data/maps/<mapa>/map.json`. Podrobnosti v
[dokumentaci editoru](src/editor/README.md).

**Tvarování terénu:** se štětcem ze skupiny Terén nebo na záložce Výška
(`mapEditor.shapesTerrain`) se schovají všechny předměty, cesty, stíny pod keři i tráva
(`decoSystem.setHidden`, `floraSystem.setHidden`) a hra stojí jako v pauze. Terén a voda
se přepočítávají hned; přestavba předmětů se odloží (`sceneWorld.setDecorShaping`,
`decorStale`: celá přestavba, nebo jen přesazení na novou výšku) a proběhne jednou,
až se přepne na jiný štětec nebo záložku nebo se editor zavře. Data mapy se ukládají
celá vždy, odkládá se jen vykreslení.

## Tráva a podrost

Tráva jsou čtyři modely (pobřežní tráva, širokolistý trs, polštářek, kapradina)
a pod nimi koberec krátkých stébel. Štětec Tráva umí Obojí / Jen trsy / Jen koberec.
Zem i stébla počítají barvu stejným kódem, stéblo bere barvu země pod sebou. Druh
určí poloha nebo předvolba Směs uložená k buňce. Trsy se kreslí jako kopie jednoho
tvaru po čtvercích mapy. V Možnostech jde vypnout míchání tří textur země.

## Boj se zbraněmi — plán po etapách

Schváleno 13. 11. 2026. Etapy jdou dělat a zkoušet po jedné; po každé je hra hratelná.
Odškrtávají se v `TODO.md` (Tvorové a boj → Zbraně a mířené rány).

**Rozhodnuto:**
- Zbraň patří do políčka Zbraň ve výbavě (`EQUIP_SLOTS`, klíč `weapon`). Lišta rychlé
  volby (`heldItemSystem.js`) zůstává pro nástroje a spotřební věci.
- Zbraň se tasí a zandává. Útok ji tasí sám, po chvíli mimo boj se sama zandá,
  sběr ji zandá. Tasená = bojový postoj (animace `combatStance` už existuje).
- Útok míří ke kurzoru a zasáhne všechno ve výseči před postavou (dosah + úhel
  podle zbraně). Jemné přitažení míření k nepříteli do zhruba ±20°.
- O zásahu rozhoduje míření, ne kostka. `rollStrike` (útok proti obraně) dál rozhoduje,
  jak rána sedla: kritická, běžná, nebo škrábnutí (poloviční poškození).
- Mezerník zůstává volný pro pozdější úskok.

**Etapa 1 — zbraň ve výbavě, tasení a zandávání**
- Klacek dostane `slot: 'weapon'`; zbraň se bere z výbavy, ne z lišty. Útok a rána
  (`playerAttackSystem.setWeapon`) se počítají z nasazené zbraně, jen když je tasená;
  zandaná = pěsti.
- Stav tasená/zandaná drží postava; klávesa **X** ho přepíná (rozhodnuto).
  Neukládá se — po načtení je zbraň zandaná.
- Model: tasená v ruce (`handSlot`), zandaná zatím skrytá (na záda později).
- Hotovo, když: klacek jde nasadit do políčka Zbraň, klávesou se tasí a zandá,
  postava s tasenou zbraní stojí v bojovém postoji a bije klackem; zandaná bije pěstí.

**Etapa 2 — mířená rána do prostoru**
- S tasenou zbraní levé tlačítko útočí směrem ke kurzoru (bod na zemi pod ním),
  chodí se na WASD. Se zandanou zbraní levé tlačítko funguje jako dnes.
- Katalog zbraně dostane dosah a úhel výseče; pěst má vlastní malou výseč v `player.js`.
- V okamžiku dopadu rány se vyberou tvorové ve výseči (vzdálenost, úhel, výškový limit
  jako dnes v `canHit`). Zatím jen nejbližší jeden. Prázdná rána = zvuk minutí.
- Přitažení míření: nepřítel do ±20° od směru natočí ránu k sobě (navazuje na
  dnešní `assistCreatureAtPointer`).
- `rollStrike` přestane rozhodovat o minutí; výsledek je kritická / běžná / škrábnutí.
- Hotovo, když: rána jde máchnout kamkoli, trefí tvora ve výseči, mimo výseč mine,
  a „Minul“ se neukazuje, když rána geometricky sedla.

**Etapa 3 — víc cílů a těžká rána**
- Katalog zbraně: kolik cílů zasáhne (`maxTargets`) a kolik dostanou další
  (např. 60 %); těžká rána s vlastní výsečí, násobkem poškození, cenou ve výdrži
  a delším nápřahem.
- Volitelně: odhození zasaženého, rána poseká trávu a keře ve výseči.
- Hotovo, když: široká zbraň zasáhne dva tvory naráz a těžká rána je znatelně
  silnější, pomalejší a dražší.

**Etapa 4 — tvorové stejným systémem, úskok**
- Kousnutí tvora se stane výsečí před ním v okamžiku dopadu, s viditelným nápřahem;
  hráč, který z výseče uteče, není zasažen (`creatureSystem` dnes volá `rollStrike`
  pro hod na zásah — změní se stejně jako u hráče).
- Úskok na mezerník: krátký přískok, stojí výdrž, chvilka nezranitelnosti.
- Hotovo, když: útoku Koa'tiki jde uhnout pohybem i úskokem.

**Otevřené otázky (rozhodnout před danou etapou):**
- Těžká rána: podržet levé tlačítko, nebo pravé tlačítko? Pravé dnes otáčí kamerou
  (tažení) a krátkým klikem připíná tvora.
- Sekyra a krumpáč: jen nástroje, nebo i slabé zbraně, když jsou v ruce?
- Pochodeň v ruce a tasená zbraň současně (pochodeň v levé ruce)?
- Zandaná zbraň vidět na zádech / u pasu — kdy a jak.
