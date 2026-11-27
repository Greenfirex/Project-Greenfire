# Vývoj projektu Greenfire

Technický průvodce: jak se hra skládá, kde co v kódu je a hlavně **proč** je něco udělané
nezvykle. Jak to přesně funguje, říká kód; sem patří jen to, co z kódu vyčíst nejde.
Hra a ovládání: [README.md](README.md). Úkoly: [TODO.md](TODO.md). Editor:
[src/editor/README.md](src/editor/README.md). Tvorové:
[src/data/catalogs/creatures/README.md](src/data/catalogs/creatures/README.md).

## Architektura

```
src/
  main.js          engine, plátno, render loop
  scenes/          GameScene.js (zná celou scénu, propojuje systémy) a její části scene*.js
  systems/         core, terrain, water, flora, creatures, player, gathering, world,
                   atmosphere, materials (pluginy materiálů)
  editor/          editor mapy (editorMode + části editor*.js, mapEditor + části map*.js)
  data/catalogs/   předměty, dekorace, štětce, tvorové, stavby, uložený stav…
  data/maps/       tvar oblasti, výšky, soubor mapy (glade/map.json)
  effects/         oheň, výseč rány, vítr za zbraní
  ui/              DOM HUD nad plátnem
  utils/           mřížka, šum, načítání modelů, sdílené výpočty
  styles/          global.css, hud.css, editor.css
```

- Systém je třída, dostane scénu (`this.s`). Velké soubory jsou rozdělené na **části**
  přes `Object.assign` (pravidla v `.clinerules`). VS Code části nevidí a hlásí
  „Property … may not exist" — to není chyba.
- Simulace běží v pevném ticku (10×/s), mechaniky se hlásí přes `simSystem.subscribe`.
- **Ukládání:** vlastník stavu se registruje přes `saveSystem.register` (`serialize`, `apply`,
  `defaultState`). Načtení během hry (`sceneReload.js`) svět nestaví znovu: vrátí ho do stavu
  z mapy (uhasí ohně, obnoví posbírané, postaví tvory znovu) a nanese uložení. **Každý nový
  trvalý stav musí umět i tenhle návrat**, jinak po načtení zůstane ze hry před ním.
  Pozice uložení v `SAVE_SLOTS` (`saveSchema.js`); autosave jen v klidu (ne boj, okno, editor).
- Start: hlavní menu, svět se staví až po volbě. „Do hlavního menu" obnoví stránku.
- Mezi kousky stavby světa se čeká přes `releaseFrame` (`assetLoader.js`). V kartě na pozadí
  přes `MessageChannel`, protože časovače tam prohlížeč brzdí na 1 s.
- Během načítání **i přestavby světa** se kreslí jen 2× za sekundu (`shouldDrawFrame`,
  `SPARSE_DRAW_MS`). Dřív se při Aplikovat kreslil celý svět mezi každou dávkou dekorací
  a na velké mapě to rostlo „na druhou".
- Vzhled oken: barvy, písma a rám jsou proměnné v `global.css`; rám přes `border-image`,
  drahokam zvlášť. Zdroje z Gemini v `_sources/`, převod `tools/prepareUiFrames.cjs`.
- Video v menu (`menu-loop.mp4`) má šev smyčky zapečený ve videu. Při novém videu kódovat
  s rezervou snímků a konec odříznout, komprese jinak zhorší poslední snímky.

### Dvě otázky na výšku

- **Výška země** (`terrainSystem.heightAt`, `heightAtCell`): kde je terén. Dekorace, voda, tráva.
- **Co je pode mnou** (`terrainSystem.walkHeightAt`, ve scéně `standHeightAt`): na čem se dá
  stát, i most a podlaha stavby. Hráč, tvorové, kurzor, kamera.

Žádný systém si výšku nepočítá z dat mapy sám, dostane ji od scény. Chybějící propojení
se ozve do konzole (`utils/missingWiring.js`) — nula je platná výška a chyba by se schovala.

## Klíčová rozhodnutí (nevrátit omylem)

- Výšky v metrech, krok 0,25 m, rozsah −15 až +24 m (`layoutStore.js`). Schod postavy
  i tvora 0,55 m (`STEP_LIMIT`), hranice útesu 2,0 m (`AUTO_CLIFF_STEP`) — tři oddělená čísla.
  Přes hranu útesu se svah nepřelévá; když přestane být cesta průchozí, je to tohle číslo.
- Mapa verze 10 (`MAP_VERSION` v `mapFile.js`). Nepovinné části (hladina, jezera, stavby)
  verzi nemění.
- Hráčova výška se dopočítá z terénu; sav drží x, z, natočení, patro a výšku (`y`, kvůli podlahám).
- `Effect.PersistentMode = true` (`main.js`): bez toho po přepočtu v editoru konzole hlásila
  `glGetProgramiv: Program object expected` (smazaný program, který materiál ještě používal).
- Materiály s vlastním programem (voda, tráva) se mažou **bez obrázků** (`dispose(false, false)`):
  drží sdílené mapy rentgenu a dohledu a jejich smazání by vodu i trávu tiše vypnulo všem.
- Kopie modelů (`instantiateModel`) zahazují vlastní seznam bodů pro klikání
  (`dropOwnPointCopy`): Babylon ho při klonu dělá každé kopii zvlášť, u stovek keřů to bylo
  přes 1 GB paměti a editor padal na nedostatek paměti.
- Kopie tvorů přes `LoadAssetContainerAsync` + `instantiateModelsToScene`; ruční `clone()`
  rozbije kostru.
- Kopie s thin instances (krabi, skalní obklad) potřebují vlastní geometrii
  (`makeGeometryUnique`): buffery instancí leží v geometrii a sdílená by se přepsala.
- Označená buňka je plošina: rovná výška, kde je soused níž, stojí stěna. Kopce a stupně
  se staví výškami, ne skalními bloky. Hranice povrchů jsou rovné.
- Pláž je štětec, ne razítko: mění jen existující buňky. Novou zem z prázdna umí jen
  Herní plocha. Kopec a Prohlubeň měří od země pod tahem, Pláž od hladiny moře.
- Editor ukládá stav otevřené stránky. Když se mapa změní mimo hru, obnovit stránku (F5),
  jinak ji uložení vrátí (tak jednou zmizel vchod).

## Kde co je

- Výšky a předvolby: `data/maps/layoutStore.js`. Výškový model: `utils/terrainField.js`.
- Terén: `systems/terrain/terrainSystem.js` (+ části), hmota `terrainMass.js`, `runVolume.js`,
  pruhy skály `utils/terrainRuns.js`, most `utils/bridgeShape.js`.
- Chůze a patra: `systems/core/navigationSystem.js`. Hledání cesty tvorů: `utils/gridPath.js`.
- Voda: `systems/water/` (`waterSystem`, `waterBodies`, `waterFalls`, shadery), vlny `utils/waterWaves.js`.
- Světlo a zvuk: `systems/atmosphere/` (`skySystem`, `lightingSystem`, `fireLightSystem`, `audioSystem`).
- Editor: `src/editor/`, rozpis v `src/editor/README.md`. Štětce: `data/catalogs/brushes.js`.
- Mapa: `src/data/maps/glade/map.json`.

## Terén

Terén má **skutečnou hmotu**: buňka drží plné pruhy skály po 0,25 m, mezi nimi vzduch
(`utils/terrainRuns.js`). Viditelný vršek je hladká plocha, hmota k ní dodá boky, stěny
jeskyní a stropy (`terrainMass.js`, `runVolume.js`). Stavba je rozdělená na kroky
(`createSteps`: pole, povrch každého patra, hmota, mřížka a výběr myší); povrch je rozdělený
na čtverce (`SURFACE_CHUNK`).

- **Přechody povrchů** (`weightsFor` v `createSurface`): váhy až tří sousedů v jednom obrázku
  (`packWeights`, R/G/B), přes práh vchodu se míchá i s podlahou v jiném patře (`thresholdKeys`).
  Jeskynní materiál s přechodem má v klíči patro (`Cave-1|…`), jinak by si patra přepisovala váhy.
- **Reliéf** (`terrainReliefPlugin.js`): normálové mapy ve formátu GL (zelená = +V), všechny
  ve vrstveném obrázku 1024 × 1024 (`RELIEF_SIZE`), jedna textura místo čtyř. Natočení vrstvy
  (`angle`) se musí otočit i ve sklonech, jinak stín nesedí. `cavity` ztmaví boky nerovností
  v barvě, aby byly vidět i při slunci shora.
- **Limit 16 textur na materiál:** materiály země ušetřily pět textur sloučením váh a reliéfu.
  Se třemi stíny ohně má nejhorší materiál země 13 textur. Každé nové světlo se stínem stojí jednu.
- **Boky:** nahoře pás v materiálu buňky, pod ním skála; rozřezané po 0,25 m s vlastním výřezem
  textury (jinak se obrázek táhne a jsou švy). Horní hrana boku bere výšku jako okraj plochy
  (`edgeHeightAt`), jinak se rozcházejí o centimetry.
- **Obrys útesu se vlní** do ±0,16 m, jediný zdroj je `cliffShifts` (bere ho povrch i bok).
- Okraj mapy končí 2 m pod povrchem (`EDGE_DEPTH`).
- **Skalní obklad útesů** (`cliffDressSystem.js`): stěna se nemění, jen se obalí kameny
  (recepty `cliff_stone_*`, hroudy `cliff_clod_*`). Pod kusy zůstává celá stěna, takže
  nejsou díry. U volného konce se kusy zúží, na vnějším rohu je menší kus (jinak převisy).
  Kameny rámů vchodů jsou modely `boulder_*` s texturou a reliéfem stěny (`cliffStonePlugin.js`).
- **Liany** (`cliffVineSystem.js`): z hran útesů, poliček, nad vchody a ze stěn staveb.
  Svislé, vodorovné (`drape`) a do U (`swag`, jen listové); vodorovná a U jen kde hrana
  pokračuje (`edgeContinues`), jinak by visely do vzduchu.
- Ladění: `?solid` ukáže pruhy jako kostky, `?corners` obarví rohy útesů.

**Zkoušeno a zamítnuto** (nezkoušet bez nového nápadu): reliéf stěn posunem bodů (díry
u hrany a paty), zaoblení rohů (nedá se sladit s vyhlazením země), nahnutí normál na horní
hraně (tmavý pruh), procedurální kůže útesů s římsami.

## Jeskyně a patra

Skutečná patra v jedné mapě. Samostatná mapa (`catalogs/maps.js`) zůstává pro jiné vnitřky.

- Buňka může mít víc pochozích ploch nad sebou, každá s výškou a případně stropem (`ceilY`).
- Číslo patra (0, −1 …) je **jmenovka, ne pořadí** a nikdy se nepřečíslovává (rozbilo by
  mapy, spoje i savy). Pořadí se počítá z výšek. Víc jeskyní, které pod sebou neleží, smí sdílet patro.
- Mezi plochami se chodí **jen po spoji** (`connectors`); spoj = díra ve stropě/podlaze
  a vynechaná stěna. V buňkách spoje neplatí stěnová kolize útesu.
- Světlá výška aspoň 2,6 m (postava 2,0 m), výchozí 3,0 m.
- Jeskynní a venkovní buňka ve stejné výšce (do 0,6 m) dají průchod samy. Podlaha se na prahu
  přimkne k zemi venku (`setDoorBlends`), úprava závisí jen na poloze, takže nevzniká škvíra.
  **Švy u vchodu** (pás, kterým je vidět prázdno) vznikají, když zem venku a podlaha nejsou
  ve stejné výšce; lék je srovnat buňky kolem vchodu v mapě.
- Otvor vchodu zúží kameny rámu (`caveFrameSystem.js`, `DOOR_OPEN_HALF`, `DOOR_OPEN_HEIGHT`);
  chůze to hlídá stejně (`navigationSystem.inDoorFrame`), jinak by postava procházela kameny.
  Styl rámu (hlína/kámen) se ukládá jako `frameStyle` u buňky za vchodem.
- Jména jeskyní (`caveNames`) patří souvislé jeskyni, ne patru; ukládá se jméno a jedna buňka.
- Jeskyně nemá vlastní světlo. Slunce a obloha se v materiálech tlumí podle mapy vchodů
  (`revealPlugin.js`). **Past:** Babylon v kódu vkládaném regulárním výrazem doplní každé
  `$1`, `$2` … jen jednou, proto má vzor tolik závorek, kolikrát se číslo světla použije.
- Skála se do stínů a dohledu kreslí z obou stran (`utils/bothSidesMaterial.js`) a do stínu
  slunce bez posunu podél normály (`keepRockWhole`), jinak hranami prosvítá čára světla.
- Schod ve stropě má stěnku jen pro stíny (`SHADOW_ONLY_LAYER`), jinak škvírou svítí slunce.
- Stěny jeskyně se kreslí odvrácenou stranou (blízká stěna zmizí); Babylon pak pro světlo
  stranu neotočí, proto mají normály otočené do jeskyně už v datech (`terrainMass.js`).

### Rentgen, dohled a průhled

- **Rentgen** (`revealSystem`): pod stropem se schová strop nad jeskyní a terén výš než
  podlaha hráče. Materiálům se připojuje přes `utils/newMaterials.js` před každým výběrem
  modelů. **Na `onNewMaterialAddedObservable` spoléhat nejde**: Babylon ho hlásí se zpožděním,
  materiál se mezitím nakreslí bez rentgenu a karta hlásí „Two textures of different types
  use the same sampler location".
- **Dohled postavy** (`sightSystem.js`, `utils/revealGlsl.js`): krychlová mapa vzdáleností
  z očí, stín vrhá jen skála (`metadata.volume`). Pod zemí ztmaví, co zakryje skála nebo je
  dál než 14 m; venku od ~15 m opar. Zem se testuje o 0,6 m výš (za nízkým schodem není tma),
  modely podle paty (`vRevealBase`), aby koruny nezahalil. Vypnout nejde, bez něj je vidět skrz skálu.
- **Průhled ke kameře** (`revealPeekAt`, čísla v `PEEK`): trubka od kamery k postavě rozptýleně
  vyřízne, co je před ní. Stejný výpočet v JS používá myš (`seesThrough`). Pod řezem se kreslí
  kamenné dno (`revealSystem.updateCap`), protože terén je jen slupka.
- **Prstenec skály při řezu** (`ringWall`/`ringCap` v `runVolume.js`): jen při otevřeném řezu,
  nevrhá stín a neblokuje dohled.

## Světla ohně

`atmosphere/fireLightSystem.js`. Pochodeň, táboráky a lucerny jsou jen **zdroje** (poloha,
barva, síla, dosah, `shadow` none/prefer/need, patro). Skutečná světla jsou **čtyři** a dostanou
je nejbližší hořící zdroje kolem postavy: tři se stínem (krychlová mapa 512), čtvrté bez stínu.

- Světla existují pořád a zdroje jen mění sílu: přidat nebo ubrat světlo by přepočítalo
  všechny materiály (bliknutí).
- `lightingSystem.fitMaterials` zvedne materiálům strop světel; obloha a slunce mají přednost
  (`renderPriority`), takže o slunce materiál nepřijde.
- Babylon dá stín světla do programu jen, když má mapa stínu při sestavení nějaké meshe;
  proto je v ní vždy vypnutý zástupce (`fireShadowStub`).
- Lucerna i táborák mají `darkness` 0, jinak světlo prosvítá zdí.
- Vlastní programy (tráva, voda, vodopády) dostávají světla přes `utils/fireGlsl.js`
  (`FIRE_UNIFORM_NAMES`); počty světel se stínem jsou jen tam.
- Víc luceren se stínem najednou nejde (limit 16 textur, viz Terén); nový systém světel je v TODO.

## Voda

Jedna hladina moře (nepovinné číslo v mapě), jezera a řeky jsou vodní plochy.

- Vlastní program pro ortografickou kameru — Babylon WaterMaterial na ní dělá bílé pruhy.
- Vlny u břehu sledují obrys ostrova, dál volné vlnění; fáze se láme po celých periodách.
  Útes vs. pláž podle sklonu (1,2 m), u útesu se vlna rozbije a pěna se vypne.
- Hloubka, mokrý pruh a „suché jámy" jsou v obrázcích pro terén (`limitToOcean`, kanály
  mapy suchých jam). Moře je jen to, co je spojené s otevřeným mořem.
- **Jezero** (`lakes`): voda se rozlije od buňky do sousedních níž než hladina
  (`utils/lakeFill.js`); doteče-li na kraj mapy, nekreslí se.
- **Řeka** (`rivers`, pořadí buněk = směr proudu, `utils/riverPlan.js`): hladina po proudu
  nestoupá, drží se 0,25 m pod nejnižším břehem (buňky pod útesem se nepočítají) a nikdy
  neklesne pod moře ani pod vodu, do které ústí. `ground` je výška země před korytem, aby šlo
  koryto zasypat. Buňky řek jsou pro jezero zeď; změní-li se pak hladina jezera, vznikne schod.
- Kde voda je, určuje maska v mapě hloubky; mimo své buňky smí voda nejvýš 0,75 m (`SHORE_SPILL`).
- **Vodopád** vznikne sám při poklesu hladiny o hranici útesu (`riverFalls`). Stěny útesu
  u vodopádu mají jen ploché mokré kameny, jinak by prolézaly clonou.
- **Ryby** a **krabi** jsou thin instances jedné šablony, pohyb ocasu a nohou je v shaderu
  (`FishWigglePlugin`, `CrabLegsPlugin`). Oblasti modelu kraba jsou vyměřené pro tento model;
  nový model je potřeba vyměřit znovu. Krabi se neukládají.

## Postava

Model `characters/castaway/castaway.glb`; bojové animace v `castaway_combat.glb`
a `castaway_double.glb`, pití v `castaway_drink.glb` (`PLAYER_ANIMS` v `modelCatalog.js`).
Další animace stejné postavy stačí přidat do `PLAYER_ANIMS`; přenášejí se **podle pořadí kostí**
(`sameBoneNodes`), protože soubor z Meshy v pojmenování „mixamo" má jiná jména. Nové pohyby
se dělají v Meshy, kódem se jen dolaďují. Ladí se ve fotoateliéru: `node tools/capture.cjs player …`.

- Staty, úrovně a vlastnosti: `playerStatsSystem.js`, čísla v `catalogs/player.js`
  (`PLAYER_BASE`, `PLAYER_ATTRIBUTES`, `PLAYER_LEVELS`). Hlad a žízeň `survivalSystem.js`,
  efekty `catalogs/effects.js`. Výbava `equipmentSystem.js` + `sceneEquipment.js`;
  bonusy z výbavy se neukládají, přepočítají se.
- Batoh má pevná políčka (`INVENTORY_SLOTS`), lišta drží jen nástroje a jídlo (`barItem`).
- Oblečení s `wear.fitted` je napasované na kostru v Blenderu; **nová postava = oblečení
  napasovat znovu**. Rukavice nejsou (rovné prsty z Meshy nesedí na pokrčenou ruku).
- Modely věcí, které hráč má, se připravují předem (`warmOwnedItems`, `forceCompilationAsync`),
  jinak první nasazení nebo jídlo zasekne hru nebo se nevykreslí.
- Pochodeň je vždy v levé ruce, pravá zůstává pro zbraň. Její světlo existuje od startu.
- **Ruce kódem** (`playerGestures.js`): jídlo k puse, pití (ruce na hladinu), použití věcí,
  sáhnutí k boku. Úchop zbraně (`gripAxis`, `holdInFist`, `guard`, `sheath`) se ladí jen
  v bojovém postoji; během rány se zápěstí zamkne (`guardWrist`).
- Model je **zrcadlený**: kost `RightHand` je z pohledu `front` vpravo, prsty pravé ruky se
  ohýbají opačně (`RIGHT_CURL_SIGN` = −1), dopředu boků je `Cross(side, up)`.

**Animace — pasti:**
- Každá animace začíná s pánví v klidu (`settleRoot`), jinak postava sklouzne;
  `PLAYER_ANIM_ROOTLESS` mají pánev přišpendlenou úplně.
- Údery se hrají jednou, ne ve smyčce. Kdy je zásah: `STRIKE_IMPACT_SHARE` (nejrychlejší pohyb ruky).
- `restoreBones` na začátku snímku vrátí kosti, které animace nepřepsala, jinak `aimBone`
  měří minulé natočení a paže kmitají.
- Výpad kopím (`PLAYER_ANIM_PLANTED`) přenese jen část otočení pánve do páteře: celé zalomí
  trup, žádné nechá kopí bodat do strany.
- Zkoušené a vyřazené: `Charged_Axe_Chop` (úder jediný snímek), `Axe_Spin_Attack` jako
  primární (chaos), `Thrust_Slash` celý (skončí bokem), `Roll_Dodge_1` (šipka místo kotoulu),
  `Heavy_Hammer_Swing` a `Left_Slash` jako sekundární.

**Portrét v okně postavy** (`portraitSystem`): dvojník hráče ve vrstvě `PORTRAIT_LAYER`,
druhá kamera kreslí do výřezu a výsledek se kopíruje do `<canvas>` v okně. Po vykreslení
se `scene.activeCamera` vrací na hlavní, jinak klikání a voda počítají s portrétní. Mlha se
přepíná jen na dvojníkovi — na celé scéně by dvakrát za snímek přepočítala všechny materiály.

**Modely z Meshy:** zmenšují se před vložením (WebP 1024, nekovové). Nahraný model ztratí
posun dílů, proto pohyblivé díly (víko truhly) mají osu spočítanou ve hře. Hustý keř vyšel
uvnitř černý, proto je ibišek procedurální. Volné kameny jsou jedna sada rozřezaná
`tools/prepareRocks.mjs` + `bl_rocks.py`. Zjednodušovat přes Blender (`tools/bl_decimate.py`):
meshoptimizer se na samostatných kouscích zastaví. Před zjednodušením slepit body, jinak se
model roztrhá, a hlídat, že větší plošky nezmění vzhled (monstera dostala černé okraje
od `modelRim`, řešeno slabším `modelRim`).

## Klikání ve světě

Levé tlačítko rozhoduje podle toho, co je **pod kurzorem** — žádné „vezmi nejbližší".
`interactionSystem.js` podle priority operací (registrace v `GameScene.registerInteractions`):
tvor 100, mrtvola 90, těžená věc 50, truhla/kostlivec 45, táborák 40, dveře a stanice.
Operace dodá `pick(context)` a `act(target)`; nápověda i klik používají stejné rozhodnutí.

- Dosah rukou `handReach` v katalogu postavy (2,6 m, ±1 m výšky), přes útes se nic nedělá.
- Bez nástroje jde sbírat jen `byHand`. Nástroj na sběr: tasená zbraň, jinak věc z lišty.
- Na buňce smí ležet víc věcí ke sběru; sebrané se evidují i podle posunu v buňce
  (`harvestSystem`), jinak by se vejce v hnízdě pletla.
- Tvora pod kurzorem vybere myš jen, když na něj paprsek narazí dřív než do země nebo skály.

## Tvorové

Každý tvor má vlastní soubor v `data/catalogs/creatures/` a řádek v `index.js`; obecné věci
řeší `creatureSystem.js` a o kostech nic neví. Návod a všechna pole:
[manuál pro tvory](src/data/catalogs/creatures/README.md).

- Tvor v mapě je zároveň spawní místo (`respawnDays`). Živý/mrtvý patří do savu.
  **`kind` a `tier` jsou v savu** — nepřejmenovávat, jinak zvednout `SAVE_VERSION`.
- Chodí a vidí podle stejných pravidel jako hráč. **Kudy se vejde tělo** je jedno pravidlo pro
  oba (`navigationSystem.bodyFree`); dřív měl každý svoje a tvorové se zasekávali ve vchodech.
- Výška pod tvorem je jedna funkce (`sceneCombat.creatureGroundAt`), i podlahy staveb.
- Do jiného patra jen s `entersCaves`; míří nejdřív na vchod (`floorWaypoint`), protože
  hledání cesty vchody nezná a má omezený počet kroků.
- Smečka (`pack`), hnízda (`utils/nestGuard.js`, jedno pravidlo pro hru i editor), bestiář
  (`bestiarySystem.js`, prahy `UNLOCKS`).
- Rozestupy: od hráče se odtlačí jen tvor, hráč projde vždy, aby ho smečka neuvěznila.
- Ladicí čísla patří do souboru tvora, ne do systému.

## Boj

- Zbraň je v políčku Zbraň (`weapon`), lišta je pro nástroje. Zbraň se tasí (útok ji tasí
  sám) a zandává klávesou X; co je v které ruce, rozhoduje jen `refreshHands`.
- Rána míří ke kurzoru a zasáhne všechny ve výseči (dosah k okraji těla, úhel); poškození
  se mezi ně dělí. Primární a sekundární rána (`utils/weaponBlows.js`, sekundární ×1,5).
- Útok proti obraně rozhodne kvalitu (`rollQuality` v `combatRoll.js`): kritická, běžná,
  škrábnutí, minutí. Poškození: los → kritický násobek → odolnost → zbroj → nejméně 1
  (`damageBreakdown` v `damage.js`). Záporná odolnost je slabina.
- Tvorové bijí stejným systémem: výseč s nápřahem, směr zamknou až `BITE_AIM_LOCK` před
  dopadem (jinak chůze dokola nešlo nikdy trefit), v posledních 0,15 s vyrazí vpřed. Uhnout
  jde sprintem nebo úskokem (kotoul, `PLAYER_BASE.dodge`).
- Výseče patří v rentgenu mezi vlastní modely (`attackArcMeshes`); zařazení mezi překryvy
  vyvolalo chybu „same sampler location".
- Otevřené: sekyra a krumpáč jako zbraně (odloženo).

## Stavby

První stavba je opuštěný pirátský srub (−20…−18, 11…14). Stavba se **skládá z dílů v kódu**,
ne z jednoho modelu: model z Meshy je jen na pohled zvenku (vnitřek bez tloušťky), z dílů jde
chůze dovnitř, dveře i pohled dovnitř. Stěny z jednotlivých klád v kódu, protože samostatné
modely na sebe nenavazují. Opuštěná stavba — nic podle pravítka, žádné rámy oken ani okenice.

- **Data:** `catalogs/buildings.js` (rozměr, podlaha, obrys a otvory stěn, patro, schody,
  střecha, zabudovaný nábytek). Strany a otvory platí pro neotočenou stavbu, otočí se celek.
  V mapě `buildings` (`key`, `cx`, `cz` = roh, `rotation`). Staví `world/buildingSystem.js`
  a části `building*.js`.
- **Chůze:** podlahy jsou obdélníky s výškou (`walkHeightAt`), vystoupit jde do 0,7 m.
  Zdi jsou úsečky s výškovým pásmem (`plan.blocks`, `wallGapAt`), takže v patře nezastaví
  stěny přízemí. Zavřené dveře jsou zeď, hledání cesty o nich ví samo.
- **Tvorové ve stavbě:** uzel cesty má i vrstvu a výšku, u stavby se hrana počítá chůzí po čáře
  (schod po schodu). Stěny neleží na hranách buněk (`shift`), proto se začátek a cíl cesty
  berou jen z dosažitelných buněk. Na podlaze stavby se nehlídá blízkost útesu.
- **Vrstvy:** přízemí, patro, střecha; uvnitř se plynule schová, co je nad postavou, a horní
  půlky stěn mezi kamerou a postavou. Prkna mizí až po kládách (`fadeLate`), jinak prosvítají trámy.
- **Zvuk uvnitř:** venkovní zvuky jdou přes společnou propust, v úkrytu se ztlumí.
- Na stěnách útesu, které míří do stavby, není skalní obklad (lezl by dovnitř). Na střechu se
  tráva nedává: dohled zahaluje oparem vše výrazně výš než postava.
- **Nábytek a drobnosti jsou dekorace v mapě** (`catalogs/furniture.js`, `utils/furnitureFactory.js`),
  kladou se volně i na podlahy (`deck`). Věc pod podlahou nebo nad hlavou nevadí (`missesBody`).
- **Pracovní místa** (`world/stationSystem.js`): dekorace s `use` — ponk (okno výroby) a lucerna
  (zdroj světla ohně se stínem povinným). Použít jen ze stejné místnosti (`roomAt`).
  Rozsvícení se ukládá (`stations`).
- **Tajná chodba:** knihovna na páku (posuvné dveře `slide`) před vchodem do patra −3;
  rám vchodu uvnitř stavby je zasunutý hlouběji (`SUNK_DEPTH`).
- Zbývá (v TODO): stavění po dílech v editoru, nábytek ze srubu převést na dekorace,
  stěny vrhající stín a blokující dohled.

## Editor mapy

F2, hra běží dál. Podrobnosti v [dokumentaci editoru](src/editor/README.md).

- Se štětcem, který mění terén, se schovají předměty i tráva a přestavba předmětů se odloží
  (`setDecorShaping`, `decorStale`) až na přepnutí štětce nebo zavření editoru. Data se ukládají hned.
- Aplikovat přestaví celou dotčenou část světa (terén, nebo dekorace), ne jen kus kolem změny;
  plán zrychlení a čísla pro větší ostrov jsou v TODO.

## Tráva a barvy rostlin

- Tráva jsou čtyři modely a koberec krátkých stébel; stéblo bere barvu země pod sebou.
  Okraj porostu řídne a přerůstá do sousedů (`GRASS_EDGE`), aby nekopíroval čtverce.
- Barvy rostlin: `catalogs/floraColor.js` (`FLORA_GRADE` pro všechny, `MODEL_COLORS` srovná
  listí modelů z Meshy na společnou zelenou), provádí `FloraColorPlugin`.
- Modely z Meshy (PBR) počítají světlo lineárně a v noci by „svítily" proti terénu;
  `nightLightPlugin.js` jim slabé světlo ztlumí (`NIGHT_CURVE`).

## Rozhraní

- Velikost rozhraní (`uiScale`) přes CSS `zoom` celé vrstvy `#hud-layer`; `hudFit.js` ji na
  úzkém okně sníží. Věci umístěné podle bodu na obrazovce mají zoom vrácený, tažení oken ho přepočítá.
- Esc nejdřív zavře okna, teprve pak pauzuje. Možnosti z pauzy pauzu schovají a vrátí.
- Mapa ostrova (`sceneMap.js`, `mapPainter.js`): sever je +Z. Kreslí se z mřížky jen při její
  změně; útes je jen tam, kde terén hranu nevyhlazuje (`hardEdgeAt`). Odkrytí drží
  `explorationSystem.js` (base64 bajty v savu).

## Zveřejnění na GitHub Pages

Ručně spouštěný workflow `.github/workflows/pages.yml`. Hra se sestavuje s `base: './'`,
takže **cesty k souborům musí být relativní**. Mimo vývoj se mapa čte z přibaleného
`map.json`; ukládání mapy z editoru online nefunguje.
