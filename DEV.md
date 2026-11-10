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
    water/                   water, waterShader, waveSpray, fish
    flora/                   flora, grassShader, treeWind
    creatures/               creature, footprint
    player/                  player, attack, stats, heldItem, inventory
    gathering/               gather, harvest, felling
    world/                   deco, decoHighlight, campfire, glow, path
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
honička s návratem domů, kousnutí, smrt, tělo s kořistí a respawn. Chybí
vypadnutí suroviny a zvuky u Koa'tiki.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů).

### Co zbývá

- Objemový terén, fáze 3 a dál (viz [Terén](#terén)).
- Jeskyně: editor pater a spojů, voda po plochách, tvorové přes spoje
  (viz [Jeskyně a patra](#jeskyně-a-patra)).
- K rozhodnutí: suché jámy pod hladinou, řeky a vodopády (viz [Plány](#plány)).
- Recepty, plnění batohu a výroba předmětů.

## Klíčová rozhodnutí (nevrátit omylem)

- Výšky jsou v metrech, krok 0,25 m, rozsah −15 až +24 m; předvolby −15, −10, −5,
  0, 5, 10, 15, 20 a 24 m (`layoutStore.js`). Krok, výška schodu a hranice útesu
  jsou tři oddělená čísla: postava i tvor vylezou schod do 0,55 m (`STEP_LIMIT`),
  hranice útesu je 2,0 m (`AUTO_CLIFF_STEP`). Přes hranu útesu se svah nepřelévá —
  kdyby některá cesta přestala být průchozí, je to tohle číslo.
- Mapa má verzi 10 (`MAP_VERSION` v `src/data/catalogs/mapFile.js`). Mapa starší
  než 10 se při načtení převede na krok 0,25 m (`quantizeMapFileHeights`).
  Hladina vody je nepovinné číslo a verzi nemění.
- Hráčova výška se dopočítá z terénu; sav drží jen x, z a natočení.
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
- Světlá výška aspoň 2,6 m (postava měří 2,31 m), výchozí 3,0 m.
- „Jsem pod střechou" se odvozuje ze stropu nade mnou, neukládá se.
- Kde jeskynní buňka sousedí s venkovní ve stejné výšce (do 0,6 m), vznikne sama
  průchozí díra. Podlahy ve vchodu na sebe navážou jen ve stejné výšce, jinak
  vznikne schod (rampy a schody se zatím nekreslí).

**Hotovo:** data a dotazy, geometrie (podlahy, stropy, stěny, šachty, vchody),
pohyb hráče po patrech i přes spoj, tma v jeskyni a jeskynní zvuk. Jeskyně je tmavá
vždy (vyloučená ze slunce), postava a tvorové zůstávají osvětlení normálně. Když je
hráč pod stropem, schovají se přesně stropní dlaždice nad jeskyní (`overCave`,
samostatný mesh `_roof`), kolem otvoru se ukáže skalní lem (`terrainCaveRim`)
a skryjí se dekorace i tráva na těch buňkách. Strop je zeshora neviditelný.
Terén výš než podlaha, na které hráč stojí, zmizí v celém rozsahu stejně jako
v editoru pater (`revealColumn`), nezávisle na natočení kamery. Zůstává jen
osvětlené okolí vchodu podle mapy `caveLightMap`.

Táborák má vlastní stín do všech stran (`campfireFire.js`). Stín vrhají jen boky,
stěny a stropy (`metadata.volume`), ploché podlahy ne, jinak by se pod ostrým úhlem
kreslily pruhy. Stín se překresluje jednou za 1,5 s, ne každý snímek. Terén mimo
dosah je z ohně vyloučený. Materiály země jsou blízko limitu 16 textur, proto je
Půda jen z jedné textury a další textura na zemi se musí pohlídat. Podlaha
jeskyně je vyloučená ze slunce jako stěny a záři od vchodu dostává přičtením
(`floorGlow`), ne násobením, aby její jas nezávisel na tom, kde je vchod.

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

**Truhly a kostlivci** (`world/lootSystem.js`): dekorace s `loot` jde jednou vybrat
(E nebo klik), obsah jde do batohu a vybrané se ukládají. Víko truhly (`lid`) se
zvedne kolem zadní horní hrany. `backToEdge` posune předmět zády ke kraji buňky
podle natočení ze štětce (R).

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

## Tráva a podrost

Tráva jsou čtyři modely (pobřežní tráva, širokolistý trs, polštářek, kapradina)
a pod nimi koberec krátkých stébel. Štětec Tráva umí Obojí / Jen trsy / Jen koberec.
Zem i stébla počítají barvu stejným kódem, stéblo bere barvu země pod sebou. Druh
určí poloha nebo předvolba Směs uložená k buňce. Trsy se kreslí jako kopie jednoho
tvaru po čtvercích mapy. V Možnostech jde přepnout detailní kapradinu a vypnout
míchání tří textur země.

## Plány

Nic z toho není rozhodnuté.

**Suché jámy pod hladinou** (lom, proláklina pod úrovní moře). Dnes nejdou, protože
voda je všude, kde je terén pod hladinou (`waterSystem.depthAt`). Doporučená cesta:
v `depthMapFor` šířit „mokré" buňky od okraje mapy a ohrazené jámy prohlásit za
suché — bez nových dat. Ruční zóna Suchá jen kdyby bylo potřeba. Potřeba je maska
ve shaderu, stěna na okraji jámy a vypnout v ní příboj, kaustiku a ryby.

**Řeky a vodopády.** Etapa 1: řeka v úrovni moře (buňky řeky + směr proudu, vlny
po proudu). Etapa 2: víc hladin = rozdělit vodu na zóny (velká přestavba, odemkne
i jezírka). Etapa 3: vodopád jako samostatný objekt. Otázky: brod, nebo hranice;
unáší proud hráče.

**Boj** (inspirace Rage of Mages): barva tvora znamená druh a sílu, takže se hráč
na první pohled rozhodne; silnější varianta = stejný model, jiná barva a čísla.
Široká rána (cleave) těžkou zbraní zasáhne víc cílů v kuželu; parametry patří ke zbrani.

**Vzhled:** kontaktní stíny pod objekty (musí kopírovat svah), mech a lišejník na
kamenech, jednodušší vzdálené stromy, rostliny u břehu, zatopené kameny, odraz
oblohy, počasí.
