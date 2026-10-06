# TruckFreakz automation coverage

Sources: `E:\Codex\MB\TD\*.xlsx` — TD-8 VAT/Currency (8), TD-10 Filters (8), TD-15 New Product Page (15),
TD-24 Homepage redesign (15), TD-29 Coming Soon page (10) — 56 cases.
Target: TruckFreakz **TST** only (`TRUCKFREAKZ_BASE_URL` = `https://tst-truckfreakz-com.mbu.dev/`, HTTP auth).
The other store views are separate TST hosts: `tst-truckfreakz-be` (NL), `-de`, `-fr`; tests derive them from
the base URL and refuse anything that is not `*.mbu.dev`. Live sites are never tested.

Run with `npx playwright test --project=truckfreakz`.

## Accounts and test data

- Storefront tests run as a logged-out visitor; nothing is ordered or subscribed (the newsletter form is filled,
  not submitted).
- Admin tests (`admin.spec.js`) only read the product form of 2SCNGHLSP; nothing is saved.
- TD-15 test product: configurable **2SCNGHLSP** "Eyelids For Headlights Scania NGS" (variants red € 12,
  green € 22, blue € 33 excl. VAT; label "Best buy"; Suitable for Daf, Renault, Iveco), created by development.
  Simple product without label / Suitable for: TS7813472 "Eyelids Scania NextGen Type 3".
- Coming Soon page: Magento maintenance page, reachable at `/errors/503.php` on every host (HTTP 503).

## Status

Run 2026-10-06: 68 tests – 43 passed, 6 failed, 19 skipped. Report:
[regression-reports/truckfreakz-2026-10-06.md](regression-reports/truckfreakz-2026-10-06.md), filed as Jira
[TD-63](https://mbu-digital.atlassian.net/browse/TD-63). Team summary on Confluence:
[02. Truckfreakz - Playwright Test Automation](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/318210049/02.+Truckfreakz+-+Playwright+Test+Automation).

### Findings

| # | Finding | Ticket |
| --- | --- | --- |
| 1 | No layered navigation on category and search-result pages: the sidebar is rendered empty although Mirasvit is installed. | TD-10 |
| 2 | The Coming Soon page is English (`lang="en"`) on the NL, DE and FR store views. | TD-29 |
| 3 | Homepage scrolls horizontally: 5,549 px at 768 px (Lighting / Volvo carousel block) and 110 px at 390 px (footer "Why TruckFreakz?"). | TD-24 |
| 4 | At 768 px the hamburger menu opens without categories; they are covered by `.nav-sections-items`. | TD-24 |

Observed: TD-15 placeholder data on 2SCNGHLSP (label translations "Best buyNE/De/Fr", green variant shows
the yellow image, specification values "test").

### Automated

| Ticket | Case | Spec |
| --- | --- | --- |
| TD-15 | Label only when configured; Suitable for brands / hidden when empty / brand links per store view (EN, NL, DE, FR); excl. + incl. VAT for simple and configurable; VAT note on every store view; swatches + preselected first variant; price/VAT and gallery update per variant; specification table per store view; PDP stable at 1366/1440/1920 | `product-page.spec.js` |
| TD-15 | Nine specification attributes in the Specifications group; Suitable for options = Truck brand subcategories; admin selection = storefront | `admin.spec.js` |
| TD-10 | Filters on category and search pages; subcategory area + filters layout; filter by attribute, inline filter search, price slider, no empty values (these four skip until filters are shown) | `filters.spec.js` |
| TD-29 | No "Error" title; launch date 1 November 2026 + e-mail link; responsive at 1920/1366/768/390; localized per store view; whitelisted runner gets the normal shop (home, category, PDP, cart, login on all hosts) | `coming-soon.spec.js` |
| TD-24 | Language dropdown; search dropdown + "View all results"; newsletter form; incl/excl VAT on PDP; responsive homepage (no horizontal scroll) at 1440/768/390; tablet/mobile menu shows categories | `homepage.spec.js` |
| TD-24 | New design (skip until "Real trucks. Real builds. Real freakz." is on the homepage): Community hero, menu dropdown, no "New" after Sale, clickable brand items, no Instagram indicator, hotspot dots, community copy + CTA, footer labels, Facebook/Instagram icons, iDEAL Wero instead of JCB | `homepage.spec.js` |
| TD-8 | Language switch to NL/DE/FR (desktop dropdown and mobile/tablet flags); all store views in EUR (currency case not applicable); current excl./incl. VAT display | `language-vat.spec.js` |
| TD-8 | Combined selector and Incl./Excl. VAT toggle (5 cases) — `test.fixme`, ticket is "After Launch" | `language-vat.spec.js` |

### Not automated

- TD-15: category label inheritance and bulk "Update attributes" (need admin changes to shared TST data).
- TD-10: filter styling vs design (no design for the filters provided).
- TD-24 / TD-29: design comparison with Figma (file `jKfmFJ0jlE1u4i6wcaJnSQ` is not exportable through the
  API; compare manually).
- TD-29: public (non-whitelisted) visitor behaviour, whitelist changes and disabling the mode — need a
  non-whitelisted IP and server access (maintenance flag / IP list).
- TD-8 region/currency switching — every store view is EUR.
