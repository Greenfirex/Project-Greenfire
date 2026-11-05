# Project Greenfire

3D survival hra, hratelná ve webu (Vite + Babylon.js).

Aktuální úkoly a známé chyby jsou v [TODO.md](TODO.md).

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5174
```

Při startu běží přes obrazovku načítání reálné počítadlo dokončených dílů (dlaždice mapy,
stromy a kameny, modely tvorů, postava, její animace, nástroje, příprava ukládání). Mapa se začne
vykreslovat dřív, než doběhnou všechny modely; vstup je zamčený, dokud obrazovka nezmizí.

## Ovládání

| Vstup | Akce |
|---|---|
| **W A S D / šipky** | Pohyb postavy (vzhledem ke kameře), Shift = běh. V editoru posouvají pohled po mapě, Shift zrychlí |
| **Tažení pravým tlačítkem** | Rotace kamery (i v editoru); v editoru pravé kliknutí bez tažení odebírá buňku |
| **Kolečko** | Zoom (v editoru jde oddálit víc než ve hře) |
| **1–3** | Výběr předmětu v ruce (sekera, krumpáč, pochodeň) |
| **I / C** | Inventář / postava — velká okna uprostřed obrazovky, jde s nimi tahat (také tlačítky po stranách lišty) |
| **Levé tlačítko u stromu / kamene** | Těžení (podržet = opakovat) |
| **Levé tlačítko u tvora** | Útok rukou (podržet = opakovat) |
| **E** | Zapálit / zrušit táborák |
| **G** | Zobrazit / skrýt mřížku |
| **N** | Posun času o 6 hodin |
| **P** | Pauza / pokračovat (ztmaví obrazovku, zastaví celou hru) |
| **F1** | Nápověda a ovládání (rozbalit / sbalit) — také tlačítkem ❔ Ovládání v liště |
| **F2** | Editor mapy (zóny, výška, herní plocha, tvorové) — také tlačítkem 🧱 Editor v liště |
| **O** | Možnosti (záložky obraz a výkon, zvuk, hra) — také tlačítkem ⚙ Možnosti v liště |
| **F5 / F9** | Uložit / načíst (načtení se ptá na potvrzení) — také tlačítky 💾 Uložit a 📂 Načíst v liště |
| **Ctrl+Alt+I** | Ladicí okno Babylona (jen při vývoji; jde i přes adresu `?inspector`) |

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

Funkční: izometrická ortho kamera, navazování na postavu, mřížka s hover
zvýrazněním, hratelná postava s animacemi (idle/run/jízda nástrojem), sběr
dřeva a kamene včetně kácení stromů, batoh a postava v oknech nad lištou
předmětů, log událostí vlevo dole, táborák s ohněm a svícením, oheň pochodně,
denní cyklus se stíny, lesní zvuky a kroky podle povrchu, panel možností,
editor mapy (zóny, cesty, výšky ±6 m, štětec pláže se svahem po 0,3 m,
štětec útesů s hliněnou stěnou, výběr buněk, undo), spojitý terén
s hranou mapy, cesty kopírující terén, hráč chodící po výšce země,
vodní hladina s vlnami a pěnou (v editoru jde jen skrýt, hladina i ryby
zůstanou), mokrý pruh na břehu kopírující terén,
rozbitý okraj písku s ostrůvky a jazyky, štětec Mušle s lasturami
ve čtyřech tvarech a třech velikostech (největší se dá sehrát), korály
na dně jako deset variací shluků se štětcem Koraly, hejna ryb
pěti barev (i drobných), která se toulají vodou, občas vyšlou rybku na
potulky a plaší se před hráčem, tráva ze čtyř modelů (pobřežní tráva,
širokolistý trs, nízký polštářek a kapradina) s květinami ve čtyřech barvách
(květy se houpou ve větru a rostou i ve shlucích, štětec Tráva je umí vypnout),
keře v šesti tvarech (kopule, sloup, suknice, stěna, hrbolatý, z karet listí
s vnitřní vrstvou, tmavší u země a světlejší nahoře, aby měly objem,
s měkkým stínem pod sebou — všechny skvrny jedním tahem —, houpou se ve větru,
sází je nástroj `scatter/bushes.mjs` hustě v pásu podél břehů a řidčeji
ve vnitrozemí, i ve shlucích, a mohou růst i pod stromy), plynulé prolínání trávy a písku
(texturou i barvou), hráč ve vodě (mělká zpomalí, do hluboké nesmí),
kroky ve vodě, příboj u vody, obloha se sluncem
a ukládání/načítání do prohlížeče.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů).

### Předání stavu

Poslední commit: `d212110` — procedurální vegetace, kameny a kamenné útesy.
Přinesl listnáče s rekurzivním větvením a atlasem tří listů, kameny stavěné
v kódu (pět tvarů a tři shluky, náhodné otočení a zvětšení), volbu kamenného
nebo hliněného útesu ve štětci Útes, míchání povrchů, které útes respektuje,
trávu na buňce se stromem a novou texturu listu palmy bez bílého oparu.
Staré low-poly modely stromů a kamenů jsou odstraněné a mapa je převedená
na procedurální druhy. Pracovní strom je čistý.

**Stav:** plán kolem terénu, povrchů a vody je uzavřený. Zbývá jen volitelné
doladění a práce mimo tento plán.

**Hotovo:**
- Povrchy a terén: písek a tráva, razítko Herní plocha, výškové nástroje,
  Kopec/Prohlubeň se svahem, spojitý terén, hrana mapy a cesty.
- Výšky: rozsah −6 až +24 m, krok 0,3 m, předvolby −6, −3, 0, 3, 6, 9, 12,
  18 a 24 m; jediný krok je 0,3 m.
- Výškový panel: vlastní okno, škála, barevné odlišení, počet, Zpět,
  Aplikovat a Zahodit; hlavní HUD už výškový řádek nemá.
- Výběr: hover buňky, levé tlačítko přidá, pravé kliknutí odebere, 0 m
  srovnává; platí pro výšky, brush drafts i Herní plochu.
- Hráč: chodí po skutečné výšce země; kamera ho sleduje i svisle; spawn,
  načtení savu a odstrčení od objektů počítají s terénem.
- Cesty: jemná síť kopíruje terén, drží se 2,5 cm nad zemí.
- Pláž: štětec s hloubkami −1,5 / −2,4 / −3 m; písek ve zvolené hloubce
  a prstence písku po 0,3 m kolem, z nichž spojitá zem udělá břeh.
  Volitelný Plynulý okraj přidá prstenec písku navíc. V pánvi mizí objekty
  a tráva, na svazích se objekty posouvají s terénem; Zpět na trávu
  srovná výšku na 0 a vrátí trávu.
- Přechod povrchů: hranice jsou rovné; tráva se u okraje plynule prolíná
  do písku texturou i barvou a písek do trávy neproniká (jednosměrné).
  Šířka pásu se lokálně mění šumem, aby přechod nepůsobil jako pruh.
  U stěn útesů se písek stahuje k zdi do nuly (aby nepřeskočil na plošinu),
  ale zbytek buňky zůstává pískový — jinak by v trávě u paty vznikl pruh.
- Staré skalní modely: pryč z katalogu, mapy i assetů; kopce a stupně dělají
  jen výšky.
- Útesy: štětec označí buňky jako plošinu; kde je mezi označenou buňkou
  a sousedem skok, vznikne svislá kamenná stěna, nebo hliněná se stejnou texturou
  jako okraj mapy, a hráč přes ni nepřejde. Volba Pata útesu přebarví při malování
  povrch buněk pod stěnou (výšky zůstanou). Mapa kvůli značce poskočila na verzi 4.
- Voda: hladina pro celou mapu jako nepovinné číslo v souboru mapy; v editoru
  se zapíná tlačítkem Voda a hladina se ladí po 0,3 m; Z vrací krok.
  Mapa má hladinu −0,3 m, takže je voda zapnutá hned po startu.
- Vzhled vody: vlastní program pro orthografickou kameru — vlny tlumené
  v hloubce, přílivové jazyky na písek, pěna a bílé hřebeny viditelné
  z každého úhlu, barva a průhlednost podle hloubky a odraz okolí přes
  odrazovou sondu (terén, dekorace, postava).
  Hustota vodní sítě jde podle kvality grafiky (0,5/1/2 m).
- Voda leží jen na skutečných buňkách mapy, takže nevyčuhuje mimo obrys ani
  do děr; na kraji mapy a v dírách ji uzavírá svislá vodní stěna. Písek
  u břehové čáry ztmavne, jako by byl mokrý; při změně hladiny v editoru se
  břeh i voda překreslí.
- Obloha: SkyMaterial bez textury; slunce na obloze jde podle denní doby
  a voda z ní bere barvu. Odraz okolí řeší odrazová sonda; obloha se
  do odrazu nepouští.
- Data a ukládání: ukládání hráče beze změny; výška je desetinné číslo,
  mapa má kvůli značkám útesů a předvolbám trávy verzi 7.

**Zbývá:**
- Volitelné doladění: rostliny u břehu, zatopené kameny, skutečný odraz
  oblohy, bouřka a déšť (počasí).
- Doladit suché jámy pod hladinou (suchá zóna nebo vodní zóny).
- Mimo uzavřený plán: recepty a plnění batohu.

**Další krok — vizuální test:**
- Přechod trávy a písku: rovná hranice bez proužku trávy i bez světlého
  lemu, diagonální rohy plynule prolnuté, i na přímém slunci.
- Voda: hráč se v mělké vodě zpomalí, do hluboké nesmí.
- Zvuky: kroky ve vodě, příboj slábne se vzdáleností a u vody ztlumí les.
- Ulož mapu a obnov — hladina, povrchy i jejich prolnutí musí držet.
- Když něco nesedí, šířka pásu, síla variací a hlasitosti jsou jen čísla.

**Klíčová rozhodnutí (nevrátit omylem):**
- Výšky jsou v metrech, krok 0,3 m, rozsah ±6 m; předvolby včetně ±4,5 a ±6.
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
- Vzorek pěny i jemných vlnek se posouvá jedním společným směrem podle
  převládajícího sklonu břehu. Kdyby se posouval v každém místě podle
  místního sklonu, na zakřiveném pobřeží by se vzorek mezi sousedními místy
  roztřepil — čím déle by hra běžela, tím víc.
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
- Suché jámy pod hladinou (doly, sklepy) současná plocha neumí; vyřeší se
  později suchou zónou nebo vodními zónami.
- Mapa má verzi 5 (značka útesu, vrstva mostů); hladina vody je nepovinné číslo
  a verzi nemění. Starší mapy se načtou bez vody i bez mostů.

**Kde co je:**
- `src/data/maps/layoutStore.js` — rozsah výšek, krok, předvolby.
- `src/editor/heightPanel.js` — okno Výška; `areaPanel.js`, `brushPanel.js` — plocha a štětce.
- `src/editor/editorMode.js`, `mapEditor.js`, `editorHud.js` — editor, výběr, panely, pláž, voda.
- `src/systems/gridSystem.js`, `inputSystem.js` — hover, levé/pravé tažení.
- `src/utils/terrainField.js` — výškový model (spojitá výška mezi buňkami).
- `src/systems/terrainSystem.js` — terén, hrana, útesy, mosty, prolnutí povrchů.
- `src/utils/bridgeShape.js` — tvar skalního mostu: klenba, čela a pochozí plocha.
- `src/systems/terrainBlendPlugin.js` — míchání textur sousedních povrchů v materiálu terénu.
- `src/utils/waterWaves.js` — čísla a výpočet vln (společné pro program i hru).
- `src/systems/audioSystem.js` — kroky, příboj, oheň a ambientní vrstvy.
- `src/systems/waterSystem.js` — hladina, odrazová sonda, kraj mapy.
- `src/systems/waterShader.js` — program pro vodu: vlny, pěna, svislá stěna.
- `src/systems/skySystem.js` — obloha a slunce.
- `src/systems/pathSystem.js`, `playerSystem.js`, `cameraSystem.js` — cesty a hráč.
- `src/data/catalogs/brushes.js` — štětce včetně Pláže, Útesu a Mostu; `decorations.js` — písek a povrchy.
- `src/data/maps/glade/map.json` — aktuální mapa; `README.md` — přehled a tento handoff.
- `.clinerules` — pravidla práce.

## Závislosti a licence

- `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/materials` (8.56.2) — jádro hry, načítání modelů a obloha.
- `@babylonjs/inspector` (8.56.2) — jen vývojová závislost; do produkčního buildu se nebalí.
- Zvuky: Free Fantasy SFX Pack od TomMusic (tommusic.itch.io); původ je zapsaný
  v `public/assets/audio/CREDITS.txt`.
- Textury pěny: `foam_fine_*` a `foam_coarse_*` v `public/assets/nature/textures/`.

**Pravidla pro navazujícího agenta:**
- Přečíst `.clinerules`, README a tuto sekci; ověřit `git status` a `git log`.
- Neinstalovat závislosti, nespouštět build/dev server, nezakládat testovací
  skripty, necommitovat. Vizuálně testuje uživatel.
- Jeden krok = jeden commit; commit dělá uživatel.
- Držet architekturu: scéna propojuje systémy, jeden vlastník hodnot,
  komentáře jen hlavičky, data a sav podle `.clinerules`.
- Nezasahovat do jiných projektů; dočasné soubory jen do `tools/_temp/`.

**Otevřené otázky pro uživatele:**
- Pláž: štětec je hotový; čeká se na vizuální test a potvrzení hloubek a okraje.
- Plynulý okraj: zatím jen zapnuto/vypnuto a jeden prstenec navíc; šířku doladit podle testu.
- Třímetrová pánev: tvar se kreslí štětcem, hloubka dna je předvolba −3 m.
- Přechod povrchů: šířka pásu a síla variací se ladí podle vzhledu.

**Test předání:**
- Ověřit, že sedí poslední funkční commit a po commitu handoffu je strom čistý.
- Ověřit, že výškový panel, výběr, hráč, cesty a hrana fungují.
- Ověřit štětec Pláž: hloubka, břeh, Plynulý okraj a Zpět na trávu.
- Ověřit vodu: hladina v pánvi, břeh po změně terénu, uložení a načtení.
- Ověřit přechod trávy a písku: rovná hranice, diagonální rohy, šev není vidět.

**První kroky dalšího agenta:**
1. Přečíst README/Předání a `.clinerules`.
2. Ověřit git stav.
3. Nechat uživatele otestovat povrchy, vodu a zvuky a počkat na potvrzení.
4. Případné úpravy dělat jen v části, které se týkají.
5. Po potvrzení pokračovat volitelným doladěním (rostliny u břehu, zatopené kameny, odraz oblohy).

## Voda

Voda je jedna hladina pro celou mapu, uložená jako nepovinné číslo
v souboru mapy. Kreslí ji vlastní program: vlny (vyšší v hloubce, nižší
u břehu), barva a průhlednost podle hloubky, pěna u břehu, odraz okolí přes
odrazovou sondu, kaustika na dně pod hladinou a tmavší hladina v noci.
Hloubka se bere z terénu pod hladinou. V editoru se voda zapíná tlačítkem
Voda a hladina se ladí po 0,3 m. Suché jámy pod hladinou současná plocha
neumí — vyřeší se později suchou zónou nebo vodními zónami.

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
0,5 m) a suché jámy pod hladinou (suchá zóna nebo vodní zóny).

**Další práce:** recepty, plnění batohu, výroba předmětů z batohu
a nový systém stavění (ten starý byl odstraněn).

## Editor mapy

Editor se otevírá **F2** a hru při otevření pozastaví. Umožňuje kreslit zóny
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
