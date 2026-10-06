# Bug Report

Need to fix:

- [BUG] TruckFreakz TST> Regression report 2026-10-06 – 4 defects found by Playwright coverage

Summary:

Automated Playwright regression run against TruckFreakz TST (EN, NL, DE and FR store views) on October 6, 2026
(68 tests: 43 passed, 6 failed, 19 skipped). Test cases: TD-8, TD-10, TD-15, TD-24 and TD-29 suites.
Skipped: TD-8 VAT switcher (ticket status "After Launch"), the new TD-24 homepage design (not on TST yet) and
TD-10 filter interactions (no filters shown, see 1).

Test suite: https://github.com/filippestrikov/MBU/tree/main/tests/truckfreakz
Coverage: https://github.com/filippestrikov/MBU/blob/main/docs/truckfreakz-coverage.md

---

## 1. [BUG] Category/Search> Layered navigation (filters) is not shown

Steps to reproduce:

1. Open https://tst-truckfreakz-com.mbu.dev/truck-interior.html (desktop 1280 px or wider).
2. Open https://tst-truckfreakz-com.mbu.dev/catalogsearch/result/?q=scania.

Actual Result: no filter sidebar on either page. The left sidebar (`.sidebar-main`) is rendered empty (height 0)
although the page has the Mirasvit classes (`page-with-filter`, `mst-nav__theme-…`) and the 2-column layout.
No attribute filters, inline filter search or price slider are available.

Expected Result: the Mirasvit layered navigation is shown on category and search-result pages, next to the
hardcoded subcategory area (TD-10, status Done).

## 2. [BUG] Coming Soon> Page is English on the NL, DE and FR store views

Steps to reproduce:

1. Open the Coming Soon page on each host: https://tst-truckfreakz-com.mbu.dev/errors/503.php,
   https://tst-truckfreakz-be.mbu.dev/errors/503.php, https://tst-truckfreakz-de.mbu.dev/errors/503.php,
   https://tst-truckfreakz-fr.mbu.dev/errors/503.php.

Actual Result: all four show the same English page ("Coming very soon", "Launch: 1 November 2026",
`<html lang="en">`).

Expected Result: each store view shows its localized Coming Soon page ("a coming soon page on all truckfreakz
languages", TD-29).

## 3. [BUG] Homepage> Page scrolls horizontally on tablet and mobile

Steps to reproduce:

1. Open https://tst-truckfreakz-com.mbu.dev/ at 768 × 1024 (tablet portrait) and swipe/scroll sideways.
2. Repeat at 390 × 844 (mobile).

Actual Result:
- 768 px: the page scrolls 5,549 px to the right (page width 6,317 px). Cause: the "Lighting / Volvo" block
  (`section.home-two-col.bottom-section`, its carousel stage).
- 390 px: the page scrolls 110 px to the right (page width 500 px). Cause: the footer "Why TruckFreakz?" block
  (`.footer-main`).

Expected Result: no horizontal scrolling at any supported width (TD-24 "Render homepage responsively").

## 4. [BUG] Header> Tablet menu opens without categories (768 px)

Steps to reproduce:

1. Open https://tst-truckfreakz-com.mbu.dev/ at 768 × 1024.
2. Tap the hamburger icon (top right).

Actual Result: the "Menu" panel opens with an empty area where the categories should be; only TruckFreakz /
About us / Contact / My Account and the language switcher are visible. The category links (Truck brand,
Truck Interior, Lighting, …) are covered by the `.nav-sections-items` layer. At 390 px the categories are shown.

Expected Result: the category navigation is visible and usable in the menu at tablet widths too.

---

Observations (not raised as defects):

- TD-15 works on all four store views (label, "Geschikt voor / Suitable for / Geeignet für / Convient pour" with
  store-view brand links, excl. price with incl. VAT note, swatches, price and image per variant,
  9 specification attributes). The test product 2SCNGHLSP still has placeholder data to clean up before launch:
  label translations "Best buyNE", "Best buyDe", "Best buyFr"; the "green" variant shows the yellow image
  (zwaailamp-geel); all specification values are "test".
- TD-24 is the Figma design; the new homepage is not on TST yet, so its 10 design checks are skipped and run
  automatically once it is deployed. The Figma file cannot be read through the API ("File not exportable"), so
  the design comparison stays manual.
- TD-8 (VAT switcher / combined selector) is "After Launch"; native language switching works on all store views.
- The Coming Soon page answers HTTP 503 (Magento maintenance page, approved option 3 on TD-29). The test runner
  gets the normal shop on all store views, so its IP is whitelisted or the mode is off; public access needs a
  check from a non-whitelisted IP.

Test Environments:

- Environment / URL: TST — https://tst-truckfreakz-com.mbu.dev/ (EN), -be (NL), -de (DE), -fr (FR); HTTP auth.
- Browser / version: Chromium 140.0.7339.186 (headless); Playwright 1.55.1.
- OS / version: Windows 11 Home Insider Preview, version 10.0.26340.
- Device / viewport: 1920 × 1080, 1440 × 900, 1366 × 786, tablet 768 × 1024, mobile 390 × 844 (Chromium emulation).
- Account role: logged-out visitor; Magento Admin (read-only product checks).
- Test orders: none (no checkout cases in these suites).
- Test date: October 6, 2026.
