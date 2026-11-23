# Editor mapy

Editor se otevírá klávesou **F2** nebo tlačítkem v liště. Hra při otevření
**běží dál** — tvorové se hýbou a denní doba plyne — takže je vidět, jak mapa
vypadá živá. Hráč přitom stojí na místě a nereaguje na klávesy (ty patří kameře).
Kdo chce při úpravách klid, zmáčkne v editoru **P** nebo tlačítko **Pauza**.

Editor mění jen **mapu**. Uložená hra, zdraví, inventář ani stav tvorů se ho
netýkají; ty patří do ukládání hry, ne do souboru mapy.

## Co editor ukládá

Mapa je hotový seznam dlaždic, cest, dekorací, ryb, tvorů a mostů v souboru
`src/data/maps/<mapa>/map.json`. Žádná část se při startu nedopočítává z receptu:
co v souboru chybí, ve hře neexistuje.

Aktuální formát mapy je **verze 10**. Hra při startu čte právě tenhle soubor;
jiná mapa v kódu není.

Tlačítko **Uložit mapu** zapíše změny přímo do souboru. Pomáhá s tím vývojový
server přes `vite.mapSaver.js`. Když server neběží nebo jde o zabalenou hru,
mapa se místo toho stáhne jako `<mapa>-map.json`, musí se přejmenovat na `map.json`
a položit do projektu ručně. Uložit jde i zkratkou **Ctrl+S**.
Po uložení je potřeba mapu znovu načíst; vývojový server obvykle stránku obnoví sám.

## Ovládání

- **Levé tlačítko a tažení** vybere obdélník buněk. Vracením myši se obdélník zmenšuje.
- **Klik bez tažení** vybere jednu buňku.
- **Pravé tlačítko bez tažení** odebere buňku z návrhu nebo z označené plochy.
  U jezera sníží hladinu, u řeky ji smaže, u mostu a spojnice zruší rozdělaný výběr.
- **Pravé tažení** otáčí kameru.
- **WASD / šipky** posouvají pohled, Shift zrychluje.
- **Kolečko** zoomuje; v editoru jde oddálit víc než ve hře.
- **Enter** potvrdí rozpracovanou zónu, návrh výšek nebo označenou plochu.
- **Esc** zahodí rozepsaný návrh, návrh výšek nebo označenou plochu; další Esc
  odvybere štětec.
- **Z** vrací poslední krok, **X** zapíná a vypíná mazání.
- **H** přepíná režim výšek, **Q** výšku sníží, **E** zvýší a číslice 1–9 ladí výšku.
- **R** pootočí náhled sázeného objektu o 45°, **Shift+R** zpět (u palem určuje směr prohnutí).
- **Shift+1–7** přepíná záložky Terén, Voda, Povrch, Jeskyně, Rostliny, Předměty a Tvorové.
- **N** posune denní dobu.
- **F2** editor zavře, **P** pozastaví nebo pustí hru (stejně jako tlačítko **Pauza**).

Hra pod editorem běží dál. Když ji v editoru pozastavíš, po zavření editoru
zůstane pozastavená a vrátí se pauzovací nabídka. Tvorové si hráče v editoru
nevšímají, takže tě nemůžou napadnout, když zrovna kreslíš.

Panel vpravo dole vypisuje, co na buňce leží, jaká je její výška a co se tam
chystá položit. Panel editoru hlásí stav: mimo plochu, neuložené změny, aplikováno.

## Záložky

Hlavní panel má dvě řady záložek. Horní je krajina — **Terén**, **Voda**, **Povrch**
a **Jeskyně** — spodní to, co v ní je — **Rostliny**, **Předměty** a **Tvorové**.
Záložka ukáže jen svoje tlačítka, rozdělená do menších skupin, a na konci svou gumu
s červeným okrajem. Které tlačítko leží ve které záložce, určuje jen `hudTabs.js`;
štětec, který tam chybí, se objeví dole mezi společnými tlačítky.

- **Terén** — nástroje **Výška** a **Herní plocha** (přerušovaný okraj; další klik
  vrátí štětce), Kopec, Prohlubeň, Útes, Pláž, Spojnice, Most a guma terénu,
- **Voda** — hladina moře, Jezero a Řeka,
- **Povrch** — Povrch, Cesta a guma cesty,
- **Jeskyně** — otevře okno Patra,
- **Rostliny** — stromy a podrost,
- **Předměty** — les a skály, pláž a moře, tábor a poklady,
- **Tvorové** — tvorové na souši (i hnízdo Koa'tiki a krabi) a ryby.

**Start hráče** a **Guma: všechno** jsou dole pod záložkami, protože nepatří k jedné.
Nad tlačítky je přepínač patra (Povrch a jednotlivá patra jeskyní); u záložky Jeskyně
ho nahrazuje seznam pater v okně Patra. Přepnutím záložky se odvybere štětec z jiné záložky.

### Štětce

Kreslí rostliny, objekty, cesty, pláž, útes, most a tvory. U štětců s více druhy
se v panelu vybírá konkrétní druh; pod kurzorem se ukazuje průsvitný náhled
přesně v té podobě, v jaké se položí. Panel štětce se zavírá křížkem nebo
tlačítkem Zrušit — tím se štětec odvybere a náhled pod kurzorem zmizí.

Keře mají navíc hustotu, kolísání počtu a volbu střídání druhů podle polohy.
Monstery mají vlastní štětec: osází zhruba polovinu buněk, na buňku jednu nebo dvě.
Každý keř i monstera na buňce má vlastní natočení a velikost.
Plocha je razítko: nové buňky vzniknou, existující se přepíšou i s objekty,
mazání udělá v mapě skutečnou díru.

Tráva má tři volby: **Květiny mezi stébly**, **Směs** (které druhy na ploše
vyrostou — Automaticky se řídí polohou, jinak Pobřežní, Louka nebo Kapradiny)
a **Vrstva** (Obojí / Jen trsy / Jen koberec). Směs i Vrstva se ukládají
k buňce, takže vedle sebe může být holý trs bez koberce a koberec bez trsů.

**Tvorové** se plní z katalogu tvorů. Každý tvor má vlastní tlačítko a v panelu
se volí stáří. Na jedné buňce zůstane vždy jen jeden tvor; nový starý nahradí.
V režimu Mazat se tvor odebere.

V podzemním patře jsou zašedlé štětce, které umí zapisovat jen na povrch
(`brushAboveGroundOnly` v katalogu štětců): Tráva, Cesta, Kopec, Prohlubeň, Pláž,
Útes, Spojnice, Most, Ryby a Start hráče. Po přepnutí do podzemí se takový štětec
sám odvybere. Ryby půjdou povolit, až budou i jiné vodní plochy než moře; Tráva
a Cesta, až je hra bude umět vykreslit v jeskyni.

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

Kruh kolem značky ukazuje poloměr toulání. U tvorů, kteří zůstávají na místě
(písečný běs), ukazuje oranžový kruh vzdálenost, na kterou si všimne hráče. Od
živého čtverečku vede tenká spojnice k místu, kde tvor skutečně stojí — jakmile
se zatoulá nebo vyrazí za hráčem, je to vidět. Stojí-li přímo na spawním místě,
spojnice se nekreslí. Tooltip u buňky vypíše druh, stáří, poloměr nebo vzdálenost
pozornosti a stav — živý, nebo přibližně kolik dní zbývá do obnovy. Prázdná mapa
znamená žádná spawní místa; editor žádné tvory nedoplňuje sám.

### Výška

Režim Výška nejdřív kreslí návrh a po potvrzení mění dlaždice. Výšky jdou od
**−15 do +24 m**, krok je **0,25 m**. Předvolby jsou −15, −10, −5, 0, 5, 10, 15, 20
a 24 m (klávesy 1–9); **Q** výšku o krok sníží, **E** zvýší.
Označená plocha se zvýrazní obrysem a průsvitnou hmotou změny (`heightHologram.js`):
zelený blok ukazuje, co přibude, červený, co se odebere, a jeho dno je nový povrch.
Hmota svítí i přes terén, takže je vidět i výkop. Na označených buňkách stojí jejich
nová výška — zeleně nahoru, červeně dolů, v závorce ta současná. U kurzoru je vidět
výška buňky pod myší.

- **Kopec** a **Prohlubeň** si svah staví samy po 0,25 m až do nuly.
- **Strmý svah** spadne o 0,5 m na řadu.
- **Nepravidelný svah** část buněk vynechá, takže obrys není kruh.
- **Útes** drží svislou stěnu a na hranici se výška nedopočítává. Hrany vyšší
  než 2,0 m se jako útes označí automaticky.
- **Spojnice** srovná dvě místa na stejnou výšku.
- **Most** položí mostovku přes vodu nebo propadlinu.

Označený pás se srovná na jednu výšku, takže po něm jde přejít. Z vrací krok.

Volba **Výška buněk → Podle sousedů** dá každé označené buňce průměr výšek okolních
neoznačených buněk (zaokrouhlený na 0,25 m). Hodí se na srovnání díry nebo hrbolu
s okolím, třeba pod cestou: stačí přejet celou cestu a dát Aplikovat. Přepočítává se
při každém tahu, takže na buňkách je vidět výsledná výška ještě před potvrzením.

### Herní plocha

Razítko pro zakládání a přepisování země. Vybírá se podklad a výška; počítadlo
předem ukáže, kolik buněk se přepíše a kolik už v mapě je. Levá buňka přidává,
pravá odebírá, mazání se zapíná v panelu.

### Patra

Novou jeskyni začneš na povrchu kliknutím na stěnu útesu, pak táhneš výběr do skály
a dáš Aplikovat. Volba **Kopat do** v panelu Pater určí, do kterého patra se jeskyně
zapíše: **Automaticky** vezme první patro, které je u toho útesu volné, jinak jde
vybrat konkrétní patro nebo **Nové patro**. Když už ve vybraném patře u útesu
jeskyně je, značka vchodu zoranžoví a nápověda upozorní, že se nová jeskyně s tou
starou spojí. V podzemním patře se dál kope, zasypává a táhnou chodby.

Klik na **existující vchod** (na povrchu) přepíná jeho kamenný rám: Podle útesu →
Kamenný → Hliněný. Nápověda u kurzoru ukáže, jaký rám je teď a na jaký se přepne.
Volba se ukládá s mapou a jde vrátit klávesou Z.

## Voda

Voda je jedna hladina pro celou mapu, uložená jako nepovinné číslo `waterLevel`.
V editoru se zapíná tlačítkem **Voda** a hladina se ladí po **0,25 m**.
Skrytí vody je jen vizuální; data se nemění.

Jezera mají vlastní hladinu a ukládají se jako seznam `lakes` (buňka a výška hladiny).
Štětec **Jezero** (skupina Terén): klik do prohlubně ji naplní až po okraj, klik na
jezero zvedne hladinu o 0,25 m, pravé tlačítko ji o 0,25 m sníží a v režimu Mazat
jezero zmizí. Když by voda vytekla z mapy, jezero nevznikne. Tlačítko Voda skrývá
i jezera a řeky.

Štětec **Řeka** (skupina Terén): táhni myší od pramene k ústí — vznikne zvýrazněný návrh,
z jeho posledního políčka jde táhnout dál. Šipky ukazují směr proudu, kroužek pramen;
slabší modré šipky patří řekám, které už v mapě jsou. **Aplikovat** (Enter) řeku postaví, Esc návrh
zahodí. Řeka si vyhloubí koryto a teče ve směru tahu; do kopce nepoteče, hladina se drží pod
nejnižším břehem. V panelu se volí šířka (1 nebo 3 buňky) a hloubka (mělká se dá
přebrodit, hluboká ne). U zvolené hloubky jsou posuvníky od–do: stejné hodnoty dají
jednu hloubku, rozdílné se podél toku plynule střídají (mělčiny a tůně). Pravé tlačítko nebo režim Mazat řeku smaže a koryto zasype
(starší řeky, které si nepamatují původní zem, ho zasypou odhadem těsně nad bývalou
hladinu). Tah přes existující řeku
zakreslený úsek nahradí novou řekou s novou hloubkou. Zpět vrátí řeku i s korytem. Řeky se ukládají jako
seznam `rivers`. Vede-li trasa přes útes (spád aspoň 2 m mezi sousedními buňkami),
vznikne tam sám vodopád; jejich počet editor napíše po postavení řeky.

## Cesty

Cesta je samostatná vrstva `path`, ne dlaždice. Záznam má pozici a styl
(`dirt` / `stone` / `wood`), žádný `key`. Výšku terénu nemění, jen převezme
výšku buňky, na kterou se nakreslí. Vykresluje ji `src/systems/world/pathSystem.js`
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

Se štětci, které mění terén (`brushShapesTerrain` v katalogu štětců: Kopec, Prohlubeň,
Útes, Pláž, Spojnice, Most, Jezero, Řeka, guma terénu), v nástrojích **Výška**
a **Herní plocha** a v záložce **Jeskyně** (kopání a zasypávání) se schovají všechny předměty
a tráva a hra stojí. Přepočítává se jen terén a voda; předměty se postaví znovu
jednou, až přepneš na jiný štětec nebo záložku nebo editor zavřeš.

Výška políčka má v editoru dvě jediná místa. Výšku zapsanou v mapě vrací
`EditorMode.cellHeightValue` (stejné pravidlo jako terén). Výšku, na kterou se kreslí
značky, obrys štětce a hologram, vrací scéna (`GameScene.cellSurfaceAt`). Když jsou předměty
schované, bere jen terén, protože výšky předmětů se do té doby nepřepočítávají.

## Kde editor bydlí

- `mapEditor.js` — spojuje režim, panely a scénu (otevření, zavření, panely, štětec, plocha, Zpět);
  jeho části: `mapInput.js` (klávesy a myš), `mapOverlays.js` (značky, hologram a popisky výšek,
  kruhy tvorů), `mapReadouts.js` (popisky pod myší), `mapFloors.js` (patra a jeskyně),
  `mapSave.js` (neuložené změny a uložení), `mapWater.js` (hladina moře), `mapLakes.js`
  a `mapRivers.js` (jezera a řeky),
- `editorMode.js` — stav editoru (režim, štětec, návrh); zápis do mapy dělají jeho části:
  `editorBrushApply.js` (použití štětce), `editorLayoutEdits.js` (úpravy buněk),
  `editorHeights.js` (výšky), `editorArea.js` (herní plocha), `editorFloors.js` (patra),
  `editorJoinBridge.js` (spojnice a mosty), `editorHistory.js` (Zpět),
  `editorQuery.js` (co je v buňce, otisk mapy),
- `editorSettings.js` — čísla a pomocné výpočty společné pro víc částí,
- `editorHud.js` — hlavní panel editoru, `hudTabs.js` — co leží ve které jeho záložce,
  `editorToggle.js` — tlačítko v horní liště,
- `brushPanel.js`, `areaPanel.js`, `heightPanel.js`, `floorPanel.js` — panely jednotlivých režimů,
- `heightHologram.js`, `heightLabels.js`, `heightRamp.js` — náhled změny výšek a barvy výšek,
- `creatureOverlay.js` — značky spawních míst a náhledy tvorů,
- `src/data/catalogs/brushes.js` — definice štětců,
- `src/data/catalogs/mapFile.js` — formát souboru mapy,
- `vite.mapSaver.js` — zápis mapy do souboru při vývoji.

Technický průvodce projektem je v [DEV.md](../../DEV.md), hráčský popis hry
v [README.md](../../README.md). Aktuální úkoly a známé chyby jsou v
[TODO.md](../../TODO.md).
