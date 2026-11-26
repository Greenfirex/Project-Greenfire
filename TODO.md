# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

### Bestiář
- [ ] Bestiář: projít ve hře nové okno (kniha), texty tvorů a prahy odemčení (1, 3, 5, 8 zabití).
- [ ] Odolnosti tvorů (jedna silná, jedna slabá) vyzkoušet v boji a doladit. Zbroj má zatím jen kajmanka; pozor, odečítá se od každé rány a hráč dnes dává 1–7.

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
- [ ] Pečené vejce v ruce má nový model: doladit úchop v dlani (`scale`, `turn`, `at`, `thumbward` u `cooked_egg`).
- [ ] Palec při jídle: neřídí se (u masa leží ze strany dlaně přes spodek masa); ostatní prsty se zavírají po povrch jídla.
- [ ] Ostrý kámen a kamenná sekera: vyzkoušet ve hře recepty, kácení tasenou sekerou a doladit úchop sekery v ruce i na boku (`grip`, `sheath` u `stone_axe`). Ostré kameny na mapě rozhazuje `tools/scatter/sharpStones.mjs`.
- [ ] Další polotovary po jednom (plán: násada, prkénko, miska z kokosu, bylinková pasta), pak recepty z nich a záložky v okně Výroby.
- [ ] Modely z Meshy (obrázek v Gemini na purpurovém pozadí → Image to 3D; trojúhelníky, ~2 000, textura 1024, GLB do `_sources/`; do hry přes `tools/prepareItems.mjs`, ikona z modelu přes `tools/bl_icon.py`). Prompty jsou v konverzaci z 26. 11. 2026.
  - Hotové modely v `public/assets/props/` (zatím nepoužité): bylina, krunýř.
  - Na vyhazování z inventáře: kabát, kalhoty a boty (u oblečení přiložit ikonu jako předlohu barev). Kámen na zemi = zmenšený `rock_small`.
  - Polotovary: násada, prkénko, miska z kokosu, bylinková pasta v mušli.
  - Výbava (až na ni dojde): nůž, štít z krunýře, palmový klobouk. Vesta z listů až po domluvě (napasování na postavu v Blenderu).
- [ ] Vyzkoušet ve hře okno Vaření (klik na hořící táborák) a doladit léčení: maso 20 zdraví po 2 za sekundu, vejce 12 po 1,5.

- [ ] Dekorace: léčivé byliny mohou být špatně umístěné ve skále (na strmých/útesových buňkách) — přeskočit nebo odsunout od stěny; dořešit s novým (objemovým) terénem.
- [ ] Pirátský srub u útesu (−20…−18, 11…14): plán po etapách v `DEV.md`, sekce „Stavby". Přízemí, patro s pavlačí, schody, střecha a porůstání jsou hotové jako pokus; chůze dovnitř, dveře, nábytek a knihovna na páku hotové (`DEV.md`, etapa 3). V editoru hotový pohled do staveb, volné pokládání dekorací i na podlahy srubu a štětec Přesun (Shift + klik). Později zvuk odsouvání knihovny a vybavení z Meshy (chodba −21,12 se dá v editoru prodloužit). Okenice ne (piráti na tropickém ostrově je neřešili).
  - [ ] Nábytek srubu jako dekorace. Volně stojící kusy a drobnosti jsou hotové. Pracovní místa jsou hotová jako pokus (ponk ve štětci Výroba spolu s táborákem, lucerna v Drobnostech, `DEV.md`, „Pracovní místa“); vyzkoušet ve hře a v editoru. Další etapa:
    4. Ve srubu zatím zůstává knihovna s pákou (tajné dveře), houpací síť, police, sítě a vlajka — vyřeší stavění po dílech (`DEV.md`, etapa 5.3).
  - [ ] Doplňky volného pokládání: jemnější otáčení než po 45°, drobnosti přenášet spolu se stolem, na kterém leží, kokosy a listy kolem palem a vejce v hnízdě i při volném pokládání.
- [ ] Rozhodnout o šířce plynulého okraje pláže.
- [ ] Světla znovu od základu: vymyslet praktičtější systém, ve kterém může svítit víc luceren, táboráků a pochodní najednou a světlo neprojde zdí. Dnes jsou jen dvě přidělovaná světla ohně (jedno se stínem pro nejbližší lucernu či táborák, jedno bez stínu pro pochodeň), takže druhá rozsvícená lucerna do okolí nesvítí. Druhé světlo se stínem zkoušeno 26. 11. 2026: materiály země pak mají 17 textur z 16 možných a nábytek, lucerny a tvorové (max 4 světla) by přišli o slunce. Podklady v `DEV.md`, „Světla ohně“.
