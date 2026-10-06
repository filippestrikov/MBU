# Portofoonweb automation coverage

Source: `E:\Codex\MB\PW\PW-*_Test_Cases.xlsx` (18 files, 149 Portofoonweb cases; the
`RD-108`/`RD-110` files in that folder belong to Rockerz and are excluded).
Target: Portofoonweb **TST** only (`PORTOFOONWEB_BASE_URL` = `https://tst-portofoonweb-nl.mbu.dev/`,
HTTP auth). Live sites are never tested. The access sheet notes the customer and admin
accounts are the same as on PRD, so they are real accounts: use them on TST only.

Team summary on Confluence: [02. PortofoonWEB - Playwright Test Automation](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/317882369/02.+PortofoonWEB+-+Playwright+Test+Automation).

## Status (2026-10-06): blocked

Cloudflare (with Hypernode Botstopper) in front of TST blocks the automated browser:

- Default Playwright Chromium: **403 "Verification error"** on every page.
- Without the `HeadlessChrome` user-agent marker: **200 "Human verification"** challenge page.

Human-verification challenges are not bypassed by the test suite. Requested from the MBU
developers / Cloudflare admin, for `tst-portofoonweb-*.mbu.dev` only (preferred first):

1. A Cloudflare WAF skip rule for requests with a secret header (e.g. `X-MBU-QA: <token>`;
   the token would live in `.env` and be sent by the tests).
2. Allow-list the IP address of the test machine.
3. Disable the bot challenge on the TST hostnames.

Related: PW-33 (Botstopper must not block normal storefront users) — confirm whether this
challenge is intended on TST.

`tests/portofoonweb/access.spec.js` shows the blocker in every run:

| Test | Result |
| --- | --- |
| Storefront is reachable for automated tests | **Fails**: verification page |
| [PW-7] Open English TST store view on the .com test domain | **Fails** (blocked; see finding 1) |

## Findings so far (HTTP checks, before the block was found)

1. **PW-7:** `https://tst-portofoonweb-com.mbu.dev/` redirects (302) to the Dutch
   `https://tst-portofoonweb-nl.mbu.dev/`, so the English `.com` store view cannot be opened.
2. `tst-portofoonweb-at` and `tst-portofoonweb-de` respond with the Dutch homepage title;
   `tst-portofoonweb-be` has no DNS record. Expected store views per domain need confirming
   (PW-12 mentions 4 store-view domains).

## Planned coverage once access works

| Ticket | Cases | Plan |
| --- | --- | --- |
| PW-7 Portofoonweb.com (EN store) | 21 | Store view, locale/currency/flag, language switcher, EN URLs without artifacts, "two-way radio", spacing of "PortofoonWEB"/"PostNL", header Login/Customer service, footer, PDP loading buttons, payment and shipping on EN checkout, sitemap. Emails: not automated. |
| PW-91 Products not correctly visible | 6 | Cobra RX680 (SKU 16315) and RX380 (16314) on "Alle portofoons" and under the Cobra brand filter; open both; other filters. |
| PW-80 Estimation FAQ | 7 | FAQ link near specifications, scroll to FAQ, expand/collapse, product title in FAQ, product without FAQ. Backend FAQ edits: opt-in admin tests. |
| PW-12 Accessories / bulk relations | 9 (+8 duplicate file) | Accessories link set/unset (no 404), store-view relative on all domains, Kenwood TK-3501 regression on TST. Bulk import/copy: not automated. |
| PW-77 Activate Klarna | 11 | Klarna offered, above IN3, 3.5% fee in totals, start Klarna flow (no payment). Capture/invoice lifecycle: not automated. |
| PW-3 Riverty | 10 | Riverty B2C offered, B2B not offered, switch method after rejection. Data sent to Riverty and live smoke: not automated. |
| PW-59 Bancontact style | 5 | Bancontact logo in checkout and other payment-logo locations vs. current brand asset. |
| PW-13 Sendcloud | 16 | DHL-only services, rates/free-shipping threshold, pickup point selection, home delivery, labelled TEST orders on TST. Order sync/emails: not automated. |
| PW-29 Product structure | 9 | Bundle PDP/PLP price consistency, bundle add-to-cart. Price propagation/import: admin opt-in or not automated. |
| PW-33 Botstopper / PW-86 smoke | 2 + 1 | Storefront smoke (home, search, PDP, cart, checkout entry, admin login page), reCAPTCHA present on forms. |
| PW-87 Contact form | 4 | `contactUs` GraphQL mutation absent from the schema (introspection only — never a real submission, which could e-mail real recipients). |

Not automatable in the browser: PW-50 (Channable), PW-66 (Klaviyo automation), PW-86 secret/key
rotation and admin users, PW-94 (one-off order fix), PW-53 redirects until the list of deleted
URLs from the ticket is available.
