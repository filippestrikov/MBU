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

## Status (first run 2026-10-06: 18 passed, 5 failed, 2 skipped)

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
- BBM2-69, BBM2-73, BBM2-85: storefront cart, checkout, filters, minicart and mobile cases. These are good next candidates; checkout cases must stop before placing an order unless order placement on staging is approved.
