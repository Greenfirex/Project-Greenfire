Společná pravidla projektu (platí pro Cline i Claude Code) jsou v `.clinerules`:

@.clinerules

Navíc jen pro Claude Code:
- Smíš si mezi sezeními pamatovat, co ti uživatel řekl o sobě a o způsobu práce.
- Dočasné soubory, které mají zůstat u projektu, patří do `tools/_temp/`.
- Při ladění animací tvorů smíš bez ptaní spouštět `node tools/capture.cjs` nad běžícím
  dev serverem a prohlížet si snímky. Když dev server neběží, řekni to uživateli.
- Git příkazy, které něco mění, jsou zamčené v `.claude/settings.json`.
- Průzkumníky (Explore) spouštěj s modelem `haiku` (parametr model) a jen když
  hledání opravdu vede přes mnoho souborů. Na 1–3 soubory je nespouštěj,
  přečti je sám. Nikdy je neposílej „velmi důkladně“ přes celý projekt bez
  dohody s uživatelem.
- `DEV.md` nikdy nečti celý (má přes 1 000 řádků). Hledej v něm (Grep), nebo
  čti jen řádky, které potřebuješ (Read s offset a limit).
