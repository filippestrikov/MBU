# Test-writing rules

Every Playwright test in this repo follows these rules. They apply to new tests and to every
change to an existing one. `npm run lint:tests` checks the mechanical part; reviewers check the rest.

## 1. Stable, readable selectors

Pick the first option that identifies the element:

1. `getByRole` with an accessible name: `getByRole('button', { name: 'Add to cart' })`
2. `getByLabel`, `getByPlaceholder`, `getByText`, `getByAltText`
3. Stable attributes owned by the platform, not by the theme: `#id` of form fields
   (`#shipping-firstname`), `[data-role="priceBox"]`, `[data-ui-id="..."]`, `[name="..."]`,
   `a[href*="..."]`, `link[rel~="icon"]`
4. A CSS class only when it names the feature itself (for example `.product-label`) and the
   element has no role, label or text to match. Put a `// stable: <reason>` comment on the line
   or the line above.

Never use:

- XPath (`xpath=..`, `ancestor::`, `following-sibling::`)
- Layout or theme classes (`.sidebar-main`, `.level-top`, `.home-ups-row`, `tr.data-row`)
- Wildcard class matches (`[class*="sidebar"]`)
- Comma-separated "one of these will match" lists (`'#a, #b, input[value="c"]'`)
- Labels of known defects in a locator. Find the element by a stable name and assert the
  wrong label separately, so the test does not break when the defect is fixed.

Scope locators to a region (`getByRole('main')`, `getByRole('contentinfo')`, a dialog) instead of
using `.nth()` on the whole page.

## 2. A clear assertion after each meaningful action

- After `page.goto`: `expectLoaded(response)` and an element that proves the right page loaded.
- After a click, fill or select: assert the visible result (URL, message, count, value, state).
- Give assertions a message when the failure would otherwise be unclear:
  `expect(price, 'Incl. VAT should be excl. + 21%')`.

## 3. No fixed waits

No `page.waitForTimeout`. Wait for state instead: a web-first `expect`, `expect.poll`,
`page.waitForResponse` or `locator.waitFor`.

## 4. One test per manual case

Keep one manual test case per Playwright test, titled `[TICKET] Exact manual case title`. Shared
steps live in the client helper (`tests/<client>/shop.js`, `admin.js`) or in `tests/common/`.

## 5. Short comments only where they help

Comment the *why* (a platform quirk, a staging limitation, an agreed exception), never the *what*.

## 6. Concise code

Reuse helpers, avoid duplicated setup, and keep fixtures (expected copy, test data) in
`tests/<client>/fixtures/`.

## 7. Explain changes

Every commit or PR that adds or changes tests says what changed and why (which rule, which
defect, which staging behaviour).

## Safety rules (unchanged)

- Never run against a live site; `playwright.config.js` refuses non-staging hosts.
- Test data is marked `TEST Playwright`; edits to shared content are opt-in (`npm run test:cms`)
  and restore the original.
