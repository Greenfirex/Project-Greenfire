# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

## Postava

- [ ] Zvážit zmenšení 2K textur nebo celého GLB, pokud bude start hry pomalý.

## Tráva

- [ ] Projít novou trávu v dev serveru: měřítko trsů, barvu, hustotu a skvrny.
- [ ] Koberec krátkých stébel: doladit hustotu (dnes 250 kusů po čtyřech stéblech) a výšku (28 cm).
- [ ] Zem ze tří textur: doladit jas (`gain` v katalogu trávy), velikost skvrn a poměr textur.
- [ ] Rozhodnout kapradinu: lehká (437 trojúhelníků), nebo detailní (7 581); poraženou verzi i s přepínačem v Možnostech pak smazat.
- [ ] Zvážit zmenšení 2K textur trávy — Meshy menší rozlišení neumí, jde to jen zmenšením při importu.

## Editor

- [ ] Doladit barvy a průhlednost značek živého a čekajícího tvora podle vizuálního testu.

## Voda

- [ ] Doladit po novém vlnění: sytost barvy podle hloubky, síla nábřežní pěny a lesk slunce.

## Tvorové a boj

### Etapa 3 — kořist

- [ ] Doladit množství kořisti podle stáří tvora a rozhodnout, jestli má část padat na zem.
- [ ] Koa'tiki: doplnit zvuky (zavrčení, kousnutí, zásah, smrt) a zapsat je do CREDITS.
- [ ] Koa'tiki: stopy ze skutečných chodidel místo jedné šmouhy.
- [ ] Koa'tiki: u jednoho ze tří tvorů se nepovedla kalibrace čelisti (v konzoli „dolů o -0,187") — čelist se mu neotevře. Zjistit proč a opravit výpočet.
- [ ] Tvor, kterého honička zavede za nepřelezný sráz, zůstane trčet u zdi — rozhodnout, jestli se má po chvíli vrátit domů zkratkou (přesunout), nebo se nechat odlákat jinam.

### Etapa 4 — doladění boje

- [ ] Zbraně a nástroje: vlastní síla, dosah a tempo rány (dnes se bije jen rukama).
- [ ] Výbava: brnění na sloty zvedá obranu o procento ze základu se stropem, zbraně útok.
- [ ] Vlastnosti postavy (síla, obratnost, výdrž) a jejich vliv na ránu, zdraví a rychlost.
- [ ] Záblesk obrysu při zásahu (zvuk zásahu už mají oba tvorové).
- [ ] Zvážit ztrátu batohu při smrti hráče.

### Etapa 5 — dotažení potvor

- [ ] Kajmanka: stopy spočítat z reálných chodidel místo odhadu.
- [ ] Do `public/assets/audio/CREDITS.txt` doplnit zdroj želvích zvuků (hiss, growl, bite).
- [ ] Ověřit licenční podmínky balíčku Darkworld (License Agreement.pdf) a případně upravit CREDITS.

### Nástroje

- [ ] `tools/capture.cjs` — vývojový náhled animace: `node tools/capture.cjs koa_tiki attack 12 2.2` (druh, scéna `attack`/`walk`, počet snímků, přiblížení). Ukládá mřížku póz do `tools/_temp/`.

### Zvuky, které ve hře chybí

- [ ] Hudba: vymyslet systém výběru (den/noc, klid versus souboj) místo dnešního náhodného střídání tří skladeb.

- [ ] Smrt hráče.
- [ ] Kroky po písku — dnes hrají jako hlína, i když máme pláž a pouštního tvora.
- [ ] Kroky tvorů (aspoň tiché našlapování, dnes dělají jen stopy).
- [ ] Švihnutí zbraně do prázdna (mine/chop bez zásahu).
- [ ] Vstup do vody (šplouchnutí, ne jen kroky ve vodě).
- [ ] Vkládání předmětů do batohu a přesouvání.
- [ ] Rozhraní: klik, otevření panelu, chybová hláška.
- [ ] Výroba předmětů.
- [ ] Ryby ve vodě.

## Výroba a svět

- [ ] Dekorace: léčivé byliny mohou být špatně umístěné ve skále (na strmých/útesových buňkách) — přeskočit nebo odsunout od stěny; dořešit s novým (objemovým) terénem.

- [ ] **Velká etapa: objemový terén (skála jako hmota) + krok výšek 0,25** a oddělené limity (vylezu ~0,5; práh útesu zvlášť). Plán a fáze 0–7 v `DEV.md`, sekce „Velká etapa: objemový terén". **Fáze 0–2 hotové**: pruhy, krok 0,25, přeškálování výšek, krokový limit 0,55, odkrývání stropu, skutečná hmota (jeskyně, stropy, okraj mapy), boky rozřezané na pláty po 0,25 m s 1m pásem povrchu a správným měřítkem textury, smazané dutiny i sukně, hranice útesu 2,0 m; `?solid` je náhled hmoty jako kostek. **Rohy: přesná detekce hotová** (`?corners` obarví skutečné rohy, vnitřní kouty a diagonální doteky; švy se nekreslí); seříznutí rohů zkoušeno a zrušeno (viz DEV.md). Zbývá fáze 3 (dotazy na pruzích) a dál.
- [ ] Objemový terén: horní hrana boku u **vchodu do jeskyně** — hladká plocha tam srovnává okraj na úroveň podlahy jeskyně, hmota ne (může zůstat drobná škvíra); dořešit stejným úložištěm jako svažené rohy (`surfaceEdge`).
- [ ] Patra: ověřit v dev serveru krok 4 — jeskyně je tmavá i bez hráče (prostorová tma; pochodеň/oheň prosvětlí), povrch světlý, jeskynní ambient (`cave.ogg`) se přelévá; a skrývání ploch nade hráčem (z výšky vidět dovnitř) funguje. Model a stav jsou v `DEV.md`, sekce „Jeskyně a patra".
- [ ] 4B pozastaveno do velké etapy: odkrývání střechy teď ukazuje prázdno/moře a dekorace nad odhalenou plochou visí — dočistí se ve fázi 7 objemového terénu (skála bude hmota + skrytí dekorací).
- [ ] Patra: hloubka skály — **řeší se velkou etapou „objemový terén"** (viz `DEV.md`, sekce „Velká etapa: objemový terén"). Skalní kůže a jiné náplasti se nepoužijí.
- [ ] Suché jámy pod hladinou a řeky s vodopády — dvě témata k rozhodnutí; rozbor (co to obnáší a co se může rozbít) je v `DEV.md`, sekce „Voda a podzemí".
- [ ] Rozhodnout, jestli recepty zůstanou jen jako přehled, nebo dostanou tlačítko pro výrobu.
- [ ] Navrhnout nový systém stavění (starý byl odstraněn).
- [ ] Rozhodnout o šířce plynulého okraje pláže.
