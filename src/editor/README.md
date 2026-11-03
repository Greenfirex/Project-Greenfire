# Editor mapy

Editor se otevírá klávesou **F2** nebo tlačítkem v liště. Při otevření se hra
pozastaví, takže se mapa dá upravovat bez pohybu tvorů a hráče.

Editor mění jen **mapu**. Uložená hra, zdraví, inventář ani stav tvorů se ho
netýkají; ty patří do ukládání hry, ne do souboru mapy.

## Co editor ukládá

Mapa je hotový seznam dlaždic, cest, dekorací, ryb, tvorů a mostů v souboru
`src/data/maps/<mapa>/map.json`. Žádná část se při startu nedopočítává z receptu:
co v souboru chybí, ve hře neexistuje.

Aktuální formát mapy je **verze 6**. Hra při startu čte právě tenhle soubor;
jiná mapa v kódu není.

Tlačítko **Uložit mapu** zapíše změny přímo do souboru. Pomáhá s tím vývojový
server přes `vite.mapSaver.js`. Když server neběží nebo jde o zabalenou hru,
mapa se místo toho stáhne jako `map.json` a musí se do projektu položit ručně.
Po uložení je potřeba mapu znovu načíst; vývojový server obvykle stránku obnoví sám.

## Ovládání

- **Levé tlačítko a tažení** vybere obdélník buněk. Vracením myši se obdélník zmenšuje.
- **Klik bez tažení** vybere jednu buňku.
- **Pravé tlačítko bez tažení** odebere buňku nebo objekt.
- **Pravé tlačení** otáčí kameru.
- **WASD / šipky** posouvají pohled, Shift zrychluje.
- **Kolečko** zoomuje; v editoru jde oddálit víc než ve hře.
- **Enter** potvrdí rozpracovanou zónu nebo označenou plochu.
- **Esc** zahodí rozepsaný návrh nebo označenou plochu.
- **Z** vrací poslední krok, **X** zapíná a vypíná mazání.
- **H** přepíná režim výšek, **Q/E** a číslice 1–9 ladí výšku.
- **F2** editor zavře.

Editor hru pozastaví, ale klávesy fungují dál — pauza se do nich neplete.
Když editor otevřeš ve chvíli, kdy máš hru pozastavenou ty, po zavření
zůstane pauza a vrátí se pauzovací nabídka.

Panel vpravo dole vypisuje, co na buňce leží, jaká je její výška a co se tam
chystá položit. Panel editoru hlásí stav: mimo plochu, neuložené změny, aplikováno.

## Režimy

### Zóny

Kreslí rostliny, objekty, cesty, pláž, útes, most a tvory. U štětců s více druhy
se v panelu vybírá konkrétní druh; pod kurzorem se ukazuje průsvitný náhled
přesně v té podobě, v jaké se položí. Panel štětce se zavírá křížkem nebo
tlačítkem Zrušit — tím se štětec odvybere a náhled pod kurzorem zmizí.

Keře mají navíc hustotu, kolísání počtu a volbu střídání druhů podle polohy.
Plocha je razítko: nové buňky vzniknou, existující se přepíšou i s objekty,
mazání udělá v mapě skutečnou díru.

**Tvorové** se plní z katalogu tvorů. Každý tvor má vlastní tlačítko a v panelu
se volí stáří. Na jedné buňce zůstane vždy jen jeden tvor; nový starý nahradí.
V režimu Mazat se tvor odebere.

Štětce jsou rozdělené podle toho, co do světa kladou: **Povrch**, **Terén**,
**Rostliny**, **Objekty**, **Tvorové** a **Ostatní**. Na konci každé kategorie
sedí její guma s červeným okrajem.

### Gumy

Guma maže podle druhu věci, takže se nemusí vybírat štětec, který ji původně
položil. Tažením označíš buňky a Enterem smažeš:

- **Guma: rostliny** — stromy, keře, houby, květiny i trávu,
- **Guma: objekty** — kameny, dřevo, suť, mušle, korály a táborák,
- **Guma: cesta** — jen vrstvu cesty,
- **Guma: terén** — srovná zem na nulu, zruší označení útesu a smaže most,
- **Guma: tvorové** — tvora nebo hejno ryb,
- **Guma: všechno** — dekorace, trávu, cestu, tvora i rybu; dlaždici nechá.

Kurzor má u gumy červenou barvu, aby bylo vidět, že se maže.

**Start hráče** určí buňku, na které hráč začíná. Klikneš na jednu buňku a potvrdíš
(Enter). Aktuální start je v editoru vidět jako žlutý čtvereček. Změna se projeví
až při startu hry nebo načtení uložené pozice.

Když je vybraný štětec tvora, editor označí všechna spawní místa v mapě:

- **plný tyrkysový čtvereček** znamená živého tvora,
- **obrysový a ztlumený čtvereček** znamená mrtvého tvora, který čeká na obnovu,
- **neutrální značka** znamená nové místo, které ještě není potvrzené.

Kruh kolem značky ukazuje poloměr toulání. Od živého čtverečku vede tenká
spojnice k místu, kde tvor skutečně stojí — jakmile se zatoulá nebo vyrazí za
hráčem, je to vidět. Stojí-li přímo na spawním místě, spojnice se nekreslí.
Tooltip u buňky vypíše druh, stáří, poloměr a stav — živý, nebo přibližně kolik
dní zbývá do obnovy. Prázdná mapa znamená žádná spawní místa; editor žádné
tvory nedoplňuje sám.

### Výška

Režim Výška nejdřív kreslí návrh a po potvrzení mění dlaždice. Výšky jdou od
**−6 do +24 m**, krok je **0,3 m**. Předvolby jsou −6, −3, 0, 3, 6, 9, 12, 18 a 24 m.
Označená plocha se zvýrazní jen obrysem, aby zůstal vidět terén. Na označených
buňkách stojí jejich nová výška — zeleně nahoru, červeně dolů, v závorce ta
současná. U kurzoru je vidět výška buňky pod myší.

- **Kopec** a **Prohlubeň** si svah staví samy po 0,3 m až do nuly.
- **Strmý svah** spadne o 0,6 m na řadu.
- **Nepravidelný svah** část buněk vynechá, takže obrys není kruh.
- **Útes** drží svislou stěnu a na hranici se výška nedopočítává. Hrany vyšší
  než 2,4 m se jako útes označí automaticky.
- **Spojnice** srovná dvě místa na stejnou výšku.
- **Most** položí mostovku přes vodu nebo propadlinu.

Označený pás se srovná na jednu výšku, takže po něm jde přejít. Z vrací krok.

### Herní plocha

Razítko pro zakládání a přepisování země. Vybírá se podklad a výška; počítadlo
předem ukáže, kolik buněk se přepíše a kolik už v mapě je. Levá buňka přidává,
pravá odebírá, mazání se zapíná v panelu.

## Voda

Voda je jedna hladina pro celou mapu, uložená jako nepovinné číslo `waterLevel`.
V editoru se zapíná tlačítkem **Voda** a hladina se ladí po **0,3 m**.
Skrytí vody je jen vizuální; data se nemění.

## Cesty

Cesta je samostatná vrstva `path`, ne dlaždice. Záznam má pozici a styl
(`dirt` / `stone` / `wood`), žádný `key`. Vykresluje ji `src/systems/pathSystem.js`
podle sousedů:

- dva protilehlí sousedé = rovinka,
- dva sousedé do pravého úhlu = zatáčka,
- tři nebo čtyři sousedé = křížení nebo rozcestí T.

Šířka cesty je deterministická funkce světových souřadnic, takže se plynule vlní,
ale sousední segmenty na sebe navazují.

## Přestavba světa

Editor neposílá scéně pokyn „postav celou mapu znovu". Každý štětec v katalogu
štětců říká, co svou změnou rozhýbe, a scéna přestaví jen ty části:

- **terén** — země, voda a útesy (výšky, útes, pláž, most, spojnice, herní plocha, hladina vody),
- **dekorace** — stromy, keře, kameny, cesty, ohniště, květiny,
- **tvorové** — spawní místa tvorů,
- **ryby** — hejna ve vodě.

Položení tvora tedy nepřestaví vegetaci ani terén a ostatní tvorové zůstanou
stát tam, kde jsou, se stejným zdravím. Start hráče nepřestavuje nic — mění se
jen údaj v mapě. Štětec, který v katalogu žádný údaj nemá, spustí přestavbu
celou — nic se tak nerozbije tiše.

Dokud přestavba běží, svítí nahoře uprostřed proužek s tím, co se právě počítá.
Klikání neblokuje: další tah se jen zařadí za běžící práci.

## Kde editor bydlí

- `mapEditor.js` — spojuje režim, panely, scénu a ukládání mapy,
- `editorMode.js` — výběr, štětce, výšky, plocha, historie,
- `editorHud.js` — hlavní panel editoru,
- `brushPanel.js`, `areaPanel.js`, `heightPanel.js` — panely jednotlivých režimů,
- `creatureOverlay.js` — značky spawních míst a náhledy tvorů,
- `src/data/catalogs/brushes.js` — definice štětců,
- `src/data/catalogs/mapFile.js` — formát souboru mapy,
- `vite.mapSaver.js` — zápis mapy do souboru při vývoji.

Hlavní dokumentace projektu je v [README.md](../../README.md). Aktuální úkoly a známé chyby jsou v [TODO.md](../../TODO.md).
