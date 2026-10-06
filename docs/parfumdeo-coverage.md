# ParfumDeo automation coverage

Source: `E:\Codex\MB\PDI\PDI-*_Test_Cases.xlsx` (19 files, 120 manual cases).
Target: ParfumDeo **dev** only (`PARFUMDEO_BASE_URL` = `https://dev-parfumdeo-nl.mbu.dev/`, HTTP auth).
Live sites are never tested. The access sheet shows the dev customer and admin accounts are
the same as on PRD, so they are real accounts: tests only read account data and never change
addresses, passwords or orders. Password-reset tests use an unregistered `example.com` address.

Expected copy and behaviour come from the ParfumDeo feature pages in Confluence (space MBUCD),
stored with their sources in `tests/parfumdeo/fixtures/site.json`.

Run with `npx playwright test --project=parfumdeo`.

## Test orders

Checkout tests place orders on dev through **Mollie test mode**: customer `TEST Playwright`,
`playwright-test@example.com`, address Teststraat 1, 1012 AB Amsterdam.

- `[PDI-139] Complete guest checkout` — paid in Mollie test mode (order stays Processing).
- `[PDI-135] Display informal Dutch failed-payment message` — "failed" in Mollie test mode
  (Magento cancels the order and returns stock).

The test product is "DUNHILL ICON RACING FOR MEN EDP (SAMPLE) 2 ML" because it has high dev
stock. The first product used ("PARFUMS GRES … MY PASSION 60 ML") had 1 in stock and is now
unavailable on dev because of paid TEST order **202601398**; restock it or cancel that order if
it is needed for manual testing.

## Notes on the dev environment

- Hyvä Checkout (Magewire) re-renders the form after each field and can clear a field that was
  just typed; the first click on "Verder naar overzicht & betalen" is sometimes ignored. The
  helpers re-fill wiped fields and retry. Customers typing quickly may hit the same issue.
- reCAPTCHA is not configured on dev (Confluence PDI-56: only active on PRD), so the PDI-19
  tests skip on dev. `/contact/` on dev is a content page without a form.

## Status (run 2026-10-06: 39 tests – 29 passed, 6 failed, 4 skipped)

Regression report: [regression-reports/parfumdeo-2026-10-06.md](regression-reports/parfumdeo-2026-10-06.md).

### Findings (all failing tests)

| # | Finding | Expected (source) | Test |
| --- | --- | --- | --- |
| 1 | Checkout offers Trunkrs, PostNL, DPD, pickup — **no DHL**. | Trunkrs, PostNL, DHL, DPD (Confluence PDI-68) | [PDI-68] Offer Trunkrs first, then PostNL, DHL and DPD |
| 2 | Cart checkout button reads **"Afrekenen"**. | "Kopen & afrekenen" (PDI-56) | [PDI-103] Use Kopen & afrekenen on orange order button |
| 3 | 404 page shows **"Pagina Niet Gevonden"**. | "Pagina niet gevonden" (PDI-56) | [PDI-103] Capitalize 404 page title correctly |
| 4 | Password-reset message: `Als er een account is gekoppeld aan "<e-mail>", … wachtwoord opnieuw instellen.` | `… gekoppeld aan dit e-mailadres, … opnieuw in te stellen.` (PDI-56) | [PDI-116] Display corrected password-reset request message |
| 5 | Footer links are never underlined, also not on hover. | Underline on hover only (PDI-32) | [PDI-32] Underline footer links only on hover |
| 6 | PDP throws `Cannot set properties of null (setting 'value')` (twice per load). | No JavaScript errors | [PDI-15] Smoke-test storefront after module updates |

Observed, not asserted: accessibility labels in English ("Toggle minicart, You have 1 product in
your cart.", "Go to Home page", "Show submenu for … category"); the final checkout button reads
"Bestelling plaatsen" (the agreed "Kopen & afrekenen" text is documented for the cart/minicart).

### Passing

| Ticket | Tests |
| --- | --- |
| PDI-103 | No-results message Dutch; "Bekijk alle … resultaten"; Dutch required-field validation; Terms link (new tab); back to shipping; repeated back/forward without freeze; gift card deselects iDEAL; one radio group for payment options; province selector for Portugal; Product type filter removed; filter values A–Z (Merk); readable filter URLs; deeper category filter; pagination centred; Kiyoh rating consistent; informal gift-card account copy; mobile login after logout |
| PDI-116 | Forgot-password page informal Dutch |
| PDI-135 | Failed Mollie test payment shows the agreed Dutch message |
| PDI-139 | Login/logout, session across pages, My Account data, order history, address book (read-only), guest checkout paid in Mollie test mode |
| PDI-141 | Shopping-assistance checkbox aligned with the other two |
| PDI-34 | "Verwachte verzenddatum" on white background |
| PDI-32 | Footer links not underlined by default |
| PDI-15 | Admin login and Catalog/Sales/Configuration pages open |

### Skipped

- PDI-142 out-of-stock cart message: needs an agreed out-of-stock fixture.
- PDI-19 reCAPTCHA (3 tests): not configured on dev.

### Not automated

Server/back-office work: PDI-9 RabbitMQ, PDI-29 memory, PDI-37 imports/timeouts, PDI-67 Composer,
PDI-111 image cache regeneration and performance measurements, PDI-120 admin attribute grid
(could be added as read-only admin checks), PDI-77 invoice e-mails/PDF, PDI-103 e-mail and invoice
cases, PDI-20 blacklisted domain/IP (needs the blacklist values).
