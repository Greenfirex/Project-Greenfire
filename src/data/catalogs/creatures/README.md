# Tvorové — jak postavit novou potvoru

Manuál k jedné věci: co všechno musí nový tvor mít, aby ho hra vzala za svůj.
Obecné věci (spawn, stavy, ikony, obrysy, ukládání) drží systém tvorů a o kostech
nic neví. Vzhled, animace a čísla chování patří do souboru tvora.

```
src/data/catalogs/creatures/
  index.js            registr: které tvory hra zná + pomocné funkce
  sandDevil.js        písečný běs — vzor (zahrabání, útok nohama, reakce na ránu)
  snappingTurtle.js   kajmanka — vzor pro model bez použitelných jmen kostí
  koaTiki.js          Koa'tiki — vzor pro dvounohého tvora s otevíratelnou čelistí
  gnawRat.js          hryzokrysa (gnaw_rat) — vzor pro tvora s hotovými animacemi z Meshy smíchanými s pohybem z kódu
src/systems/creatures/creatureSystem.js   obecné: spawn, stavy, ikony, obrysy, ukládání
src/utils/creatureMarker.js     vykřičník a otazníky nad hlavou (společné všem)
src/utils/proceduralRig.js      společné pomocníky pro rigy (kosti, osy, otáčení)
public/assets/creatures/<kind>/ model + CREDITS.txt
```

## Checklist nové potvory

1. Model do `public/assets/creatures/<kind>/` + `CREDITS.txt` (odkud model je a jaká licence).
2. Soubor `src/data/catalogs/creatures/<jménoTvora>.js` (jméno souboru je ve tvaru `snappingTurtle.js`, `kind` v datech `snapping_turtle`): hlavička (1–3 řádky), import `ASSET_DIRS`,
   rig (nebo `rig: null`) a data podle tabulky níž.
3. Řádek do `index.js` (import + položka v `CREATURE_TYPES`).
4. Zvuky: soubory do `public/assets/audio/creatures/<druh>/`, záznam do seznamu klipů a do `CREDITS.txt`.
5. Zapsat tvora do mapy (mapa určuje, kdo ve hře existuje; hra tvory nedoplňuje).
6. Portrét do bestiáře: `node tools/capture.cjs <kind> idle --portrait 1` (běžící dev server).

Spawn, ikony, obrysy, tooltip, stopy i ukládání pak fungují samy.

## Data tvora

Povinné je to, co systém čte bez náhrady. „Když chybí" říká, co se stane, když pole vynecháš.

| Pole | Co dělá | Když chybí |
|---|---|---|
| `label` | jméno do konzole a do jmen uzlů | povinné |
| `model` | cesta ke GLB | povinné |
| `rig` | trojice `build` / `pose` / `summary` (a nepovinné `busy`), nebo `null` | `null` = model bez animace |
| `sounds` | klíče zvuků (`alert`, `charge`, `bite`) | tvor je němý |
| `length` | délka těla ve světových jednotkách (buňka = 2); model se na ni normalizuje | 1 |
| `scale` | dodatečné měřítko nad `length` (1 = beze změny) | 1 |
| `yawOffset` | pootočení modelu, který nekouká na +Z | 0 |
| `groundOffset` | výška nejnižšího bodu modelu nad zemí (v jednotkách modelu) | 0 |
| `walkSpeed` | rychlost chůze ve světových jednotkách za sekundu | povinné |
| `chaseBoost` | násobek rychlosti v boji (honička) | 1 |
| `turnRate` | jak rychle se otáčí (radiány za sekundu) | povinné |
| `aggroRange` | od jaké dálky si tě všimne | povinné |
| `chargeRange` | od jaké dálky rovnou útočí; dál jde nejdřív varování | povinné |
| `alertSeconds` | rozsah `[min, max]`, jak dlouho varuje; v půlce zaskřečí podruhé | `[5, 6]` |
| `noWarning` | `true` = žádné varování, rovnou boj | `false` |
| `damageType` | typ poškození (`piercing`, `slashing`, …) proti resistitám hráče | žádný |
| `biteRange` | na jakou dálku dosáhne | povinné |
| `biteArc` | úhel výseče kousnutí ve stupních; hráč mimo ni uhne | 90 |
| `regenPerSecond` | kolik životů za sekundu se pořád doplňuje (i v boji) | 0 |
| `biteLunge` | o kolik metrů tvor na konci nápřahu vyrazí vpřed | 0 |
| `biteWindup` | jak dlouho se napřahuje, než rána padne | povinné |
| `biteCooldown` | pauza mezi útoky | povinné |
| `biteRecover` | jak dlouho se po ráně zotavuje | povinné |
| `confusedSeconds` | jak dlouho tápe, když tě ztratí | 1,4 |
| `roamRadius` | jak daleko od domova se toulá | 0 = stojí na místě |
| `slopeTilt` | jak moc se tělo nakloní podle svahu (1 = celý sklon pod hlavou a zadkem, max. asi 34°; 0 = vždy vodorovně, hodí se pro dvounohé) | 1 |
| `footprint` | stopy v písku (viz níž) | jedna šmouha bez detailů |
| `respawnDays` | po kolika herních dnech se obnoví | povinné |
| `idleSeconds` | rozsah `[min, max]`, jak dlouho postává | povinné |
| `idleCallSeconds` | rozsah `[min, max]`, jak často v klidu zavolá (zvuk `idle`) | v klidu mlčí |
| `defaultTier` | který tier platí, když mapa nic neřekne | povinné |
| `loot` | co z něj vypadne (`{ id_předmětu: počet }`) | nic |
| `resistances` | odolnosti v procentech (`{ blunt: 25, piercing: -25 }`); záporné = slabina | všude 0 |
| `bestiary` | texty do bestiáře: `summary` (popis), `habitat` (kde žije), `notes` (poznámky lovce) | v bestiáři prázdno |
| `tiers` | úrovně (viz níž) | povinné |
| `buried` | `true` = začíná zahrabaný a vylézá na hráče | `false` |
| `emergeRange` | z jaké dálky vyleze ze země | `aggroRange` |
| `emergeSeconds` | jak dlouho vylézá (a stejně dlouho se i zahrabává) | 1 |
| `emergeJump` | jak vysoko při vylézání poskočí | 0 = nevyskočí |
| `buriedDepth` | jak hluboko je zapadlý (světové jednotky) | 0,85 |
| `deathRoll` | o kolik se při smrti převalí; `Math.PI` = na záda, opačné znaménko = na druhou stranu | lehne si na bok |
| `deathSeconds` | jak dlouho padání trvá | 0,5 |

## Tiery

Tier je stáří tvora. Klíč tieru se ukládá do savu, takže přejmenování zvedá verzi savu.

| Pole | Co dělá | Když chybí |
|---|---|---|
| `label` | jméno stáří do konzole | — |
| `scale` | měřítko proti základu | 1 |
| `tint` | `[r, g, b]` nádech barvy | `[1, 1, 1]` |
| `health` | životy | povinné |
| `xp` | zkušenosti pro hráče za zabití | 0 |
| `bite` | zranění z rány jako rozsah `[min, max]` | povinné |
| `damageType` | přebije typ poškození z druhu tvora | typ tvora |
| `attack` | síla útoku proti obraně hráče | povinné |
| `defense` | obrana proti útoku hráče | povinné |
| `speed` | násobek rychlosti | 1 |
| `aggroRange` | přebíjí základní dohled | základ z dat tvora |

## Rozhraní rigu

```js
rig.build(mesh, skeleton, animace) // -> stav kostry, nebo null, když se rig nepovedl
                                   //    (animace = hotové animace z modelu, smí se ignorovat)
rig.pose(stav, dt, info)           // -> { bob }  (jen svislé zhoupnutí)
rig.summary(stav)                  // -> řetězec do konzole („6 nohou, 2 chapadla“)
rig.busy(stav)                     // nepovinné: true, dokud rig dodělává klidovou akci;
                                   //    tvor do té doby neodejde na procházku
```

`pose` se volá každý snímek s reálným `dt` (ne v tiku simulace). Dostává:

| Vstup | Význam |
|---|---|
| `mode` | v jakém stavu tvor je — viz seznam níž |
| `moving` | `true`, jen když se v tomto tiku opravdu pohnul |
| `moved` | kolik metrů v tomto snímku ušel (0, když stojí) |
| `turning` | `true`, když se právě otáčí (i na místě) |
| `engaged` | `true`, když je v boji (honička, útok) |
| `leaving` | `true`, když tvoru vypršel čas stání; rig už nemá začínat novou klidovou akci |
| `hit` | `true` v jediném snímku, kdy dostal ránu |
| `buried` | `true`, dokud je zarytý v zemi |
| `emergeProgress` | 0 = úplně v zemi, 1 = venku; dorazí o snímek starší |

Módy, které rig musí snést: `buried`, `emerging`, `burying`, `windup`, `recover`,
`alert`, `confused`, `chase`, `roam`, `idle` a `dead`. Mrtvola se animuje taky —
`pose` dostane `mode: 'dead'` a podle toho tělo složí.

Rig nikdy nehýbe s pozicí ani otočením těla; to patří systému. Rig sahá jen na kosti
a vrací jedno číslo — jak moc se má tělo zvednout.

## Hotové animace z modelu (hryzokrysa)

Model z Meshy může mít v sobě animace. Rig je nepouští sám od sebe (systém je při
stavbě zastaví), ale čte je po snímcích přes `src/utils/clipSampler.js` a sám rozhoduje,
kterou animaci v jaké síle smíchá: `extractClips` vytáhne vybrané animace podle jména,
`blendPose` z nich složí polohu kostí a rig k ní pak přidá pohyby z kódu (otočení hlavy,
ucuknutí, sednutí). Kosti, které rig ovládá z kódu, berou smíchanou polohu jako svůj základ.

- **Chůze a běh podle ušlé cesty.** Fáze se posouvá o `ušlo / délka cyklu`; délku
  cyklu (kolik tělo ujde za jedno opakování animace) je potřeba změřit z animace
  (posun chodidla po zemi). Tak tlapky neklouzají při žádné rychlosti a chůze se
  plynule mění v běh.
- **Na místě (`inPlace`).** Animace, které tělo posouvají (skok leoparda, smrt), se
  pouštějí bez vodorovného posunu kořenové kosti; dopředu tvora posouvá hra.
- **Nadzvednutí (`raise`).** Animace dělané pro jiné zvíře mívají tělo níž, než model
  stojí; tlapky pak zajíždějí do země. Malé zvednutí kořene to srovná — každé animaci zvlášť.
- **Útok z dlouhé animace.** Napřažení a zotavení se mapuje na vybraný úsek (`ATTACK_CLIP`):
  okamžik rány je v animaci nejlepší chvíle (vrchol skoku), konec úseku se utne před tím,
  než animace začne dělat něco nechtěného (otočka), a zbytek se dolní vahou.
- **Ocas psí animace utlumit.** Animace pro psy nesou ocas vysoko; krysa ho má táhnout,
  proto se vliv animací na ocas bere jen zčásti.
- **Klid hlavně z kódu.** Animace lišky nebo vlka stojí na špičkách; krysa šlape celou
  tlapkou, takže ve stoji visí na drápech. Čenichání a rozhlížení má hryzokrysa v kódu;
  vsedě k tomu kód přidá švihání ocasem. Čuchání jsou krátké série drobných cuknutí
  hlavou (`SNIFF`) s pauzami, ve kterých krysa pootočí hlavu jinam. Sednutí je psí animace upravená pro krysu: tělo klesne jen o část (`dropShare`
  — pes má delší nohy), přední nohy se po dobu sezení drží v jednom okamžiku animace
  (`only` = vrstva jen pro vybrané kosti) a dorovnají se k zemi, hřbet se shrbí a ocas
  z animace se nahradí vlastním položeným ocasem.
- **Stoj.** Základní póza modelu z Meshy stojí na rovných nohách jako na chůdách. Hryzokrysa
  proto pod všemi animacemi drží slabě přimíchané přikrčení z varovné animace (`STAND`).
  Sednutí se uprostřed na pár vteřin zastaví (`clipTime`) a kód mezitím hýbe
  hlavou a čumákem, takže trvá déle, než je dlouhá samotná animace.
- Při přípravě modelu (`tools/prepareGnawRat.mjs`) se z animací vyhodí měřítko a posuny
  kostí kromě kořene — nic nemění a zabírají místo.

## Jak najít kosti v modelu

Dvě cesty, obě použitelné:

- **Podle klidové polohy** (želva): kosti nemají použitelná jména, tak se hledá podle
  toho, kde v klidu leží (nejvíc vepředu = hlava, mimo tělo a nízko = noha). Funguje
  i po novém exportu modelu, ale je to odhad.
- **Podle jmen kostí** (běs): když export jména má (`Bone_035`), dá se rovnou říct,
  která kost je která noha. Je to přesnější, ale jména generuje Meshy — po novém
  exportu se změní a tabulka v souboru tvora se musí přepsat.

Ať tak nebo tak, první krok je vždycky **vypsat, co v modelu je**:

```js
// node -e "...", jen ke čtení; vypíše jména kostí a jejich děti
const fs = require('fs');
const b = fs.readFileSync('public/assets/creatures/<kind>/<model>.glb');
const len = b.readUInt32LE(12);
const json = JSON.parse(b.slice(20, 20 + len).toString('utf8'));
json.nodes.forEach((node, index) => console.log(index, node.name, node.children || ''));
```

Z toho se poznají řetězy kostí (která kost je kořen nohy, která prostředek a která
špička). Klidové polohy se počítají průchodem hierarchie (translaci a otočení rodičů)
a vynásobením měřítkem modelu — z toho vyjde tabulka chodidel pro stopy a osy otáčení.


## Osvědčené vzory

- **Nic nepřepínej skokem.** Každá poloha (prohnutí, otevření, zvednutí) má cílovou
  hodnotu a k ní se plynule dojíždí; rychlost dojíždění je samostatná konstanta.
  Skokové přepnutí je vidět jako cuknutí.
- **Úder jako impuls.** Systém nemá mód „udeřil jsem“. Pozná se to podle přechodu
  `windup` → `recover`; v ten snímek si rig nastaví impuls a ten postupně odezní.
  Animace tak sedí na okamžik, kdy hra opravdu ubere zdraví.
- **Reakce na ránu přes `hit`.** Systém pošle puls v jednom snímku; rig si drží
  vlastní časovač (jak dlouho cuknutí trvá) a sílu reakce.
- **Fázi kroku posouvej podle ušlé vzdálenosti, ne podle času.**
  `phase += moved / STRIDE` (želva) sedí na každou rychlost — i na zrychlení v boji
  a na mladší tiery. Časová fáze se s tlapkami rozejde, jakmile se tempo změní.
- **Krok drž ve svislé rovině.** Všechny nohy se otáčejí kolem vodorovné osy napříč tělem,
  takže krok je vidět z boku jako krok. Otáčení kolem svislé osy nohu přelévá do strany
  (u roztažených nohou to vypadá jako plavání prsama, ne jako chůze).
- **Dráhu chodidla na zemi srovnej s ušlou cestou, jinak tlapky kloužou.** Za dobu, kdy
  tlapka stojí na zemi, ujde tělo `STRIDE × podíl stání`; přesně tolik musí chodidlo
  popojet dozadu. Rig si při stavbě přečte skutečné měřítko modelu (světovou matici), takže
  to sedí i na mladší a starší tiery. Kratší noha dostane větší úhel.
- **Směr kroku si spočítej.** Na zemi jde chodidlo dozadu, vzduchem dopředu. Kterým
  znaménkem úhlu to je, plyne z polohy chodidla pod kloubem (vektorový součin osy
  a ramene), ne z odhadu.
- **Řetěz nohy hledej podle rodičů kostí, ne podle vzdálenosti od středu.** Kořen nohy je
  kost, jejíž rodič do nohy nepatří, koleno je jeho dítě. Řazení podle vzdálenosti
  od těla vybere jako „koleno“ špičku prstu a noha se pak nekrčí. Ocas je řetěz kostí
  s jediným dítětem od špičky až k pánvi.
- **Noha kývaná kolem svislé osy potřebuje znaménko strany i pro krok.** Stejný úhel
  posune chodidlo vpravo dozadu a vlevo dopředu, takže bez znaménka polovina nohou
  couvá (běs). Znaménko ber z klidové polohy kosti v prostoru modelu (`bindPosition`),
  ne ze světa: model může být při načtení zrcadlený.
- **Klid nemá být socha.** Rozvrh krátkých akcí (rozhlédnutí, cvaknutí, škubnutí, poklep)
  se střídá dokola a každý kus začíná jinde, aby nebyli všichni sladění (běs, Koa'tiki).
  Mezi chůzí a klidem míchej přes váhu, která plynule dojíždí, ne přepínáním.
- **Úder se švihem.** Výpad se rozjede za pár setin sekundy a dojede se zhoupnutím
  přes klid; okamžitý skok na plnou sílu je vidět jako cuknutí.
- **Ptačí noha: pata vyrovnává koleno.** U dvounožce s kolenem, patou a prsty
  (Koa'tiki) vyrovná pata při kroku polovinu pohybu kyčle a kolena a zbytek
  vyrovná chodidlo, takže nárt se kývá s nohou a prsty leží naplocho. Ve vzduchu
  se vyrovnávání povolí a prsty se přikrčí. Délku kroku rig počítá z toho, kam se
  pod kyčlí posune chodidlo. Ušlou cestu vyhlazuje, protože chodí po nepravidelných
  kouscích a bez vyhlazení noha cuká.
- **Váha přes stojnou nohu.** Tělo se při chůzi naklání nad nohu na zemi a pánev se
  pootáčí; kyčle se otočí zpátky, aby chodidla nepopojela, a krk vyrovná hlavu.
  V klidu stojí chodidla pevně a pohupuje se jen tělo.
- **Ocas jako vlna.** Každý článek ocasu se pohne o kousek později než ten před ním
  (kajmanka, Koa'tiki); při chůzi se ocas kývá v rytmu kroku proti pánvi.
- **Víc druhů útoku.** Systém zná jen napřažení a zotavení; rig si při začátku
  napřažení sám vybere, kterou animaci zahraje (Koa'tiki: klovnutí, nebo výskok
  se škrábnutím levou a pak pravou nohou). Každá animace je tabulka klíčových poloh v čase, kde 0 je
  okamžik rány; mezi klíči se plynule dojíždí. Skok se vrací přes `bob`.
  Ocas čte stejnou tabulku o kousek později, takže dozní švihem.
- **Klid jako sled náhodných akcí.** Místo pevného rozvrhu si tvor po každé akci
  vylosuje další (stání, rozhlédnutí, zobání) a zobání si pokaždé sestaví znovu
  (kolik klovnutí, pauzy, jestli předtím hrabe nohou, na kterou stranu nakloní
  hlavu). Kusy tak nejsou sladěné. Po boji začíná vždy stáním, aby hned nezobal.
- **Mrtvola dozní.** Po smrti se nohy postupně stáhnou a pár sekund slábnoucími
  záškuby doznívají (`deadTime` v rigu běsa).
- **Zrcadlové nohy potřebují znaménko strany.** Stejný úhel na levou a pravou nohu
  neudělá souměrný pohyb; znaménko se bere z klidové polohy kosti.
- **Osy otáčení převáděj do prostoru rodiče** a normalizuj, jinak se do rotace
  zamíchá měřítko modelu.
- **Bázi kosti si ulož při stavbě** a každý snímek počítej z ní; nikdy neakumuluj
  rotaci na živé kosti.
- **Znaménka rotací ověř, neodhaduj.** Babylon počítá kvaterniony jinak než matice;
  co vypadá „logicky“, může být obráceně. Nejrychlejší kontrola je krátký výpočet
  v Node: otočit vektor kolem osy a podívat se, kterým směrem vyšel.
- **Ladění patří k tvorovi** — rozsahy, prahy i rychlosti jsou v jeho souboru
  jako pojmenované konstanty nahoře, ne rozeseté v kódu.

## Stopy

```js
footprint: {
  kind: 'sanddevil',         // který obrázek stopy a jak je velká
  scale: 1,                  // násobek velikosti stopy
}
```

- Kde a kdy stopa vznikne, určují skutečné nohy: rig vrátí z `build` pole `feet`
  s uzly kostí chodidel (špičky nebo prsty). Systém tvorů je sleduje a stopu
  otiskne tam, kde chodidlo při chůzi stálo nejklidněji na zemi.
- Noha, která se nese ve vzduchu spolu s tělem (zvednutá klepeta), stopu nedělá,
  protože se vůči zemi hýbe stejně rychle jako tvor.
- Rig bez `feet` stopy nedělá.

## Zvuky

Data tvora mají `sounds` s klíči, které systém volá: `alert` (varování před útokem),
`charge` (naštvání), `bite` (rána), `hit` (dostal ránu), `death` (zahynul)
a `dig` (vylézá nebo se zahrabává). Klidové zvuky: `idle` zazní v klidu nebo při
procházce jednou za náhodnou dobu z `idleCallSeconds` (bez tohoto čísla tvor v klidu
mlčí) a `peck` ohlásí sám rig, když v `pose` vrátí `sound: 'peck'` (Koa'tiki tak klapne
zobákem pokaždé, když při zobání ťukne do země). Tvor s víc druhy útoku nemá `bite`,
protože systém neví, který útok rig vybral; zvuk rány ohlásí rig ve chvíli dopadu
(Koa'tiki: `beak` při klovnutí, `claws` při každém seknutí drápy ve výskoku). Klíč se hledá v seznamu klipů v audio systému,
hlasitost se počítá podle vzdálenosti od hráče: každý zvuk má v audio systému vlastní
dosah `hearing` v metrech (bez něj 22 m) a hlasitost k okraji dosahu klesá se čtvercem
vzdálenosti, takže zvuk na půli dosahu hraje na čtvrtinu. Drobné zvuky (klapnutí zobáku)
mají dosah malý, varovný skřek velký. Když tvor nějaký klíč nemá, prostě
v tu chvíli mlčí.

Nový zvuk = tři kroky: soubor do správné složky v `public/assets/audio/` (kroky do `steps/`,
sběr a těžba do `gather/`, souboj do `combat/`, smyčky do `ambient/` nebo `fire/`, zvuky
tvora do `creatures/<druh>/`), záznam do seznamu klipů a hlasitostí (jméno i se složkou)
a řádek do `CREDITS.txt` (odkud a jaká licence). Bez CREDITS zvuk v projektu nemá co dělat.

Názvy složek nesmí obsahovat tečku — podle tečky v názvu klipu se pozná, jestli se má
doplnit `.ogg`.

Formát je OGG (Vorbis) — malý a čte ho každý prohlížeč. Stažené balíčky ale často
chodí jako WAV; převod dělá ffmpeg:

```
ffmpeg -i vstup.wav -ar 44100 -ac 1 -c:a libvorbis -q:a 4 vystup.ogg
```

`-ar 44100 -ac 1` srovná vzorkování i počet kanálů (zdrojové balíčky mívají 96 kHz),
`-q:a 4` je kvalita, na krátké ruchy bohatě stačí.

## Nástrahy

- **`kind` je v savu.** Přejmenování u existujícího tvora zahodí stará data.
- **`tier` je v savu.** Přejmenování tieru zvedá verzi savu.
- **Stav živý/mrtvý není v mapě** — mapa drží druh, stáří a buňku; čas smrti a zdraví
  patří do uložené hry.
- **Načtení musí snést stará data** (chybějící tvory, neznámé tiery) a nesmí spadnout.
- **Kam dojde hráč, tam dojde i tvor.** Schod mají všichni tvorové stejný jako hráč
  (`walkStepLimit` předá scéna); plánovač cest kontroluje svah po 0,3 m stejně jako chůze.
  Výšku, do které tvor kousne, drží jedno číslo `ATTACK_HEIGHT` v systému tvorů.
- **Kam dohlédne hráč, tam i tvor — jen blíž.** Tvor si tě všimne, jen když jsi v jeho
  dohledu (`aggroRange`) a mezi vámi nestojí skála (stejný paprsek, jakým hráč vidí tvory,
  `seesSpot` ve scéně). Ztratí tě, když zmizíš za skálou nebo dál než 1,8× dohled.
- **Paměť:** když tě ztratí, dojde na místo, kde tě viděl naposledy, rozhlédne se tam
  (`confusedSeconds`, otazníky nad hlavou) a teprve pak jde domů. Stejně tápe, když mu
  utečeš během varování.
- **Zásah rozhodují vlastnosti** (`attack` proti `defense`, ohraničeno 5–95 %); citlivý
  zásah se nevyplňuje, je odvozený z téhož porovnání.
- **Kopírování modelu:** `LoadAssetContainerAsync` + `instantiateModelsToScene`;
  ruční `clone()` skinned meshe rozbije kostru.
- **`pose` dostane `emergeProgress` o snímek starší** — nevadí to, ale nepočítej s ním
  jako s aktuální hodnotou.
- **Mrtvý kód:** když tvor ocas nemá, rig ho nesmí mít „pro jistotu“.
- **Bez kostí** (sochy, barely): `rig: null` a systém to snese.

## Co která potvora umí

Aby se vědělo, kde je vzor a kde mezera. Úkoly z toho plynoucí patří do `TODO.md`.

| Vlastnost | Písečný běs | Kajmanka | Koa'tiki | Hryzokrysa |
|---|---|---|---|---|
| reakce na ránu (`hit`) | ano | ano | ano | ano |
| nohy našlapou i při otáčení (`turning`) | ano | ano | ano | ano |
| prohýbání kolen při chůzi | ano | ano | ano | ano |
| zrychlení v boji (`chaseBoost`) | ano (1,2) | chybí | ano (1,35) | ano (2,3; chůze plynule přejde v běh) |
| zahrabání a vylézání | ano | ne (žije u vody) | ne | ne |
| víc druhů útoku | ne | ne | ano (klovnutí, výskok se škrábnutím každou nohou) | ne (skok na kořist z animace) |
| otevíratelná čelist | ne (kusadla) | ne | ano (kost čelisti + tmavá vložka) | ne (model nemá kost čelisti) |
| převrácení na záda při smrti (`deathRoll`) | ano | ne (padá na bok) | ne (padá na bok) | ne (`deathRoll: 0`, pád dělá animace) |
| stopy z reálných chodidel | ano (4 nohy; přední pár nese jako ruce) | odhad (4 nohy stejně) | chybí (jedna šmouha) | ano (4 tlapky) |
| varování před útokem (`noWarning`) | ne — rovnou útok | ano | ano | ano (přikrčí se, animace) |
| vlastní doložené zvuky | ano (Darkworld Audio) | ano, ale zdroj chybí v CREDITS | ano (ElevenLabs; zvlášť klovnutí, drápy, volání a zobání) | ano (ElevenLabs; varování, útok, kousnutí, rána, smrt, čenichání v klidu) |
