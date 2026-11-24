# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

### Bestiář
- [ ] Bestiář: projít ve hře nové okno (kniha), texty tvorů a prahy odemčení (1, 3, 5, 8 zabití).
- [ ] Odolnosti tvorů (jedna silná, jedna slabá) vyzkoušet v boji a doladit. Zbroj má zatím jen kajmanka; pozor, odečítá se od každé rány a hráč dnes dává 1–7.

### Editor
- [ ] Při kontrole editoru pater (`tools/checkConsole.cjs`) hlásí grafická karta občas „Two textures of different types use the same sampler location“ (4–9×). Bylo i před 23. 11. 2026; nejspíš značky editoru v podzemí (překryvy v rentgenu). Zjistit, který materiál to je.
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
- [ ] Šavli a kopí z truhly u spawnu po testu odebrat nebo přesunout (dnes jsou ve všech truhlách).

### Etapa 3 — kořist

- [ ] Doladit množství kořisti podle stáří tvora a rozhodnout, jestli má část padat na zem.
- [ ] Koa'tiki: u jednoho ze tří tvorů se nepovedla kalibrace čelisti (v konzoli „dolů o -0,187") — čelist se mu neotevře. Zjistit proč a opravit výpočet.

### Etapa 4 — doladění boje

- [ ] Výbava: brnění na sloty zvedá obranu o procento ze základu se stropem, zbraně útok.
- [ ] Úrovně a vlastnosti: vyzkoušet ve hře proužek zkušeností, novou úroveň a tlačítka +; doladit zkušenosti za tvory, kolik jich chce úroveň, 3 body za úroveň a co dává bod. Zvážit vliv obratnosti na rychlost.
- [ ] Načítání: po kontrole smazat dočasné měření kroků terénu (`[terén]` v `terrainStep` v `sceneWorld.js`); případně dál zrychlit povrch hlavního patra, vodu a objem skal.
- [ ] Po testu odebrat zkušenosti zdarma při startu (`this.gainXp(350)` v `prepareGame` v `GameScene.js`).
- [ ] Zkušenosti za úkoly, až budou úkoly (scéna má na to `gainXp`).
- [ ] Záblesk obrysu při zásahu (zvuk zásahu už mají oba tvorové).
- [ ] Zvážit ztrátu batohu při smrti hráče.

### Etapa 5 — dotažení potvor

- [ ] Hryzokrysa: projít ve hře chůzi a běh (kloužou tlapky?), sednutí, útok a smrt; ověřit, jestli není v jeskyni moc tmavá.
- [ ] Hryzokrysa: z modelu vyhodit nepoužité animace (`cat_idle2`, `wolf_idle1`, `fox_mon_xiaohuli_01_xiuwen`, `wolf_jump_*`, `wolf_walk_fight_forward`), pokud se nebudou hodit.
- [ ] Smečka (volba v editoru): vyzkoušet ve hře, že zavolaní přiběhnou k vůdci a zaútočí s ním; doladit dosah zavolání (10 m), jak dlouho vůdce čeká na ostatní (3 s) a jak dlouho zůstanou rozzuření (8 s).

- [ ] Koa'tiki: běh v honičce (předklon, natažený krk, rovný ocas), tápání jako rychlé rozhlížení bez zobání.
- [ ] README tvorů uvádí u Koa'tiki zrychlení v honičce 1,35, v datech je 1,6 — sjednotit.
- [ ] Ověřit licenční podmínky balíčku Darkworld (License Agreement.pdf) a případně upravit CREDITS.

### Zvuky, které ve hře chybí

- [ ] Hudba: vymyslet systém výběru (den/noc, klid versus souboj) místo dnešního náhodného střídání tří skladeb.

- [ ] Tón smrti (`death_sting`) — vygenerovat a zapojit.
- [ ] Nová úroveň postavy: krátká znělka (dnes jen zpráva v logu).
- [ ] Kritický zásah tvora: těžký úder navíc přes zvuk zbraně (`hit_crit_1–2`, prompt hotový).
- [ ] Kopí: vlastní bodnutí (`hit_spear_1–3`); dnes hraje jen maso (`fleshCut`).
- [ ] Kroky tvorů (aspoň tiché našlapování, dnes dělají jen stopy).
- [ ] Švihnutí zbraně do prázdna (mine/chop bez zásahu).
- [ ] Vstup do vody (šplouchnutí, ne jen kroky ve vodě).
- [ ] Rozhraní: zapojit „nejde to" (`ui/denied.ogg` je připravený), až bude kde.
- [ ] Pochodeň v ruce nemá zvuk; `fire/torch_loop.ogg` je volný — použít, nebo smazat.
- [ ] Vaření: prskání masa na ohni při Upéct (dnes hraje obecný zvuk výroby `craft`).
- [ ] Jídlo: kousnutí a žvýkání při jedení (dnes je jedení úplně tiché, platí pro houbu i pečené jídlo).

## Rozhraní

- [ ] Deník: vymyslet obsah (zápisky, úkoly…); okno a tlačítko jsou zatím prázdné.
- [ ] Projít novou dolní lištu (nápověda myši, ukazatele nad lištou, malá tlačítka oken) a doladit velikosti.

## Výroba a svět

### Výroba a vaření (chybějící obrázky a modely)
- [ ] Ikony `cooked_egg.png`, `twine.png` a `rope.png` do `public/assets/ui/items/` (256 × 256, průhledné pozadí, jako ostatní; doplnit do `CREDITS.txt`) a pak přidat `image` k předmětům v `items.js`. Dnes se ukazují jen emoji 🥚, 🧵 a 🪢.
- [ ] Pečené maso v ruce: vyzkoušet velikost (`scale: 0.18` u `cooked_meat`) a jak ho pěst drží.
- [ ] Další polotovary po jednom (plán: ostrý kámen ze 2 kamenů a občas při těžbě, násada, prkénko, miska z kokosu, bylinková pasta), pak recepty z nich a záložky v okně Výroby.
- [ ] Pečené vejce: vlastní model (opečená skořápka) místo dnešního syrového vejce v ruce; zkontrolovat velikost v ruce (`scale: 0.6`).
- [ ] Vyzkoušet ve hře okno Vaření (klik na hořící táborák) a doladit léčení: maso 20 zdraví po 2 za sekundu, vejce 12 po 1,5.

- [ ] Dekorace: léčivé byliny mohou být špatně umístěné ve skále (na strmých/útesových buňkách) — přeskočit nebo odsunout od stěny; dořešit s novým (objemovým) terénem.
- [ ] Pirátský srub u útesu (−20…−18, 11…14): plán po etapách v `DEV.md`, sekce „Stavby". Přízemí, patro s pavlačí, schody, střecha a porůstání jsou hotové jako pokus; dál chůze dovnitř po krocích (zdi pro postavu hotové jako pokus — ověřit průchod z pavlače na −21,11; schovávání patra a střechy hotové; seříznutí stěn ke kameře hotové; průhled ke kameře hotový; tvorové v přízemí hotoví; tvorové v patře hotoví; dveře hotové; nábytek a knihovna na páku před tajným vchodem hotové jako pokus — ověřit ve hře — `DEV.md`, etapa 3), rozbité okenice, zvuk odsouvání knihovny a vybavení z Meshy (chodba −21,12 se dá v editoru prodloužit).
- [ ] Rozhodnout o šířce plynulého okraje pláže.
