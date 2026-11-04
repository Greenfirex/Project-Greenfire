# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

## Dokumentace

- [ ] Sjednotit údaje v hlavním README: výšky terénu, verzi mapy, ovládání vody a okraje povrchů.
- [ ] Odstranit z hlavního README historický handoff a duplicitní pravidla pro agenty.

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

## Tvorové a boj

### Etapa 3 — kořist

- [ ] Doladit množství kořisti podle stáří tvora a rozhodnout, jestli má část padat na zem.

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

### Zvuky, které ve hře chybí

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

- [ ] Rozhodnout, jestli recepty zůstanou jen jako přehled, nebo dostanou tlačítko pro výrobu.
- [ ] Navrhnout nový systém stavění (starý byl odstraněn).
- [ ] Rozhodnout o suchých jamách pod vodní hladinou a šířce plynulého okraje pláže.
