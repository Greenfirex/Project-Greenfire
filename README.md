# Project Greenfire

3D survival hra o přežití na tropickém ostrově, hratelná ve webu
(Vite + Babylon.js). Hráč se probere na pláži, sbírá dřevo a kámen, staví si
táborák a učí se, co ostrov dovolí — přes den svítí slunce, v noci přichází tma
a s ní i tvorové, kteří si svůj revír hlídají.

## Spuštění

```bash
npm install
npm run dev      # http://localhost:5174
```

Při startu běží přes obrazovku načítání reálné počítadlo dokončených dílů
(dlaždice mapy, stromy a kameny, modely tvorů, postava, její animace, nástroje,
příprava ukládání). Mapa se začne vykreslovat dřív, než doběhnou všechny modely;
vstup je zamčený, dokud obrazovka nezmizí.

## Ovládání

| Vstup | Akce |
|---|---|
| **W A S D / šipky** | Pohyb postavy (vzhledem ke kameře), Shift = běh. V editoru posouvají pohled po mapě, Shift zrychlí |
| **Tažení pravým tlačítkem** | Rotace kamery (i v editoru); v editoru pravé kliknutí bez tažení odebírá buňku |
| **Kolečko** | Zoom (v editoru jde oddálit víc než ve hře) |
| **1–5** | Výběr předmětu v ruce z lišty dole; na lištu se věci přetahují z batohu, pravé tlačítko je z ní sundá |
| **I / C / B / V** | Postava a batoh (obojí I i C) / bestiář / výroba — velká okna uprostřed obrazovky, jde s nimi tahat (také tlačítky v liště); výroba je zatím prázdná |
| **Levé tlačítko u houby / kokosu / klacku** | Sebrání (podržet = opakovat) |
| **Levé tlačítko u truhly / kostry / táboráku** | Otevřít / prohledat / zapálit (stačí stát u nich) |
| **Levé tlačítko u tvora** | Útok rukou (podržet = opakovat) |
| **Pravé kliknutí na tvora** | Panel se statistikami tvora (zavře ho křížek, Esc nebo pravé kliknutí jinam) |
| **E** | V otevřené truhle vzít vše |
| **G** | Zobrazit / skrýt mřížku |
| **N** | Posun času o 6 hodin |
| **P** | Pauza / pokračovat (ztmaví obrazovku, zastaví celou hru) — v editoru jen zastaví hru |
| **F1** | Nápověda a ovládání (rozbalit / sbalit) — také tlačítkem ❔ Ovládání v liště |
| **F2** | Editor mapy (zóny, výška, herní plocha, tvorové) — také tlačítkem 🧱 Editor v liště |
| **O** | Možnosti (záložky obraz a výkon, zvuk, hra) — také tlačítkem ⚙ Možnosti v liště |
| **F5 / F9** | Uložit / načíst (načtení se ptá na potvrzení) — také tlačítky 💾 Uložit a 📂 Načíst v liště |
| **Ctrl+Alt+I** | Ladicí okno Babylona (jen při vývoji; jde i přes adresu `?inspector`) |

Hra se ukládá do prohlížeče, takže si ji můžeš rozehrát na pokračování.

## Co ve hře jde dělat

**Pohyb a svět.** Kamera je izometrická (nadhled, mírně zešikma), otáčí se
pravým tlačítkem a přibližuje kolečkem. Na ostrově běží denní cyklus se stíny
a sluncem na obloze; ráno a večer se barvy krajiny mění, v noci je tma a
pochodeň nebo táborák je jediné světlo.

**Sběr.** Rukou se sbírají houby, kokosy, klacky a mušle na pláži; klikneš na věc
pod kurzorem, držené tlačítko akci opakuje. Do ruky si bereš věci z lišty dole
(klávesy 1–5): klacek, kterým se dá bít, nebo pochodeň, kterou najdeš v truhle.
Sekera a krumpáč na kácení a těžení přibudou později. Nasbírané věci se ukládají
do batohu (I), kde si je můžeš přeskládat, a postava má vlastní okno se staty (C).

**Oheň.** Táborák se zapálí kliknutím u připraveného místa, svítí do okolí a v noci
zahřívá. Pochodeň v ruce svítí, kam jdeš.

**Voda.** Mělká voda u břehu tě zpomalí, do hluboké se nedá vejít. Hladina má
vlny, pěnu, odlesky a u břehů příboj, který je slyšet; pod hladinou se honí
hejna ryb.

**Tvorové.** Potkáš kajmanku, písečného běsa a Koa'tikiho. Toulají se po svém
území, varují tě vykřičníkem a pak útočí; když utečeš, vrátí se domů. Dají se
zabít, zůstane po nich tělo s kořistí a po pár herních dnech se na stejném místě
objeví jiný.

**Zdraví a výdrž.** Běh a každé máchnutí ubírá výdrž, ta se po chvíli doplní.
Když dojde zdraví, probudíš se na startovním místě mapy.

**Editor mapy.** Ve hře jde otevřít editor (F2) a malovat mapu — zóny, povrchy,
výšky, pláž, útesy, vodu, tvory a start hráče. Při spuštění přes `npm run dev`
se uloží přímo do souboru mapy, takže si můžeš ostrov předělat k obrazu svému.

## Závislosti a zdroje

- `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/materials` (8.56.2) — jádro
  hry, načítání modelů a obloha.
- `@babylonjs/inspector` (8.56.2) — jen vývojová závislost (ladicí okno
  Ctrl+Alt+I); do produkčního buildu se nebalí.
- Zvuky: Free Fantasy SFX Pack od TomMusic (tommusic.itch.io).
- Hudba: tři skladby z Pixabay Music (licence Pixabay Content License).
- Modely postav, tvorů, ryb, rostlin a kamenů: Meshy a KayKit (podrobnosti
  u jednotlivých souborů).
- Licence všech assetů a jejich původ jsou zapsané v `CREDITS.txt` ve složkách
  `public/assets/`.

## Kde hledat dál

- [DEV.md](DEV.md) — jak se hra skládá, kde co v kódu je, co je hotové a kudy
  se projekt bude ubírat.
- [TODO.md](TODO.md) — aktuální úkoly a známé chyby.
- [Manuál pro tvory](src/data/catalogs/creatures/README.md) — jak postavit
  nového tvora.
- [Dokumentace editoru](src/editor/README.md) — jak funguje editor mapy.

Pravidla práce na projektu jsou v [.clinerules](.clinerules).

