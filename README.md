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
| **Tažení pravým tlačítkem** | Rotace kamery (v editoru středním tlačítkem) |
| **Kolečko** | Zoom |
| **1–5** | Výběr předmětu v ruce (plán, sekera, krumpáč, pochodeň) |
| **Levé tlačítko u stromu / rudy / kamene** | Těžení (podržet = opakovat) |
| **Klik na zem s plánem v ruce** | Postavení stroje na buňku |
| **M** | Přepnutí typu stavěného stroje |
| **R** | Otočení stroje (pod kurzorem, nebo u stavby budoucího) |
| **Pravé tlačítko ×2 na stroj (klik bez tažení)** | Bourání (první klik označí, druhý zbourá) |
| **E** | Zapálit / zrušit táborák |
| **G** | Zobrazit / skrýt mřížku |
| **N** | Posun času o 6 hodin |
| **P** | Pauza / pokračovat (ztmaví obrazovku, zastaví celou hru) |
| **F1** | Editor mapy (zóny, dlaždice, výšky) — také tlačítkem 🧱 nahoře uprostřed |
| **F2** | Vývojářské nástroje (rychlost času 1×/2×/5×/10×, pauza času) — také tlačítkem 🐞 |
| **O** | Možnosti (kvalita, stíny, FPS, hlasitost) |
| **F5 / F9** | Uložit / načíst |
| **Ctrl+Alt+I** | Ladicí okno Babylona (jen při vývoji; jde i přes adresu `?inspector`) |

## Architektura

```
src/
  main.js                    engine, plátno, render loop
  scenes/GameScene.js        orchestrátor — stav světa, delegace na systémy
  systems/                   camera, grid, terrain, water, sky, deco, build, gather,
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
editor mapy (zóny, cesty, výšky ±6 m, štětec pláže se svahem po 0,3 m,
štětec útesů s hliněnou stěnou, výběr buněk, undo), spojitý terén
s hranou mapy, cesty kopírující terén, hráč chodící po výšce země,
vodní hladina s vlnami a pěnou, plynulé prolínání trávy a písku
(texturou i barvou), hráč ve vodě (mělká zpomalí, do hluboké nesmí,
ve vodě nejde stavět), kroky ve vodě, příboj u vody, obloha se sluncem
a ukládání/načítání do prohlížeče.

Připraveno, ale zatím nepoužité: recepty (`RECIPES` v seznamu předmětů) a
suroviny pro výrobu (železná a měděná ruda, ingoty). Stroj má v savu připravený
stav (co má uvnitř, co vyrobil, jak daleko je ve výrobě), ale výroba v něm
zatím neběží.

### Předání stavu

Poslední commit: `f06a51d` — vlnění vodní hladiny. V pracovním stromu je nad
ním hotové míchání textur trávy a písku (jednosměrné, písek do trávy), rovné
hranice povrchů, kroky ve vodě a příboj u vody včetně hráče ve vodě a zákazu
stavění; čeká na vizuální test, commit dělá uživatel.

**Stav:** plán kolem terénu, povrchů a vody je uzavřený. Zbývá jen volitelné
doladění a práce mimo tento plán.

**Hotovo:**
- Povrchy a terén: písek a tráva, razítko Herní plocha, výškové nástroje,
  Kopec/Prohlubeň se svahem, spojitý terén, hrana mapy a cesty.
- Výšky: rozsah −6 až +6 m, krok 0,3 m, předvolby −6, −4,5, −3, −1,5, 0,
  1,5, 3, 4,5 a 6 m; jediný krok je 0,3 m.
- Výškový panel: vlastní okno, škála, barevné odlišení, počet, Zpět,
  Aplikovat a Zahodit; hlavní HUD už výškový řádek nemá.
- Výběr: hover buňky, levé tlačítko přidá, pravé odebere (i tahem), 0 m
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
- Staré skalní modely: pryč z katalogu, mapy i assetů; kopce a stupně dělají
  jen výšky.
- Útesy: štětec označí buňky jako plošinu; kde je mezi označenou buňkou
  a sousedem skok, vznikne svislá hliněná stěna stejnou texturou jako okraj
  mapy a hráč přes ni nepřejde. Mapa kvůli značce poskočila na verzi 4.
- Voda: hladina pro celou mapu jako nepovinné číslo v souboru mapy; v editoru
  se zapíná tlačítkem Voda a hladina se ladí po 0,3 m; Z vrací krok.
  Mapa má hladinu −0,3 m, takže je voda zapnutá hned po startu.
- Vzhled vody: vlastní program pro orthografickou kameru — vlny tlumené
  v hloubce, přílivové jazyky na písek, pěna a bílé hřebeny viditelné
  z každého úhlu, barva a průhlednost podle hloubky a odraz okolí přes
  odrazovou sondu (terén, dekorace, postava, stroje).
  Hustota vodní sítě jde podle kvality grafiky (0,5/1/2 m).
- Voda leží jen na skutečných buňkách mapy, takže nevyčuhuje mimo obrys ani
  do děr; na kraji mapy a v dírách ji uzavírá svislá vodní stěna. Písek
  u břehové čáry ztmavne, jako by byl mokrý; při změně hladiny v editoru se
  břeh i voda překreslí.
- Obloha: SkyMaterial bez textury; slunce na obloze jde podle denní doby
  a voda z ní bere barvu. Odraz okolí řeší odrazová sonda; obloha se
  do odrazu nepouští.
- Data a ukládání: ukládání hráče beze změny; výška je desetinné číslo,
  mapa má kvůli značkám útesů verzi 4.

**Zbývá:**
- Volitelné doladění: rostliny u břehu, zatopené kameny, skutečný odraz
  oblohy, bouřka a déšť (počasí).
- Doladit suché jámy pod hladinou (suchá zóna nebo vodní zóny).
- Mimo uzavřený plán: výroba ve strojích, recepty a plnění batohu.

**Další krok — vizuální test:**
- Přechod trávy a písku: rovná hranice bez proužku trávy i bez světlého
  lemu, diagonální rohy plynule prolnuté, i na přímém slunci.
- Voda: hráč se v mělké vodě zpomalí, do hluboké nesmí, ve vodě nejde stavět
  a panel Stavba napíše důvod.
- Zvuky: kroky ve vodě, příboj slábne se vzdáleností a u vody ztlumí les.
- Ulož mapu a obnov — hladina, povrchy i jejich prolnutí musí držet.
- Když něco nesedí, šířka pásu, síla variací a hlasitosti jsou jen čísla.

**Klíčová rozhodnutí (nevrátit omylem):**
- Výšky jsou v metrech, krok 0,3 m, rozsah ±6 m; předvolby včetně ±4,5 a ±6.
- Výškový panel je samostatné okno; hlavní HUD výšky neobsahuje.
- Výběr buněk: hover + levé přidá + pravé odebere; 0 m srovnává.
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
  nedopočítává a kde je soused níž, stojí hliněná stěna. Stejně vysoký soused
  se napojí plynule bez stěny a hrana stěny se drobně vlní.
- Voda je jedna hladina pro celou mapu a jen se kreslí — nic v mapě nemění.
  Kde je terén pod ní, tam je voda; kde je výš, terén ji překryje.
- Voda má vlastní program pro orthografickou kameru; hotový Babylon
  WaterMaterial se nepoužívá, protože počítá odlesky z pozice kamery a na
  ortho kameře dělá bílé pruhy a zrcadlové fleky.
- Odraz se bere z odrazové sondy nad středem vody. Do odrazu jdou terén
  a objekty; obloha je barva.
- Hloubka se bere z terénu pod hladinou; kde je mělko, prosvítá dno, hloubka
  tmavne. Pěna u břehu je součástí vodního programu.
- Hustota vodní sítě jde podle kvality: vysoká 0,5 m, střední 1 m, nízká 2 m.
- Obloha je SkyMaterial bez textury a nahrazuje jednobarevné nebe; voda
  z ní bere jen barvu.
- Suché jámy pod hladinou (doly, sklepy) současná plocha neumí; vyřeší se
  později suchou zónou nebo vodními zónami.
- Mapa má verzi 4 (značka útesu); hladina vody je nepovinné číslo a verzi
  nemění. Starší mapy se načtou bez vody.

**Kde co je:**
- `src/data/maps/layoutStore.js` — rozsah výšek, krok, předvolby.
- `src/editor/heightPanel.js` — okno Výška; `areaPanel.js`, `brushPanel.js` — plocha a štětce.
- `src/editor/editorMode.js`, `mapEditor.js`, `editorHud.js` — editor, výběr, panely, pláž, voda.
- `src/systems/gridSystem.js`, `inputSystem.js` — hover, levé/pravé tažení.
- `src/utils/terrainField.js` — výškový model (spojitá výška mezi buňkami).
- `src/systems/terrainSystem.js` — terén, hrana, útesy, prolnutí povrchů.
- `src/systems/terrainBlendPlugin.js` — míchání textur sousedních povrchů v materiálu terénu.
- `src/utils/waterWaves.js` — čísla a výpočet vln (společné pro program i hru).
- `src/systems/audioSystem.js` — kroky, příboj, oheň a ambientní vrstvy.
- `src/systems/waterSystem.js` — hladina, odrazová sonda, kraj mapy.
- `src/systems/waterShader.js` — program pro vodu: vlny, pěna, svislá stěna.
- `src/systems/skySystem.js` — obloha a slunce.
- `src/systems/pathSystem.js`, `playerSystem.js`, `cameraSystem.js` — cesty a hráč.
- `src/data/catalogs/brushes.js` — štětce včetně Pláže a Útesu; `decorations.js` — písek a povrchy.
- `src/data/maps/glade/map.json` — aktuální mapa; `README.md` — přehled a tento handoff.
- `.clinerules` — pravidla práce.

## Závislosti a licence

- `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/materials` (8.56.2) — jádro hry, načítání modelů a obloha.
- `@babylonjs/inspector` (8.56.2) — jen vývojová závislost; do produkčního buildu se nebalí.
- Zvuky: Free Fantasy SFX Pack od TomMusic (tommusic.itch.io); původ je zapsaný
  v `public/assets/audio/CREDITS.txt`.

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

**Otevřená rozhodnutí:** šířka Plynulého okraje u pláže (zatím jeden
prstenec navíc), průchodnost útesů (schod nad 0,45 m a hrana na mřížce
0,5 m) a suché jámy pod hladinou (suchá zóna nebo vodní zóny).

**Další práce:** výroba ve strojích a recepty, plnění batohu, výběr a stav
stroje kliknutím, výroba předmětů z batohu.

## Editor mapy

Mapa je uložená jako hotový seznam dlaždic a objektů v souboru
(`src/data/maps/<mapa>/map.json`) — žádný recept, ze kterého by se dopočítávala.
Co v souboru chybí, ve hře neexistuje: chybějící buňka znamená díru bez trávy,
přes kterou se nedá chodit. Výška terénu je uložená u každé dlaždice zvlášť.

V editoru (F1) jsou tři druhy práce: **zóny** vyplní označené buňky rostlinami
a objekty, **výška** nejdřív kreslí návrh a po potvrzení zvedá dlaždice
a **plocha** zakládá nebo přepisuje zem s vybraným podkladem a výškou.
Plocha je razítko: nové buňky vzniknou, existující se přepíšou i s objekty,
mazání udělá v mapě skutečnou díru.
Tlačítka výšky v panelu určují, jak vysoko se dlaždice po Aplikovat pokládají.
Výška má vlastní okénko jako Herní plocha; otevírá se při přepnutí na Výšku.
Výšky jdou od −6 do +6 m; předvolby jsou −6, −4,5, −3, −1,5, 0, 1,5, 3,
4,5 a 6 m; jediný mezikrok je +/−0,3 m. Levé tlačítko buňky přidává do výběru,
pravé je odebírá; na nulu se srovnává předvolbou 0 m. Návrh se dá kdykoli
zrušit.
Kopec a Prohlubeň si svah staví samy: v jejich okně vybereš výšku a namalovaná
plocha zůstane plochá, kolem ní se přidá svah po 0,3 m až do 0.

Podklad dlaždice (tráva, písek) se mění štětcem **Povrch**: ten nechá výšku,
cesty i objekty a uklidí jen trávu. Mazání tímto štětcem vrátí buňku na trávu.
Nový povrch je jeden záznam v katalogu dekorací vedle `floor_grass` a
`floor_sand`; terén pak každý povrch kreslí vlastní texturou a velikostí dlaždice.

**Výška** mění jen výšku: podklad zůstane a objekty na buňce se posunou
spolu se zemí. Výšky jdou od −6 do +6 m; jediný krok je 0,3 m. Kopec
a Prohlubeň dělají totéž plošně; jejich Srovnat buňky srovná na nulu,
nemaže je. Výšky v jejich podmenu odpovídají skutečné výšce v metrech.

**Pláž** je štětec v paletě zón: vybereš hloubku (−1,5 / −2,4 / −3 m)
a namaluješ plochu. Písek se položí do zvolené hloubky a kolem ní se přidají
prstence písku po 0,3 m až k původní zemi, ze kterých spojitá zem udělá břeh.
Zaškrtnutý **Plynulý okraj** přidá ještě jeden prstenec písku za poslední schod.
V namalované ploše zmizí stromy, kameny i tráva; na svazích se objekty posunou
s terénem. Tlačítko **Zpět na trávu** srovná výšku na 0 a vrátí trávu.

**Útes** je štětec, který buňky označí jako plošinu. Označená buňka drží svou
výšku rovně a na každé straně, kde je soused níž, se postaví svislá hliněná
stěna stejnou texturou jako okraj mapy; hráč přes ni zatím nepřejde. Stěna se
staví po půlmetrových kouscích, dorovná se i v rozích a její hrana se drobně
vlní, aby nebyla rovná jako podle pravítka. Kde má soused stejnou výšku, hrana
se spojí po celé délce — terén se k plošině dotáhne i v rozích a žádná stěna
tam nevznikne. Rozdíl proti nižší zemi se uzavře krátkou hliněnou plochou
na boku, takže do útesu se nedělají zářezy a neprosvítá tráva. Rohy, kde se
potkají dvě stěny, se drobně zkosí, aby nebyly ostré. Značky
se ukládají do mapy (verze 4), mažou se tlačítkem **Zrušit útesy** a Z vrací
celý krok.

Země je spojitá: výška se mezi středy buněk dopočítává, takže kopce a prohlubně
mají plynulé svahy a na okraji mapy je hliněný bok. Výjimka je označená buňka
útesu — ta drží rovnou výšku a na hranici se přes ni nedopočítává. Za okrajem mapy se počítá
s výškou nejbližší buňky, takže se zem na okraji nezvedá zpátky nahoru.
Cesty, tráva, objekty i kurzor v editoru sedí na skutečné výšce země. Cesty
se skládají z jemných kousků, takže kopírují zaoblení země i v kopci a v příkopu.
Hráč už chodí po skutečné výšce země; voda přijde v dalším kroku.

Hranice mezi povrchy se při kreslení země plynule rozvlní, aby nepůsobila
jako podle pravítka. Data se tím nemění — buňka má pořád jeden povrch, takže
se po ní chodí a staví stejně jako dřív a změna je vidět jen na pohled.

V okně **Herní plocha** se k razítku vybírá podklad a výška; počítadlo předem
ukáže, kolik buněk se přepíše a kolik jich už v mapě je. Levé tlačítko buňky
přidává do výběru, pravé je odebírá; mazání se vybírá tlačítkem v panelu.

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

