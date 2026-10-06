const { test, expect } = require('@playwright/test');
const content = require('./fixtures/customer-service.json');
const blog = require('./fixtures/blog.json');
const { hasAdmin, adminLogin, openGridRow, saveAdminForm, withCmsPageChange } = require('./admin');

// Opt-in (npm run test:cms): these tests temporarily change shared staging content through
// Magento Admin and restore it afterwards. They run serially on one worker, never with the
// storefront suite, so no other test sees the temporary TEST content.
test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.skip(!hasAdmin(), 'Needs BULBBARN_ADMIN_URL/USER/PASSWORD in .env.');

const MARK = 'TEST Playwright';
const pages = { sub: 'Delivery and Time [NL]', main: 'Find the solution to your question [NL]]' };
const [subject, subpage] = Object.entries(content.subpages)[0];

const faqQuestions = page => page.locator('section')
  .filter({ has: page.getByRole('heading', { level: 2, name: content.faqHeading }) })
  .getByRole('listitem').getByRole('heading', { level: 3 });

async function storefront(page, path) {
  const view = await page.context().newPage();
  const response = await view.goto(path);
  expect(response.ok(), `${path} should load`).toBeTruthy();
  return view;
}

function renameFaq(html, question, text) {
  expect(html, `${question} should be in the page content`).toContain(question);
  return html.replace(question, text);
}

// FAQ items live in the Bulbbarn FaqWidget directive as encoded entries:
// conditions_encoded="[^[`question`:`…`,`answer`:`…`,`delete`:``^],^[…^]]". Remove one entry.
function removeFaq(html, question) {
  const start = html.indexOf(`^[\`question\`:\`${question}\``);
  expect(start, `${question} should be a FaqWidget entry`).toBeGreaterThan(-1);
  const end = html.indexOf('^]', start) + 2;
  if (html[end] === ',') return html.slice(0, start) + html.slice(end + 1);
  expect(html[start - 1], 'A last entry is preceded by a comma').toBe(',');
  return html.slice(0, start - 1) + html.slice(end);
}

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test.describe('BBM2-55 Customer Care subpage (admin edits)', () => {
  test('[BBM2-55] Reflect backend changes to intro text on the subpage', async ({ page }) => {
    const intro = 'Bij Bulbbarn begrijpen';
    await withCmsPageChange(page, pages.sub, html => html.replace(intro, `${MARK} – ${intro}`), async () => {
      const view = await storefront(page, subpage.path);
      await expect(view.locator('h1 + [data-content-type="text"]')).toContainText(`${MARK} – ${intro}`);
      await view.close();
    });
    const view = await storefront(page, subpage.path);
    await expect(view.locator('h1 + [data-content-type="text"]'), 'The original intro should be back').not.toContainText(MARK);
  });

  test('[BBM2-55] Reflect FAQ question changes made in the backend', async ({ page }) => {
    const [question] = subpage.faq;
    const edited = `${MARK} – FAQ question`;
    await withCmsPageChange(page, pages.sub, html => renameFaq(html, question, edited), async () => {
      const view = await storefront(page, subpage.path);
      await expect(faqQuestions(view)).toHaveText([edited, ...subpage.faq.slice(1)]);
      await view.close();
    });
    await expect(faqQuestions(await storefront(page, subpage.path))).toHaveText(subpage.faq);
  });

  test('[BBM2-55] Remove deleted FAQ question from storefront', async ({ page }) => {
    const removed = subpage.faq[subpage.faq.length - 1];
    await withCmsPageChange(page, pages.sub, html => removeFaq(html, removed), async () => {
      const view = await storefront(page, subpage.path);
      await expect(faqQuestions(view)).toHaveText(subpage.faq.slice(0, -1));
      await view.close();
    });
    await expect(faqQuestions(await storefront(page, subpage.path))).toHaveText(subpage.faq);
  });
});

test.describe('BBM2-56 Customer Service main page (admin edits)', () => {
  test('[BBM2-56] Reflect updates to main-page FAQ content', async ({ page }) => {
    const [question] = content.mainFaq;
    const edited = `${MARK} – general FAQ question`;
    await withCmsPageChange(page, pages.main, html => renameFaq(html, question, edited), async () => {
      const view = await storefront(page, content.mainPath);
      await expect(faqQuestions(view)).toHaveText([edited, ...content.mainFaq.slice(1)]);
      // The subpage FAQ must not change with the general FAQ.
      await view.goto(subpage.path);
      await expect(faqQuestions(view)).toHaveText(subpage.faq);
      await view.close();
    });
    await expect(faqQuestions(await storefront(page, content.mainPath))).toHaveText(content.mainFaq);
  });
});

test.describe('BBM2-65 Blog (admin edits)', () => {
  const featuredSwitch = page => page.getByRole('checkbox', { name: /Mark as Featured/ });

  async function setFeatured(page, title, featured) {
    await openGridRow(page, /^\s*Content/, 'Posts', title);
    const toggle = featuredSwitch(page);
    await expect(toggle).toBeAttached({ timeout: 30_000 });
    if ((await toggle.isChecked()) !== featured) {
      await toggle.locator('xpath=..').locator('label').first().click();
      await expect(toggle).toBeChecked({ checked: featured });
    }
    await saveAdminForm(page);
  }

  async function featuredOnOverview(page) {
    const view = await storefront(page, blog.overviewPath);
    const name = (await view.getByRole('main').getByRole('article').first().getAttribute('aria-label'))
      ?? (await view.getByRole('main').getByRole('article').first().getByRole('heading').first().innerText());
    await view.close();
    return name.trim();
  }

  test('[BBM2-65] Allow only one featured blog at a time', async ({ page }) => {
    const other = blog.otherPost;
    expect(await featuredOnOverview(page)).toBe(blog.featuredPost);
    try {
      await setFeatured(page, other, true);
      expect(await featuredOnOverview(page), `${other} should now be the featured post`).toBe(other);
      await openGridRow(page, /^\s*Content/, 'Posts', blog.featuredPost);
      await expect(featuredSwitch(page), `${blog.featuredPost} should be unmarked automatically`).not.toBeChecked();
    } finally {
      await setFeatured(page, blog.featuredPost, true);
      await setFeatured(page, other, false);
    }
    expect(await featuredOnOverview(page), 'The original featured post should be restored').toBe(blog.featuredPost);
  });
});
