const { test, expect } = require('@playwright/test');
const content = require('./fixtures/customer-service.json');

const [subject, subpage] = Object.entries(content.subpages)[0];
const title = page => page.getByRole('heading', { level: 1 });
// Page Builder places the client-editable intro text directly after the title.
const intro = page => page.locator('h1 + [data-content-type="text"]');
const faqHeading = page => page.getByRole('heading', { level: 2, name: content.faqHeading });
const faqQuestions = page => page.locator('section').filter({ has: faqHeading(page) })
  .getByRole('listitem').getByRole('heading', { level: 3 });
const subjectLink = (page, name) => page.getByRole('navigation', { name: content.subjectNavigation })
  .getByRole('link', { name, exact: true }).first();

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function openSubject(page, name) {
  await expectLoaded(await page.goto(content.mainPath));
  await subjectLink(page, name).click();
  await page.waitForLoadState();
}

test.describe('BBM2-55 Customer Care subpage', () => {
  test('[BBM2-55] Open Customer Care subpage from Customer Service main page', async ({ page }) => {
    await openSubject(page, subject);
    await expect(page).toHaveURL(new RegExp(`${subpage.path}$`));
    await expect(title(page)).toBeVisible();
  });

  test('[BBM2-55] Display selected subject as page title', async ({ page }) => {
    await openSubject(page, subject);
    await expect(title(page)).toHaveText(subject);
  });

  test('[BBM2-55] Update page title when a different subject is selected', async ({ page }) => {
    const other = content.subjects.map(item => item.name).find(name => name !== subject);
    await openSubject(page, subject);
    await expect(title(page)).toHaveText(subject);
    await openSubject(page, other);
    await expect(title(page), `"${other}" should not reuse the "${subject}" title`).toHaveText(other);
  });

  test('[BBM2-55] Display editable intro text below the title', async ({ page }) => {
    await expectLoaded(await page.goto(subpage.path));
    await expect(intro(page)).toBeVisible();
    await expect(intro(page)).toHaveText(/\S/);
  });

  test('[BBM2-55] Display static FAQ section title', async ({ page }) => {
    await expectLoaded(await page.goto(subpage.path));
    await expect(faqHeading(page)).toBeVisible();
  });

  test('[BBM2-55] Display backend-managed FAQ questions', async ({ page }) => {
    await expectLoaded(await page.goto(subpage.path));
    await expect(faqQuestions(page)).toHaveText(subpage.faq);
  });

  test('[BBM2-55] Load Delivery and Time staging subpage successfully', async ({ page }) => {
    await expectLoaded(await page.goto(subpage.path));
    await expect(title(page)).toHaveText(subject);
    await expect(faqHeading(page)).toBeVisible();
  });
});
