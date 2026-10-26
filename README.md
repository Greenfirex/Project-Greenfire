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

### Voda

Voda zatím ve hře není. Dřívější dlaždicová logika i modely byly z projektu
odstraněny; nová voda bude vycházet z hladiny a z výšky terénu. Postup a
jednotlivé kroky jsou v sekci „Plán: terén, písek a voda“ níže.

Další kroky: výroba ve strojích a plnění batohu, výběr a stav stroje kliknutím,
výroba předmětů z batohu.

## Plán: terén, písek a voda

Tohle je závazné pořadí prací. Každá fáze se dokončí, otestuje a commitne
samostatně; když se některá nepovede, vrací se jen ona a plán zůstává.

### Pravidla postupu

- Jedna fáze = jeden commit. Commit dělá uživatel, ne agent.
- Dokud není splněné „Hotovo, když“, do další fáze se nepokračuje.
- Když se fáze zvrhne, rozdělí se; plán se tím nemění.
- Nové závislosti jen s výslovným souhlasem; vizuální kontrolu dělá uživatel.

### Rozhodnutí, na kterých plán stojí

- **Herní plocha je razítko.** Umí podklad i výšku a existující buňky přepíše
  včetně objektů. Je to jediné místo, které vytváří novou zem z prázdna.
- **Povrch mění jen podklad.** Nechá výšku, cesty, stromy i skály; uklidí jen
  trávu.
- **Výška mění jen výšku.** Nechá podklad a objekty posune spolu se zemí.
- **Kopec a Prohlubeň si svah staví samy.** Namalovaná plocha zůstane plochá,
  svah se přidá kolem. Globální Vyhladit se ruší.
- **Země bude spojitá.** Štěrbiny se neřeší stěnami, ale plynulým dopočtem
  výšky. Stěny by za chvíli zmizely a pláž by s nimi nešla.
- **Voda vznikne z hladiny a terénu.** Co je pod hladinou, je zatopené. Není to
  dlaždice ani vrstva mapy a stará dlaždicová logika se nevrací.
- **Voda bude mít vlastní program** (jako tráva), ne novou knihovnu.

### Fáze 0 — Ukotvení plánu

**Cíl:** plán je v projektu a existuje bod pro návrat.

- Zapsat tento plán do README a odstranit zastaralou sekci o dlaždicové vodě.
- Uživatel commitne současný stav jako checkpoint.

**Hotovo, když:** plán je v repu, stará vodní sekce je pryč a existuje commit
před začátkem přestavby.

### Fáze 1 — Povrchy a písek

**Cíl:** písek je použitelný povrch, tvar země se nemění.

- Společný seznam podkladů (tráva, písek): název, textura, velikost dlaždice,
  zabarvení. Písek použije `Ground080` z `public/assets/nature/textures/`.
- Terén kreslí každý povrch zvlášť; neznámý podklad spadne na trávu.
- Štětec **Povrch** s volbami Tráva/Písek a náhledy. Mění jen klíč podlahy:
  výšku, cesty a objekty nechá, trávu uklidí.
- Mřížka editoru se kreslí v úrovni buňky, ne v nule.

**Hotovo, když:** písek jde namalovat na trávu i na kopec, zůstane výška i
objekty, po uložení a obnovení drží, stará mapa vypadá stejně.

**V této fázi ještě nebude:** razítko, výškové nástroje, spojitá zem, pláž, voda.
**Data a ukládání:** beze změny.

### Fáze 2 — Herní plocha jako razítko

**Cíl:** jedním tahem vznikne nebo se přepíše zem s vybraným podkladem a výškou.

- Panel Herní plocha dostane volbu podkladu; výškový pruh bude vidět i tady.
- Výchozí výška bude 0 (dnes 1,2 m).
- Kreslení nastaví přesně zvolený podklad a výšku. Nové buňky vzniknou,
  existující se přepíšou i s objekty, trávou a cestami.
- Počítadlo ukáže počet přepsaných buněk, z toho existujících, podklad a výšku.
- Mazání zůstane; Z vrátí celé razítko.

**Hotovo, když:** z prázdna vznikne písek na zvolené výšce; přejetí existující
země ji přepíše; počítadlo sedí; Z vrátí vše.

**V této fázi ještě nebude:** plynulé svahy a oprava štěrbin.
**Data a ukládání:** beze změny.

### Fáze 3 — Výškové nástroje bez vedlejších účinků

**Cíl:** nástroje na výšku nemění podklad a nenechávají objekty viset.

- Společná operace „nastav výšku buňky“: podlaha, cesty, tráva, drobné vrstvy
  a objekty se posunou spolu se zemí.
- Režim Výška přestane přebarvovat na trávu.
- Kopec a Prohlubeň mění jen výšku; na písku zůstane písek.
- Vyhladit posouvá i objekty (ve fázi 3b je nahrazeno svahem u Kopce).
- Názvy prohlubní odpovídají skutečné hloubce.

**Hotovo, když:** kopec i prohlubeň na písku zůstanou pískové, objekty se
posunou, cesta drží, režim Výška nemění podklad.

**V této fázi ještě nebude:** hlubší jámy, plynulé svahy, hráč na zemi, voda.
**Data a ukládání:** beze změny.

### Fáze 3b — Kopec a Prohlubeň se svahem

**Cíl:** zrušit globální Vyhladit a naučit výškové štětce stavět svah samy.

- Jeden Kopec s výškami 1,2 / 1,8 / 2,4 m a jeden Prohlubeň s 0,6 / 1,2 m;
  výšky se vybírají v okně štětce.
- Namalovaná plocha zůstane plochá ve zvolené výšce; kolem ní brush přidá
  svah po 0,6 m, dokud nedojde na 0.
- Svah jen na existující buňky; podklad zůstane, objekty se posunou; náhled
  ukáže plochu i svah; Z vrátí celý krok.
- Vyhladit a globální dohlazování se mažou.

**Hotovo, když:** pruh tří buněk na 1,2 m zůstane plochý, kolem něj je
prstenec 0,6 m a dál 0; Prohlubeň funguje zrcadlově; tlačítko Vyhladit
zmizelo a náhled nešedí celou mapu.

**V této fázi ještě nebude:** spojitá zem – kopec bude v datech správně, ale
vizuálně schodovitý. Plynulý svah přijde ve fázi 4.
**Data a ukládání:** beze změny.

### Fáze 4 — Spojitá zem

**Cíl:** štěrbiny zmizí a schody se stanou svahy.

- Výška se mezi buňkami dopočítá plynule, střed buňky zůstane přesný.
- Terén se vzorkuje jemněji a zůstane rozdělený podle podkladů.
- Okraj mapy a vnitřní díry dostanou svislý bok z hlíny.
- Cesty, tráva, objekty, kurzor, zóny a mřížka používají skutečnou výšku země.

**Hotovo, když:** prohlubeň na okraji mapy nemá prosvítající štěrbinu, svahy jsou
plynulé, cesty/tráva/stromy sedí na zemi, okraj mapy je uzavřený.

**V této fázi ještě nebude:** hráč sledující výšku, hluboká pláž, voda.
**Data a ukládání:** beze změny; mění se jen vykreslení a čtení výšky.

### Fáze 5 — Hloubka, pláž a hráč na zemi

**Cíl:** jezero s pláží a hráč, který po něm chodí.

- Výšky v metrech, širší rozsah (návrh −6 až +3 m) a jemnější krok (návrh 0,3 m).
- Pláž razítkem: pásy písku po 0,3 m; spojitá zem z nich udělá svah. Volitelně
  volba Plynulý okraj.
- Hráč sleduje výšku země; dojde do jámy i na kopec.

**Hotovo, když:** třímetrová pánev má pozvolné břehy, hráč po nich chodí a stojí
na zemi.

**V této fázi ještě nebude:** voda.
**Data a ukládání:** beze změny (výška je už desetinné číslo).

### Fáze 6 — Voda: hladina a tvar

**Cíl:** hladina v mapě a voda tam, kde je zem pod ní.

- Hladina do souboru mapy; verze mapy se zvedne, staré mapy se načtou bez vody.
- Ovládání hladiny v editoru, voda vidět hned po aplikaci.
- Vodní plocha z terénu, břeh kopíruje tvar země, hloubka v každém bodě.
- Zatím jednoduchá poloprůhledná plocha pro kontrolu tvaru.

**Hotovo, když:** voda se objeví jen v pánvi, břeh sedí, změna terénu vodu
přepočítá, hladina přežije uložení, stará mapa se načte.

**V této fázi ještě nebude:** vlny, pěna, odlesky, chování hráče.
**Data a ukládání:** soubor mapy nová verze; herní uložení beze změny.

### Fáze 7 — Voda: vzhled

**Cíl:** živá a realistická voda.

- Vlastní program: vlny, odlesky, barva podle hloubky, průhledná mělčina,
  pěna u břehu, noc.
- Kvalita podle nastavení grafiky.
- Volitelně mokrý písek a jiné zabarvení dna.

**Hotovo, když:** mělčina je průhledná, hloubka tmavne, jsou vidět vlny a slunce,
pěna kopíruje břeh, v noci je voda tmavá a hra se nezpomalí.

**V této fázi ještě nebude:** skutečné zrcadlení okolí.

### Fáze 8 — Voda: hráč a život

**Cíl:** voda je součást hry.

- Rozhodnout mělká/hluboká (návrh: mělká průchozí se zpomalením, hluboká ne).
- Cákance, zpomalení, zákaz stavění ve vodě, zvuky (potřebují soubory).
- Případný nový stav se registruje u ukládání.

**Hotovo, když:** chování je jasné, stavění ve vodě hlásí důvod, zvuky hrají.

### Fáze 9 — Doladění (volitelné)

Mokrý písek, rostliny u břehu, jemnější přechod písek/tráva, zatopené kameny,
ambientní zvuk, případně zrcadlení.

### Pořadí a závislosti

- 1 → 2 → 3 → 3b → 4 → 5 → 6 → 7 → 8; fáze 9 kdykoliv na konci.
- Fáze 2 potřebuje seznam podkladů z fáze 1.
- Fáze 3b navazuje na výškové nástroje z fáze 3 a připravuje tvar kopců pro spojitou zem.
- Fáze 4 je nejcitlivější; bez ní není pláž ani voda.
- Fáze 6 jediná mění formát souboru mapy.

### Otevřená rozhodnutí

- Fáze 5: přesný rozsah a krok výšek.
- Fáze 6: hladina editovatelná v editoru (návrh ano).
- Fáze 8: mělká + zákaz hluboké, nebo plavání.
- Fáze 8: zvukové soubory.

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
Návrh se dá kdykoli zrušit a pravé tlačítko označí buňky ke srovnání na nulu.
Kopec a Prohlubeň si svah staví samy: v jejich okně vybereš výšku a namalovaná
plocha zůstane plochá, kolem ní se přidá svah po 0,6 m až do 0.

Podklad dlaždice (tráva, písek) se mění štětcem **Povrch**: ten nechá výšku,
cesty i objekty a uklidí jen trávu. Mazání tímto štětcem vrátí buňku na trávu.
Nový povrch je jeden záznam v katalogu dekorací vedle `floor_grass` a
`floor_sand`; terén pak každý povrch kreslí vlastní texturou a velikostí dlaždice.

**Výška** mění jen výšku: podklad zůstane a objekty na buňce se posunou
spolu se zemí. Kopec a Prohlubeň dělají totéž plošně; jejich Srovnat buňky
srovná na nulu, nemaže je. Výšky v jejich podmenu odpovídají skutečné
výšce v metrech.

Země je spojitá: výška se mezi středy buněk dopočítává, takže kopce a prohlubně
mají plynulé svahy a na okraji mapy je hliněný bok. Za okrajem mapy se počítá
s výškou nejbližší buňky, takže se zem na okraji nezvedá zpátky nahoru.
Cesty, tráva, objekty i kurzor v editoru sedí na skutečné výšce země. Cesty
se skládají z jemných kousků, takže kopírují zaoblení země i v kopci a v příkopu.
Hráč zatím chodí v nulové výšce; jeho výška přijde ve fázi 5.

V okně **Herní plocha** se k razítku vybírá podklad a výška; počítadlo předem
ukáže, kolik buněk se přepíše a kolik jich už v mapě je.

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

