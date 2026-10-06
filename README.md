# MBU

MBU Playwright coverage for client staging sites.

**Live sites are never tested.** Every client runs against its staging/test
host, and `playwright.config.js` refuses to start with a base URL that does not
look like a staging/test host.

## Manual test cases

Manual scenarios are kept per client in the MBU test case folders
(`E:\Codex\MB\<client>\*.xlsx`). Read the relevant rows before preparing tests,
and keep the Jira ticket and manual case title in each test title.
Expected copy belongs in `tests/<client>/fixtures/`.

| Client | Project | Coverage |
| --- | --- | --- |
| BulbBarn | `bulbbarn` | [BulbBarn coverage](docs/bulbbarn-coverage.md) |

## Setup

Requires Node.js 18 or newer. Playwright 1.55.1 is pinned for compatibility
with the Node.js 18 installation in this workspace.

```sh
npm ci
npx playwright install chromium
```

Create a local `.env` (Git-ignored) with each client's staging URL and logins:

```sh
BULBBARN_BASE_URL=https://staging-bulbbarn.mbu.dev/
BULBBARN_HTTP_USER=
BULBBARN_HTTP_PASSWORD=
BULBBARN_CUSTOMER_EMAIL=
BULBBARN_CUSTOMER_PASSWORD=
BULBBARN_ADMIN_URL=
BULBBARN_ADMIN_USER=
BULBBARN_ADMIN_PASSWORD=
```

Values come from the MBU access sheet. Never commit credentials.

Checkout tests place real orders on **staging only**, marked "TEST Playwright"
with a "TEST – Playwright" order note and paid by Check / Money order.
A client without a base URL in `.env` is skipped.

## Run

```sh
npm test
npx playwright test --project=bulbbarn
npm run test:headed
npm run test:ui
npm run test:report
```

`npm run test:cms` runs the opt-in tests that temporarily edit staging content in
Magento Admin (and restore it). Run it on its own, never together with `npm test`.

Failure screenshots and traces are saved in `test-results/`; the HTML report
is saved in `playwright-report/`.
