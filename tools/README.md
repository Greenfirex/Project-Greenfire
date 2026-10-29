# Nástroje

Vývojářské nástroje mimo běh hry. Pouští se ručně z rootu projektu (Node, ESM).

- `_temp/` — dočasné soubory, náhledy, logy a scratch skripty. Nekomituje se.

## glb_measure.mjs

Změří GLB modely (rozměry, pivot, rozložení geometrie po dlaždici) a vypíše ASCII
heatmapu plus souhrn vertexů po stranách N/S/E/W. Slouží k odvození orientace
dlaždic — kde má dlaždice rameno cesty, stěnu cliffu nebo volný okraj.

```
node tools/glb_measure.mjs "public/assets/nature/paths" --pattern "^ground_path"
node tools/glb_measure.mjs "public/assets/nature/paths/ground_pathCorner.glb"
node tools/glb_measure.mjs "public/assets/nature/cliffs" --pattern "^cliff_" --json
```

Adresáře assetů ve hře drží `src/data/catalogs/assetPaths.js`.

## make_cliff_catalog.py

Vykreslí izometrický náhledový katalog cliff modelů do jednoho PNG — každý model
na čtverci půdorysu buňky, s kompasem (červená šipka = `+Z` = jih). Slouží k tomu,
aby se „co je co" nemuselo hádat: je vidět, vyplňuje-li model celou buňku, nebo
je to jen lem nalepený na hranu, a na které straně.

```
python tools/make_cliff_catalog.py
python tools/make_cliff_catalog.py --filter "^(block|top|half|cornerTop)$"
```

Výstup: `tools/_temp/cliff_catalog.png`.

## shores.mjs

Doplní do souboru mapy lastury na břeh a koraly do hloubky. Lastury leží kolem
hladiny ve čtyřech tvarech a třech velikostech. Koraly se sázejí jako několik
shluků v hluboké vodě (aspoň 2 m) — na každé buňce shluku 8–14 menších kusů
s náhodným posunem a měřítkem, takže nevypadají jako pravidelná mřížka ani jako
jeden kus na buňku. Každá drobnost dostane svoji výšku, aby nevisela ve vzduchu.
Lastury se nikdy nesázejí na sousední buňky, aby nevznikaly hromady. Na jedno
místo u spawnu dá jednu obrovskou mušli, kterou jde ve hře sehrát krumpáčem.
Před zápisem smaže dřívější břehové i mořské drobnosti, takže se dá pouštět
opakovaně. Nakonec do mapy zapíše třináct hejn ryb pěti barev — stříbrné i
v hloubce, barevné (zlaté, zelené, červené) do mělčiny, kde je voda průhledná,
a drobné roje až od 0,3 m hloubky. Část hejn krouží, část se toulá. Hejna se
sázejí jen tam, kde je v okolí dost vody (od 0,3 m u břehu po 0,7 m v hloubce),
aby ryby nevplavaly na souš.
Výšky počítá stejným kódem jako hra (`src/utils/terrainField.js`),
takže vše sedí na skutečný terén.

```
node tools/shores.mjs --dry          # jen spočítá a vypíše, soubor nezmění
node tools/shores.mjs                # zapíše do src/data/maps/glade/map.json
node tools/shores.mjs cesta/map.json # jiná mapa
```

Budoucí úpravy břehu se dělají štětcem **Pobřeží** v editoru mapy, tenhle
nástroj je jen na první naplnění mapy.

## Cliff assety — co je co

Zdroj: `public/assets/nature/cliffs/cliff_*_rock.glb`.
Buňka je široká 1.0 v X i Z (střed buňky = 0,0, hrana buňky = ±0.5). Ve hře se
modely zvětšují `scale: 2.0` (1 jednotka modelu = 2 jednotky světa).

### Bloky — samostatná hmota, vyplňují CELOU buňku (X −0.5..0.5, Z −0.5..0.5)

| asset | Y (výška) | význam |
| --- | --- | --- |
| `cliff_block` | 0..1.0 | plná kostka |
| `cliff_blockHalf` | 0..0.5 | půlblok |
| `cliff_blockQuarter` | 0..0.25 | čtvrtblok |
| `cliff_blockCave` | 0..1.0 | kostka s jeskyní |
| `cliff_blockDiagonal` | 0..1.0 | kostka s diagonálním lícem |
| `cliff_blockSlope` | 0..1.0 | rampa (přesah X −0.6..0.6) |
| `cliff_blockSlopeWalls` | 0..1.0 | rampa s bočnicemi |
| `cliff_blockSlopeHalfWalls` | 0..0.5 | půlrampa s bočnicemi |
| `cliff_steps` | 0..1.0 | schody (přesah Z −0.55..0.5) |
| `cliff_stepsCorner` | 0..1.0 | rohové schody |

### Lemy — deska nalepená na hranu `z+`, NENÍ to blok

Rozhodující: lemy mají Z jen `0.08`–`0.33 .. 0.50`, tedy leží u hrany buňky
`z = +0.5`, ale X mají přes celou buňku `−0.5..0.5`. **Lemy se proto umisťují do
středu buňky bez offsetu** — jejich geometrie už je vůči hraně buňky. Rotací se
natočí na požadovanou světovou stranu.

| asset | X | Z | Y | význam |
| --- | --- | --- | --- | --- |
| `cliff_top` | −0.5..0.5 | 0.23..0.50 | 0..1.0 | boční lem plné výšky (s trávou) |
| `cliff_half` | −0.5..0.5 | 0.08..0.50 | 0..0.5 | boční lem půl výšky |
| `cliff_large` | −0.5..0.5 | 0.08..0.50 | 0..1.0 | boční lem plné výšky, silnější |
| `cliff_cave` | −0.5..0.5 | 0.33..0.50 | 0..1.0 | lem s jeskyní |
| `cliff_waterfall` | −0.5..0.5 | 0.33..0.50 | 0..1.0 | lem s vodopádem |
| `cliff_waterfallTop` | −0.5..0.5 | 0.23..0.50 | 0..1.0 | lem s vodopádem nahoře |
| `cliff_rock` | −0.5..0.5 | 0.33..0.50 | 0..1.0 | lem (základní) |

### Rohové lemy — úzké v X i Z, sedí v rohu buňky

| asset | X | Z | Y | význam |
| --- | --- | --- | --- | --- |
| `cliff_corner` | −0.50..−0.33 | 0.33..0.50 | 0..1.0 | rohový lem (úzký) |
| `cliff_cornerTop` | −0.50..−0.23 | 0.23..0.50 | 0..1.0 | rohový lem s trávou |
| `cliff_cornerLarge` | −0.50..−0.08 | 0.08..0.50 | 0..1.0 | velký rohový lem |
| `cliff_halfCorner` | −0.50..−0.08 | 0.08..0.50 | 0..0.5 | rohový lem půl výšky |

Rohové lemy mají geometrii v rohu `(−X, +Z)`, tedy v **jihozápadním (JZ)** rohu buňky
(`−X` = západ, `+Z` = jih). Při `rotation.y = π/2 · r` se roh posune takto:

| rotace | roh buňky, kde lem stojí |
| --- | --- |
| 0 | JZ (`−X, +Z`) |
| 1 | JV (`+X, +Z`) |
| 2 | SV (`+X, −Z`) |
| 3 | SZ (`−X, −Z`) |

Rohový lem stojí **na buňce diagonálně od valu** (nízká/prázdná buňka v diagonále),
a míří do toho **rohu buňky, který je nejblíž valu** — doplňuje tak bočnici valu
v jeho vnějším rohu. Rohy staví `buildRidgeCorners` (běží po `buildRidgeFlanks`):

1. Projde buňky valu (`ridgeLevels`), výška **≥ 1** (i metrové valy mají rohy).
2. Pro každou projde `DIAG_SIDES` — hledá diagonálního souseda **nižšího** než buňka
   (`neighbour < height`), s rozdílem **≤ 2**.
3. Buňka rohu se přeskočí, když je v `rampCells` nebo když už na ní stojí lem
   (`flankCells`) — roh a lem na jedné buňce se nikdy nepřekrývají.
4. `flankStack(neighbour, height)` určí vrstvy jako u lemů; `cliff_top` se mapuje
   na `cliff_cornerTop`, `cliff_half` na `cliff_cornerHalf` (`cornerKey`).
5. Buňka valu se 3 diagonálními valy dostane 3 rohy (roh valu má 3 hrany) —
   to je správně, ne chyba.

### Klíčová tabulka: směr diagonály → rotace rohu

Rozhodující je, že hmota rohu musí ležet na té straně buňky, kde je val.
Pro buňku `C` a val na diagonále `C + (dx, dz)` platí:

| směr valu od buňky | `(dx, dz)` | `DIAG_SIDES.dir` | roh buňky, kam jde hmota |
| --- | --- | --- | --- |
| JZ | `(−1, +1)` | 2 | SV (`+X, −Z`) |
| JV | `(+1, +1)` | 3 | SZ (`−X, −Z`) |
| SV | `(+1, −1)` | 0 | JZ (`−X, +Z`) |
| SZ | `(−1, −1)` | 1 | JV (`+X, +Z`) |

Pozor: `dir` je **otočený o 180°** proti směru valu — hmota rohu leží na hraně
přivrácené k valu, proto `JZ` val → `SV` roh atd. Když se `dir` nastaví ve směru
valu (0,1,2,3), rohy sedí na opačné straně buňky a objeví se jich dvakrát tolik
(dva na každý roh valu) — což je přesně chyba, která se tímhle pořadím opravila.

Ověřeno na testovacím bloku 2×2 (`(5,−5)`, `(6,−5)`, `(5,−6)`, `(6,−6)`,
výška 1): vzniknou **přesně 4 rohy** `cliff_cornerHalf` na buňkách
`(4,−4)` rot 2, `(7,−4)` rot 3, `(4,−7)` rot 1, `(7,−7)` rot 0 — každý hmotou
ke svému rohu valu. Na celé mapě 86 rohů, všechny hmotou nad vyšším sousedem,
0 rohů ve vzduchu a 0 rohů na buňce lemu.

`cliff_cornerHalf` = `cliff_halfCorner_rock.glb` (výška 1) v katalogu dekorací,
`cliff_cornerTop` = `cliff_cornerTop_rock.glb` (výška 2). Rohy jsou stejně jako
lemy **neblokovací** (`blocks = false`) a jejich buňky se rezervují v `occupied`.

Rohy v `buildBorderCliffs` **nejsou** — dřív se stavěl `cliff_cornerTop` přímo na
rohovou buňku valu, ale ta je vyplněná `blockStack`em, takže roh skončil zanořený
uvnitř plného bloku a nebyl vidět. `buildBorderCliffs` proto staví jen `blockStack`
a rohy řeší `buildRidgeCorners` na diagonálních buňkách valu.

### Maximální rozdíl výšky 2

Bočnice i rohy se staví **jen když je rozdíl výšek ≤ 2** (`height - neighbour > 2`
se přeskakuje). Bez toho vznikaly na prudkých stupních, kde soused chybí úplně
(`neighbour = 0`, val 4), dva kusy `flankStack` visící ve vzduchu. Rozdíl 2
odpovídá jednomu dvousloupcovému `cliff_top` — víc už se nedá poskládat.

### Díra (prohlubeň) kolem cesty

Val se nestaví v pásu `PATH_GAP` (4) buněk kolem cesty — vznikne průchod, ne
soutěska. Dvě věci dělá `PATH_GAP`:

1. **Vyhloubení** — `surfaceHeight(cx, cz, limit, carve, pathCells)` odečte od
   výšky `carve - distance`, kde `distance` je Chebyshevova vzdálenost buňky od
   nejbližší buňky cesty. Těsně u cesty (`distance = 0`) je výška o `carve` nižší,
   o `carve` buněk dál už beze změny → dlaždice k cestě **plynule klesají**,
   nevzniká stěna.
2. **Přeskočení** — `buildBorderCliffs` v pásu `inGap` buňky vůbec nestaví
   (`PATH_GAP` buněk od cesty a blíž) a `hillCells` tam taky nesází.

`pathDistance(cx, cz, pathCells, maxDist)` počítá Chebyshevovu vzdálenost
(8 sousedů, `max(|dx|, |dz|)`), takže díra je čtvercová, ne kosočtvercová.
Stejné `carve`/`pathCells` dostává i `rampPlan`, aby schody seděly na snížené
dlaždice, a `ridgeLevels` je čte z postavených dlaždic — lemy i rohy valu se
proto samy přizpůsobí novým výškám.

`PATH_GAP = 4` je zvolený proto, že **na krajní hraně mapy** (kde val začíná
hned u okraje) je díra o buňku užší než uvnitř — s hodnotou 3 zůstával na kraji
val výšky 2 hned vedle cesty, se 4 je odstup 3 buňky a svah pozvolnější.
Na krajní hraně zůstává díra **jen v buňkách cesty** (`cx = 1` na severu) —
okrajový val je jinde neporušený, takže hráč nevidí „do prázdna".

### Cesta

`buildPath` vede cestu od severního okraje (`cz = −limit`) lomem k mýtině:

- `bendCx = clearingCenter.cx − 2`, `bendCz` uprostřed trasy (clampnutý, aby
  lom zůstal aspoň 2 buňky od obou konců),
- `endCz = clearingCenter.cz − PATH_CAMP_GAP` (3) — cesta končí **3 buňky před
  kempem**, ne na okraji mýtiny (`clearingRadius = 8`), takže dojde až k táboru.

### Vodopád a jezírko

`buildWaterfall` (běží jako poslední v `buildGladeLayout`, po lese a detailech)
přidá jeden vodopád s jezírkem a odtokovou řekou. Místo hledá `waterfallSite`:
buňka valu s výškou **≥ 3**, jejíž soused **směrem dovnitř mapy** (`|nx| ≤ |cx|`
a `|nz| ≤ |cz|`, aspoň jedna ostrá) má výšku **0** a ještě o buňku dál je taky
nula. Kandidáti se seřadí (nejvyšší val, pak podle `cz`, `cx`, `dir`) a bere se
**první** — deterministicky.

Katalogové klíče (`cliff_waterfall`, `cliff_waterfallTop`, `river_*`) jsou
v `decorations.js`:

1. **Stěna valu.** Buňka valu (`site.cx,cz`) zůstává — je to hmota, ze které
   vodopád padá. Na sousední buňku (`site.nx,nz`) se nasype `blockStack(height)`
   (plný val, `blocks = true`), takže vodopád **není lem ve vzduchu** — má pod
   sebou i za sebou pevný blok. `blockStack` **nesmí** nahradit buňku valu,
   jinak vodopád zůstane viset (to byla první chyba).
2. **Vodopádový líc.** Na tutéž buňku se posadí `cliff_waterfall` pro každý metr
   stěny (`liftY = 0..height−1`) a **koruna** `cliff_waterfallTop` na
   `liftY = height`. Lemy mají stejnou geometrii jako `cliff_top` — jsou to
   bočnice valu s vodopádovým lícem, jen `blocks = false`.
3. **Jezírko.** Pod pádem je obdélník 3 × 3 buněk (`river_*` dlaždice,
   `liftY = 0.01`). Buňky na valu a na cestě se vynechají. Na hladině se
   náhodně objeví **lekníny** (`lily_large`/`lily_small`, ~35 % buněk).
4. **Řeka.** Z jezírka vede tok 3–4 buňky dál od valu (`sz += 1`), dokud nenarazí
   na val, cestu nebo okraj mapy; poslední buňka dostane `river_end`
   (uzavřený konec). Tok se přeruší, neohne.
5. **Tvary.** `riverShapeAt` vybere dlaždici podle ortogonálních sousedů: 0 =
   `river_tile`, 1 = `river_side`, 2 naproti sobě = `river_straight`, 2 vedle
   sebe = `river_corner`, 3+ = `river_cross`. Rotace je index souseda v `ORTHO`
   (`S, V, J, Z`). Buňka stěny valu se do `waterKeys` počítá taky, aby horní
   dlaždice věděla, že od ní voda přitéká.
6. **Mech.** Přes hranu valu nad vodopádem visí `hanging_moss` (rotace otočená
   dovnitř, `liftY = height − 0.5`).
7. **Blokace.** Buňky jezírka a řeky se přidají do `blocked` (radius 0.85),
   buňka stěny valu (radius 1.2) taky — hráč nestojí ve vodě ani na vodopádu.

Katalog nabízí i další vodní dlaždice (`river_open` — hladina bez břehů,
`river_bank` — zatáčka s břehem, `river_rocks` — kamenitá hladina), které
`buildWaterfall` zatím nepoužívá; jsou připravené pro ruční rozvržení v editoru.

Vodopád i jezírko potřebují **volný prostor** — jinak by je zakryl strom nebo
kámen. Proto `buildWaterfall` vrací i `remove` (množina buněk: stěna valu,
jezírko, řeka) a `buildGladeLayout` z ní vyfiltruje `decorations` i `blocked`,
než vodopád a vodu přidá.

Vodopádové lemy **nejsou** v `ridgeLevels` — proto je validační kontrola
„lem nevisí" musí vynechat (`cliff_waterfall*` záměrně visí na stěně valu,
koruna sedí na vršku).

### Jak se staví bočnice valu

### Diagonály a přechody — přesahují buňku

`cliff_diagonal` (X −0.50..0.67, Z −0.67..0.5), `cliff_topDiagonal` (X −0.50..0.77, Z −0.77..0.5).

### Rotace

Engine staví dekorace přes `anchor.rotation.y = (Math.PI / 2) * rotation`.
Naměřená konvence (Babylon `Matrix.RotationY`) — kam míří hrana `+Z` modelu:

| rotation | hrana `+Z` míří na | světová strana |
| --- | --- | --- |
| 0 | +Z | jih |
| 1 | +X | východ |
| 2 | −Z | sever |
| 3 | −X | západ |

Protože lem má geometrii na hraně `+Z`, platí: **lem s rotací `r` kryje stranu,
na kterou při rotaci `r` míří `+Z`.** Mapování světová strana → rotace:
**jih → 0, východ → 1, sever → 2, západ → 3.**

### Jak se staví bočnice valu

Buňka je 2×2 světa (`CELL_SIZE = 2`), anchor stojí ve středu buňky. Blok vyplňuje
celou buňku (`x` i `z` ±1 od středu). Lem má hmotu i líc **uvnitř** své buňky
(jeho `z` rozsah `0.23..0.50` nikdy nepřeleze hranu buňky `z = +0.5`).

Z toho plyne jediné správné umístění:

1. **Lem stojí na buňce SOUSEDA**, ne na buňce valu. Kdyby stál na buňce valu,
   jeho hmota by byla uvnitř bloku a nebyl by vidět.
2. **Rotace = `side.dir`** (směr od valu k sousedovi). Tím líc lemu míří **zpět
   k valu** a hmota lemu je v prázdné buňce za hranou valu — tedy vidět.
3. **Lem kryje jen schod mezi výškou souseda a výškou valu** (`flankStack`):
   `lift` začíná na výšce souseda, ne na 0. Dvousloupcový `cliff_top` (výška 2),
   zbytek `cliff_half` (výška 1) — dokud se nedosáhne výšky valu.

Když by lem začínal na `lift 0` na buňce valu, byl by zanořený v bloku a nebyl by
vidět — to byla původní chyba.

**Výšky se čtou ze skutečných `cliff_level*` dekorací, ne z `solidCells`.**
Valy vznikají na dvou místech (`buildBorderCliffs` a `hillCells`) a obě používají
stejné klíče (`cliff_levelHigh` = 2, `cliff_levelMid` = 1). Proto si
`buildRidgeFlanks` projde už hotové `decorations` a sestaví si výškovou mapu sám
(`liftY + 2` pro `cliff_levelHigh`, jinak `liftY + 1`). Díky tomu sedí i lemy na
vnitřních vyvýšeninách valu a nikde nezůstane plně zanořený lem.

**Kopce (`hillCells`) mají jen dvě vrstvy** — `open <= 1` (vnitřek a jeden
soused) je `cliff_levelHigh` (2 m), `open >= 2` (okraj) je `cliff_levelMid`
(1 m). Dřív měly okrajové buňky `cliff_levelLow` (`cliff_blockQuarter`, 0,5 m),
což dělalo půlmetrové dlaždice na úpatí kopců; tenhle klíč je zrušený a
v katalogu už není.

Lemy se generují **všude, kde je odhalená stěna** (žádný náhodný filtr).
Chráněné jsou jen buňky s rampou/schody (`rampCells`), aby lem neprorazil schod,
a buňky s rohovým lemem, aby se dva lemy nepřekrývaly. Duplicity se řeší přes
`placed` (klíč `cx,cz,dir,lift`).

**Lemy NEJSOU blokovací — jsou jen vizuální.** Do `layout.blocked` se nepřidávají
(blokují jen valy a dekorace). Aby ale hráč nenarazil do neviditelné stěny,
`buildRidgeFlanks` si buňky lemů **zarezervuje v `occupied`** — tím zabrání tomu,
aby na stejnou buňku postavil `buildRimProps` / `buildForest` / `buildGroundDetails`
kus dekorace, který blokuje (radius 0.9). Bez té rezervace stálo 202 lemů na
blokované buňce bez valu, což v hře vypadalo jako neviditelná kolize u bočnice.



