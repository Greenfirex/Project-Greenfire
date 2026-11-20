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
    creatures/               creature, footprint, sandBurst, bestiary, crab
    player/                  player, attack, stats, heldItem, inventory, equipment, portrait
    gathering/               gather, harvest, felling
    world/                   deco, decoHighlight, campfire, loot, path, reveal, sight
    atmosphere/              dayNight, lighting (světla a stíny), sky, audio
    materials/               modelRim, floraColor, nightLight a další (pluginy materiálů)
  editor/                    editor mapy (editorMode + části history, layoutEdits, heights,
                             area, joinBridge, brushApply, query, settings), panely, štětce
  data/catalogs/             předměty, dekorace, mapy, tvorové, uložený stav
  data/maps/                 tvar oblasti, nastavení výšek a soubor mapy
  effects/                   oheň (táborák, pochodeň), výseč rány, vítr za zbraní
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
dohled, a po ztrátě hráče jdou na místo, kde ho viděli naposledy. Panel tvora (vpravo
uprostřed, hodiny jsou vpravo nahoře) ukazuje statistiky odemčené počtem zabití
(`bestiarySystem.js`, prahy `UNLOCKS`): životy, útok, obranu, poškození, zbroj, odolnosti,
dohled a rychlost. Pro ladění je zatím odemčené všechno (`SHOW_ALL_STATS`). Okno bestiáře
je na B. Panel se připíná prostředním klikem (bez tažení; tažení otáčí kamerou). Bez
připnutí ho v boji ukazuje `refreshCombatFocus`: tvor naposledy zasažený (`onStruck`,
nejbližší z rány), jinak nejbližší útočící; 3 s po boji (`FOCUS_LINGER`) nebo po smrti zmizí.
Zavřený panel se k témuž tvorovi nevrátí, dokud se boj nezmění (`mutedFocus`). Tvorové i hráč se léčí pořád, i v boji a bez ohledu
na zásahy (`regenerate` a `regenPerSecond` u druhu tvora; hráč 0,2 života za sekundu
v `PLAYER_BASE`). Tvorové mají zbroj a odolnosti jako hráč (`armor`, `resistances` u druhu nebo
stáří, zatím všude nula); hráčova rána je odečítá stejným výpočtem (`mitigateDamage`
v `damage.js`). Při najetí na tvora ukazuje nápověda u kurzoru šanci na plný zásah
a na škrábnutí (`strikeChances` v `combatRoll.js`, zbytek do sta je minutí).

Výroba: recept (`RECIPES` v seznamu předmětů) drží jen cenu; jeho klíč je klíč vyráběného
předmětu, název a ikona se berou z předmětu. Okno Výroba (`craftingWindow.js`, klávesa V)
ukazuje seznam receptů a tlačítko Vyrobit, co jde vyrobit z batohu, počítá a vyrábí
`sceneCrafting.js` (`inventorySystem.craft`). Vyrábí se kdekoli, výbava na postavě se
do ceny nepočítá. Okno Deník (`journalWindow.js`, klávesa J) je zatím prázdný panel.
Rozpracované a plánované věci jsou v `TODO.md`.

Dolní lišta (`src/ui/dock.js`, `dockArea`) má tři části: vlevo nápověda myši
(`mouseHint.js`; co udělá levé, pravé a prostřední tlačítko a klávesy, plní ji
`refreshMouseHint` ve scéně podle toho, na co se míří, `pointerAction`), uprostřed
ukazatele zdraví a výdrže nad lištou nástrojů a vpravo malá tlačítka oken
(`DockButton` s písmenem klávesy; skládají se do dvou řad a další přibývají doprava).

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

- **Reliéf povrchu** (`terrainReliefPlugin.js`) čte normálové mapy ve formátu GL
  (zelená = +V) s texturou načtenou standardně (`invertY`), takže bitangenta míří
  k +Z (`cross(tangent, n)`). Natočení vrstvy (`angle`) se musí otočit i ve sklonech
  z mapy, jinak stín nesedí na tvar. Do 17. 11. 2026 byla osa Z obrácená a vlnky
  písku vypadaly dopoledne ploše. `cavity` v nastavení povrchu ztmaví boky nerovností
  přímo v barvě, aby byly vidět i při slunci shora (zatím jen písek).
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
  (`addShelfGrass`) i liany (`CliffVineSystem`, modely `cliff_vine.glb` a
  `cliff_vine_2.glb`, zkrácené podle výšky stěny, pod 0,6 m se nedávají). Liany
  visí z horní hrany, z poliček (`terraceAnchors` z `cliffDressSystem`) a po 3–5
  nad každým vchodem do jeskyně (visí z překladu do otvoru, před kameny rámu); staví se v `refreshCaveLighting` až po kamenech.
  Houpou se přes `TreeWindPlugin` s volbou `hangFrom` (pevné nahoře, kmitá spodek).
- **Skalní kusy na útesech** (`terrain/cliffDressSystem.js`): stěna se nemění, jen
  se obalí překrývajícími se kameny (kamenné útesy, recepty `cliff_stone_*` v `rocks.js`)
  nebo hroudami (hliněné, recepty `cliff_clod_*`). Stejné kameny tvoří obklad v jeskyních.
  Mají texturu stěny, mech na vršcích přidává `cliffMossPlugin.js`. Modely `cliff_stone_*`
  z tmavé sady vypadaly na stěně hůř, proto se obklad vrátil k receptům (modely jsou teď tmavé
  volné kameny). Kameny rámů jeskyní jsou
  modely `boulder_*`; tvar mají z modelu, barvu, texturu a světlo stejné jako stěna
  (`cliffStonePlugin.js`, textura promítnutá podle polohy ve světě). Rámy navíc dostanou
  reliéf stěny (její mapa nerovností promítnutá ze tří stran) a kolísání odstínu jako
  stěna (`wallTint` v `terrainMass.js`), aby splynuly se skálou; obklad útesů ne. Obklad stíny nevrhá, jen přijímá. Pod kusy zůstává celá stěna, takže
  nevznikají díry. Seznam stran dává `terrainMass.cliffFaces()`; strana nad vchodem
  dostane jen řadu nad otvorem. Kusy u volného konce stěny se zúží a přitisknou, na
  vnějším rohu stojí menší zapuštěný kus (jinak převisy). Horní řada má občas mech
  (v `cliffStonePlugin.js`, vršek zezelená celý, boky v ostrůvcích ze šumu, spodek ne). Občas je ve stěně
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
  průchozí díra. Zem venku se nemění; podlaha jeskyně se k ní na prahu přimkne
  v každém bodě a rozdíl se rozlije do půl buňky dovnitř a do boků až o půl buňky
  za ostění (`setDoorBlends` v `terrainField.js`). Úprava závisí jen na poloze, ne na
  buňce, takže mezi buňkou vchodu a sousedy nevznikne škvíra. Každá plocha se jinak
  vyhlazuje jen podle svých buněk; dřív tak na prahu vznikal zub a u ostění škvíra.
- Otvor vchodu je užší a nižší než díra ve skále: kameny rámu (`caveFrameSystem.js`)
  ho zúží na `DOOR_OPEN_HALF` od středu a sníží na `DOOR_OPEN_HEIGHT` nad podlahou
  (`areaShape.js`). Chůze to hlídá stejně: v pásu `DOOR_FRAME_DEPTH` kolem prahu je
  pochozí jen střed do `DOOR_WALK_HALF` (`navigationSystem.inDoorFrame`), jinak by
  postava procházela kameny. Kameny rámu vrhají stín (bez nich svítil dovnitř pravoúhlý
  stín díry ve skále). Horní část otvoru tvoří oblouk z menších kamenů (půlkruh o poloměru půlky otvoru), aby nebyl hranatý;
  sedí nad výškou postavy.
- Kameny rámu jsou zapuštěné do skály: přední hrana každého končí `CLIFF_STONE_MAX_OUT`
  před stěnou, stejně daleko jako obklad útesu, zbytek kamene je ve skále.
- Hlína nebo kámen rámu: podle útesu nad jeskyní a vedle vchodu (`cliffStyleAt`),
  v editoru jde přepsat kliknutím na vchod (Patra, povrch). Volba se ukládá jako
  `frameStyle` u buňky jeskyně za vchodem (`doorFrameStyleOf` v `areaShape.js`).

**Hotovo:** data a dotazy, geometrie (podlahy, stropy, stěny, šachty, vchody),
pohyb hráče po patrech i přes spoj, tma v jeskyni a jeskynní zvuk. Jeskyně nemá
vlastní světlo (svítí jen slunce a obloha vchodem, táborák a pochodeň; pochodeň i táborák
svítí v podzemí naplno jako v noci). Slunce i obloha se v materiálu tlumí podle mapy vchodů
stejně (`revealPlugin.js`, `CUSTOM_LIGHT{X}_COLOR` pro směrové a polokulové světlo), takže na
prahu svítí jako venku a asi 3 buňky dovnitř plynule slábnou; dřív obloha do jeskyně
nesvítila vůbec a na prahu byl skok v jasu. Pozor: Babylon v kódu vkládaném přes regulární výraz
doplní každé `$1`, `$2` … jen jednou, proto má vzor tolik závorek, kolikrát se číslo světla použije. Zvláštní přisvícení podlahy
od vchodu (světlo oblohy) bylo zrušené, dělalo za prahem ostře světlejší pruh. Stěny a strop jeskyně vrhají stín od slunce i táboráku; do map
stínů (i do mapy dohledu) se skála kreslí z obou stran (`utils/bothSidesMaterial.js`),
jinak by ji některé strany krychle i slunce viděly odvrácenou stranou a světlo by
prošlo. Skála (`metadata.volume`) se do stínu slunce kreslí bez posunu podél normály
(`lightingSystem.keepRockWhole`): posun odsune každou plochu jinam a na hranách stropu
a stěn otevře škvíru, kterou občas prosvítí čára světla (bliká s pohybem kamery).
Ostatní vrhače (stromy, modely, mosty) posun dál mají.
Schod ve stropě mezi dvěma buňkami jeskyně má svou svislou stěnku (`runVolume.js`, druh
`ceilingStep`, bez přesahu dolů); vynechává se jen schod v podlaze, kterou vyhladí povrch.
Stěnka je ve vrstvě `SHADOW_ONLY_LAYER` (`terrainSettings.js`): kamera ji nekreslí (strop je
taky schovaný), stín slunce, táboráku i dohled ji mají. Dřív chyběla
i u stropu a čtvrtmetrovou škvírou svítilo slunce na podlahu pravoúhlou čarou po obvodu buněk. Modely v podzemí (postava, tvorové a dekorace v patře pod 0) tlumí slunce a oblohu stejně
jako terén jeskyně (`revealUnder`, seznam drží `GameScene.updateUndergroundMeshes`). Když je
hráč pod stropem, schovají se přesně stropní dlaždice nad jeskyní (`overCave`,
samostatný mesh `_roof`) a skryjí se dekorace i tráva na těch buňkách. Strop je zeshora neviditelný.
Terén výš než podlaha, na které hráč stojí, zmizí v celém rozsahu stejně jako
v editoru pater (`revealColumn`), nezávisle na natočení kamery. Výjimka je zem venku
osvětlená vchodem (`caveLightMap`): ta se ve hře řeže až nad výškou očí postavy, jinak
by zmizela i zem za prahem, která je jen o kousek výš než podlaha jeskyně. Co z okolí je
vidět, řeší dohled postavy (níž); bez dohledu (editor pater) zůstává
jen osvětlené okolí vchodu podle mapy `caveLightMap` a tma od 8–14 m.

**Světla ohně** (`atmosphere/fireLightSystem.js`): pochodeň, táboráky i lucerny jsou jen zdroje (`source`:
poloha, barva, síla, dosah, `shadow` none/prefer/need, patro, `refresh`, `dirty`, vlastní meshe `own`);
skutečná světla jsou dvě a každý snímek (`GameScene.fireFocus` = postava, v editoru střed kamery) dostanou
nejbližší hořící zdroje v dosahu a ve stejném patře: první se stínem (nejbližší táborák nebo lucerna), druhé
bez stínu (pochodeň, jinak další táborák; lucerna bez stínu ne, svítila by skrz stěny). Přechod mezi zdroji
je plynulý (0,25 s). Obloha + slunce + 2 = 4 světla = výchozí strop materiálu, takže nic nevypadne a zdrojů
může být libovolně. Přidat nebo ubrat světlo by přepočítalo všechny materiály, proto světla existují
pořád a zdroje jen mění sílu. Stín (krychlová mapa 512) vrhají boky, stěny a stropy terénu (`metadata.volume`,
ploché podlahy ne, jinak pruhy pod ostrým úhlem) a díly staveb v dosahu (`GameScene.fireCastersNear`, bez `own`);
při jeho kreslení se na okamžik zapnou i schované díly staveb. Překreslí se při přeskoku na jiný zdroj,
u táboráku jednou za 1,5 s (`refresh`) a když zdroj hlásí `dirty` (lucerna při pohybu dveří).
Zdroje ohlásí vlastníci přes `onLightSource` (táboráky, stavba, postava při první pochodni).
Pochodeň svítí ve dne slabě, v noci naplno; v jeskyni a uvnitř stavby (`torchFire.setIndoors`, z `GameScene.updateIndoor`)
naplno i ve dne, aby uvnitř dosvítila stíny od lucerny.
Blikání všech tří zdrojů je plynulé (`utils/flicker.js`: síla se přelévá k náhodné hodnotě, ne skokem), jinak se
pochodeň a lucerna přes sebe trhaně přeblikávaly. Zdroj může mít `darkness` (jak moc stín propouští, 0 = černý):
lucerna 0,5 (`shadowDarkness` ve stylu) jako odraz od dřevěných stěn, táborák venku 0. Materiály země jsou blízko limitu 16 textur, proto je
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
- Model na vyšší zemi venku zešedne jen v místech, kam čáru od očí zakrývá skála
  (`revealSightBlocked` pro bod modelu). Kmen palmy pod hranou útesu je v oparu,
  koruna nad hranou je vidět. Zem na vyšší zemi se řídí dál jen výškou.

**Průhled ke kameře** (`revealPeekAt` v `utils/revealGlsl.js`, stav v `revealSystem.setPeek`, zapíná
`GameScene.updateReveal` jen na povrchu a mimo editor, náběh 0,3 s). Od kamery k hrudi postavy vede trubka
o poloměru 2,2 m (`PEEK_RADIUS`, měkký okraj od 55 %). Co v ní leží aspoň 0,6 m před postavou a výš než
0,3–0,7 m nad jejíma nohama, se rozptýleně vyřízne (`discard` se zrnem jako rentgen). Platí pro terén,
rámy vchodů, modely kromě tvorů (`REVEAL_PEEK` v `revealPlugin.js`) a pro trávu a vodu (výchozí `peek`
v `revealBlock`). Jeskynní materiály, značky a pozadí se nevyřezávají. Čísla trubky jsou jednou v `PEEK`
(`revealGlsl.js`); stejný výpočet v JS (`peekAmount`, `revealSystem.peekAt`) používá myš: paprsek
(`inputSystem.surfacePoint`, `seesThrough`) ignoruje zem, která je z poloviny a víc vyříznutá, a jde skrz
díru na okolí postavy. Terén je jen slupka (pod vrškem útesu nic není), proto `revealSystem.updateCap` kreslí
ve výšce spodku řezu (nohy + `PEEK.feetFrom`) ztmavené kamenné dno s texturou skály útesů
(`CLIFF_TEXTURE`, `CLIFF_NORMAL` v `assetPaths.js`, sdílí je s materiály terénu, opakování po 2 m): mřížka 0,2 m v okruhu 5 m kolem postavy,
jen tam, kde je terén (`GameScene.rockHeightAt`) nad touto výškou a buňka nemá jeskyni (`navigation.hasCaveAt`
— nad jeskyní je terén vysoko, ale uvnitř je dutý); přestaví se po posunu o 0,25 m. Dno má vlastní druh
materiálu (`peekCap`) a kreslí se jen tam, kde pohled na něj vede dírou: bod na spojnici s kamerou ve výšce
nohy + `PEEK.behind` musí být vyříznutý (`revealPeekBehind`), jinak by dno vykukovalo pod stěnami. Rub útesu kreslit
nejde — všechno, co je dírou vidět, leží v trubce a vyřízlo by se.
- Volba Ostrost dohledu: jednoduchá (mapa 256) / plná (512). Vypnout dohled ve hře
  nejde, protože bez něj je vidět skrz skálu (tvorové, tma v jeskyni, zvýraznění).

**Prstenec skály při řezu** (`runVolume.js`, kind `ringWall`/`ringCap`): kolem jeskyně
se kreslí jedno políčko skály (i po úhlopříčce) od podlahy do výšky řezu
(`REVEAL_CUT_ABOVE_FLOOR`); poklička kopíruje terén a v řezu se usekne, boky se zaoblí
jako útesy. Je vidět jen při otevřeném řezu, nevrhá stín, neblokuje dohled
a dohled ho neztmavuje. Část, za kterou z pohledu kamery leží jeskyně, se schová
(`revealCaveAhead`). Buňka hned za vchodem prstenec nedostane (není to skála).
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
- **Ryby** jsou modely z Meshy (`public/assets/fish/<druh>/`, textura 512 WebP), otočené
  hlavou k +X a sjednocené na 1 m. Hejno z jedné šablony kreslí thin instances, takže
  drží pohromadě i při stovkách kusů; ocas vlnit `FishWigglePlugin` ve shaderu, žádná
  kostra se neanimuje. Modely se načítají při startu (`collectStartupUrls`).
- **Krabi** jsou jen ozdoba, nic se o nich neukládá do savu. Jeden model z Meshy
  (`public/assets/nature/crab/`, klepety k +Z, šířka 1 m, nohy na nule), všichni krabi
  jsou thin instances jedné šablony. Nohy a klepeta hýbe `CrabLegsPlugin` ve shaderu
  podle čtyř čísel na kraba (`crabPose`: fáze kroku, síla chůze, zvednutí klepet,
  vlastní posun). Oblasti modelu (tělo do |x| 0,2, klepeta vpředu od z 0,11 a pod
  y 0,16 kvůli očím na stopkách) jsou vyměřené pro tento model; nový model je potřeba
  vyměřit znovu. Krabi se objeví sami na suchém písku do `beachReach` buněk od moře
  (podíl `beachShare` v `crabs.js`) a navíc tam, kde je položí štětec Krabi
  (`layout.crabs`). Běhají bokem kolem svého místa, před hráčem utečou a na písku se
  zahrabou (rozstřik přes `sandBursts`), jinde zvednou klepeta. Velikost se losuje
  mezi `sizeMin` a `sizeMax`, malých je víc. Barva je v textuře ztlumená (`tools/prepareCrab.mjs`).
  Kraba pod myší hledá `crabSystem.hoverAt` podle vzdálenosti na obrazovce (thin instances
  nejdou rozumně pickovat a krab je malý), v pořadí až po tvorech a mrtvých tělech.
  Vybraný krab se v hromadném bufferu schová a kreslí ho samostatný mesh s jednou instancí
  a zeleným obrysem (`OUTLINE_CALM`, stejný jako klidný tvor); popisek jde do `tooltipPanel`.
  Tento mesh musí mít vlastní geometrii (`makeGeometryUnique`), protože buffery thin
  instances leží v geometrii a sdílená by přepsala buffery všech krabů. Dál než 45 m od hráče stojí.
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
Bojové animace leží v `castaway_combat.glb` a `castaway_double.glb` (`PLAYER_ANIMS`).
`castaway_combat.glb` je stejná postava stažená z Meshy v pojmenování „mixamo“ (kosti `mixamorig:…`). Kostra je jinak totožná, takže se animace
přenášejí podle pořadí kostí (`sameBoneNodes`), ne podle jmen. Další animační soubor stejné
postavy stačí přidat do `PLAYER_ANIMS`. Z jedné animace jde vzít jen úsek
(`PLAYER_ANIM_RANGES`); bojové animace se přehrávají na místě (`PLAYER_ANIM_ROOTLESS`).
Násada vede pěstí podél řady kloubů od malíčku k ukazováčku (`gripAxis`,
`PLAYER_GRIP_LINE_BONES`), takže z pěsti vychází jen jedním směrem; klacek je posunutý
od středu pěsti kus k palci (`grip.toThumb`, jako u pochodně), aby seděl v dlani, ne u konečků prstů. Úchop se ladí jen v bojovém postoji
(`guard` u zbraně); během rány se zápěstí zamkne v natočení z postoje (`guardWrist`,
`holdSwingWrist`, náběh 0,1 s), takže klacek se hýbe jen s předloktím a animace ho nekroutí.
Bez předchozího postoje se zamkne do klidové polohy ruky. U ran z `PLAYER_ANIM_SWING_ALONG` (vodorovný
sek `slash`) se zápěstí během rány narovná a klacek míří víc v linii předloktí
(`alignSwing`), jinak by při vodorovném máchnutí trčel nahoru. Rána s `pitch` (silná `smash`)
vede klacek místo podle předloktí po oblouku v rovině těla: od úhlu `pitch[0]` (stupně, 0 = dopředu,
90 = nahoru, 180 = dozadu) k `pitch[1]` během okna `from`–`full` (`bodyPitch`); `grab` je část okna,
za kterou se klacek do oblouku chytí, `limit` povolí větší otočení zápěstí. Bez toho trčel klacek po
úderu za záda, a když mířil rovnou dopředu, předběhl ruce a mezi dvěma snímky se přetočil o půl kruhu. Po konci rány srovnání dobíhá spolu se zápěstím (`swingHold`), jinak klacek v prvním snímku postoje cukl. Narovnání najíždí až od vrcholu
nápřahu (`from`/`full` jako podíl rány) a otočení zápěstí je omezené (`SWING_TURN_LIMIT`):
na začátku seku míří předloktí dolů a klacek nahoru, takže by se ruka přetočila naruby. Prsty pravé ruky se ohýbají
opačným směrem než levé (`RIGHT_CURL_SIGN` = −1, kostra je zrcadlená); s +1 se prsty ohýbaly
dozadu a ruka s klackem vypadala otevřeně. Zkoušené a vrácené (16. 11. 2026):
klacek obrácený v pěsti a klacek ve směru paže; oba při nápřahu mířily dolů nebo k tělu. Zkoušené a vyřazené (16. 11. 2026): `Charged_Axe_Chop` (úder trvá jediný snímek, nemá
švih), `Axe_Spin_Attack` (chaotická otočka), `Thrust_Slash` (postava skončí bokem k cíli),
`Roll_Dodge_1` (skok šipkou místo převalu).

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

**Vybavení:** předmět s `slot` se přetáhne z batohu
na slot v okně postavy, zpět ho sundá přetažení do batohu (`dragTypes.js`). Co má
hráč na sobě drží `equipmentSystem.js` (ukládá se), propojení dělá
`sceneEquipment.js`, model na postavě `playerWear.js` (část `playerSystem`). Model na hlavě
(`wear.model`) sedí na uzlu odvozeném z kostí `Head`, `head_end` a `headfront`; velikost,
výška, posun vpřed a natočení jsou v `wear` u předmětu. Oblečení s `wear.fitted`
(pirátský kabát, kalhoty, boty v `public/assets/characters/castaway/outfit/`) je
přizpůsobené postavě a napojené na její kostru už v Blenderu; ve hře se jeho kosti
přečíslují podle jmen na kostru postavy a ohýbá se s ní. Patří jen k modelu Castaway:
nová postava = oblečení znovu napasovat. `wear.hipGap` a `wear.hipTilt` odsunou
a vykloní zbraň zandanou na boku (v šířkách boků), aby do ní oblečení nelezlo; sčítají se
přes všechno nasazené. Rukavice zatím nejsou (rovné prsty z Meshy
nesedí na pokrčenou ruku).
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
- Šavle (`TOOL_TYPES.saber`, sečná) a kopí (`TOOL_TYPES.spear`, bodné, dlouhý dosah a úzká
  výseč) drží stejný úchop `fist` jako klacek. Modely z Meshy jsou při vložení narovnané:
  zbraň stojí podél osy Y, konec rukojeti je v nule a délka je 1, takže `hold` je podíl
  délky a velikost v ruce určuje jen `grip.scale`. Kopí má ztenčenou násadu (Meshy ho
  udělal moc tlusté). `grip.edge` je směr ostří v modelu: v ruce se zbraň kolem své osy
  natočí ostřím ke kloubům prstů (`rollEdgeToward`), u boku podle `sheath.edge` dopředu (1)
  nebo dozadu (−1), aby čepel ležela naplocho podél stehna. Bez `edge` se zbraň nenatáčí.
  Kopí bodá začátkem animace `Thrust_Slash` (`thrust`, 0–1 s: natažení volné ruky je
  nápřah, výpad zbraní přijde kolem 0,85 s; dál pokračuje otočkou). Animace je dělaná pro
  meč, při výpadu by kopí mířilo do strany, proto ho `PLAYER_ANIM_SWING_ALONG.thrust`
  srovná s předloktím. Výpad je v `PLAYER_ANIM_PLANTED` (`plantLegs`): pánev se neposune
  do strany ani dopředu (jen klesá a stoupá), otočí se o podíl `hips` (0,5) původního otočení
  a zbytek dotočí spodní páteř; nohy se hýbou podílem `legs` (0,5) původního pohybu, měřeno
  od první pozice výřezu. Postava nevykročí, ale kolena a váha pracují.
  Přenést do páteře celé otočení nejde (trup se zalomí), odebrat ho úplně taky ne (trup
  zůstane bokem a kopí bodá do strany); samotné přišpendlení pánve (`PLAYER_ANIM_ROOTLESS`)
  nechá nohy klouzat. Sekundární rána kopí je otočka dokola (`spin`, animace
  `Axe_Spin_Attack`, výseč 360°, pánev přišpendlená přes `PLAYER_ANIM_ROOTLESS`).
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
(`rummageOffset`). Tělo se k truhle nepřisouvá (dřívější posun modelu vypadal jako sklouznutí).
Pohyb klávesami dřep zruší. Truhla si spočítá čelo (`lootSystem.shapeOf`), jde se vždy
před víko (`standSpot`) a sahá kousek dovnitř (`reachPoint`, `REACH_INSIDE`); kostlivec
a tvor čelo nemají. Truhla, ve které něco zůstalo, se po zavření zaklapne, prázdná
zůstane otevřená (`settle` po načtení). Překážka truhly (`deriveBlocked`) stojí
i s posunem `backToEdge`, jinak by k ní postava nedošla.

Modely z Meshy se před vložením zmenšují (textury WebP 1024, nekovový materiál);
pandánům se listí posunulo do teplé žlutozelené přímo v textuře (Meshy dává studenou modrozelenou);
hustý keř z Meshy vyšel uvnitř i z boku skoro černý, proto je ibišek procedurální
(textura se dvěma větvičkami, `sprigs` v receptu určuje, kolik karet nese květ);
nahraný model ztratí posun svých dílů, proto pohyblivé díly (víko truhly) mají osu
otáčení spočítanou až ve hře z tvaru dílu.

**Volné kameny** (`rock_small`, `rock_small_flat`, `rock_large`, `rock_large_c`, `rock_tall`,
`rock_jagged`, `rock_pair`, `rock_pebbles`) jsou modely z jedné sady z Meshy
(`public/assets/nature/rocks/`). Sadu rozřeže a poskládá `tools/prepareRocks.mjs`
s `bl_rocks.py` (slepení bodů na švech textury, rozdělení na oddělené kusy, zjednodušení,
složené kameny z několika kusů). Kameny jsou `.gltf` se společnou texturou sady
(`rocks_light_*.webp`, `rocks_dark_*.webp`), aby ji hra načetla jen jednou. V katalogu mají
`stone: true` (náhodné natočení a velikost jako u kamenů z receptů). Světlá sada dává volné
kameny a světlé sesuvy pod útesy, tmavá sada tmavé sesuvy, tmavé volné kameny `rock_dark_*`
(modely `cliff_stone_*`, dřív obklad útesů) a kameny `boulder_*` pro rámy jeskyní a táborák. Kameny, které dřív stavěl recept, mají rozměry
z uložených receptů (`tools/rock_recipes.json`) a kusy sady se na ně natáhnou.
Rámy a táborák kameny potřebují hned, proto jsou v `ROCK_MODELS` (`rocks.js`),
načítají se při startu hry a `rockRoot` (`rockFactory.js`) je bere z načtených modelů.
Kameny rámů jeskyní mají texturu stěny, ve které je vchod (hlína nebo skála). Recepty zbývají
pro obklad kamenných útesů a jeskyní, hroudy hlíny a černé sesuvy (čekají na své sady).
Štětec Kameny má skupiny Všechny, Světlé a Tmavé (`poolByStyle`). S volbou `randomInStyle`
střídá náhoda tvary jen ve vybrané skupině a výběr jednoho tvaru nabízí tvary té skupiny.

Mušle jsou dva modely (`shell_fan`, `shell_conch`) v `public/assets/nature/shells/`;
oba se pokládají naplocho a sbírají se jako stejný předmět `shell`. Hvězdice
(`starfish`) leží na dně v hloubce 0,5–4 m; štětec je pouští jen pod vodu.

Hnízdo Koa'tiki (`koa_nest`, `public/assets/nature/koa_nest/`) je dekorace s nastavením
`nest` v katalogu dekorací (druh vejce, počet, kdo ho hlídá a na jakou vzdálenost).
Štětec Hnízdo Koa'tiki k němu do stejné buňky položí vejce (`koa_egg`, sbírá se rukou)
s posunem v buňce (`dropNestEggs`). Sebrané věci se proto v `harvestSystem` rozlišují
i podle posunu v buňce, ne jen podle buňky a druhu. Scéna předá hnízda tvorům
(`nestSpots` → `creatureSystem.setNests`) při stavbě tvorů a po přestavbě dekorací.
Tvor hlídá nejbližší hnízdo svého druhu do `guardLink` od svého domova. Samotné
přiblížení k hnízdu nic nespustí; až krádež vejce (`provoke`) pošle hlídače hned do útoku
a na `provokeSeconds` jim prodlouží dosah zpozornění až k hráči.
Kdo které hnízdo hlídá, počítá jedno pravidlo v `src/utils/nestGuard.js` (`nestSpots`,
`guardedNest`) pro hru i editor. Editor při štětci na tvory nebo na hnízdo kreslí
v `creatureOverlay.showNests` kruh `guardLink` kolem hnízda (zlatý, bez hlídačů červený)
a spojnice k živým hlídačům (podle `creatureStatusAt`); k mrtvému hlídači vede slabší
spojnice na místo, kde se znovu objeví.
Hnízdo bylo z Meshy zjednodušené v Blenderu (`tools/bl_decimate.py`), protože
meshoptimizer se na samostatných větvičkách zastavil kolem 10 000 trojúhelníků.

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

**Tvarování terénu:** se štětcem ze skupiny Terén nebo na záložkách Výška, Plocha
a Patra (kopání a zasypávání; `mapEditor.shapesTerrain`, `SHAPING_MODES`) se schovají všechny předměty, cesty, stíny pod keři i tráva
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

Barvy stromů a keřů drží `src/data/catalogs/floraColor.js`. `FLORA_GRADE` (jas,
teplota, sytost) dolaďuje všechny rostliny najednou; `MODEL_COLORS` srovnává listí
každého modelu z Meshy na společnou žlutozelenou (mezi palmou a banánovníkem).
Procedurální keře a listnáče se na stejnou barvu srovnávají svými odstíny v katalogu.
Obojí provádí `FloraColorPlugin`; listí pozná podle toho, že je zelenější než okolí.
Tráva má vlastní barvení podle země; trsy se na společnou zelenou (o kousek světlejší
než koberec stébel) srovnávají svým `tint` v `grass.js`, pobřežní tráva je o něco sušší.

Modely z Meshy mají fyzikální materiál (PBRMaterial), který počítá světlo lineárně
a slabé světlo pak při převodu na obrazovku zesílí; terén (StandardMaterial) ne.
Bez korekce by v noci modely „svítily“. `materials/nightLightPlugin.js` se přes
`RegisterMaterialPlugin` sám přidá ke každému PBR materiálu a v noci ztlumí slabé
světlo křivkou `NIGHT_CURVE` (1,2 = přesná shoda s terénem, nechává se mírnější 0,7).
Sílu noci a denní úroveň světla mu posílá `refreshAmbient` přes `setNightLight`.

## Boj se zbraněmi — plán po etapách

Schváleno 13. 11. 2026. Etapy jdou dělat a zkoušet po jedné; po každé je hra hratelná.
Odškrtávají se v `TODO.md` (Tvorové a boj → Zbraně a mířené rány).

**Stav (16. 11. 2026):** etapy 1, 1b a 2 hotové a vyzkoušené, etapy 3 a 4 napsané a čekají
na vyzkoušení ve hře. Úskok je kotoul (`Roll_Dodge_2`), rány klackem mají vlastní animace
z `castaway_combat.glb` (16. 11. 2026, čeká na vyzkoušení).
Sekyra a krumpáč jako zbraně odloženy na později.

**Rozhodnuto:**
- Zbraň patří do políčka Zbraň ve výbavě (`EQUIP_SLOTS`, klíč `weapon`). Lišta rychlé
  volby (`heldItemSystem.js`) zůstává pro nástroje a spotřební věci.
- Zbraň se tasí a zandává. Útok ji tasí sám; zandává hráč (X), sama se zandá jen při
  otevírání kořisti a po smrti. Tasená = bojový postoj (animace `combatStance` už existuje).
- Útok míří ke kurzoru a zasáhne všechno ve výseči před postavou (dosah + úhel
  podle zbraně). Jemné přitažení míření k nepříteli do zhruba ±20°.
- Míření rozhoduje, na koho rána dopadne (tvor musí být ve výseči). Útok proti obraně pak
  rozhodne, jak sedla: kritická, běžná, škrábnutí (poloviční poškození), nebo minutí
  (změněno 16. 11. 2026, dřív rána ve výseči nikdy neminula).
- Mezerník je úskok (etapa 4).

**Etapa 1 — zbraň ve výbavě, tasení a zandávání**
- Klacek dostane `slot: 'weapon'`; zbraň se bere z výbavy, ne z lišty. Útok a rána
  (`playerAttackSystem.setWeapon`) se počítají z nasazené zbraně, i když je zandaná:
  každý útok ji nejdřív vytáhne, takže s nasazenou zbraní se pěstmi bojovat nedá.
- Stav tasená/zandaná drží postava (`playerSystem.weaponDrawn`); klávesa **X** ho
  přepíná. Bez nasazené zbraně X postaví postavu do bojového postoje s pěstmi (mířené
  rány pěstí a výseč fungují stejně). Ukládá se u postavy; starší uložení ho nemají.
- Co je ve které ruce, rozhoduje jen `refreshHands` v `sceneEquipment.js` (tasená zbraň,
  jinak věc z lišty). Zbraně na lištu nesmí (`hotbarTool`). Klik na tvora zbraň tasí
  z boku a rána přijde po vytažení; zandá se jen klávesou X, při otevírání kořisti
  (`beginLootPickup`) a po smrti. První sebraný klacek se sám nasadí do prázdného políčka Zbraň.
- Model: tasená v ruce (`handSlot`), zandaná visí na boku u ruky se zbraní (pozor: model je
  ve scéně zrcadlený, kost `RightHand` je z pohledu `front` vpravo; `sheath.side` záporné
  = strana ruky se zbraní; úchyt na kosti boků,
  poloha a sklon v `sheath` u zbraně v `TOOL_TYPES`, měřeno v šířkách boků, takže sedí
  při jakékoli velikosti modelu). Tasení i zandání klávesou X je naprogramovaný pohyb
  pravé paže k boku (`reachHip`), v půlce se zbraň přehodí. Paže se ohýbá v lokti
  (`reachArm`) a pěst se dorovnává několikrát za snímek i se sevřením prstů a natočením
  zápěstí, aby dosedla přesně na úchyt. Zápěstí se natočí jen o půl cesty podle rukojeti
  (`HIP_GRIP_TURN`) a loket jde víc dozadu a nahoru (`HIP_ELBOW_UP`) — plné natočení
  zalomilo zápěstí dolů do nepřirozené polohy; s předchozí pózou se prolíná kost po kosti
  (částečné natočení kostí zvlášť dává skoky). Fotoateliér hlásí odstup úchopu od úchytu
  na boku. Osy boků se počítají ze stehen a páteře; kvůli zrcadlení je dopředu
  `Cross(side, up)`. Model postavy vlastní
  animaci tasení nemá. Klik na tvora tasí stejně a rána přijde až po vytažení.
- Bojový postoj (`Combat_Stance`) je dělaný pro štít; s tasenou zbraní ho `holdGuard`
  přepíše: paže míří do bodů kolem ramene (`guard` u zbraně: loket, ruka, levá ruka
  v metrech do strany / nahoru / dopředu) a zbraň drží směr `guard.club`. Při úderu,
  tasení a sbírání se úprava plynule vypne.
- Pochodeň se drží vždy v levé ruce (`offHand` u nástroje v `TOOL_TYPES`,
  `setOffHandTool`, úchyt `leftSlot`, prsty levé ruky `PLAYER_LEFT_*`), pravá zůstává
  volná pro zbraň, takže se nic nepředává. Mimo bojový postoj drží levá paže pochodeň
  zvednutou (`grip.raise`/`bend`), v postoji míří do bodů `offHand.hand`/`elbow`.
  Co v levé ruce opravdu je, říká `offNodeKey`. Výběr pochodně z lišty zbraň nezandá.
  Vytažení a schování pochodně: levá ruka sáhne k levému boku (`stow` u nástroje, stejné
  míry jako `sheath`; `reachPocket` sdílí s tasením `reachPoint`), v půlce se pochodeň
  objeví nebo zmizí. Modely nástrojů z lišty se načítají předem, aby se pochodeň
  při vytažení neobjevila pozdě.
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
- Jak je to udělané: dosah (`reach`) se měří k okraji těla tvora (poloměr = 0,3 × délka
  tvora, `BODY_SHARE` v `playerAttackSystem.js`), úhel výseče (`arc`) ve stupních, tělo
  výseč o kus rozšíří (čísla v etapě 3). Míří se na bod na zemi pod
  kurzorem (`pointerGroundPoint`), přitažení do 20° bere tvory do dosahu + 0,4 m
  (`aimPoint`). Klik na tvora bez tasené zbraně míří na něj. Podržené tlačítko opakuje
  ránu ke kurzoru (`attackHeld`). Kostka `rollQuality`: kritická / běžná / škrábnutí
  (poloviční poškození). Od etapy 4 stejně i tvorové.
  S tasenou zbraní ukazuje výseč na zemi `src/effects/attackArc.js` (dosah a úhel zbraně,
  míří tam, kam by šla příští rána; při úderu zesvětlí).

**Etapa 3 — víc cílů, primární a sekundární rána**
- Rozhodnuto 16. 11. 2026: každá rána zasáhne všechny tvory ve výseči a poškození se mezi
  ně rozdělí (tři zasažení = každý třetinu). Výseče jsou proto úzké; víc tvorů naráz bude
  trefovat až zbraň s obrovskou výsečí (třeba šavle).
- Každá zbraň (i pěst) má dvě rány: primární (levé tlačítko) a sekundární (pravé).
  Sekundární je pro všechny zbraně stejně silnější (`SECONDARY_DAMAGE_SCALE` = 1,5
  v `src/utils/weaponBlows.js`); zbraně se liší dosahem, úhlem, prodlevou a cenou ve výdrži.
  Sekundární rána = krátký klik pravým tlačítkem v bojovém postoji; tažení pravým dál otáčí
  kamerou, tvor se připíná prostředním klikem; mimo bojový postoj pravý klik nic nedělá.
- Odhození zasaženého a posekání trávy se nedělají (zatím).
- Hotovo, když: dva tvorové těsně u sebe ve výseči dostanou každý zhruba polovinu a sekundární
  rána je znatelně silnější, pomalejší a dražší.
- Jak je to udělané: zbraň v `TOOL_TYPES` (pěst v `PLAYER_BASE.punch`) má `damage` a sekce
  `primary` a `secondary` (`reach`, `arc`, `cooldown`, `anim`, sekundární i `cost`; co
  sekundární neurčí, převezme z primární). Cena primární rány je společná
  (`PLAYER_BASE.stamina.attackCost`). Obě rány spočítá `weaponBlows` a čte je útok
  (`playerAttackSystem.blows`) i detail předmětu v okně postavy (sekce Primární a Sekundární
  rána; prázdné políčko Zbraň ukazuje pěsti). `swingAt` dostane druh rány, dopad vybere
  všechny ve výseči (`struckAll`) a kostka `rollQuality` se hází pro každého zvlášť.
  Výsledky hodu `rollQuality`: z ran, které podle útoku proti obraně nesedly, je polovina
  škrábnutí a polovina minutí (`GRAZE_SHARE` v `combatRoll.js`; minutí ukáže „Minul“
  nad tvorem, `missCreature`). Žádná rána (primární ani sekundární) se neprovede, když na ni
  nestačí výdrž (`canSpend`); hráč počká, až se výdrž doplní. Poškození hráče je od
  16. 11. 2026 snížené na třetinu: pěst 1–3, klacek 3–5 (sekundární ×1,5). Klacek: primární
  1,7 m / 70° / 1 s, sekundární 1,9 m / 40° / 1,6 s / 22 výdrže. `anim` rány může být
  seznam: každá rána vybere náhodně jednu položku, jen ne stejnou jako minule (`pickAnim`
  v `playerAttackSystem.js`). Klacek: primární náhodně střídá tři rány: původní sek
  `Right_Hand_Sword_Slash` (bojová kopie `slash`, aby se nezměnilo sbírání s `chop`) s prvním švihem z `Double_Combo_Attack` (`double1`, soubor
  `castaway_double.glb`; první dva seky `Triple_Combo_Attack` vypadaly divně, 16. 11. 2026),
  a třetí sek z `Triple_Combo_Attack` (`triple3`, velký úder přes hlavu, do 16. 11. 2026
  sekundární); všechny tři primární rány trvají zhruba stejně (asi 0,9 s; rychlost
  a úsek v `PLAYER_ANIM_SPEEDS` a `PLAYER_ANIM_RANGES`). Vodorovný sek má švih: nápřah běží
  pomalu (0,7) a od vrcholu nápřahu se animace zrychlí na 1,8 (`PLAYER_ANIM_SNAP`, `applySnap`;
  `at` = vrchol nápřahu v sekundách animace), zásah přijde asi v 0,69 s, když klacek letí před tělem. Sekundární je `Attack`
  (`smash`): nápřah oběma rukama za hlavu s výpadem a úder dopředu k zemi, zásah
  asi v 0,95 s; pak se v animaci vlastním pohybem zvedne z výpadu (od 1,15 s dvojnásobnou rychlostí, `PLAYER_ANIM_SNAP`), celkem asi 1,85 s. Dřív končila ve výpadu a přechod do postoje přetáčel tělo. Vyzkoušené a nepoužité pro sekundární: `Heavy_Hammer_Swing` (pomalé, končí s klackem
  za hlavou; zůstává na kopání), `Left_Slash` (rozmáchlá otočka bez síly). Okamžik dopadu je podle nejrychlejšího pohybu ruky
  v animaci (`STRIKE_IMPACT_SHARE`). Pěst: primární úder pěstí 1,4 m / 50° / 1 s (už se nestřídá s kopem),
  sekundární kopnutí 1,6 m / 50° / 1,5 s / 16 výdrže (klíč `heavyKick`, pomalejší `kick`).
  Výseč na zemi během sekundární rány ukazuje její výseč.
  Za zbraní se při ráně táhne vítr (`src/effects/swingTrail.js`, volá ho `updateSwingTrail` v `playerSystem`):
  pruh od třetiny zbraně ke špičce, kreslí se jen během rány a jen když špička letí vůči postavě
  rychleji než 5 m/s (naplno od 12 m/s), takže pomalý nápřah ani chůze stopu nenechají; každý
  vzorek zmizí za 0,14 s. Materiál `swingTrailMaterial` patří v rentgenu mezi překryvy, aby pruh
  nemizel v jeskyních; připravuje se hned po vzetí zbraně, jinak by se při první ráně nestihl zkompilovat.

**Etapa 4 — tvorové stejným systémem, úskok**
- Kousnutí tvora se stane výsečí před ním v okamžiku dopadu, s viditelným nápřahem;
  hráč, který z výseče uteče, není zasažen.
- Úskok na mezerník: krátký přískok, stojí výdrž, chvilka nezranitelnosti.
- Hotovo, když: útoku Koa'tiki jde uhnout pohybem i úskokem.
- Jak je to udělané: na začátku nápřahu se tvor natočí k hráči a směr zamkne. Při dopadu
  (`resolveBite`) musí hráč stát ve výseči (`biteRange` k okraji těla hráče 0,3 m,
  úhel `biteArc` u tvora), jinak „Uhnul“. Ve výseči rozhodne stejná kostka jako u hráče
  (`rollQuality`: zásah, kritický, škrábnutí, minutí); `rollStrike` zmizel. Během nápřahu
  je pod tvorem slabá červená výseč a v ní se od tvora k okraji vyplňuje sytější výseč;
  když dojde na konec, tvor kousne (`updateBiteArcs`, `biteView`, `AttackArc` s barvou
  `DANGER_COLOR` a `progress`). Nápřahy: Koa'tiki 0,35 s, běs 0,4 s, kajmanka 0,45 s;
  výseče 100° / 80° / 60°. V posledních 0,15 s nápřahu tvor vyrazí vpřed (`biteLunge`:
  1 m / 0,8 m / 0,5 m, `lunge`; zastaví se, když se čumákem — půl délky těla od středu —
  dotkne okraje těla hráče, aby nezajel do postavy), takže chůzí se uhnout nedá,
  na útěk je potřeba sprint nebo úskok. Výseč ukazuje skutečný dosah včetně výpadu
  a okraje těla hráče.
- Úskok (`tryDodge` ve scéně, `dodge`/`stepDodge` v `playerSystem`, čísla
  `PLAYER_BASE.dodge`): kotoul 3 m za 0,9 s směrem WASD, bez pohybu pryč od kurzoru;
  animace `roll` se přizpůsobí délce úskoku. Kotoul v animaci vede šikmo, o 0,79 rad
  vpravo od pohledu (`PLAYER_ROLL_HEADING`), proto se postava natočí o tolik doleva od směru
  úskoku (rychlým otočením `DODGE_TURN_SPEED`); 20 výdrže, 0,5 s nezranitelnost (`protect`), 0,4 s pauza do dalšího. Nejde během
  nápřahu vlastní rány (do dopadu), po dopadu ránu přeruší. Kousnutí během
  nezranitelnosti ukáže „Uhnul“.

**Otevřené otázky (rozhodnout před danou etapou):**
- Sekyra a krumpáč: jen nástroje, nebo i slabé zbraně, když jsou v ruce? (Odloženo.)

## Stavby — plán po etapách (první: opuštěný pirátský srub)

Srub stojí v buňkách (−20…−18, 11…14), otočený o 90° (`rotation: 1`), zadní stěnou
přitisknutý k útesu na západě; půdorys 4 × 3 buňky (8 × 6 m). Je to opuštěná, ne dokonalá
stavba, kterou si bere příroda: nic nemá být podle pravítka ani zdobné (žádné rámy oken). Stavba se skládá z dílů na mřížce, ne z jednoho modelu:
model z Meshy je dělaný na pohled zvenku (vnitřek bez tloušťky, dveře často jen
namalované), z dílů jde postavit chůze dovnitř, otvírání dveří i pohled dovnitř.
Stěny se staví v kódu z jednotlivých klád, ne z dílů z Meshy: samostatné modely by na
sebe nenavazovaly (jiná tloušťka a rozestup klád, jiný odstín, nepřesné hrany).

**Data.** Katalog `src/data/catalogs/buildings.js` popisuje stavbu: rozměr v buňkách,
podlahu, stěny (`walls.sides`) s otvory (`walls.openings`: strana, posun od středu stěny,
šířka, spodek a vršek) a později střechu. Strany a otvory platí pro neotočenou stavbu;
`world/buildingSystem.js` ji poskládá kolem jejího středu a celou otočí podle `rotation`
(podlaha na kůlech v `buildingFloor.js`, stěny v `buildingWalls.js`, terasa se zábradlím a schody
v `buildingPorch.js`, vlajka a síť v `buildingProps.js`, tvary v `utils/buildingGeometry.js`, kreslené
textury v `utils/pirateCloth.js`). `shift` posune stavbu v buňkách (srub o 25 cm od útesu, aby klády
neprolézaly skálou). Vše se skládá do pár těles: prkna, klády, čela klád, vlajka, síť.
**Chůze:** podlaha, terasa, patro i schody jsou obdélníky s výškou (`plan.walk`); `buildingSystem.walkHeightAt`
dává nejvyšší z nich, na který se dá z výšky postavy vystoupit (`STEP_UP` 0,7 m), takže v přízemí
postava zůstane dole a do patra se dostane jen po schodech. `GameScene.standHeightAt` to na povrchu
(patro 0) použije pro postavu a klikání místo země, když je výš.
**Zdi:** stěny přízemí a místnosti v patře a zábradlí (`railRun`, jen když z něj zbyla aspoň jedna tyč)
si při stavbě zapíšou úsečku s tloušťkou a výškovým pásmem (`plan.blocks`, `addBlock`). Stěna se dělí jen
otvory od podlahy (`PASSABLE_BOTTOM` v `buildingWalls.js`), okna jsou zeď. `buildingSystem.wallGapAt`
dá vzdálenost postavy k nejbližší zdi v jejím výškovém pásmu (nohy až výška postavy), takže v patře
nezastaví stěny přízemí. Postava (`playerSystem.free`, `buildingGapAt`) nesmí vkročit blíž ke zdi, než
je její poloměr, ledaže se tím od zdi vzdaluje (aby se nezasekla). Šikmé zábradlí schodů zeď nemá
(ze schodů se stejně nesestoupí).
**Tvorové a stavba:** výška pod tvorem je jedna funkce `sceneCombat.creatureGroundAt(x, z, patro, odkud)`:
terén a na povrchu nejvyšší podlaha stavby, na kterou tvor z výšky `odkud` vystoupí (jako u postavy).
Tvor si nese svou výšku (`creature.y`, ukládá se od verze savu 9; po načtení se ověří, že tam ta podlaha je — `savedFootY` —, jinak tvor stojí dole) a každý krok ji posune
(`walkTo`); vykreslení, stopy a kousnutí ji používají taky. Zdi se ptají ve výšce tvora
(`creatureSystem.wallGapAt`): krok blíž než 0,3 m ke zdi projde, jen když se tím tvor od zdi vzdaluje
(platí i při úniku ze zaseknutí); přímá chůze (`walkLine`) jde po 0,3 m, drží výšku a zdi se drží 0,3 m.
**Hledání cesty ve stavbě:** uzel cesty má vedle buňky a patra i vrstvu (`layer` 0 dole, 1 přes 1 m nad
zemí — patro, horní schody) a výšku (`gridPath` ji nese v uzlu). U stavby (`buildingSystem.nearCell`,
buňka s podlahou ± 1) se hrana počítá „chůzí“ po čáře (`walkLine`) z výšky uzlu, takže tvor vyjde po
schodech schod po schodu; hrana nesmí projít kládou (`BUILDING_WALL_HIT`). Jinde zůstává rychlý výpočet
po buňkách. Narovnání cesty nepřeskočí změnu vrstvy. Přímá chůze k cíli platí, jen když dojde do výšky
cíle (`directReach`), jinak se hledá cesta (po schodech).
Stěny srubu neleží na hranách buněk (posun `shift`), proto se začátek i cíl cesty berou jen z buněk,
kam se z tvora, resp. z cíle dojde (`searchRoute`, `reachable`). Kousnutí přes zeď neprojde
(`inBiteRange`, `biteReaches`); honička se za zdí nezastaví na dosah kousnutí a míří přímo na postavu
(ne na bod před ní, ten by byl na straně tvora), takže cesta vede dveřmi. Stejně, když je postava o víc
než 1 m výš nebo níž (patro): tvor míří přímo na ni a hledá cestu po schodech.
Na podlaze stavby (`GameScene.onBuildingDeck`) se nehlídá blízkost útesu (`cliffOverlap`) a převýšení
terénu (`riseNear`) se měří od podlahy, ne od země pod ní — jinak by z pavlače nešlo na schůdky na útes.
Místa, která mají zůstat volná (`plan.keepClear`, i konec schůdků na útesu), zná stavba i ve světě
(`buildingSystem.keepsClear`); tráva na hraně útesu se tam nesází (`GameScene.shelfGrassAnchors`).
**Vrstvy a pohled dovnitř:** stavba se skládá do tří vrstev (`lower`, `upper`, `roof`); díly si vrstvu
přepnou přes `buildingSystem.useLayer` (každá vrstva má vlastní prkna, klády a čela klád). Patro = věnec,
podlaha patra, místnost a zábradlí pavlače a věci `on: 'upper'`; venkovní schody a schůdky na útes zůstanou
v přízemí. Střecha = štíty a model střechy. `buildingSystem.updateInside` (volá `GameScene.updateBuildingInside`
každý snímek, jen na povrchu a mimo editor) plynule schová vrstvy nad postavou (`mesh.visibility`, za 0,4 s; prkna až po kládách, `fadeLate`,
aby přes mizející podlahu neprosvítaly trámy — při objevování obráceně):
v půdorysu stěn pod patrem patro i střechu, v místnosti v patře střechu.
Schovávají se **části** (`plan.parts`, `deck.parts`): tři vrstvy a k nim horní půlky stěn — klády nad
`walls.insideCut` (1,1 m nad podlahou podlaží) si stěna dá do části `vrstva|strana` (`useWallTop`).
Díl patří vrstvě i své části a je vidět jen tolik, kolik ta méně viditelná. Když je postava uvnitř podlaží,
schovají se horní půlky jeho stěn, za kterými je kamera (kamera je na vnější straně stěny).
Liany ze staveb mají skupinu `jméno stavby:část` a `cliffVineSystem.hideGroups` je schová, když jejich
část nebo vrstva zmizí z víc než poloviny; liany z vršku stěny patří k její horní půlce.
**Zvuk uvnitř:** stejné „uvnitř“ (`buildingSystem.storeyInside`, `shelterAt`) ztlumí venek: `GameScene.updateIndoor`
plynule nastaví `audioSystem.setSheltered`. Venkovní zvuky (smyčky lesa ve dne a v noci, voda, hlasy zvířat
kromě jeskyně) jdou přes společnou cestu `outdoor` → dolní propust; v úkrytu klesne na 75 % hlasitosti a
řez na 1 600 Hz (`SHELTER_LEVEL`, `SHELTER_CUTOFF`). Jeskyně má dál vlastní přepnutí na jeskynní smyčku (`setIndoor`).
Zvuky stavby (`audio/building/`): dveře mají vlastní otevření a zavření; každý krok po dřevě má šanci 16 %
na vrzání prkna (`stepWood` → `with: plankCreak`); uvnitř občas zavrzají trámy (hlas prostředí `when: shelter`,
netlumí se). Hlasy prostředí (`LIFE_CALLS`) mají `when` den, noc, jeskyně, úkryt nebo seznam; `sea` = jen u moře
(vlny u skal).
**Patro** (`upper`, `buildingUpper.js`): na stěnách přízemí leží po obvodu věnec z klád překřížený
v rozích (`walls.ringSeat` = jak hluboko sedí na horní kládě), aby mezi patry neprosvítalo přízemí;
na něm trámy a pevná podlaha přes celý půdorys — spodní vrstva prken napříč (`upper.subfloor`)
a horní vrstva bez chybějících a ulomených prken (`upper.planks`), aby shora nebylo vidět do přízemí; místnost z klád nad buňkami −20…−19 × 12…14 (`upper.room` v neotočených souřadnicích), ustoupená
o 30 cm dovnitř, aby stěna nešla rovně odspodu (kolem zůstane římsa podlahy),
zbytek otevřená pavlač do L (nad −20…−18, 11 a nad −18, 12…14) se zábradlím (`upper.rails`) a schůdky z kulatiny na útes u −21,11 (`upper.sideSteps`). Dveře z venkovních schodů (od −18,15 nahoru
k plošině u −20,15) a dveře z místnosti na pavlač jsou otvory ve stěnách patra (`upper.openings`).
Terasa je jen na jižní straně neotočené stavby (strana dveří), síť visí na jižní stěně.
Sudy (`props.barrels`: stojící i povalené, prkna po obvodu přes `log.staves`, tmavé obruče) a bedny
(`props.crates`, i otevřená s víkem vedle) jsou zatím kreslené v kódu; stojí na terase (`on: porch`),
na zemi (`ground`) nebo na pavlači (`upper`). Detailnější pirátské věci se udělají v Meshy.
Rostliny kolem srubu a listí na terase jsou obyčejné dekorace v mapě (dají se upravit v editoru).
Stáří (`age`): barva po bodech — mech dole, na horních plochách klád a u stěn na podlaze,
špína u země; skvrny podle šumu. Klády (`walls.weather`) mají navíc oprýskaná vybledlá místa
s ostrým okrajem a tmavé svislé šmouhy od deště, silnější nahoře.
Liany visí z vršku vnějších stěn přízemí i místnosti v patře a ze štítů střechy (vždy přímo na dřevě;
z přečnívajících došků ani ze zábradlí ne — visely by ve vzduchu)
(`buildingSystem.vineAnchors` → `cliffVineSystem`, druh `walls`; každý bod nese vlastní šanci `chance`).
Liany jsou čtyři modely, které se náhodně míchají po celé mapě: dvě původní z útesů a dvě nové z Meshy
(`tools/prepareVines.mjs`, barva přiladěná k původním) — plochá popínavka (`vine_wall.glb`) a visící šlahoun
(`vine_hang.glb`); nové si drží proporce (`keep`). Každý model patří do skupin (`pools`: `cliff`, `wall`,
`hang`), bod si skupinu volí přes `look`. Tvary: svislá (výchozí), vodorovná podél hrany (`shape: drape`, na útesech i stěnách srubu) a girlanda
do U ze dvou šikmých kusů (`swag`, podél hrany útesu a přes vchod do jeskyně).
Délky se losují v širokém rozsahu (`KEEP_LENGTH`, `KEEP_THICK` v `cliffVineSystem.js`).
**Porůstání** (`growth`, `buildingGrowth.js`): dírami v podlaze přízemí a terasy prorůstá tráva a kapradí
a trsy obrůstají obvod srubu i kousek pod okraj podlahy; místa u schodů zůstanou volná (`plan.keepClear`).
Mech je dekorace pro editor (štětec Mech, `moss_small`, `moss_mid`, `moss_wide`): shluky nízkých hrbolatých
polštářů s roztřepeným okrajem zanořeným do podkladu (`utils/mossFactory.js`, tvar `pushMossPad`, vzhled
v `catalogs/moss.js`, textura Moss004 z ambientCG). Model mechu z Meshy nevyšel (dělal i prkna pod mechem).
Jsou to body pro systém trávy (`buildingSystem.grassSpots` → `floraSystem.addGrassSpots`, volá
`GameScene.sowAnchoredGrass`), takže mají stejné modely a vítr jako ostatní tráva. Na střechu se tráva
nedává: dohled postavy zahaluje oparem trávu výrazně výš než postava, střecha by byla černá.
**Střecha** (`roof`, `buildingRoof.js`): došková sedlová střecha z modelu z Meshy
(`public/assets/props/cabin_roof/`), položená na štíty z ubývajících klád nad místností v patře.
Model připraví `tools/prepareRoof.mjs`: natáhne ho na `roof.length` × `roof.width` (hřeben podél X, vršek
hřebene v nule), ztmaví světlé došky a zmenší textury. Model se načítá zvlášť a připojí se pod stavbu,
až je načtený; jeho stín přidá `buildingSystem.onMesh`. Dřívější střecha z prken a snítek z kódu
vypadala uměle, proto model.
Na stěnách útesu, které míří do buňky stavby, se nestaví skalní obklad (`buildingCellKeys`
v `GameScene.refreshCaveLighting`), jinak by kameny lezly dovnitř srubu.

**Tajná chodba:** jeskyně v patře −3 („Tajná chodba", buňky −21,12 a −22,12, podlaha 6,5 m,
strop 9,5 m) s průchodem z buňky −20,12 uvnitř srubu. Zadní stěna srubu má na tom místě
otvor (`kind: 'cave'`). Kamenný rám vchodu, jehož buňka patří stavbě, je zasunutý o `SUNK_DEPTH`
hlouběji do skály (`caveFrameSystem`, `GameScene.caveDoorsAround`) a liany nad ním nevisí.
Před vchod se později postaví kus nábytku, který ho schová. Mapa drží seznam
`buildings` (`key`, `cx`, `cz` = roh s nejmenšími souřadnicemi, `rotation` 0–3);
nepovinný údaj, formát mapy zůstává verze 10. Stavbu staví `world/buildingSystem.js`.

**Etapy (každou jde vyzkoušet zvlášť):**
1. **Podlaha** (hotovo jako pokus): jednotlivá prkna z textury dřevěné cesty (každé
   bere jedno prkno z textury), s mezerami, trochu zkroucená, některá chybí nebo jsou
   ulomená; leží na trámech z kulatiny na křivých kůlech, pod podlahou žádná výplň (dírami je vidět zem); terasa a schody jsou taky jen z kulatiny a prken; kroky po ní zní jako dřevo.
2. **Stěny z klád** (rozpracováno, čtyři stěny s otvory): každá kláda je křivý válec
   s texturou dřeva Wood062 (vlákna podél klády) — prohnutá, zúžená, nestejně tlustá,
   s jiným odstínem a přesahem konce; některé horní klády jsou ulomené. Otvory pro dveře
   a okna jsou jen hrubě vyřezané klády (konce nestejně dlouhé), bez rámů. Klády sousedních stěn jsou posunuté o půl rozestupu a v rohu se
   překříží; první kláda bočních stěn je napůl zapuštěná do podlahy. Čela mají letokruhy
   kreslené v kódu (`utils/logEndTexture.js`). Klády jedné stavby jsou sloučené do
   dvou těles (pláště a čela).
   **Z Meshy jen vybavení**, kde na navazování nezáleží: dveře, okenice, stůl, sudy, síť.
3. **Chůze dovnitř** po krocích:
   1. Zdi zastaví postavu (hotovo jako pokus, viz **Zdi** výše).
   2. Srub rozdělený na tři vrstvy (přízemí, patro, střecha); uvnitř plynule zmizí vše nad postavou
      (v přízemí patro i střecha, v místnosti v patře jen střecha). Hotovo jako pokus.
   3. Stěny mezi kamerou a postavou se uvnitř seříznou v pasu: horní klády každé stěny zvlášť a schovají se.
      Hotovo jako pokus.
   4. Tvorové chodí po podlaze srubu ve správné výšce, zastaví je zdi a do přízemí jdou jen dveřmi
      (hledání cesty o dveřích ví). Hotovo jako pokus.
   5. Tvorové po schodech a schůdcích z útesu do patra. Hotovo jako pokus.
   Později: stěny vrhají stín a zastaví dohled (`metadata.volume`).
4. **Dveře** (hotovo jako pokus, `buildingDoors.js`): každý otvor `kind: 'door'` v přízemí i v patře dostane
   křídlo ze svislých prken se dvěma příčkami na vnitřní straně (vzhled `walls.door` v katalogu, vlastní
   náhoda podle jména dveří, aby nepřeskládala zbytek srubu). Křídlo visí na pantu (`TransformNode` u kraje
   otvoru, `hinge: 1` u otvoru = pant na druhé straně) a otáčí se dovnitř o `swing` za `seconds`.
   Patří k vrstvě svého podlaží (schová se s patrem), ne k horní půlce stěny. Zavřené dveře jsou zeď
   (`plan.blocks` s odkazem `door`; `wallGapAt` otevřené přeskočí), takže je hlídá postava, tvorové
   i hledání cesty bez další úpravy. Pod myší (`doorAt`: zásah do křídla, jinak bod na zemi do 0,8 m
   od středu otvoru) zlatý obrys; levým tlačítkem otevřít/zavřít do 2,2 m (`GameScene`, interakce `door`,
   zvuk truhly). Které dveře jsou otevřené, drží `buildingSystem.openDoors` (přežije přestavbu srubu),
   ukládá se jako `doors` (verze savu 10); na začátku jsou všechny zavřené.
   Tvor a zavřené dveře: když je mezi tvorem a postavou zeď (`walledOff`), ověří si cestu i ve stejné výšce
   (`canGetTo`). Bez cesty je zmatený (otazníky, `giveUpConfused`), vzdá to na 12 s navíc (`WALLED_GIVE_UP_SECONDS`)
   a jde domů; když se dveře otevřou, cesta se najde a honička pokračuje. Později možná obléhání nebo vyražení dveří.
   **Nábytek** (hotovo jako pokus, `buildingFurniture.js`, data `furniture` v katalogu: `styles` vzhled podle druhu,
   `items` druh, místo v neotočené stavbě, `yaw`, `on: 'upper'`, převržení `tilt` + `lift`): stůl, židle (jedna
   převržená), ponk s nářadím, v místnosti v patře síťová houpací síť mezi stěnou a sloupkem
   (síť má materiál sítě na stěně). Každý kus má vlastní náhodu, nábytek je překážka (`furnitureBlock`, obdélník
   jako blok zdi; převržená židle ne).
   **Pracovní místa:** kus nábytku s `use` (`{ kind, hint }`) má vlastní mesh (`finishStations`), pod myší zlatý obrys
   (`stationAt`, společné `pickInteractive`, `inReach` a `updateInteractive` s dveřmi) a klik ho použije
   (`GameScene`, interakce `station`). Ponk v severozápadním rohu podél zdi s knihovnou (mimo dráhu jejího
   odsunutí) otevře okno výroby (`kind: crafting`).
   **Lucerna** na stole (`kind: lamp`, tvar `furnitureLantern`, svícení `buildingLamps.js`): kovový rámeček, sklíčka,
   svíčka a plamínek; klik ji rozsvítí/zhasne (zvuk zapálení). Sklíčka a plamínek mají vlastní materiály se září.
   Světlo je zdroj pro **světla ohně** (viz výše) se stínem povinným (`shadow: 'need'`), takže nesvítí skrz stěny
   a podlahu patra; při rozsvícení a pohybu dveří či knihovny hlásí `dirty`. Ve dne slabě, v noci naplno, lehce
   bliká (`light` ve stylu).
   Rozsvícené lucerny se ukládají spolu s dveřmi (`lit`, verze savu 11).
   **Knihovna před tajným vchodem**: přihrádky (`rows` × `cols`), většina prázdných, v několika knihy, sklenice
   a svitek (`decor`, barvy přes materiál bez textury `paintMaterial`). Je to posuvné „dveře“ (`kind: 'slide'`
   v `buildingDoors.js`, `doorShift`): pod myší a na klik reaguje jen malá páka na boku (`secret` — bez hledání
   podle bodu na zemi), knihovna odjede o `slide` podél stěny a odkryje otvor; zeď knihovny se posouvá s ní
   (`wallGapAt`). Stav se ukládá stejně jako dveře.
5. **Editor**: štětec Stavby — klik na roh, R otočí, guma smaže; zápis do historie (Zpět).

**Otevřené otázky:** zvednutá podlaha (dnes jen o pár centimetrů, výš potřebuje výšku
chůze ze stavby a schod u dveří); tráva a dekorace pod podlahou (dnes se neschovávají,
na místě srubu tráva není); veranda.
