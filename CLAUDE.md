Společná pravidla projektu (platí pro Cline i Claude Code) jsou v `.clinerules`:

@.clinerules

Navíc jen pro Claude Code:
- Smíš si mezi sezeními pamatovat, co ti uživatel řekl o sobě a o způsobu práce.
- Dočasné soubory, které mají zůstat u projektu, patří do `tools/_temp/`.
- Při ladění animací tvorů smíš bez ptaní spouštět `node tools/capture.cjs` nad běžícím
  dev serverem a prohlížet si snímky. Když dev server neběží, řekni to uživateli.
- Modely a obrázky z `_sources/` a `public/assets/` si smíš bez ptaní prohlížet,
  rozebírat a vykreslovat na obrázky (vlastní pomocné skripty do `tools/_temp/`,
  okna skrytá). Herní kód se tím nemění.
- Git příkazy, které něco mění, jsou zamčené v `.claude/settings.json`.
- Průzkumníky (Explore) spouštěj s modelem `haiku` (parametr model) a jen když
  hledání opravdu vede přes mnoho souborů. Na 1–3 soubory je nespouštěj,
  přečti je sám. Nikdy je neposílej „velmi důkladně“ přes celý projekt bez
  dohody s uživatelem.
- `DEV.md` drž krátké (kolem 400 řádků): jen proč a pasti, ne převyprávěný kód,
  historii ani hotové etapy plánů (ty patří do gitu a TODO). Smíš ho přečíst celý.
