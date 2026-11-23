# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

### Odladit tvory přes patra (rozdělané, ve hře netestované)
- [ ] Ověřit návrat domů přes průchody a to, že písečný ďábel a kajmanka se zastaví u vchodu z povrchu.
- [ ] Doladit vnímání přes průchod (`FLOOR_LINK_RADIUS` 8 m v `navigationSystem.js`): viditelnost tvora a jeho reakce u průchodu.
- [ ] Tvor umístěný do jeskyně: drží se v podzemí? Správné značky a stav v editoru (`statusAt` zná jen povrch).
- [ ] Ověřit výkon hledání cesty přes patra.

### Bestiář
- [ ] Bestiář: doplnit obsah okna (popis tvora, kde žije, obrázek); kostra se seznamem a statistikami je hotová.
- [ ] Doplnit tvorům skutečnou zbroj a odolnosti (dnes všude nula; pozor, zbroj se odečítá od každé rány a hráč dnes dává 1–5).
- [ ] Až bude bestiář hotový, vypnout ladicí odemčení všech statistik (`SHOW_ALL_STATS` v `bestiarySystem.js`).

### Život v jeskyni
- [ ] Ověřit v praxi pokládání předmětů a táboráku v patře, zapálení a znovunačtení savu.

### Editor
- [ ] Ověřit, jestli se předměty hýbou s buňkou při změně výšky (tak nejspíš zapadly léčivé byliny).
- [ ] Liana u nově vykopaného vchodu: objeví se hned, nebo až po znovunačtení?
- [ ] Slabý obrys povrchu při kopání do prázdného patra, pokud bude chybět.

### Úklid a dokumentace
- [ ] Prověřit zbytky starého schovávání střechy (`roofMeshes` v `terrainSystem.js` a `GameScene.js`, dnes se ještě používají); smazat jen po souhlasu.
- [ ] Zapsat patra, rentgen, chodby, rám vchodu a tvory přes patra do `DEV.md` a `src/editor/README.md`.

### Až později
- [ ] Vrátit ležení na začátku hry: `START_LYING` v `playerSystem.js` na `true`.

## Postava

- [ ] Zvážit zmenšení 2K textur nebo celého GLB, pokud bude start hry pomalý.

## Tráva

- [ ] Projít novou trávu v dev serveru: měřítko trsů, barvu, hustotu a skvrny.
- [ ] Koberec krátkých stébel: doladit hustotu (dnes 250 kusů po čtyřech stéblech) a výšku (28 cm).
- [ ] Zem ze tří textur: doladit jas (`gain` v katalogu trávy), velikost skvrn a poměr textur.
- [ ] Zvážit zmenšení 2K textur trávy — Meshy menší rozlišení neumí, jde to jen zmenšením při importu.

## Editor

## Voda

- [ ] Doladit po novém vlnění: sytost barvy podle hloubky, síla nábřežní pěny a lesk slunce.

## Tvorové a boj

### Zbraně a mířené rány (plán v `DEV.md`, sekce „Boj se zbraněmi — plán po etapách")

- [ ] Etapa 3: vyzkoušet ve hře rozdělení rány mezi víc tvorů a sekundární ránu na pravé tlačítko, doladit čísla a animaci úderu klackem.
- [ ] Šavle: vlastní zvuk zásahu čepelí (dnes zvuk klacku).
- [ ] Šavli a kopí z truhly u spawnu po testu odebrat nebo přesunout (dnes jsou ve všech truhlách).

### Etapa 3 — kořist

- [ ] Doladit množství kořisti podle stáří tvora a rozhodnout, jestli má část padat na zem.
- [ ] Koa'tiki: stopy ze skutečných chodidel místo jedné šmouhy.
- [ ] Koa'tiki: u jednoho ze tří tvorů se nepovedla kalibrace čelisti (v konzoli „dolů o -0,187") — čelist se mu neotevře. Zjistit proč a opravit výpočet.

### Etapa 4 — doladění boje

- [ ] Výbava: brnění na sloty zvedá obranu o procento ze základu se stropem, zbraně útok.
- [ ] Vlastnosti postavy (síla, obratnost, výdrž) a jejich vliv na ránu, zdraví a rychlost.
- [ ] Záblesk obrysu při zásahu (zvuk zásahu už mají oba tvorové).
- [ ] Zvážit ztrátu batohu při smrti hráče.

### Etapa 5 — dotažení potvor

- [ ] Hryzokrysa: projít ve hře chůzi a běh (kloužou tlapky?), sednutí, útok a smrt; ověřit, jestli není v jeskyni moc tmavá.
- [ ] Hryzokrysa: z modelu vyhodit nepoužité animace (`cat_idle2`, `wolf_idle1`, `fox_mon_xiaohuli_01_xiuwen`, `wolf_jump_*`, `wolf_walk_fight_forward`), pokud se nebudou hodit.
- [ ] Hryzokrysa: zvuky (varování, syčení, kousnutí, zásah, smrt, čenichání) — prompty pro ElevenLabs, pak zapojit.
- [ ] Hryzokrysa: smečka — když si jeden všimne hráče, přivolá ostatní poblíž (nové chování v systému tvorů).

- [ ] Kajmanka: stopy spočítat z reálných chodidel místo odhadu.
- [ ] Koa'tiki: běh v honičce (předklon, natažený krk, rovný ocas), tápání jako rychlé rozhlížení bez zobání.
- [ ] README tvorů uvádí u Koa'tiki zrychlení v honičce 1,35, v datech je 1,6 — sjednotit.
- [ ] Ověřit licenční podmínky balíčku Darkworld (License Agreement.pdf) a případně upravit CREDITS.

### Zvuky, které ve hře chybí

- [ ] Hudba: vymyslet systém výběru (den/noc, klid versus souboj) místo dnešního náhodného střídání tří skladeb.

- [ ] Tón smrti (`death_sting`) — vygenerovat a zapojit.
- [ ] Kroky tvorů (aspoň tiché našlapování, dnes dělají jen stopy).
- [ ] Švihnutí zbraně do prázdna (mine/chop bez zásahu).
- [ ] Vstup do vody (šplouchnutí, ne jen kroky ve vodě).
- [ ] Rozhraní: zapojit „nejde to" (`ui/denied.ogg` je připravený), až bude kde.
- [ ] Pochodeň v ruce nemá zvuk; `fire/torch_loop.ogg` je volný — použít, nebo smazat.

## Rozhraní

- [ ] Deník: vymyslet obsah (zápisky, úkoly…); okno a tlačítko jsou zatím prázdné.
- [ ] Projít novou dolní lištu (nápověda myši, ukazatele nad lištou, malá tlačítka oken) a doladit velikosti.

## Výroba a svět

- [ ] Dekorace: léčivé byliny mohou být špatně umístěné ve skále (na strmých/útesových buňkách) — přeskočit nebo odsunout od stěny; dořešit s novým (objemovým) terénem.
- [ ] Pirátský srub u útesu (−20…−18, 11…14): plán po etapách v `DEV.md`, sekce „Stavby". Přízemí, patro s pavlačí, schody, střecha a porůstání jsou hotové jako pokus; dál chůze dovnitř po krocích (zdi pro postavu hotové jako pokus — ověřit průchod z pavlače na −21,11; schovávání patra a střechy hotové; seříznutí stěn ke kameře hotové; průhled ke kameře hotový; tvorové v přízemí hotoví; tvorové v patře hotoví; dveře hotové; nábytek a knihovna na páku před tajným vchodem hotové jako pokus — ověřit ve hře — `DEV.md`, etapa 3), rozbité okenice, zvuk odsouvání knihovny a vybavení z Meshy (chodba −21,12 se dá v editoru prodloužit).
- [ ] Rozhodnout o šířce plynulého okraje pláže.
- [ ] Díry u vchodů do jeskyní −16,−2 a −18,−4: podél paty útesu vedle vchodu je široký pás, skrz který je vidět voda a prázdno. Okolní buňky −0,25 až 0,5 m, podlaha jeskyně 0, jedna buňka přesně ve výšce vody. Nejspíš úprava prahu (`setDoorBlends` v `terrainField.js`) srovná zem až o půl buňky za ostění, ale spodní hrana útesu se neposune — neověřeno.
