# Velder automation coverage

Sources: `E:\Codex\MB\Velder\*.xlsx` (Login 29, Cart Quantities 29, Assortment & Prices 24,
Checkout & Order 25) and `E:\Codex\MB\V2\Velder - V2 Non-Checklist Test Suite.xlsx` (29) — 136 cases.
Target: Velder **TST** only (`VELDER_BASE_URL` = `https://tst-bestellen-velder-com.mbu.dev/`, HTTP auth).
Live sites are never tested.

Run with `npx playwright test --project=velder` (a `velder-setup` project logs in once — reCAPTCHA
makes a login take ~15 s — and stores the session in the Git-ignored `.auth/`).

## Accounts and test data

- Customer: the TST customer from the access sheet, an internal MBU account (`@mbu.digital`);
  same credentials as on PRD, used on TST only.
- Cart tests change this customer's TST cart. Removing lines on the TST storefront does not work
  (no request is sent), so every cart test starts from an empty cart that is cleaned through
  Magento Admin → Customers → (customer) → Shopping cart, and the file ends the same way.
- Test orders are allowed (TEST label in the 30-character order reference field: `TEST Playwright`),
  but none could be placed: no delivery date is selectable (see finding 1).
- TST sends login/cart events to Klaviyo company `UcbTd9`. If that is Velder's production
  Klaviyo, test activity reaches real segments/flows (V2-42 winback). The customer is internal,
  so e-mails go to MBU. To confirm with development.

## Status

Run 2026-10-06: 31 tests – 19 passed, 11 failed, 1 skipped (V2-72, behaviour pending). Report: [regression-reports/velder-2026-10-06.md](regression-reports/velder-2026-10-06.md), filed as Jira [V2-82](https://mbu-digital.atlassian.net/browse/V2-82). Team summary on Confluence: [02. Velder - Playwright Test Automation](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/318013442/02.+Velder+-+Playwright+Test+Automation).

### Findings

| # | Finding | Ticket |
| --- | --- | --- |
| 1 | No delivery date is selectable in the checkout date picker (Oct–Dec 2026 all disabled), and "Bezorgdatum is verplicht" — the TST customer cannot complete an order. | Checklist #5 / V2-73 |
| 2 | Cart items are stored with price € 0.00 (Admin → customer → Shopping cart); the checkout only offers the zero-total "free" payment method and shows no amounts; the customer's TST order history shows € 0,00 totals. | V2-9 / V2-73 |
| 3 | Product 188843 (sold as "collo à 5 stuks") is priced "per ST" on desktop, mobile and tablet (portrait and landscape). | V2-56 |
| 4 | "Cookies settings" link is missing from the login-screen footer (Privacy statement and Cookie statement are present). | V2-47 |
| 5 | Reset-password page: the e-mail field moves down 18.5 px when the validation warning appears. | V2-71 |
| 6 | Cart page: typed quantity is not saved on blur or Tab (Enter works); "Verwijder" sent no request in manual checks; minicart and cart page once showed different quantities. | V2-66 |
| 7 | 5 rapid "+" clicks on a homepage tile sometimes add fewer than 5 (3 in one run, 5 in another). | V2-67 / V2-43 |

Observed: the order reference field sits under the "Kortingscode" heading ("Vul hier uw referentie
of kortingscode toe", max 30 characters); minicart copy uses formal "u" ("U heeft geen product(en)
in uw winkelwagen.").

### Not automated

- Assortment and prices per price list (PL RE, PL10, PL20, PL28) and the client accounts
  1181200 / 1263900: those test accounts are in the password manager, not in the access sheet.
- Klaviyo events, segments and the winback flow (V2-42/46/48/49/50, V2-74).
- Order XML export, cron and downstream systems (V2-75/76), REST API checks (V2-73 #4).
- Client WordPress/other sites in the V2 suite (Skylger, Velder.com, dekaaskoerier.nl).
- Real-device iPad/iPhone Safari cases (V2-34 #22–24): V2-34 is covered with Chromium iPad emulation.
- PRD checks (2FA on PRD admin, checklist PRD walkthrough) — PRD is never automated.
