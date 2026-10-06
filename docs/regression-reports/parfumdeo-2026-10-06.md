# Bug Report

Need to fix:

- [BUG] ParfumDeo dev> Regression report 2026-10-06 – 6 defects found by Playwright coverage

Summary:

Automated Playwright regression run against ParfumDeo dev on October 6, 2026
(39 tests: 29 passed, 6 failed, 4 skipped). Expected texts and behaviour come from the
ParfumDeo feature pages in Confluence (PDI-56 translations, PDI-68 shipping, PDI-32 footer).

Test suite: https://github.com/filippestrikov/MBU/tree/main/tests/parfumdeo
Coverage: https://github.com/filippestrikov/MBU/blob/main/docs/parfumdeo-coverage.md

---

## 1. [BUG] Checkout> DHL is not offered as a shipping method

Steps to reproduce:

1. Add a product to the cart on https://dev-parfumdeo-nl.mbu.dev/ and open /checkout/.
2. Look at "Verzendmethodes" (NL address).

Actual Result: Trunkrs avond 17:00-22:30 € 5,95, PostNL € 8,45, DPD aan huis € 7,45,
Ophalen magazijn Koudum € 0,00. No DHL.

Expected Result: Trunkrs first, then PostNL, DHL and DPD (Confluence "PDI-68 - Shipping methods
(Trunkrs) & expected shipping date"). Confirm whether DHL is still required.

## 2. [BUG] Cart> Order button reads "Afrekenen" instead of "Kopen & afrekenen"

Steps to reproduce:

1. Add a product to the cart and open https://dev-parfumdeo-nl.mbu.dev/checkout/cart/.
2. Look at the orange order button.

Actual Result: "Afrekenen".

Expected Result: "Kopen & afrekenen" (agreed text, Confluence PDI-56; PDI-103 "Use Kopen & afrekenen
on orange order button").

## 3. [BUG] 404 page> Title is capitalised "Pagina Niet Gevonden"

Steps to reproduce: open https://dev-parfumdeo-nl.mbu.dev/playwright-test-page-that-does-not-exist

Actual Result: "Pagina Niet Gevonden".

Expected Result: "Pagina niet gevonden" (Confluence PDI-56; PDI-103 "Capitalize 404 page title correctly").

## 4. [BUG] Forgot password> Request message differs from the agreed text

Steps to reproduce:

1. Open https://dev-parfumdeo-nl.mbu.dev/customer/account/forgotpassword/.
2. Enter an e-mail address and click "Wachtwoord resetten".

Actual Result: `Als er een account is gekoppeld aan "<e-mailadres>", ontvang je een e-mail met een link
om je wachtwoord opnieuw instellen.` (also shown three times in the message area).

Expected Result: `Als er een account is gekoppeld aan dit e-mailadres, ontvang je een e-mail met een link
om je wachtwoord opnieuw in te stellen.` (Confluence PDI-56; PDI-116 "Display corrected password-reset
request message"). Note the missing "in te".

## 5. [BUG] Footer> Links are not underlined on hover

Steps to reproduce: on the homepage, hover a link in the "Klantenservice" or "Informatie" footer column.

Actual Result: no underline (text-decoration stays "none").

Expected Result: no underline by default, underline on hover (PDI-32 "Underline footer links only on hover").

## 6. [BUG] PDP> JavaScript error "Cannot set properties of null (setting 'value')"

Steps to reproduce: open https://dev-parfumdeo-nl.mbu.dev/85715806437-dunhill-icon-racing-for-men-edp-sample-2-ml.html
with the browser console open.

Actual Result: `Cannot set properties of null (setting 'value')` is thrown twice on page load.

Expected Result: no JavaScript errors (PDI-15 "Smoke-test storefront after module updates").

---

Observations (not tested as defects):

- Accessibility labels in English: "Toggle minicart, You have 1 product in your cart.", "Go to Home page",
  "Show submenu for … category".
- Hyvä Checkout sometimes clears a field that was just typed, and the first click on "Verder naar
  overzicht & betalen" is sometimes ignored; a second click works.
- Paid TEST order 202601398 used the last unit of "PARFUMS GRES … MY PASSION EAU DE PARFUM 60ML"; that
  product is now "Niet leverbaar" on dev.

Test Environments:

- Environment / URL: dev — https://dev-parfumdeo-nl.mbu.dev/ (HTTP auth); Mollie test mode.
- Browser / version: Chromium 140.0.7339.186 (headless); Playwright 1.55.1.
- OS / version: Windows 11 Home Insider Preview, version 10.0.26340.
- Device / viewport: Desktop Chrome 1280 × 720 / 1440 × 900; Pixel 7 emulation for mobile login.
- Account role: Guest; dev customer account (read-only checks).
- Test orders: "TEST Playwright", playwright-test@example.com (Mollie test mode).
- Test date: October 6, 2026.
