# Velder VDP (product data integration) automation coverage

Scope: Jira board VDP (board 912), the Velder XML → Alumio → Magento product and image integration.
Target: Velder **ACC** (`VELDER_ACC_BASE_URL`), which Alumio UAT is connected to. Read-only checks.

Source documents (not in Git; Downloads, 2026-10-07):

- *Magento Product Integration Test Execution Guide* (TC-000 … TC-008, expected prices, options and images)
- *productDataMappingTable (1).xlsx* (field mapping; option-id sheets copied to `tests/velder-acc/fixtures/option-ids.json`)
- `nlTestData.xml` / `enTestData.xml` (copied to `tests/velder-acc/fixtures/`)
- *Velder | Data project kick-off phase 1* (business rules)

The manual workbook *Velder - VDP Product Data Integration Test Suite.xlsx* is corrupted (cannot be opened).

## How to run a controlled test round

1. `npm run test:vdp:cleanup` – **TC-000**: the fictional SKUs 21422142 / 21422000 must not exist, 100790 must.
2. Run the Alumio side manually (TC-000 … TC-002, TC-004): send `nlTestData.xml` and `enTestData.xml`, let the
   schedulers finish.
3. `npm run test:vdp` – **TC-003 / TC-005** checks of the Magento result. Run it right after the run: 100790 is a
   real product and the regular feed overwrites its test values.
4. Clean up (TC-008, manual), then `npm run test:vdp:cleanup` again.

New test data: replace the two XML files in `tests/velder-acc/fixtures/` and update `expected.json` (prices,
representative option ids, image names). Text and attribute expectations are read from the XML files.

## Access

`.env`: `VELDER_ACC_BASE_URL`, `VELDER_ACC_HTTP_USER/PASSWORD`, `VELDER_ACC_ADMIN_URL/USER/PASSWORD`.

- Magento REST is unusable on ACC: the nginx HTTP auth owns the `Authorization` header. The checks read the
  storefront **GraphQL** API per store view (`Store` header: `nl_sv10`, `nl_sv20`, `nl_sv_pl_re`, `en_sv28`,
  `en_sv40`). GraphQL returns only enabled products that are visible in that store view.
- Price-list customers `filip+10/+20/+re/+28/+40@mbu.digital` have no password (ACC sends no e-mail); the tests open
  them through Admin > Customers > **Login as Customer** ("Allow remote shopping assistance" is enabled on the accounts).
- The admin helper clears saved grid filters before searching (the admin user had a saved "SKU: 105930" filter that
  hid every result).

## Automated (`tests/velder-acc/`)

| Test | Guide | Checks |
| --- | --- | --- |
| Keep exactly one Magento product per SKU | TC-003 | Admin product grid: each test SKU exists once |
| Show each SKU in the store views of its price groups | TC-003 | GraphQL per store view |
| Map the store-view prices from the price groups | TC-003 | `general_price` per SKU and store = guide table (15 values) |
| Map the representative attributes to their Magento option ids | TC-003 | Guide table (e.g. IGP 5635, allergens) |
| Map every list attribute with a mapping table to its option ids | TC-003 | 9 `lov_*` / allergen attributes via `option-ids.json` |
| Show the NL texts in NL store views and the EN texts in EN store views | TC-003, VDP-16 | commercial / legal / M3 name, descriptions, declaration (`**x**` → `<b>x</b>`) |
| Map article number, M3 status, nutrition values, weight unit and product sheet | TC-003 | Direct mappings |
| Convert the net weight in KG to grams | TC-003 | `nmbruom_netto_gewicht_ce` = "4000.000 g", `weight` = 4000 |
| Show the PLxx price to the PLxx customer (5 tests) | TC-003 | Storefront PDP price per price-list customer |
| Create only the supported JPG images at their F positions | TC-005 | Gallery = Appendix B names at positions 2–5, no `.tif` |
| Give the lowest supported image the four image roles | TC-005 | image, small_image, thumbnail, swatch_image = F2 |
| Fictional test SKUs do not exist / existing SKU present | TC-000, TC-008 | `npm run test:vdp:cleanup` |

## Not automated (Alumio internals, manual)

TC-000 configuration and scheduler pause, TC-001/002 webhook and storage, TC-004 bulk-status polling, TC-005
steps 8–9 (deletion replay, delete-before-create order), TC-006 replay and duplicate filter, TC-007 DLQ,
TC-008 deletion and restore.

## Open questions (tests marked `fixme` or limited until answered)

1. **Product name:** mapping table says `name` = `commerciele_benaming` (fallback `m3_description`); ACC shows the
   M3 name in NL store views and the commercial name in EN; the kick-off document calls the M3 description the title.
2. **Packing unit:** mapping table `aantal_per_eenheid + ' ' + eenheid`; ACC shows `STK 1` for 100790.
3. **Non-standard values in 100790:** `belgië`, `melk,lactose` (mapped case-insensitively today), unit `STK`,
   weight unit `kilo` (ACC shows `KG`), weight `2.8`.
4. **Cross-language prices:** each file also sends the other language's price groups at `0.000010`; the tests expect
   the guide's prices (e.g. en_sv28 = 127.00).
5. **Default scope:** the fictional SKUs from the Aug 25 run show EN name and EN price in the default scope.
6. **Visibility without a price group** ("Not visible individually", kick-off document): no test product without a
   price group in the current data.
7. **Option ids not in the mapping table:** `lov_europese_bescherming`, `lov_weidezuivelproduct`, `piece_kg`.

## Status 2026-10-07 (state before a clean controlled run)

`npm run test:vdp`: option-id mapping, KG weight conversion and both image tests pass on the visible data. The rest
fails because ACC still holds the Aug 25 test run and the daily feed: the fictional SKUs exist but are disabled,
100790 has feed prices (16.94 / 17.30 / 16.04 instead of 3.40 / 1.20 / 5.60) and its M3 name is not the test
value. `npm run test:vdp:cleanup`: fails until 21422142 and 21422000 are deleted.
