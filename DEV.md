# Vývoj projektu Greenfire

Technický průvodce projektem: jak se hra skládá, kde co v kódu je, co je hotové
a co následuje. Co hra je, jak se ovládá a jaké má licence, popisuje
[README.md](README.md); aktuální úkoly jsou v [TODO.md](TODO.md).

## Architektura

```
src/
  main.js                    engine, plátno, render loop
  scenes/GameScene.js        orchestrátor — stav světa, delegace na systémy
  systems/                   camera, grid, terrain, water, sky, deco, gather, interaction,
                             inventory, heldItem, player, input,
                             campfire, glow, dayNight, sim, audio, save, creature
  editor/                    editor mapy, panely, štětce, značky spawních míst
  data/catalogs/             předměty, dekorace, mapy, tvorové, uložený stav
  data/maps/                 tvar oblasti, nastavení výšek a soubor mapy
  effects/                   oheň (táborák, pochodeň)
  ui/                        DOM HUD panely nad plátnem
  utils/                     výpočty mřížky, načítání modelů, ukládání do prohlížeče
  styles/                    global.css, hud.css, editor.css
```

- Systémy jsou třídy, konstruktor dostane scénu, přístup přes `this.s`.
- Simulace běží v pevném ticku (10× za sekundu) a o obsahu mechanik nic neví;
  mechaniky se hlásí přes `simSystem.subscribe`.
- Ukládání je obecný sběrač stavu; scéna registrované vlastníky připojuje přes
  `saveSystem.register` (vlastníci dodávají `serialize`, `apply` a `defaultState`).
- Načtení savu hru znovu spustí a stav se navrství na čerstvě postavený svět
  při startu — proto je u načtení vidět načítací obrazovka. Běžné spuštění
  zůstává čisté, nic se nenačítá samo.

### Dvě otázky na výšku

Pro každé místo existuje jedna výška země a na ní stojí všechno ostatní. Vedle
ní je ale druhá odpověď — **co je pode mnou**, tedy země včetně mostu. Jsou to
dvě různé otázky a zůstávají oddělené:

- **Výška země** (`terrainSystem.heightAt`, `heightAtCell`) — kde je terén.
  Berou ji dekorace, cesty, voda a tráva: zajímá je země, ne to, co je nad ní.
- **Co je pode mnou** (`terrainSystem.walkHeightAt`) — na čem se dá stát.
  Berou ji hráč, tvorové, kurzor a kamera: zajímá je povrch, po kterém se chodí.

Výšku si žádný systém nepočítá sám z dat mapy — dostane ji od scény jako
`groundHeightAt`. Když propojení chybí, ozve se do konzole (`utils/missingWiring.js`,
jednou za systém), místo aby tiše počítal s nulou: nula je platná výška, takže by
se chyba schovala. Až se jednou svět rozdělí na vrstvy, přibude vrstva právě na
jednu z těch dvou otázek — proto musí být od začátku jmenované.

## Kde co je

- `src/data/maps/layoutStore.js` — rozsah výšek, krok, předvolby.
- `src/editor/heightPanel.js` — okno Výška; `areaPanel.js`, `brushPanel.js` — plocha a štětce.
- `src/editor/editorMode.js`, `mapEditor.js`, `editorHud.js` — editor, výběr, panely, pláž, voda.
- `src/systems/gridSystem.js`, `inputSystem.js` — hover, levé/pravé tažení.
- `src/utils/terrainField.js` — výškový model (spojitá výška mezi buňkami).
- `src/systems/terrainSystem.js` — terén, hrana, útesy, mosty, prolnutí povrchů.
- `src/utils/bridgeShape.js` — tvar skalního mostu: klenba, čela a pochozí plocha.
- `src/utils/gridPath.js` — hledání cesty tvorů po buňkách (A*).
- `src/systems/terrainBlendPlugin.js` — míchání textur sousedních povrchů v materiálu terénu.
- `src/utils/waterWaves.js` — čísla a výpočet vln (společné pro program i hru).
- `src/systems/audioSystem.js` — kroky, příboj, oheň, ambientní vrstvy a hudba.
- `src/systems/waterSystem.js` — hladina, odrazová sonda, kraj mapy.
- `src/systems/waterShader.js` — program pro vodu: vlny, pěna, svislá stěna.
- `src/systems/skySystem.js` — obloha a slunce.
- `src/systems/pathSystem.js`, `playerSystem.js`, `cameraSystem.js` — cesty a hráč.
- `src/data/catalogs/brushes.js` — štětce včetně Pláže, Útesu a Mostu; `decorations.js` — písek a povrchy.
- `src/data/maps/glade/map.json` — aktuální mapa; `DEV.md` — tento přehled.
- `.clinerules` — pravidla práce.

## Postava

Hráčská postava je `public/assets/characters/castaway/castaway.glb`. Model má
vlastní kostru i animace přímo v GLB a při startu se přednačítá spolu s ostatními
modely. Nástroj se přichytí na kost `RightHand`.

Nový svět začíná na buňce **−1, −16**. Hráč nejdřív leží a vstane po stisknutí
WASD nebo šipek. Uložená hra se načte na uložené pozici a úvodní vstávání přeskočí.

Mapování animací, kandidáti na kost ruky, výška a otočení modelu jsou v
`src/data/catalogs/modelCatalog.js`; vlastní načtení a přepínání animací řeší
`src/systems/playerSystem.js`. Licence modelu je v `CREDITS.txt` vedle souboru.

Zdraví a výdrž postavy drží `src/systems/playerStatsSystem.js`; čísla (maximum,
doplňování, ceny za běh a útok, chvilka klidu po probuzení) jsou v
`src/data/catalogs/player.js`. Oba proužky nad lištou předmětů kreslí
`src/ui/vitalsBar.js` — zdraví červeně, výdrž žlutě. Stav se ukládá jako každý jiný
a načtení starších dat ho doplní na plno. Když dojde zdraví, hráč se probudí na
startovním místě mapy.

Výdrž ubírá běh, každý útok a každé máchnutí do stromu či kamene. Doplňuje se po
krátké prodlevě, kterou restartuje i kousnutí od tvora. Když dojde, postava přejde
do chůze a běh povolí až po doplnění nad nastavenou mez — Shift je potřeba pustit
a stisknout znovu, aby postava nekmitala mezi během a chůzí. Útočit jde i s prázdnou
výdrží; omezený je jen běh.

Okno **Postava** (C) má vlevo náhled postavy se sloty na výbavu a vpravo staty;
sloty jsou zatím prázdné placeholdery, náhled čeká na 3D podobu. Okno **Inventář**
(I) má vlevo mřížku předmětů a vpravo popisek toho, na co hráč najede myší. Obě
okna jdou tahat myší a pamatují si pozici.

## Klikání ve světě

Levé tlačítko rozhoduje podle toho, co je **pod kurzorem** — žádné „vezmi nejbližší
věc v dosahu". Když je vybraná věc mimo dosah, nestane se nic. Držené tlačítko
opakuje tutéž akci, dokud kurzorem neodjedeš.

Rozhodování drží `src/systems/interactionSystem.js`: ptá se registrovaných operací
podle priority a vrátí jednu, nebo nic. O obsahu operací sám nic neví.

| priorita | operace | co udělá |
| --- | --- | --- |
| 100 | tvor | útok |
| 90 | mrtvola | sebrat kořist |
| 50 | těžená věc | máchnutí (kácení, těžba, sběr) |
| 40 | táborák | zapálit |

Operace se registrují v `src/scenes/GameScene.js` v `registerInteractions`. Každá
dodá dvě věci:

- `pick(context)` — když na daném místě něco umí, vrátí `{ ref, inReach }` (a případně `detail` s textem pro nápovědu u kurzoru), jinak `null`,
- `act(target)` — provede akci.

Nápověda u kurzoru i samotný klik používají stejné rozhodnutí, takže se nemůžou
rozejít. Nová operace (vaření, výroba, cokoli dalšího) znamená **jeden nový řádek**
v registraci — klikání, držení tlačítka ani nápověda se nemění.

## Tvorové (NPC)

První tvor je kajmanka (`snapping_turtle`), druhý písečný běs (`sand_devil`). Každý tvor
má **jeden vlastní soubor** — data i rig pohromadě — a systém tvorů o kostech nic neví.
Tvor ve hře je jen ten, který je zapsaný v mapě; hra žádné tvory nedoplňuje sama.
Jak postavit nového, stojí v [manuálu pro tvory](src/data/catalogs/creatures/README.md).

Každý tvor zapsaný v mapě je zároveň **spawní místo**. Když zahyne, po `respawnDays`
herních dnech se na stejném místě obnoví. Živý tvor se neobnovuje ani nekopíruje;
počet tvorů určuje mapa, ne uložená hra. Mapa si stav živý/mrtvý nepamatuje — ten
patří do uložené hry.

Po smrti zůstane tělo ležet přes tři minuty a jde z něj sebrat kořist, potom se propadne
do země. Když ho sebereš dřív, propadne se hned po sehrání. Jak tělo padne, si určuje
sám tvor (kajmanka na bok, běs se převrátí na záda). Bílý obrys se ukáže, jen když jsi blízko.

```
src/data/catalogs/creatures/
  index.js            registr: které tvory hra zná + pomocné funkce
  README.md           manuál: jak postavit nového tvora
  sandDevil.js        písečný běs: data, tiery a rig
  snappingTurtle.js   kajmanka: data, tiery a rig
src/systems/creatureSystem.js   obecné: spawn, stavy, ikony, obrysy, ukládání
src/utils/gridPath.js           hledání cesty kolem překážek (A* nad mřížkou buněk)
src/utils/creatureMarker.js     vykřičník a otazníky nad hlavou (společné všem)
public/assets/creatures/<kind>/ model + CREDITS.txt
```

### Co patří kam

| Věc | Kde | Poznámka |
|---|---|---|
| jméno, model, měřítko, otočení | soubor tvora | `length` je délka těla ve světových jednotkách (buňka = 2) |
| čísla chování (rychlosti, kruhy, časy, dostřel, útok a obrana) | soubor tvora | systém je jen čte |
| tiery | soubor tvora | klíč tieru se ukládá do savu |
| rig (rozpoznání kostí + animace) | soubor tvora | `build` / `pose` / `summary` |
| stopy v písku (`footprint`) | soubor tvora | které nohy a kam našlapují, jak jsou velké |
| zahrabání, vylézání a způsob smrti | soubor tvora | `buried`, `emerge*`, `deathRoll` |
| zvuky (`alert`, `charge`, `bite`, `hit`, `death`, `dig`) | soubor tvora | klíče do seznamu zvuků v audio systému |
| stavy, spawn, ikony, obrysy, tooltip, ukládání | systém tvorů | pro všechny tvory stejné |
| barvy a tloušťky obrysů, obrázky ikon | systém / `creatureMarker.js` | společné, ne v souboru tvora |

### Rozhraní rigu

```js
rig.build(mesh, skeleton)   // -> stav kostry, nebo null
rig.pose(stav, dt, info)    // -> { bob }
rig.summary(stav)           // -> řetězec do konzole
```

Rig vrací jen svislé zhoupnutí; polohu a otočení řeší systém a na jednotlivé kosti
nesahá. Co všechno `info` obsahuje a které módy rig musí snést, popisuje
[manuál pro tvory](src/data/catalogs/creatures/README.md).

### Konvence modelu

- Formát GLB, skinned mesh; jeden model = jeden tvor.
- Model se normalizuje na `length` a staví se nohama na nulu.
- Otočení: model kouká na +Z; `yawOffset` v datech srovná model, který kouká jinam (želva má `Math.PI`).
- Kosti buď nemají jména, nebo je generuje Meshy: rig je hledá podle klidové polohy (želva),
  nebo podle jmen, když je export má (běs). Podrobně v manuálu pro tvory.
- Tuhé části (krunýř) se neanimují: hýbe se jen to, co rig výslovně vybere.
- Model i `CREDITS.txt` patří do `public/assets/creatures/<kind>/`.

### Přidání nového tvora

1. Nahraj model do `public/assets/creatures/<kind>/` a přilož `CREDITS.txt`.
2. Vytvoř `src/data/catalogs/creatures/<kind>.js`: hlavičku (1–3 řádky), import `ASSET_DIRS`,
   rig (nebo `rig: null`, když model kosti nemá) a data tvora.
3. Přidej řádek do `index.js` (import + položka v `CREATURE_TYPES`).
4. Hotovo — spawn, ikony, obrysy, tooltip i ukládání fungují automaticky.

Přesný seznam všech polí v datech, rozhraní rigu, stopy a zvuky popisuje
[manuál pro tvory](src/data/catalogs/creatures/README.md).

### Na co si dát pozor

- **`kind` je v savu.** Nepřejmenovávej ho u existujícího tvora, jinak se stará data ignorují
  a tvor zůstane na místě, kam ho položila mapa.
- **Stav živý/mrtvý není v mapě.** Mapa drží jen druh, stáří a buňku; čas smrti a zdraví
  patří do uložené hry.
- **Výškový rozdíl:** `maxStepHeight` určuje, jak velký schod tvor zvládne. Větší rozdíl
  je pro něj zeď, takže nepřeleze útes; toulat se smí jen po spojitém terénu.
- **Útok přes výšku:** `attackHeight` určuje, jak vysoko nebo nízko ještě tvor dosáhne
  na hráče. Na hráče na útesu nezaútočí. Všímavost je velkorysejší — `noticeHeight` říká,
  jak velký výškový rozdíl ještě stačí na to, aby si tě tvor všiml a zavrčel; když na tebe
  nedosáhne, po chvíli varování to vzdá.
- **Zásah rozhodují vlastnosti:** `attack` útočníka proti `defense` obránce (útok² proti
  obraně², ohraničeno na 5–95 %). Vzdálenost se u dopadu nekontroluje — kdo útok zahájí,
  ten ho dokončí; rána ho nepřeruší.
- **Crit se nevyplňuje:** šance na citlivý zásah je odvozená z téhož porovnání —
  `(šance na zásah − 50 %) × 0,75`, strop 40 %, poškození ×2. U tvora se nic nenastavuje.
- **`tier` je v savu.** Při přejmenování tierů zvedni `SAVE_VERSION`.
- **Načtení musí snést stará data** (chybějící tvory, neznámé tiery) — `apply` nesmí spadnout.
- **Matematika kostí:** `getBindPose()` je lokální, ne absolutní; osa otáčení se převádí do prostoru
  rodiče a normalizuje (jinak se rotace násobí měřítkem modelu).
- **Kopírování modelu:** `LoadAssetContainerAsync` + `instantiateModelsToScene`; ruční `clone()`
  skinned meshe si rozbije kostru.
- **Tvary bez kostí** (sochy, barely): `rig: null`, systém to snese.
- **Mrtvý kód:** když tvor ocas nemá, rig ho nesmí mít „pro jistotu“.
- **Ladění patří k tvorovi**, ne do systému: rozsahy, prahy i časy jsou v jeho souboru.

## Stav projektu

Hotové je jádro hratelného ostrova: izometrická kamera, postava s animacemi
a staty, sběr dřeva a kamene, batoh a okna postavy, táborák a pochodeň, denní
cyklus se stíny, zvuky podle povrchu, ukládání do prohlížeče, editor mapy
(zóny, povrchy, výšky, pláž, útesy, mosty, voda, tvorové) a svět kolem toho —
spojitý terén s hranou mapy a cestami, vodní hladina s vlnami, pěnou a odlesky,
ryby, tráva s květinami, keře, kameny, palmy a útesy.

Tvorové: kajmanka, písečný běs a Koa'tiki — toulání, dvě zóny pozornosti,
honička s návratem domů, kousnutí, smrt, tělo s kořistí a respawn. Chybí už jen
vypadnutí suroviny a zvuky u Koa'tiki.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů).

### Co zbývá

- Volitelné doladění vzhledu: rostliny u břehu, zatopené kameny, skutečný odraz
  oblohy, počasí (bouřka a déšť).
- Suché jámy pod hladinou a řeky s vodopády — dvě témata k rozhodnutí,
  rozbor je níž v sekci [Voda a podzemí](#voda-a-podzemí). Jeskyně a patra jsou
  rozhodnuté (sloupce), model je v sekci [Jeskyně a patra](#jeskyně-a-patra).
- Mimo uzavřený plán: recepty, plnění batohu a výroba předmětů.

## Klíčová rozhodnutí (nevrátit omylem)

- Výšky jsou v metrech, krok 0,3 m, rozsah −15 až +24 m; předvolby −15, −12, −9,
  −6, −3, 0, 3, 6, 9, 12, 18 a 24 m.
- Patra jsou sloupce: buňka může mít víc pochozích ploch nad sebou, štítek patra
  je jen jmenovka (pořadí se počítá z výšek v buňce) a mezi plochami se chodí
  jen po spoji. Pravidla a důvody jsou v sekci „Jeskyně a patra".
- Výškový panel je samostatné okno; hlavní HUD výšky neobsahuje.
- Výběr buněk: hover + levé přidá + pravé kliknutí odebere; 0 m srovnává.
- Střed buňky zůstává přesný; kraj mapy a díry berou výšku nejbližší buňky.
- Terén se dělí podle povrchů; cesty jsou jemné a 2,5 cm nad zemí.
- Hráčova výška se dopočítá z terénu; sav drží jen x, z a natočení.
- Pláž je štětec, ne razítko: mění jen existující buňky a svah si staví
  prstenci po 0,3 m. Novou zem z prázdna dál umí jen Herní plocha.
- Plynulý okraj = jeden prstenec písku navíc za posledním schodem.
- V pánvi pláže mizí objekty a tráva; na svazích se posouvají s terénem.
- Hranice povrchů jsou rovné (vlny zůstaly jen u útesů). Tráva se u okraje
  prolíná do písku texturou i barvou, písek do trávy neproniká. Váha prolnutí
  je v textuře nad mapou (0,25 m) a šev drží na 1, aby nebyl vidět.
- Kopce a stupně se staví výškami, ne skládáním skalních bloků; staré skalní
  modely jsou z projektu odstraněné i s kusy v mapě.
- Označená buňka je plošina: drží rovnou výšku, přes její hranu se výška
  nedopočítává a kde je soused níž, stojí kamenná nebo hliněná stěna. Stejně vysoký soused
  se napojí plynule bez stěny a hrana stěny se drobně vlní.
- Voda je jedna hladina pro celou mapu a jen se kreslí — nic v mapě nemění.
  Kde je terén pod ní, tam je voda; kde je výš, terén ji překryje.
- Voda má vlastní program pro orthografickou kameru; hotový Babylon
  WaterMaterial se nepoužívá, protože počítá odlesky z pozice kamery a na
  ortho kameře dělá bílé pruhy a zrcadlové fleky.
- Vlny se počítají ze vzdálenosti od břehu, ne z pevného směru: hřebeny jsou
  obrysy ostrova, takže na každé straně běží ke břehu, stáčí se kolem mysů
  a v zálivech se sbíhají. Fáze se láme po celých periodách (8 s), takže
  hladina nikdy „necukne“.
- Vzdálenost od břehu se měří v metrech jako vzdálenost k nejbližší zemi;
  jemný šum na ní dělá nepravidelné hřebeny. Velký šum se u břehu vypíná
  (aby zůstal obrys čistý), ale drobný šum o vlnové délce pár metrů zůstává
  — díky němu se kraj vody a pěny na rovném břehu nevlní geometricky přesně.
  Hřebeny se u břehu zvedají a zostřují.
- Zvednutí hladiny i sklon pro světlo počítá stejný vzorec — vysoký hřeben
  má i strmé světlo. Vlnky kratší než 5,6 m jsou jen v šumu programu, protože
  na ně síť hladiny nemá dost vrcholů; světlo, odlesk i pěna je počítají dál.
- Všechny vlny mají dobu oběhu 4 s, takže devítimetrová vlna běží 2,25 m/s;
  hřebeny se ve vodě hýbou svižně a pěna se posouvá ke břehu 0,5 m/s.
- Útes a pláž se poznají podle sklonu břehu: kde země u vody stoupá aspoň o
  1,2 m, je to skála. Vlna se tam vyzdvihne a rozbije (a stříká), nábřežní
  krajková pěna se tam naopak vypne.
- Pěna jde ze stejných vln: nábřežní linka se přelévá podle vzdálenosti od
  břehu a sahá až k vodní linii, hřebeny se lámou tam, kam skutečně dorazí.
  Její okraj se navíc pomalu posouvá v rytmu vln, takže se voda na písku
  rozlévá nerovnoměrně, ne jako rovná čára. V hluboké vodě zůstávají jen
  slabé bílé hřebeny.
- Vzorek pěny se houpe podle výšky hladiny: když vlna přichází, posune se
  k pláži, když hladina klesá, vrátí se k moři — a stejný signál hýbe i
  okrajem pěny. Posouvá se vždy jedním společným směrem pro celou plochu,
  takže se vzorek nedeformuje (kdyby se řídil místním směrem, na zakřiveném
  pobřeží by se mezi sousedními místy stlačoval a natahoval).
- Pěna se nikdy nekreslí nad suchou zemí (jen tam, kde je pod ní voda nebo
  kde se hladina u útesu dotahuje ke stěně).
- Odraz se bere z odrazové sondy nad středem vody. Do odrazu jdou terén
  a objekty; obloha je barva. Síla zrcadlení se počítá z hladké vlny, ne
  z jemných vlnek, takže odlesk je plynulý: rovná hladina drží hlubokou
  barvu a zrcadlí se hlavně šikmé vlny.
- Slunce dělá široký lesk a řídké jiskřičky na několika metrech; drobný lesk
  i jiskřičky se při oddálení kamery tlumí, aby nekmitaly.
- Jemné vlnky jsou součet deseti krátkých vln (0,78 až 0,15 m). Jejich směr
  se řídí směrem velkých vln (ze tří čtvrtin převládajícím směrem moře,
  ze čtvrtiny místním), takže se s vlněním stáčejí kolem ostrova. Délky jsou
  nesouměřitelné a souřadnice se ještě jemně vlní, aby nevznikla pravidelná
  mřížka. Vlnka se vypne, když je na obrazovce menší než ~18 pixelů.
- Hloubka se bere z terénu pod hladinou; kde je mělko, prosvítá dno, hloubka
  plynule tmavne. Pěna u břehu je součástí vodního programu.
- Hustota vodní sítě jde podle kvality: vysoká 0,5 m, střední 1 m, nízká 2 m.
- Obloha je SkyMaterial bez textury a nahrazuje jednobarevné nebe; voda
  z ní bere jen barvu.
- Suché jámy pod hladinou (doly, sklepy) současná plocha neumí; rozbor obou cest
  je v sekci [Voda a podzemí](#voda-a-podzemí--tři-témata-k-rozhodnutí).
- Mapa má verzi 8 (`MAP_VERSION` v `src/data/catalogs/mapFile.js`); hladina vody
  je nepovinné číslo a verzi nemění. Starší mapy se načtou bez toho, co v nich
  chybí.

## Voda

Voda je jedna hladina pro celou mapu, uložená jako nepovinné číslo
v souboru mapy. Kreslí ji vlastní program: vlny (vyšší v hloubce, nižší
u břehu), barva a průhlednost podle hloubky, pěna u břehu, odraz okolí přes
odrazovou sondu, kaustika na dně pod hladinou a tmavší hladina v noci.
Hloubka se bere z terénu pod hladinou. V editoru se voda zapíná tlačítkem
Voda a hladina se ladí po 0,3 m.

**Vlny** skládají dva systémy a míchají se podle vzdálenosti od břehu: do ~6 m
od pobřeží jdou hřebeny rovnoběžně s pískem (pole vzdáleností se počítá přesně,
takže má skutečné kružnice, a vyhlazuje se jen přes vodu), od ~24 m dál vládne
volné vlnění z pěti směrů s nezaokrouhlenými vlnovými délkami — proto se vzor
nikde neopakuje. Mezi tím se plynule míchá **výška** obou systémů, takže
nevzniká šev ani hrana. Výšku vln tlumí hloubka, takže u břehu je hladina
klidná. Jemný třpyt dodává jedna normálová textura ve třech pootočených
vrstvách, které se posouvají stejným směrem jako vlny.

**Otevřená rozhodnutí:** šířka Plynulého okraje u pláže (zatím jeden
prstenec navíc), průchodnost útesů (schod nad 0,45 m a hrana na mřížce
0,5 m) a suché jámy pod hladinou (suchá zóna nebo vodní zóny). Rozbor všech
tří odložených témat — suché jámy, řeky s vodopády a jeskyně — je v sekci
[Voda a podzemí](#voda-a-podzemí--tři-témata-k-rozhodnutí).

## Editor mapy

Editor se otevírá **F2** a hra pod ním běží dál — tvorové se hýbou, jen hráč
stojí a klávesy patří kameře. Klávesou **P** nebo tlačítkem **Pauza** v panelu
editoru se dá hra kdykoli zastavit a zase pustit. Editor umožňuje kreslit zóny
a objekty, modelovat výšky, razítkovat herní plochu a ukládat mapu přímo do
`src/data/maps/<mapa>/map.json`.

- **Zóny** — rostliny, objekty, cesty, pláž, útes, most a tvorové.
- **Výška** — terén od −6 do +24 m po 0,3 m, kopce, prohlubně, útesy a spojnice.
- **Herní plocha** — razítko podkladu a výšky pro nové nebo přepsané buňky.
- **Voda** — jedna hladina pro mapu, v editoru ji jde zapnout, skrýt a ladit po 0,3 m.
- **Tvorové** — spawní místa se značkami živého, čekajícího a nového místa
  a se spojnicí od spawního místa k živému tvorovi.

Podrobný popis režimů, štětců, výšek, vody, cest, tvorů a ukládání mapy je
v [dokumentaci editoru](src/editor/README.md).

## Tráva a podrost

Tráva nejsou stébla dopočítaná v kódu, ale čtyři modely z Meshy: pobřežní
tráva, širokolistý trs, nízký polštářek a kapradina. Pod nimi leží jemný
koberec krátkých stébel (28 cm, tři stébla na kus), aby mezi trsy neprosvítala
holá plocha. Štětec Tráva umí vrstvy oddělit: Obojí, Jen trsy nebo Jen koberec.
Zem i stébla počítají barvu stejným kódem: travnatou zem míchají tři textury
(Grass001–003) do velkých skvrn podle šumu, stéblo si bere barvu země přesně
pod sebou a k tomu světlejší špičku a tmavší základnu, aby bylo vidět. Každý
druh má v katalogu výšku, počet kusů na buňku, odstín a jas; přidání dalšího
modelu k druhu je jeden záznam v jeho seznamu modelů. Druh na buňce určí
poloha (u písku pobřežní, u stromů a skal kapradina, jinde směs podle skvrn),
nebo předvolba Směs ve štětci Tráva, která se ukládá k buňce. Trsy se sázejí
jako kopie jednoho tvaru, takže tisíce kusů stojí jedno kreslení na čtverec
mapy a vzdálené čtverce se schovávají. Kapradina jde v Možnostech přepnout
na detailní verzi (7 581 trojúhelníků) pro porovnání s lehkou (437);
míchání tří textur země jde tamtéž vypnout.

## Nápady na další vizuální vylepšení

Seřazeno podle poměru přínos / práce. Nic z toho není rozhodnuté, je to
seznam k výběru.

1. **Kontaktní stíny pod objekty** — kameny a keře nemají
   stín přímo pod sebou, takže působí, že plavou. Plochý flek na zemi ale
   neumí kopírovat svah, takže to chce řešení, které se ohne s terénem.
2. **Skála: mech a lišejník** — kámen je jednolitý. Ztmavení u paty a mírné
   zelené omaštění horních ploch podle sklonu (barvou ve vrcholech, bez
   nových textur) oživí útes i balvany.
3. **Vzdálené stromy (LOD)** — až bude les hustší, nahradit daleké stromy
   jednodušší variantou. Uvolní výkon a dovolí sázet víc stromů.

## Nápady na další vývoj

### Nepřátelé a boj

> **Stav:** první verze je hotová — kajmanka (`snapping_turtle`) umí toulání, dvě zóny
> pozornosti (ostražitost s vykřičníkem, pak honička), kousnutí s nápřahem, zmatení
> s otazníky, návrat domů, obrysy a tooltip. O zásahu rozhoduje hod útoku proti obraně,
> zásah ubírá zdraví (kousnutí 4/8/14 podle stáří), po smrti se tvor na svém místě
> po pár dnech vrátí; chybí už jen vypadnutí suroviny. Jak přidat dalšího tvora je
> v sekci [Tvorové (NPC)](#tvorové-npc).

Vychází z Rage of Mages (1998): hrdina s vlastnostmi, k tomu jednotky a souboje
sledované z nadhledu, kde jsou vlastní a cizí jednotky barevně odlišené. Nejde
o kopírování — bereme si nápad: nepřítel má svoje vlastnosti, svůj okruh
pozornosti a svou barvu, a boj se odehrává kolem hráče, ne ve výběrovém okně.

**Jak by to mělo vypadat ve hře**

- Každý nepřítel má vlastnosti (kolik vydrží, jak silně a jak daleko útočí, jak
  je rychlý) a okruh pozornosti. Dokud je hráč daleko, nepřítel postává nebo
  chodí po svém území.
- Když hráč do okruhu vstoupí, nepřítel se rozběhne. Když ho ztratí (uteče dost
  daleko), vrátí se domů a přestane ho honit — jinak by ho pronásledoval přes
  celou mapu a nedalo by se před ním utéct.
- Barva není ozdoba: jiná barevná kombinace znamená jiný druh a jinou sílu,
  takže se hráč na první pohled rozhodne, jestli do toho jde. Stejný model
  s jinou barvou je levná varianta, silnější verze dostane i jiné vlastnosti.
- Boj je akční, protože se chodí WASD: hráč mává zbraní v ruce a rozhoduje
  vzdálenost, ne kliknutí na cíl. Postava se na kliknutý cíl sama otočí a ve stoje
  se dívá za myší. O tom, jestli rána vyšla, rozhodují vlastnosti — útok proti
  obraně. Kdo útok zahájí, ten ho dokončí: uskočení ani rána ho nepřeruší.
- Široká rána (cleave): těžká zbraň zasáhne i další tvory v malém kuželu před
  hráčem. Šířka kuželu, nejvyšší počet cílů a podíl poškození pro vedlejší cíle
  patří ke zbrani, ne k postavě.

**Jak to sedne do projektu**

- Co nepřítel je a co umí (vlastnosti, okruh pozornosti, barvy, model, co po
  něm zůstane) patří do nového katalogu mezi stávající katalogy. Čísla se drží
  jen tam, nikde jinde.
- Chování (čekání, honička, útok, návrat) patří do nového systému, který
  dostane scénu; scéna ho jen propojí s ostatními, stejně jako dnes.
- Počítá se v pevném kroku simulace (desetkrát za sekundu), obraz jen kreslí,
  co simulace rozhodla.
- Trvalý stav (kde nepřítel stojí, kolik mu zbývá, kdo je mrtvý) se hlásí
  ukládání jako každý jiný stav ve hře; načtení starších dat nesmí spadnout.

**První verze**

Jeden druh nepřítele, okruh pozornosti, honička a návrat domů, jeden typ útoku,
smrt, mrtvé tělo s kořistí a respawn.

## Voda a podzemí

Jeskyně a patra jsou **rozhodnuté** — viz „Jeskyně a patra" níž. Suché jámy
a řeky zůstávají otevřené; sepsané je to proto, aby se nemuselo znovu
objevovat, proč to kde dnes nejde.

### Suché jámy pod hladinou

**Cíl:** jít po souši do prohlubně, která leží pod úrovní moře — lom,
proláklina, jeskynní dno, přístavní jáma.

**Proč to dnes nejde:** voda není „někde", je všude, kde je terén pod hladinou.
`waterSystem.depthAt` počítá hloubku jako `hladina − výška země` a
`GameScene.isWalkableAt` podle ní blokuje chůzi. Žádné místo v datech neumí
říct „tady voda není".

**Varianta A — automatika (doporučená první):** při stavbě hloubkové mapy
(`waterSystem.depthMapFor`) se od okraje mapy rozšíří „mokré" buňky jen tam,
kam se moře opravdu dostane. Buňky pod hladinou, které jsou ze všech stran
ohrazené vyšším terénem, se prohlásí za suché.

- `depthAt` a `waveDepthAt` v suchých buňkách vrátí nulu, takže chůze, tvorové,
  hledání cest i „nevstupuj do vody" se opraví na jednom místě.
- Pěna, vlny i příboj v suché jámě nevzniknou, protože pro vodu je to souš.
- Bez nových dat v mapě a bez změny verze formátu.
- Podmínka: jáma musí být ze všech stran ohrazená; otevřená proláklina u moře
  zůstane zálivem, jak má.

**Varianta B — ruční zóna Suchá:** štětec v editoru, který automatiku přebije
(jáma se svislou stěnou k moři, studna, dok). Navíc proti áčku: nová vrstva
v mapě, verze formátu +1 a zápis v seznamu pro ukládání.

**Co je potřeba v obou případech:**

1. Maska „tady vodu nekreslit" ve shaderu — vejde se do volného B kanálu
   stávající hloubkové textury, nová textura není potřeba.
2. Stěna na okraji jámy (štětc Útes), jinak je vidět moře viset ve vzduchu.
   Editor by měl varovat „suchá zóna sousedí s vodou a nemá stěnu".
3. Příboj a kaustika: `shoreDistanceAt` by v suché jámě šuměl, i když je sucho —
   ošetřit stejnou maskou. Totéž ryby a odlesky na dně.
4. Schůdnost: do jámy musí vést svah nebo schody do 0,45 m na krok.

**Rizika:** maska má rozlišení hloubkové mapy, takže okraje jámy budou trochu
zubaté — proto bod 2 (hranu schovat za stěnu).

**Otevřené otázky:** jak hluboko se má chodit (kvůli tmě a dohledu kamery);
chceme ruční zónu hned, nebo až podle potřeby.

### Řeky a vodopády

**Cíl:** tekoucí voda, která se chová jinak než moře — řeka s proudem, vodopád
přes hranu skály.

**Proč to dnes nejde:** celá voda je jeden kus — jedna hladina, jedna plocha,
jedna hloubková mapa a jedno pole vln (`waveDistAt`, `shoreCells`,
`shoreDistanceAt`). Pěna, vlny i odrazy stojí na tom, že existuje jeden břeh
a jedna hladina.

**Etapa 1 — řeka v úrovni moře** (údolí, delta, potok ústící do moře): buňky
řeky v mapě + směr a síla proudu (nový kanál v datech vody). Shader v těch
buňkách pošle vlnky a pěnu po proudu místo vln od moře a vypne pěnu po obvodu.
Hloubka, odrazy a průhlednost zůstanou. Zhruba: data + shader + štětec.

**Etapa 2 — víc hladin** (potok výš než moře): dnešní systém je jeden, takže se
musí rozdělit na vodní zóny — každá vlastní hladina, plocha, hloubková mapa
a pole břehů. Moře zůstane jedna zóna, řeka další. Tohle je ta velká přestavba;
odemkne i jezírka, studny a kanály.

**Etapa 3 — vodopád:** samostatný objekt, ne plocha — svislé pruhy vody přes
hranu, pěna nahoře i dole, stříkající kapky a zvuk. Dá se udělat i dřív, jen
potřebuje výškový rozdíl.

**Editor a mapa:** řeka = namalované buňky + směr proudu; vodopád = značka na
hraně s výškou. Obojí znamená novou verzi formátu mapy.

**Doladění nakonec:** zvuk tekoucí vody, proud unáší hráče, ryby v řece, pěna
na přechodu řeka → moře.

**Otevřené otázky:** jak vysoko má řeka být (úroveň moře, nebo vlastní hladina);
má se dát přebrodit, nebo je to hranice (hráč zatím neumí plavat); má proud
hráče unášet.

### Jeskyně a patra

**Cíl:** díra do útesu, kterou se dá projít, a možnost jít pod zem a dovnitř do
skály — včetně jeskyně pod jeskyní.

**Proč je to nejtěžší:** celý svět stojí na výškovém poli — pro každé místo na
mapě existuje jedna výška, a na tom je postavené úplně všechno: terén, voda,
tráva, dekorace, tvorové, stíny, kamera i hledání cest. Jeskyně ale znamená dvě
podlaží nad sebou na stejném místě.

**Rozhodnutí:** obecnost hned, žádné zjednodušování. Varianty A a B níž jsou
zamítnuté, zvolená je varianta C a model, který je popsaný za nimi.

**Varianta A — vchod jako kulisa** (zamítnutá): ve skalní stěně se vygeneruje
tmavá nika, pár metrů hluboká, s tmavým koncem. Žádné druhé podlaží, jen
geometrie a tma. Dá pocit, že hráč do skály vešel, ale nevede nikam. Práce: nový
objekt v editoru, mesh a zákaz vstupu dál.

**Varianta B — jeskyně jako samostatná mapa** (zamítnutá pro jeskyně; zůstává
vhodná pro jiné vnitřky, třeba dům):
vchod je díra ve stěně, po vejití se obrazovka zatmí a načte se jiná mapa.
Tři výhody, které to mají zadarmo:

- Registr map už v projektu je (`src/data/catalogs/maps.js`): přidání mapy je
  jeden záznam v seznamu a klíč.
- Každá mapa má vlastní hladinu vody, takže jeskyně může mít vodu vlastní nebo
  žádnou — tím se obejde i problém suchých jam pod hladinou.
- Každá mapa má vlastní světlo i denní dobu, takže jeskyně může být tmavá, bez
  slunce, jen s pochodní. Data pro to už existují.

Co je potřeba udělat: (1) přepínání mapy za běhu — korektně uklidit a znovu
postavit terén, dekorace, vodu, ryby, tvory, stopy, sběr a táboráky a přesunout
hráče; hodně systémů už `clear()` a `create()` má, protože to používá editor při
přestavbě, ale chce to prototyp. (2) portál v mapě: cílová mapa a cílová buňka,
vchod zvenku i východ zevnitř. (3) uložení hry si musí pamatovat, ve které mapě
hráč je. (4) obsah jeskyně: chodby, síně, krápníky, tma, vlastní tvorové,
případně voda. (5) zvuk — smyčka „Cave" je v balíčku, který už máme.

**Varianta C — skutečná patra v jedné mapě — ZVOLENÁ:** aby šlo projít
tunelem pod skálu a zůstat ve stejné mapě, rozdělí se výškové pole na plochy
a s ním všechno ostatní. Co je potřeba projít:

- **Data mapy:** dvě vrstvy buněk, verze formátu +1, staré mapy musí jít načíst;
  každý štětec a zóna musí vědět, do které vrstvy kreslí (jinak maluješ strop,
  když chceš podlahu).
- **Výškové pole:** `heightAt(x, z)` by muselo vracet výšku podle vrstvy a každý
  volající by musel vědět, na které je. Plynulý dopočet mezi buňkami (4×4
  sousedů) by se musel počítat zvlášť pro každou vrstvu a hlídat, aby se výška
  nepřelila mezi nimi — stejná třída chyby jako rohy útesu, jen mnohokrát horší.
- **Chůze hráče:** `groundY`, `stepAllowed` (porovnává výšku odkud/kam — přes
  portál vyjde skok pěti metrů a hráč se nehne), `free` (stěny, schody,
  dekorace), pád, vynášení z vody i teleporty. Typický projev: vejdeš do
  jeskyně a jsi „ve skále", protože tam je terén o pět metrů výš.
- **Voda:** jedna hladina vede celou mapou, takže by se prořízla skrz strop
  jeskyně; hloubková mapa, pole vzdálenosti od břehu, pěna, odrazy, kaustika
  a zvuk příboje by potřebovaly vědět o vrstvách. Projev: modrá plocha plave ve
  vzduchu ve tmě, v suché jeskyni šumí moře.
- **Tvorové:** `canStep`/`canStand` pracují s výškou, hledání cest je
  dvourozměrná mřížka s jedním „dá se tudy projít" na buňku. Projev: tvor útočí
  skrz strop (vzdálenost ve dvou osách vyjde malá), tvor v jeskyni jde domů přes
  skálu, zvířata padají do jeskyně.
- **Rostliny a sběr:** sází se podle `groundHeightAt` buňky, kreslí se podle
  vzdálenosti od hráče. Projev: tráva a palmy vyrostou na stropě jeskyně
  a sbírat jde přes strop.
- **Světlo a stíny:** slunce svítí shora a stíny se počítají z jedné roviny;
  bylo by potřeba maska světla podle vrstvy. Projev: do jeskyně svítí slunce
  a na dně jsou ostré stíny listí, nebo je naopak všude černo.
- **Kamera:** izometrický pohled shora uvidí strop, ne hráče. Muselo by se
  dělat prořezávání stropu (skrývání vrchní vrstvy nad hráčem) — další systém:
  detekce, průhlednost, řazení průhledných ploch. Projev: v jeskyni se nevidíš,
  nebo vidíš zdola prosvítat krajinu.
- **Kurzor a editor:** paprsek se trefuje do terénu hledáním, kde protne výšku
  země (`inputSystem.surfacePoint`) — trefí tu horní. Projev: kurzor ukazuje
  místo na skále nad hlavou místo podlahy u nohou.
- **Zvuk:** vzdálenost od břehu se počítá z polohy, ambientní vrstvy jsou jedna
  sada pro celý svět. Projev: v jeskyni 20 metrů pod zemí hraje příboj.
- **Ukládání:** pozice hráče je dnes jen x, y, z; musela by přibýt vrstva, kde
  je, a každý uložený tvor by ji potřeboval taky. Projev: po načtení se probudíš
  uprostřed skály.
- **Výkon:** zhruba dvojnásobek geometrie terénu, víc stínů a rostlin, a víc
  systémů, které se každý snímek ptají na výšky. Projev: nepravidelné padání
  snímků v hustých místech.

Souhrn: není to „přidat jeskyně", ale předělat základ hry na plochy
a projet všechny systémy, které dnes počítají s jedinou výškou — a to jsou
prakticky všechny. Riziko není, že by to nešlo, ale že chyby budou tiché
a místní: něco půjde devadesát procent času a v určité kombinaci se to rozbije.

### Model sloupců — jak se to udělá

**Pochozí plocha patří buňce, ne světu.** Buňka (sloupec) může mít libovolný
počet pochozích ploch; každá má svou výšku a některé i strop. Nic se nedopočítává
z okolí — plocha je záznam v datech.

**Patro je jmenovka, ne pořadí.** Číslo patra (0, −1, −2 …) jen říká „tyhle
plochy patří k sobě" — aby šlo malovat, svítit, hledat vodu a ukládat po celých
plochách. Štítky se nikdy nepřečíslovávají; přečíslování by rozbilo mapy, spoje
i uložené hry. Nová jeskyně vložená mezi dvě dostane další volný štítek.

**Pořadí se počítá v každé buňce zvlášť, z výšek.** Co je nade mnou, pode mnou
a mezi tím, pozná buňka tak, že si své plochy seřadí podle výšky. Globální
pořadí pater neexistuje a nikde se nepotřebuje — ani pro viditelnost, protože
„skrýt, co je nade mnou" je otázka pro buňku. V editoru se seznam pater řadí
podle naměřené výšky, ne podle štítku.

**Data** (formát mapy 9; verze 8 se načte jako všechno v patře 0):

- záznam vrstvy (`floor`, `grass`, `path`, `clearing`) dostane `level`
  (chybějící = 0) a `ceilY` (strop plochy; chybějící = otevřeno nahoru),
- nová sekce `connectors`: spoj `{ from: {cx, cz, level}, to: {cx, cz, level},
  kind }` — hrana mezi dvěma dvojicemi buňka + plocha, **libovolného směru**:
  svislá šachta, vodorovný průchod i šikmý vchod ze skalní stěny. `kind`
  (`stairs`, `ramp`, `ladder`, `shaft`, `passage`) říká, jak spoj vypadá a kdo
  po něm umí chodit,
- dekorace patří k patru stejně jako plocha, na které stojí.

**Hloubka:** rozsah výšek je −15 až +24 m (v krocích 0,3 m), takže jeskyně jde
vyhrabat do 15 m pod nulou. Původně to bylo 6 m — rozšířilo se kvůli patrům.

**Zkušební jeskyně v mapě Glade:** 16 buněk (4×4) pod plošinou u spawnu
(plocha −1, dno 0,9 m, strop 3,6 m, povrch štěrk) a **vchod ve skalní stěně**
na buňce −6,−10, který vede ven na −5,−10. Všechny výšky jsou násobky 0,3 m,
takže je editor umí namalovat. V editoru se dá posunout nebo zrušit.

**Pozor při ukládání mapy:** editor ukládá to, co má otevřená stránka. Když se
data mapy změní mimo běžící hru, je potřeba **obnovit stránku (F5)** — jinak
uložení starý stav vrátí. Takhle jednou zmizela sekce `connectors` a s ní vchod
do jeskyně.

**Strop se kreslí jen zespodu.** Je to jednostranná plocha s normálami dolů, takže
zeshora je neviditelný a pozdější pohled do jeskyně z výšky zůstane volný — strop
nedělá poklop. Vidět je tam, kde se do jeskyně díváš zevnitř: vchodem ze skalní
stěny při plochém úhlu kamery, nebo v editoru.

**Pravidla, která drží model pohromadě:**

1. **Strop je údaj plochy**, ne dopočet z plochy nad ní. Jinak by jeskyně pod
   horou byla vysoká podle hory.
2. **Mezi plochami se chodí jen po spoji.** Geometrie nikdy nedovolí přechod
   sama. Spoj zároveň znamená díru ve stropě nebo v podlaze a vynechanou stěnu
   tam, kudy prochází — takže nemůže vzniknout jeskyně se schody a bez díry.
   **V buňkách spoje neplatí stěnová kolize útesu** (jinak by se kvůli „překryvu
   útesu" k díře vůbec nedošlo); schod nahoru/dolů dál hlídá krokový limit, takže
   se přes otvor nedá nikam vyskočit.
3. **Světlá výška 2,6 m** (postava měří ve světě 2,31 m, zbytek je rezerva) je
   minimum, do kterého hráč vejde; editor varuje, když jeskyně vyjde nižší.
   Výchozí světlá výška nové jeskyně je 3,0 m.
4. **„Jsem pod střechou" se odvozuje** z toho, že nade mnou existuje strop —
   neukládá se. Z toho plyne tma, žádné slunce a klid na pozadí.
5. **Buňka zabraná šachtou nemá v tom patře podlahu.** Výškové pole to musí
   vědět, jinak díru zalepí výškou od souseda — dnes to tak dělá u okraje mapy.

**Plochy mezi buňkami** — jádro práce. Nejdřív tabulka případů (co je na jedné
straně, co na druhé, jaká plocha mezi nimi), pak geometrie z ní:

- **Stěny dutin se staví jen u ploch, které mají strop.** Otevřený povrch světa
  se do nich nepočítá — o jeho stěny se starají útesy. Kdyby se počítal, udělá
  každý schod rovnou stěnu a útesy ztratí svůj vzhled.
- **Stěna dutiny se tam, kde sousedí s otevřeným světem níž než její dno,
  nekreslí.** Skalní stěna sama dutinu uzavře — a protože je to tatáž plocha,
  nevyčuhuje z ní žádná umělá stěna. Jinde (soused má povrch nad stropem dutiny)
  se stěna kreslí, ale je schovaná uvnitř skály.
- **Vchod do skalní stěny:** tam, kudy prochází spoj, se útes staví jen **nad
  otvorem**, ne od země — tím ve stěně vznikne díra. Profil stěny se přitom
  počítá z původní plné výšky a jen se pod otvorem odřízne, aby si skála
  zachovala svůj tvar. **Podlahy se v místě vchodu potkají jen tehdy, když leží
  ve stejné výšce** — pak na sebe navážou samy, bez jakékoli pomocné geometrie.
  Když se výšky rozejdou, vznikne schod; ten bude řešit rampa nebo schody
  (spoj už druh `stairs`/`ramp` má, jen se zatím nekreslí).
- **Konec spoje, který je díra, bere výšku z výškového pole.** Buňka s dírou na
  horní ploše nemá v datech co změřit; bez toho by spoj zanikl a díra by zůstala
  zavřená stropem.

- stejná plocha, stejná výška → žádná plocha mezi nimi,
- stejná plocha, jiná výška → schod nebo útes (dnes),
- plocha na jedné straně, nic na druhé → stěna,
- plocha na jedné straně, šachta na druhé → stěna šachty,
- dvě plochy nad sebou, soused jen jednu → stěna od podlahy ke stropu,
- skála mezi dvěma plochami → neviditelná, ale musí existovat,
- strop a podlaha téže plochy v jedné buňce (tenká skála) → dvě plochy.

**Pořadí prací:**

1. Data a dotazy: štítek patra a strop v záznamech, spoje, výšky po plochách,
   díra versus okraj mapy. Bez viditelné změny. **Hotovo.**
2. Geometrie podle tabulky ploch — podlaha, strop, stěny, šachty. **Hotovo**:
   povrch po plochách, stropy, stěny dutin, šachty i vynechané stěny u spojů.
3. Hráč a tvorové nesou štítek patra; pohyb jen v rámci plochy; spoje. **Hotovo**
   u hráče i tvorů (štítek patra, průchodnost podle patra) a u hráče i průchod
   spojem (vejde do jeskyně a ven). Tvorové zatím přes spoj nechodí — jejich
   hledání cesty je 2D nad jednou plochou (viz Stav níž).
4. Viditelnost a světlo: skrýt plochy nade mnou, pod stropem tma.
   **Tma a jeskynní ambient hotové.** Tma je **prostorová**: jeskynní plochy
   (dlažba patra −1, stěny a strop jeskyně) jsou vyloučené ze slunce i z oblohy,
   takže jsou tmavé **vždy** — i když tam nikdo nestojí; svítí je jen slabé
   jeskynní světlo a pochodеň/oheň. Povrch zůstává vždy světlý. **Postava a tvorové
   zůstávají osvětlení normálně i v jeskyni** (vylučovat je ze světla dělalo potíže —
   po výstupu černali; doladí se později). Zvuk se naproti
   tomu přelévá podle hráče: pod stropem se les ztlumí a rozehrajе se `cave.ogg`
   (a naopak). **Skrývání nad hráčem hotové:** povrch se staví po **dílcích**
   (skupiny buněk, `SURFACE_CHUNK`) a každý dílek ví, jestli leží nad jeskyní
   (`overCave`). Když je hráč pod stropem, schovají se dílky vyššího patra, které
   jsou nad jeskyní v okolí hráče (strop jeskyně je zeshora neviditelný, takže je
   vidět dovnitř). Jinde zůstávají vidět. Pozn.: dílek je větší než malá jeskyně,
   takže u okrajů se může odkrýt i prázdno — to je „hloubka skály", samostatné téma.
5. Editor: přepínač pater, štětec díry, štětec spoje, řez sloupcem, duch skryté
   plochy, kontroly (díra bez spoje, nízký strop, podlaha pod vodou) a vracení
   zpět přes plochy.
6. Voda po plochách — samostatná etapa, protože jedna hladina dnes proteče
   stropem.
7. Ukládání: štítek patra u hráče, tvorů i táboráků; stará uložení = patro 0.

Kroky 1–3 se dají ověřit na mapě napsané ručně, bez editoru.

**Stav:** kroky 1–3 jsou hotové (data, dotazy, geometrie i pohyb po patrech).
Co je potřeba doladit, až se k tomu vrátíme:

- **šev nad vchodem** (vchod na −5,−10 mezi −5,−9 a −5,−11) — **opraveno.**
  Vršek útesu má vizuální převis (lem se rozšiřuje nad stěnu), který je na
  sousední stěně vidět jako prohnutí. Pruh skály nad otvorem se napojuje na dvě
  sousední stěny a dřív se při výřezu posouval i první řádek nad otvorem, takže
  se ten převis na pruhu „zmáčkl" a na prohnutí sousední stěny nenavázal (k −5,−9
  to sedělo, protože tam sousední stěna končí ve výšce otvoru 3,6 m a převis tam
  žádný není). Teď výřez jen odřízne spodek a **řádky nad otvorem nechá beze
  změny**, takže lem/převis zůstane stejný jako u sousední stěny a šev naváže.
  *(čeká na vizuální potvrzení v dev serveru)*
- **skvíra u podlahy** ve vchodu — **opraveno.** Dlažba jeskyně je rovná, ale zem
  před vchodem je vyhlazovaný povrch se zvlněným okrajem (reliéf skály se do něj
  promítá) a její výšku táhne i sousední buňka −5,−11 (0,94 m vs. 0,9 m). Podél
  vchodu se proto hrana země a dlažby nesešly a zůstal tenký klín. Teď se hrana
  země podél otevřeného vchodu srovná na rovnou dlažbu — ve výšce i v půdorysu
  (přesně na hranici buňky) — takže na sebe navážou. *(čeká na vizuální potvrzení
  v dev serveru)*
- **v jeskyni je tma a hraje jeskynní ambient** — hotovo v kroku 4 (část světlo/zvuk);
  skrývání ploch nade hráčem (vidět do jeskyně z výšky) taky hotové — dílky nad jeskyní
  se pod stropem schovají,
- **tvorové nechodí přes spoj** — jejich hledání cesty je 2D nad jednou plochou;
  štítek patra i průchodnost podle patra mají, ale do jeskyně sami nevejdou. V jeskyni
  zatím žádní nejsou, takže to nevadí; doplní se, až tam mít budou,
- **editor neumí** namalovat plochu −1 ani spoj (krok 5),
- **vchod potřebuje stejnou výšku** na obou stranách; když se rozejdou, vznikne
  schod — ten budou řešit rampy nebo schody.

**Viditelnost se bude vylepšovat.** První verze skryje celou plochu nad hráčem;
později totéž po buňkách kolem hráče (plynulé schovávání, průhled). Aby to druhé
neznamenalo přestavět terén, staví se geometrie **po skupinách buněk** už od
začátku — to je jediná věc, která by se dodatečně dělala draze.

**Hloubka skály.** Terén není kus skály, ale sada tenkých skořápek: pochozí
povrch nahoře, stěny útesů po stranách (oboustranné, takže z rubu je vidět
textura) a „sukně" na okraji mapy. Pod povrchem ale není nic vyplněné — je tam
prázdný prostor, který uzavírají jen ty skořápky. Dokud je terén kompaktní, není
to vidět. Jakmile skálu prořízne vchod (a později celé jeskyně), vnější skořápka
se přeruší a její okraj se nenapojí na vnitřní stěny jeskyně — mezi nimi zůstane
prázdno. Proto je u vchodu „vidět dovnitř" a z boku je skála prázdná. Odpovídá to
dřívějšímu pravidlu „skála mezi dvěma plochami je neviditelná, ale musí
existovat" — dnes existuje jen jako prázdno.

*Směry řešení (cena roste shora dolů):*

- **Hrdlo u otvoru:** kolem každého vchodu doplnit krátké stěny, které spojí
  vnější okraj díry s vnitřními stěnami jeskyně. Levné a místní, řeší jen otvory.
- **Plné těleso po vrstvách:** doplnit spodní víka a vnitřní stěny tak, aby každý
  vyvýšený blok byl uzavřený a nebylo přes něj vidět; jeskyně je dutina v něm.
  Střední cena, sedí na model pater.
- **Skutečná tloušťka stěn:** rubová plocha posunutá dovnitř a zarovnané hrany.
  Robustní pro jakýkoli řez, ale nejdražší a u jeskyní naráží na dutinu uvnitř hmoty.
- **Tmavé skalní dno (kosmetika):** prázdno vyplnit tmavým rubem a spodními víky,
  aby to vypadalo jako temná skála, ne prázdno. Rychlé, ale není to skutečná hloubka.

*Doporučení:* nejdřív pomůže „hrdlo" u vchodu (přestane prosvítat); dlouhodobě
k tomu patří plné těleso po vrstvách — model pater už s ním počítá.

**Řeší se velkou etapou „objemový terén" (viz konec dokumentu).** Skalní kůže ani
jiné náplasti se nakonec nepoužijí; terén se předělá na skutečnou hmotu.

**Otevřené otázky:** má se pod stropem zastavit denní doba; co má být uvnitř
ke sbírání (ruda, krystaly) a jací tvorové; a jestli má voda v podzemí přijít
hned po editoru, nebo až po něm.

## Velká etapa: objemový terén (skála jako hmota)

**Proč.** Terén je dnes sada tenkých skořápek (povrch, stěny útesů, strop jeskyně,
sukně). Pod povrchem není hmota, takže v řezech (vchod, odklopení střechy ve 4B) je
vidět prázdno až do moře. Náplasti (skalní kůže, prosvícení, přiklopení kamery)
problém jen maskují. Pro budoucí přesahy, jeskyně kdekoliv a volná patra je potřeba
terén jako objem.

**Princip.** Místo „jedna výška na buňku a patro" drží každá buňka seznam **plných
pruhů** (od–do) v rozlišení kroku; mezi nimi je vzduch. Je to totéž co voxely, jen
komprimované (run-length). Umí jeskyně kdekoliv, volná patra, přesahy (pruh s prázdnem
pod i nad), tunely i libovolný řez. Pevná skála se **odvodí ze stávajících dat** jako
doplněk vzduchu (`airSpansAt` dá vzduch, zbytek je skála) — proto jde o migraci, ne
o přepis mapy od nuly.

**Krok výšek 0,25.** Změna z dnešních 0,3 na **0,25** (0 = default; kulatá čísla
0 / 0,25 / 0,5 / 0,75 …). Rozsah zůstává **−15…+24 m** → v počtech kroků **−60…+96**
(`MIN_HEIGHT`/`MAX_HEIGHT` a `HEIGHT_PRESETS` přepočítat).

**Tři oddělená čísla** (dřív částečně svázaná s krokem; teď záměrně oddělené):

- **krok mřížky** = 0,25 (jen rozlišení/vzhled),
- **co postava/tvor vyleze** ≈ 0,5 (samostatný limit, nezávislý na kroku),
- **práh útesu** zvlášť (velký rozdíl výšky nebo buňka označená jako útes).

**Co se přepíše.** Kreslení terénu jedním **mesherem pruhů** po dílcích: horní líce
= podlaha, spodní líce = spodní víka, boční líce = útesy / stěny jeskyní / přesahy
(stěny slučovat kvůli výkonu). Dále dotazy na výšku a průchodnost (na pruzích), voda
po sloupcích, editor (malování výšky + vykopat/vyplnit), formát mapy a savu (nová
verze + migrace). Tráva, dekorace, kamera a tvorové zůstanou, jen budou číst nové
dotazy.

**Největší riziko: vzhled útesů.** Současné římsy, převisy a mech jsou procedurální
na plochách; na objemových lících je třeba detail znovu vymyslet, jinak krajina zhrubne.

**Fáze (hra běží celou dobu; starý renderer držet až do fáze 2):**

0. Model pruhů vedle stávajícího (`utils/terrainRuns.js`, `terrainSystem.solidRunsAt`)
   a krok výšek 0,25 v `layoutStore` (rozsah −15…+24 m, `HEIGHT_STEP`, předvolby).
   **Hotovo.** Přeškálování starých výšek na 0,25 a zvednutí krokového limitu (~0,5)
   patří na začátek fáze 1 — mění svět/pohyb, tak ať to jde s migrací naráz.
1. Nový mesher pro podlahy (horní líce) za přepínačem; porovnat se současným povrchem.
2. Boční a spodní líce (skála, stěny jeskyní, spodní víka) → hmota; odstranit staré
   útesy/dutiny/sukni; ladit vzhled.
3. Pohyb a dotazy na pruzích.
4. Voda, tráva, dekorace, kamera na nové dotazy.
5. Editor: úpravy pruhů (vykopat/vyplnit), díry, spoje.
6. Formát mapy a ukládání (nová verze, migrace starých).
7. Dočistit 4B: odkrývání střechy je teď bezpečné (skála je hmota) a skryjí se i
   dekorace na odkrytých buňkách.

**Stav:** Fáze 0 hotová (model pruhů + krok 0,25). Čeká na fázi 1 (mesher podlah).

