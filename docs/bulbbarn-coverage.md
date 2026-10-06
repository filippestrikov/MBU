# BulbBarn automation coverage

Source: `E:\Codex\MB\BulBarn\BBM2-*_Test_Cases.xlsx` (12 files, 132 manual cases).
Target: BulbBarn staging only (`BULBBARN_BASE_URL` in `.env`, HTTP auth required).
Live sites are never tested; `playwright.config.js` refuses non-staging hosts.

Test titles keep the Jira ticket and the exact manual case title, for example
`[BBM2-63] Display BulbBarn favicon in browser tab`.

Fixtures in `tests/bulbbarn/fixtures/` record the Dutch (default store view)
staging content read on 2026-10-06. They are a regression baseline, not approved
copy; update them only when the expected content is confirmed.

Run with `npx playwright test --project=bulbbarn`.

## Test orders

Checkout tests place **real orders on staging only** (never on live). Every order is
marked so it can be found and cleaned up in Magento:

- customer name `TEST Playwright`, email `playwright-test@example.com`
- order note (`Extra informatie`): `TEST – Playwright automated order. Do not ship.`
- payment method `Check / Money order` (offline, no Mollie transaction)

A full run places 3 orders (BBM2-73 MyParcel, BBM2-74, BBM2-76). Mollie methods are
only selected, never paid.

## Status (run 2026-10-06: 46 passed, 17 failed, 3 skipped)

Full regression report: [regression-reports/bulbbarn-2026-10-06.md](regression-reports/bulbbarn-2026-10-06.md), filed as Jira [BD2-5](https://mbu-digital.atlassian.net/browse/BD2-5).

Wishlist tests log in as the shared staging customer, add one product that is not yet
on the wishlist and remove it again (from wishlist and cart) at the end. Admin tests
are read-only.

Local runs use 2 workers to limit load on the shared staging server.

### Staging findings

| # | Finding | Tests |
| --- | --- | --- |
| 1 | All Customer Service subject blocks link to `/delivery-and-time`. | BBM2-56, BBM2-55 |
| 2 | "Volg je bestelling" subject block appears 5 times. | BBM2-56 |
| 3 | Blog "Terug naar overzicht" links to `/blog/`, which returns 403 Forbidden. | BBM2-65 |
| 4 | Blog overview has 4px horizontal overflow at 1440px. | BBM2-65 |
| 5 | iDEAL payment option still shows the legacy iDEAL logo/label; no Wero branding. | BBM2-69 |
| 6 | Sort By ("Sorteer op") reloads the whole page (`?product_list_order=`). | BBM2-73 |
| 7 | Selecting a colour swatch in the standard filter does not update the product list (only a count request is sent). | BBM2-73 |
| 8 | "Apply Filters" in All filters reloads the whole page (`?color=`). | BBM2-73 |
| 9 | Adding to cart on the PDP shows the "toegevoegd" message and does not open the minicart. | BBM2-73 |
| 10 | Adding a minicart upsell product (via its options pop-up) closes the minicart. | BBM2-73 |
| 11 | Mobile (412px) All-filters pop-up is 9px wider than the screen. | BBM2-85 |
| 12 | Mobile category page has 20px horizontal overflow. | BBM2-85 |
| 13 | No Trustpilot block on the homepage. | BBM2-85 |
| 14 | Minicart quantity accepts 0. | BBM2-85 |
| 15 | Intermittent: after several checkouts in a row MyParcel returns no delivery time slots (even after reload) and checkout stops with "The shipping method is missing". The affected test varies per run. | BBM2-69 / BBM2-73 checkout tests |
| 16 | Mobile hamburger button is labelled "Menu sluiten" while the menu is closed (observed, not asserted). | — |
| 17 | "Account aanmaken" submit button reads "Log in" (observed, not asserted). | — |
| 18 | Sale product PDP shows original price € 49,00 for the first option; the wishlist shows € 4,90. | BBM2-85 |
| 19 | Sale product options are all disabled; adding it fails with "required option(s) weren't entered". | BBM2-85 |

### Implemented

| Ticket | Manual case | Result / notes |
| --- | --- | --- |
| BBM2-63 | Display BulbBarn favicon in browser tab | Pass. Checks the Magento-uploaded icon (`/media/favicon/…`) loads as an image. Whether the artwork is the BulbBarn logo needs a visual check. |
| BBM2-63 | Display favicon on multiple storefront pages | Pass. Home, category, PDP, cart and checkout (empty cart redirects to cart). |
| BBM2-63 | Load favicon without broken request | Pass. `/favicon.ico` itself returns 404, but pages declare a `link rel="icon"`, so browsers do not request it. |
| BBM2-63 | Display favicon after hard refresh/new session | Pass. Uses a fresh browser context (no cache) and a reload. |
| BBM2-56 | Display Customer service item in the footer | Pass. The NL label is "Klantenservice" (EN store: "Customer Care"). |
| BBM2-56 | Open Customer Service main page from the footer | Pass. |
| BBM2-56 | Display subject blocks that lead to Customer Care subpages | Pass. |
| BBM2-56 | Navigate to the corresponding subpage from each subject block | **Fails**: all subject blocks link to `/delivery-and-time`; only "Levering en tijd" opens its own page. |
| BBM2-56 | Display general FAQ questions specific to the main page | Pass. |
| BBM2-56 | Keep main-page FAQ behavior consistent with Customer Care subpages | Pass. Same open/close toggle on both pages. |
| BBM2-56 | Do not show subject-specific FAQ content as general FAQ | Pass. |
| BBM2-56 | Display required Customer Service main-page structure | **Fails**: "Volg je bestelling" appears 5 times among 8 subject blocks. Hero support block not checked (see below). |
| BBM2-56 | Load Customer Service main staging page successfully | Pass. |
| BBM2-55 | Open Customer Care subpage from Customer Service main page | Pass. |
| BBM2-55 | Display selected subject as page title | Pass. |
| BBM2-55 | Update page title when a different subject is selected | **Fails**: other subjects open the "Levering en tijd" page (same cause as BBM2-56). |
| BBM2-55 | Display editable intro text below the title | Pass. |
| BBM2-55 | Display static FAQ section title | Pass. |
| BBM2-55 | Display backend-managed FAQ questions | Pass against the fixture baseline. |
| BBM2-55 | Load Delivery and Time staging subpage successfully | Pass. |
| BBM2-65 | Display selected featured blog at top of Blog Overview | Pass. |
| BBM2-65 | Show 12 blog posts per overview page | Skipped: staging has fewer than 13 posts. |
| BBM2-65 | Paginate Blog Overview like category pages | Skipped: staging has fewer than 13 posts. |
| BBM2-65 | Render Blog Overview responsively | **Fails**: 4px horizontal overflow at 1440px; 768px and 375px pass. |
| BBM2-65 | Return to Blog Overview from bottom button | **Fails**: "Terug naar overzicht" links to `/blog/`, which returns 403 Forbidden. |
| BBM2-69 | Display Ideal-WERO logo instead of legacy iDEAL logo | **Fails** (finding 5). Checks the iDEAL option's accessible name for Wero branding; artwork needs a visual check. |
| BBM2-69 | Render Ideal-WERO logo correctly on desktop (1366x786, 1920x1024) | Pass (two tests). Logo visible, ≥24px, inside its option, not overlapping the label. |
| BBM2-69 | Render Ideal-WERO logo correctly on mobile | Pass (390x844). |
| BBM2-69 | Render Ideal-WERO logo correctly on tablet | Pass (820x1180). |
| BBM2-69 | Keep payment option functional after logo replacement | Pass when MyParcel returns slots (finding 15). Selects iDEAL; Place Order enabled; no errors. Does not pay. |
| BBM2-73 | Show notifications promptly and clear them correctly | Pass. The add-to-cart message does not persist on the next page. |
| BBM2-73 | Display required product information in search results | Pass. Image, name and price on the first 6 cards. |
| BBM2-73 | Apply Sort By without full-page reload | **Fails** (finding 6). |
| BBM2-73 | Apply standard filters without full-page reload | **Fails** (finding 7). |
| BBM2-73 | Apply filters from All filters without full-page reload | **Fails** (finding 8). |
| BBM2-73 | Open minicart instead of showing add-to-cart notification on PDP | **Fails** (finding 9). |
| BBM2-73 | Keep minicart open when adding an upsell product | **Fails** (finding 10). |
| BBM2-73 | Verify Mollie payment integration in checkout | Pass. Bancontact, Belfius, Credit Cards, iDeal, Klarna, PayPal offered and selectable. |
| BBM2-73 | Verify MyParcel shipping integration in checkout | Pass. Places a labelled test order. |
| BBM2-74 | Verify Mollie payment methods on staging | Pass (same checks as BBM2-73). |
| BBM2-74 | Verify MyParcel shipping methods and checkout compatibility | Pass. Home delivery and PostNL pickup offered; places a labelled test order. |
| BBM2-76 | Place order successfully after MyParcel serialization fix | Pass. Places a labelled test order; Admin check not automated yet. |
| BBM2-85 | Show correct account links on Sign In / Sign Up screens | Pass (Pixel 7 viewport, as all BBM2-85 tests). |
| BBM2-85 | Update mobile menu according to login status | Pass. Uses the staging customer account from `.env`. |
| BBM2-85 | Open Shopping Cart from mobile cart button | Pass. |
| BBM2-85 | Display filters pop-up correctly on mobile PLP | **Fails** (finding 11). |
| BBM2-85 | Use QTY selector correctly on PDP and Cart | Pass. |
| BBM2-85 | Display product prices and names on search results | Pass. |
| BBM2-85 | Display product cards correctly on mobile PLP | **Fails** (finding 12). |
| BBM2-85 | Allow cart to contain more than 10 products when business rules permit | Pass (quantity 11 on one line). |
| BBM2-85 | Display required homepage icons and CMS/Trustpilot blocks | **Fails** (finding 13). |
| BBM2-85 | Display Blog Post page correctly on mobile | Pass. |
| BBM2-85 | Display Planting Calendar correctly on PDP | Pass. |
| BBM2-85 | Display language switcher correctly in footer | Pass. Opens "Taal" and switches to English. |
| BBM2-85 | Display product options when adding configurable/custom-option items | Pass ("3 tubers" shown in cart). |
| BBM2-85 | Calculate quantity, price and tax correctly after option changes | Pass (2 × € 14,85 = € 29,70; VAT line shown). |
| BBM2-85 | Prevent invalid minicart quantity/removal behavior | **Fails** (finding 14). Removing the last item works. |
| BBM2-85 | Highlight wishlisted products correctly on mobile | Pass. Wishlists a new product, checks the highlighted heart on the category page, then removes it. |
| BBM2-85 | Add product to cart from Wishlist on mobile | Pass. Uses the options pop-up; cleans up cart and wishlist. |
| BBM2-85 | Display correct original and current prices on mobile | **Fails** (findings 18 and 19). Uses `/test-product.html` (the only sale product found). |
| BBM2-85 | Keep sticky total usable and non-overlapping | Skipped: no sticky total is rendered on the mobile cart; needs the design to confirm it should exist. |
| BBM2-85 | Keep footer scrolling stable on mobile | Pass. Wheel scrolling around the footer moves in the requested direction without jumps; no scroll lock. |
| BBM2-76 | Place order successfully after MyParcel serialization fix (Admin part) | Pass. Admin order view shows TEST customer, address, MyParcel shipping, delivery date and the test note. |
| BBM2-113 | Display PlatformSVS status in Sales Order grid | Pass. "PlatformSVS Export" column shows a valid status for TEST orders (all "NOT EXPORTED"). |
| BBM2-113 | Display PlatformSVS export information on order view | Pass (partial). Block present with "Not queued for PlatformSVS export yet."; attempts/supplier ID need an exported order. |
| BBM2-74 | Verify EN, NL and DE store/language hierarchy | Pass. Admin Stores > All Stores lists NL, EN and DE store views. |

### Not automated yet: needs staging content or a design reference

| Ticket | Manual case | What is needed |
| --- | --- | --- |
| BBM2-56 | Display Customer support block in the hero | Not rendered on staging (the hero static block is empty). Needs the Figma reference to define the expected block. |
| BBM2-56 | Open correct destinations from Customer support logos | Depends on the hero support block and its expected link targets. |
| BBM2-55 | Display static contact block | No contact block is rendered on `/delivery-and-time`. Needs expected content. |
| BBM2-55 | Keep contact block unchanged across subject subpages | Needs the contact block and a second real subpage. |
| BBM2-55 | Display reviews component consistently with other pages | No reviews section is rendered. Needs the reference component. |
| BBM2-55 | Display required page sections in the designed structure | Blocked by contact block and reviews. |
| BBM2-65 | Support video in blog hero media | Needs a staging post with hero video. |
| BBM2-65 | Render H2 and H3 heading styles | Needs a staging post with H2/H3 content (current posts have no body). |
| BBM2-65 | Display multiple images in a blog post | Needs a staging post with several images. |
| BBM2-65 | Display three client-selected related blogs at bottom | No related posts are rendered; needs three configured related posts. |

### Not automated: needs Magento admin changes, back-end access or real orders

- BBM2-55 / BBM2-56 / BBM2-65: cases that edit content in the admin and check the storefront (intro text, FAQ add/edit/delete, featured-post switch, overview text). These change staging data and need agreed admin test accounts.
- BBM2-113 (PlatformSVS), BBM2-74 (integrations/translations), BBM2-75 (PDFs), BBM2-76 (Anowave GA4), BBM2-80 (product import): admin, queue, log or API checks.
- Admin cases that **change** staging data (CMS text/FAQ edits, featured blog switch, configuration saves, retries/exports) are not automated: they would alter shared staging content. They can be added with an agreed revert step.
- PlatformSVS export/retry/status sync, inventory and product sync (BBM2-113), PDFs (BBM2-75), logs/CLI (BBM2-76, BBM2-80) need server or API access.
