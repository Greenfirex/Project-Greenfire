# TODO

Krátký seznam aktuálních úkolů. Hotové položky se odsud mažou; historie patří do gitu.

## Dokumentace

- [ ] Sjednotit údaje v hlavním README: výšky terénu, verzi mapy, ovládání vody a okraje povrchů.
- [ ] Odstranit z hlavního README historický handoff a duplicitní pravidla pro agenty.

## Postava

- [ ] Doladit měřítko, otočení a uchycení nástroje u nové castaway postavy.
- [ ] Doladit úvodní ležení a vstávání: polohu na zemi, otočení a rychlost `Stand_Up1`.
- [ ] Zkontrolovat animace v dev serveru: idle, chůze, běh, sekání a zapalování.
- [ ] Zvážit zmenšení 2K textur nebo celého GLB, pokud bude start hry pomalý.

## Editor

- [ ] Přidat spojovací čáru mezi spawním místem a živým tvorem; jen při vybraném štětci tvora.
- [ ] Doladit barvy a průhlednost značek živého a čekajícího tvora podle vizuálního testu.

## Tvorové a boj

### Etapa 3 — kořist

- [ ] Doladit množství kořisti podle stáří tvora a rozhodnout, jestli má část padat na zem.
- [ ] Zkontrolovat vzhled mrtvého těla v dev serveru (bok, nebo hřbet).

### Etapa 4 — doladění boje

- [ ] Zbraně a nástroje: vlastní síla, dosah a tempo rány (dnes se bije jen rukama).
- [ ] Výbava: brnění na sloty zvedá obranu o procento ze základu se stropem, zbraně útok.
- [ ] Vlastnosti postavy (síla, obratnost, výdrž) a jejich vliv na ránu, zdraví a rychlost.
- [ ] Výraznější zpětná vazba zásahu (záblesk obrysu, zvuk).
- [ ] Doladit barvu a délku plovoucích čísel poškození podle vizuálního testu.
- [ ] Zobrazit zdraví tvora číslem nebo proužkem nad ním.
- [ ] Zvážit tvrdší smrt hráče: obrazovka smrti a ztráta batohu.
- [ ] Druhý nepřítel a barevné varianty s jinou silou.

### Etapa 5 — dotažení potvor

- [ ] Kajmanka: reakce na ránu (cuknutí při zásahu, stejný princip jako u běsa).
- [ ] Kajmanka: nohy našlapou i při otáčení na místě.
- [ ] Kajmanka: prohýbání kolen při chůzi.
- [ ] Kajmanka: zrychlení v boji (`chaseBoost`).
- [ ] Kajmanka: stopy spočítat z reálných chodidel místo odhadu.
- [ ] Do `public/assets/audio/CREDITS.txt` doplnit zdroj želvích zvuků (hiss, growl, bite).
- [ ] Ověřit licenční podmínky balíčku Darkworld (License Agreement.pdf) a případně upravit CREDITS.

### Zvuky, které ve hře chybí

- [ ] Hráč dostane ránu (a jakákoli zvuková zpětná vazba bolesti).
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
