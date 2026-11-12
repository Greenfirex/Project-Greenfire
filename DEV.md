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
                             sceneSettings (společná čísla)
  systems/
    core/                    sim, save, input, interaction, camera, grid, navigation
    terrain/                 terrain + části (materials, bridges, caves, mass, picking,
                             settings), ladicí pohledy (terrainDebug), hmota (runVolume,
                             runBlocks), pluginy blend/relief/caustic/wet/grass, cliffSurface,
                             cliffVine
    water/                   water, waterBodies, waterFalls, waterShader, waterfallShader, waterSettings, waveSpray, fish
    flora/                   flora, grassShader, treeWind
    creatures/               creature, footprint
    player/                  player, attack, stats, heldItem, inventory
    gathering/               gather, harvest, felling
    world/                   deco, decoHighlight, campfire, loot, path
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
ukazuje statistiky odemčené počtem zabití (`bestiarySystem.js`), okno bestiáře je na B. Chybí
vypadnutí suroviny a zvuky u Koa'tiki.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů). Okno Výroba
(`craftingWindow.js`, klávesa V) je zatím jen prázdný panel.

### Co zbývá

- Objemový terén, fáze 3 a dál (viz [Terén](#terén)).
- Jeskyně: editor pater a spojů, voda po plochách, tvorové přes spoje
  (viz [Jeskyně a patra](#jeskyně-a-patra)).
- Zvuk řeky a vodopádů (viz [Plány](#plány)); k rozhodnutí suché jámy pod hladinou.
- Recepty, plnění batohu a výroba předmětů.

## Klíčová rozhodnutí (nevrátit omylem)

- Výšky jsou v metrech, krok 0,25 m, rozsah −15 až +24 m; předvolby −15, −10, −5,
  0, 5, 10, 15, 20 a 24 m (`layoutStore.js`). Krok, výška schodu a hranice útesu
  jsou tři oddělená čísla: postava i tvor vylezou schod do 0,55 m (`STEP_LIMIT`),
  hranice útesu je 2,0 m (`AUTO_CLIFF_STEP`). Přes hranu útesu se svah nepřelévá —
  kdyby některá cesta přestala být průchozí, je to tohle číslo.
- Mapa má verzi 10 (`MAP_VERSION` v `src/data/catalogs/mapFile.js`). Mapa starší
  než 10 se při načtení převede na krok 0,25 m (`quantizeMapFileHeights`).
  Hladina vody je nepovinné číslo a verzi nemění, stejně jako nepovinný seznam jezer.
- Hráčova výška se dopočítá z terénu; sav drží jen x, z a natočení.
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

**Další fáze:** 3) pohyb a dotazy na pruzích, 4) voda, tráva, dekorace a kamera na
nové dotazy, 5) editor (vykopat/vyplnit, díry, spoje), 6) nová verze mapy a savu
s migrací. Vzhled útesů řeší skalní kusy nad stejnou hmotou (viz výš).

## Jeskyně a patra

Rozhodnuto: skutečná patra v jedné mapě (ne kulisa ani samostatná mapa — ta zůstává
vhodná pro jiné vnitřky, třeba dům, přes registr `src/data/catalogs/maps.js`).

**Model sloupců:**

- Buňka může mít víc pochozích ploch nad sebou; každá má výšku a případně strop
  (`ceilY`). Strop je údaj plochy, ne dopočet z plochy nad ní.
- Číslo patra (0, −1, −2 …) je **jmenovka, ne pořadí** a nikdy se nepřečíslovává
  (rozbilo by mapy, spoje i savy). Pořadí si buňka spočítá z výšek.
- Mezi plochami se chodí **jen po spoji** (sekce `connectors` v mapě: odkud, kam,
  druh `stairs`/`ramp`/`ladder`/`shaft`/`passage`). Spoj znamená i díru ve stropě
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
samostatný mesh `_roof`), kolem otvoru se ukáže skalní lem (`terrainCaveRim`)
a skryjí se dekorace i tráva na těch buňkách. Strop je zeshora neviditelný.
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

**Zbývá:** editor pater (přepínač, štětec díry a spoje, kontroly nízkého stropu
a díry bez spoje), voda po plochách (jedna hladina dnes proteče stropem), tvorové
přes spoje (hledání cesty je 2D nad jednou plochou), štítek patra v savu u hráče,
tvorů a táboráků.

**Otevřené otázky:** zastavit pod stropem denní dobu; co se v podzemí sbírá
a jací tvorové tam žijí.

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
  níž — pod útesem — se nepočítají). Hlídání do 2 buněk stahovalo hladinu na svazích
  zbytečně hluboko; proti přetečení na svah stačí `SHORE_SPILL`. Koryto se vyhloubí jako
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
- Ryby, sprej a zvuk příboje jsou jen u moře; řeka zatím nemá vlastní zvuk.
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

Zdraví a výdrž drží `playerStatsSystem.js`, čísla jsou v `src/data/catalogs/player.js`,
proužky kreslí `src/ui/vitalsBar.js`. Výdrž ubírá běh, útok a máchnutí do stromu či
kamene; doplňuje se po prodlevě, kterou restartuje i kousnutí. Při prázdné výdrži
postava přejde do chůze a běh povolí až nad mezí — Shift je potřeba pustit
a stisknout znovu (jinak by kmitala). Útočit jde i bez výdrže.

Okno **Postava** (C) a **Inventář** (I) jdou tahat myší a pamatují si pozici. Obě
můžou být otevřená zároveň a postaví se vedle sebe.

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

**Pochodeň** je model z Meshy (`props/torch/torch.glb`). Nástroj může mít vlastní
`grip`. U pochodně (`upright`) se každý snímek po animaci předpaží paže, sevřou
prsty a pochodeň se postaví svisle s náklonem ve směru pohledu do středu pěsti
(`holdUpright`, `turnBone`, `closeFist` v `playerSystem.js`). Pojistka v `turnBone`
pozná kost, kterou animace nepřepsala, aby se otočení nesčítalo. Světlo pochodně
existuje od startu a jen se ztlumí; přidání světla by přepočítalo materiály celého
světa (bliknutí). Výměna nástroje ve stoje se odehraje sáhnutím (`toolSwapLeft`).

**Klacek** je první zbraň (`TOOL_TYPES.club`, `weapon`: poškození, prodleva, animace
úderu). Nástroj je na liště zamčený, dokud hráč jeho předmět (`item`) nemá v batohu
(`GameScene.ownsTool`); jméno a ikonu bere z předmětu. Na zemi leží osm tvarů větví
(`club_a`–`club_h`, světlé a–d, tmavé e–h, uložené naležato), v ruce je stojící větev e
(`props/club/stick.glb`). Opracovaný kyj `club.glb` čeká na výrobu.
Klacek drží úchop `fist` (`holdInFist`): prsty se sevřou (`curl`) a klacek vede středem
pěsti podél osy ruky „dopředu“ (`Forward` kosti `RightHand`, ve stoji míří ve směru
pohledu; `fist` 1 / −1 = na kterou stranu pěsti trčí). `tilt` ho nakloní ke prstům
(záporný = k zápěstí, tedy nahoru), `hold` je místo úchopu od spodního konce modelu.
Úchop se počítá vůči ruce, takže klacek jde s rukou i při úderu. `wrist` srovná zápěstí
do klidové polohy vůči předloktí (`lockWrist`), aby klacek nekroutila otevřená ruka
z animace běhu; během úderu a sbírání se zámek plynule uvolní (`WRIST_BLEND`).
Úder `chop` se přehraje celý (`STRIKE_PLAY_SHARE`), jinak se utnul uprostřed kroku
a nohy skočily do bojového postoje; zásah je ve 35 % délky. Každá animace postavy
začíná s pánví (`Hips`) v klidové poloze kostry (`settleRoot`); bojový postoj měl pánev
trvale vystrčenou do strany a při přepnutí na úder postava sklouzla. Animace
v `PLAYER_ANIM_ROOTLESS` mají pánev vodorovně přišpendlenou úplně.
Ve stoji (`idle`, `holdTool`) `relaxIdle` přitáhne obě paže k tělu a pokrčí lokty
(`IDLE_ARM_IN`, `IDLE_ELBOW`, náběh `IDLE_FADE`); pravou paži nechá, když drží svislý
nástroj (pochodeň). `updateGlance` občas otočí hlavu do strany (`LOOK_*`). Kop má
odříznuté úvodní přešlapování (`PLAYER_ANIM_RANGES.kick`), zásah je ve 30 % úderu.
Sbírání (`pickUp`) hraje z animace jen dřep k zemi (`PLAYER_ANIM_RANGES.pickup`, bez
smyčky, zbytek animace je přehrabování v dřepu), předmět se vezme na konci dřepu
a postava se narovná pomalým prolnutím do stání (`RISE_BLEND` přes `nextBlend`).
Animace sama sahá jen ke kolenům, proto `reachDown` během sbírání předkloní záda
(`REACH_BEND`) a paži i předloktí natočí k bodu na zemi kousek před rameny
(`aimBone`, `REACH_AHEAD`, `REACH_LIFT`). `turnBone` umí víc natočení jedné kosti
za snímek (sčítají se). Na začátku každého snímku `restoreBones` vrátí kosti, které
animace nepřepsala (zastavená animace), do polohy před natočením; jinak by měření
polohy ruky v `aimBone` vidělo minulé natočení a paže by kmitaly.
Po zmenšení postavy (`MODEL_HEIGHT` 2,31 → 2,0) běží chůze a běh o 15 % rychleji
(`PLAYER_ANIM_SPEEDS`), aby nohy neklouzaly.
Dokud je otevřené okno kořisti (truhla, mrtvý tvor), drží `sceneGathering` postavu
v dřepu (`playerSystem.kneeling`); pohyb klávesami dřep zruší a okno se pak zavře
vzdáleností jako dřív.
Okno kořisti (truhla, kostlivec, mrtvý tvor) se otevírá vždy stejně: postava dojde
krokem k věci (`playerSystem.walkTo`, ruší se pohybem klávesami), dřepne si a ruce
natáhne k ní (`playerSystem.reachTarget`, záda se jen mírně narovnají,
`REACH_LID_BEND`). Truhla s víkem si při stavbě spočítá čelo (`lootSystem.shapeOf`: víko
má pant vzadu, čelo je místní +Z rodiče víka), takže se jde vždy před víko
(`standSpot`) a sahá na jeho přední hranu (`reachPoint`). Kostlivec a tvor čelo nemají:
postava dojde ze strany, odkud přichází (`standSpot`, `approachLoot`), a sahá na střed.
Dokud je okno otevřené, ruce se přehrabují (`rummageOffset`, `RUMMAGE_*`).
V dřepu se viditelné tělo přisune k cíli až o `LOOT_LEAN` (posouvá se jen `rig`, kořen
postavy a kolize zůstávají), ruce u truhly míří kousek dovnitř (`REACH_INSIDE`).
Po zavření okna se truhla, ve které něco zůstalo, zaklapne (`lootSystem.shut`, víko jde
k `goal`); prázdná zůstane otevřená. Po načtení hry je víko podle toho, jestli je truhla
prázdná (`settle`). Dokud je truhla otevřená v okně, nápověda „otevřít“ se neukazuje.
Chůze k věci skončí i tehdy, když se postava přestane přibližovat (`AUTO_WALK_STUCK`).
Překážka dekorace (`deriveBlocked`) stojí i s posunem `backToEdge`, jinak by kruh
truhly ležel před ní a postava by k ní nedošla. Náhodné rozházení (`jitter`) do
překážky nepatří.
`animLength` vrací skutečnou délku úseku při rychlosti animace (`getLength` už
rychlost započítává). Chop (`0.74`), mine (`0.41`), zapálení (`IGNITE_PLAY`) a ucuknutí
(`FLINCH_PLAY`) trvají stejně jako před opravou; pěst a kop se přehrají celé (vejdou se
do prodlevy úderu holou rukou 1 s). Údery se hrají jednou, ne ve smyčce: pauza
`STRIKE_HOLD` po konci animace by jinak pustila úder znovu od začátku. Ladí se ve
fotoateliéru: `node tools/capture.cjs player strike --tool club --view side2`.
Údery bez zbraně střídají pěst a kop, se zbraní se máchá jako sekyrou.

Modely z Meshy se před vložením zmenšují (textury WebP 1024, nekovový materiál);
nahraný model ztratí posun svých dílů, proto pohyblivé díly (víko truhly) mají osu
otáčení spočítanou až ve hře z tvaru dílu.

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
- `maxStepHeight` = jaký schod tvor zvládne (útes nepřeleze), `attackHeight` = jak
  vysoko dosáhne útokem, `noticeHeight` = z jaké výšky si hráče ještě všimne.
- Zásah: útok² proti obraně², ohraničeno na 5–95 %. Kdo útok zahájí, dokončí ho.
  Citlivý zásah se odvozuje sám: (šance − 50 %) × 0,75, strop 40 %, poškození ×2.
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

## Plány

Nic z toho není rozhodnuté.

**Suché jámy pod hladinou** (lom, proláklina pod úrovní moře). Dnes nejdou, protože
voda je všude, kde je terén pod hladinou (`waterSystem.depthAt`). Doporučená cesta:
v `depthMapFor` šířit „mokré" buňky od okraje mapy a ohrazené jámy prohlásit za
suché — bez nových dat. Ruční zóna Suchá jen kdyby bylo potřeba. Potřeba je maska
ve shaderu, stěna na okraji jámy a vypnout v ní příboj, kaustiku a ryby.

**Zvuk tekoucí vody.** Řeka ani vodopád zatím nemají zvuk — potřeba je zvukový soubor
šumění (řeka) a hukotu (vodopád), hlasitost podle vzdálenosti jako u příboje.

**Boj** (inspirace Rage of Mages): barva tvora znamená druh a sílu, takže se hráč
na první pohled rozhodne; silnější varianta = stejný model, jiná barva a čísla.
Široká rána (cleave) těžkou zbraní zasáhne víc cílů v kuželu; parametry patří ke zbrani.

**Vzhled:** kontaktní stíny pod objekty (musí kopírovat svah), mech a lišejník na
kamenech, jednodušší vzdálené stromy, rostliny u břehu, zatopené kameny, odraz
oblohy, počasí.
