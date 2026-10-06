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
| BulbBarn | `bulbbarn` | [BulbBarn coverage](docs/bulbbarn-coverage.md) · [Confluence](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/317652995/02.+BulbBarn+-+Playwright+Test+Automation) · Jira [BD2-5](https://mbu-digital.atlassian.net/browse/BD2-5) |
| ParfumDeo | `parfumdeo` | [ParfumDeo coverage](docs/parfumdeo-coverage.md) · [Confluence](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/317194244/02.+ParfumDeo+-+Playwright+Test+Automation) · Jira [PDI-145](https://mbu-digital.atlassian.net/browse/PDI-145) |
| Velder | `velder` | [Velder coverage](docs/velder-coverage.md) · [Confluence](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/318013442/02.+Velder+-+Playwright+Test+Automation) · Jira [V2-82](https://mbu-digital.atlassian.net/browse/V2-82) |
| TruckFreakz | `truckfreakz` | [TruckFreakz coverage](docs/truckfreakz-coverage.md) · [Confluence](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/318210049/02.+Truckfreakz+-+Playwright+Test+Automation) · Jira [TD-63](https://mbu-digital.atlassian.net/browse/TD-63) |
| Portofoonweb | `portofoonweb` | [Portofoonweb coverage](docs/portofoonweb-coverage.md) · [Confluence](https://mbu-digital.atlassian.net/wiki/spaces/MBUCD/pages/317882369/02.+PortofoonWEB+-+Playwright+Test+Automation) — blocked by Cloudflare bot verification on TST |

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

PARFUMDEO_BASE_URL=https://dev-parfumdeo-nl.mbu.dev/
PARFUMDEO_HTTP_USER=
PARFUMDEO_HTTP_PASSWORD=
PARFUMDEO_CUSTOMER_EMAIL=
PARFUMDEO_CUSTOMER_PASSWORD=
PARFUMDEO_ADMIN_URL=
PARFUMDEO_ADMIN_USER=
PARFUMDEO_ADMIN_PASSWORD=

VELDER_BASE_URL=https://tst-bestellen-velder-com.mbu.dev/
VELDER_HTTP_USER=
VELDER_HTTP_PASSWORD=
VELDER_CUSTOMER_EMAIL=
VELDER_CUSTOMER_PASSWORD=
VELDER_ADMIN_URL=
VELDER_ADMIN_USER=
VELDER_ADMIN_PASSWORD=

TRUCKFREAKZ_BASE_URL=https://tst-truckfreakz-com.mbu.dev/
TRUCKFREAKZ_HTTP_USER=
TRUCKFREAKZ_HTTP_PASSWORD=
TRUCKFREAKZ_ADMIN_URL=
TRUCKFREAKZ_ADMIN_USER=
TRUCKFREAKZ_ADMIN_PASSWORD=

PORTOFOONWEB_BASE_URL=https://tst-portofoonweb-nl.mbu.dev/
PORTOFOONWEB_HTTP_USER=
PORTOFOONWEB_HTTP_PASSWORD=
PORTOFOONWEB_CUSTOMER_EMAIL=
PORTOFOONWEB_CUSTOMER_PASSWORD=
PORTOFOONWEB_ADMIN_URL=
PORTOFOONWEB_ADMIN_USER=
PORTOFOONWEB_ADMIN_PASSWORD=
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

`node scripts/seed-bulbbarn-blog.cjs` creates the permanent "TEST Playwright" blog posts
the BulbBarn blog tests rely on (idempotent; staging only).

`npm run test:cms` runs the opt-in tests that temporarily edit staging content in
Magento Admin (and restore it). Run it on its own, never together with `npm test`.

Failure screenshots and traces are saved in `test-results/`; the HTML report
is saved in `playwright-report/`.
