const { test, expect } = require('@playwright/test');
const content = require('./fixtures/customer-service.json');

const subjectNav = page => page.getByRole('navigation', { name: content.subjectNavigation });
const subjectLinks = page => subjectNav(page).getByRole('link');
const faqHeading = page => page.getByRole('heading', { level: 2, name: content.faqHeading });
const faqItems = page => page.locator('section').filter({ has: faqHeading(page) }).getByRole('listitem');
const faqQuestions = page => faqItems(page).getByRole('heading', { level: 3 });

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function openMain(page) {
  await expectLoaded(await page.goto(content.mainPath));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.mainHeading);
}

async function subjectNames(page) {
  return (await subjectLinks(page).allInnerTexts()).map(text => text.trim());
}

// Each FAQ item toggles open (minus icon) and closed (plus icon) when clicked.
async function expectFaqToggles(page) {
  const item = faqItems(page).first();
  const wasOpen = await item.getByRole('img', { name: 'minus' }).isVisible();
  await item.getByRole('heading', { level: 3 }).click();
  await expect(item.getByRole('img', { name: wasOpen ? 'plus' : 'minus' }).first()).toBeVisible();
  await item.getByRole('heading', { level: 3 }).click();
  await expect(item.getByRole('img', { name: wasOpen ? 'minus' : 'plus' }).first()).toBeVisible();
}

test.describe('BBM2-56 Customer Service main page', () => {
  test('[BBM2-56] Display Customer service item in the footer', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    const link = page.locator('footer').getByRole('link', { name: content.footerLabel, exact: true });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  });

  test('[BBM2-56] Open Customer Service main page from the footer', async ({ page }) => {
    await expectLoaded(await page.goto('/'));
    await page.locator('footer').getByRole('link', { name: content.footerLabel, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${content.mainPath}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.mainHeading);
  });

  test('[BBM2-56] Display subject blocks that lead to Customer Care subpages', async ({ page }) => {
    await openMain(page);
    await expect(subjectLinks(page)).not.toHaveCount(0);
    for (const link of await subjectLinks(page).all()) {
      await expect(link.getByRole('img')).toBeVisible();
      await expect(link).toHaveAttribute('href', /\S/);
    }
    expect(new Set(await subjectNames(page)), 'All configured subjects should be shown')
      .toEqual(new Set(content.subjects.map(subject => subject.name)));
  });

  test('[BBM2-56] Navigate to the corresponding subpage from each subject block', async ({ page }) => {
    await openMain(page);
    for (const { name } of content.subjects) {
      await subjectLinks(page).filter({ hasText: name }).first().click();
      await expect.soft(page.getByRole('heading', { level: 1 }), `"${name}" should open its own subpage`).toHaveText(name);
      await openMain(page);
    }
  });

  test('[BBM2-56] Display general FAQ questions specific to the main page', async ({ page }) => {
    await openMain(page);
    await expect(faqHeading(page)).toBeVisible();
    await expect(faqQuestions(page)).toHaveText(content.mainFaq);
  });

  test('[BBM2-56] Keep main-page FAQ behavior consistent with Customer Care subpages', async ({ page }) => {
    await openMain(page);
    await expectFaqToggles(page);
    const [subpage] = Object.values(content.subpages);
    await expectLoaded(await page.goto(subpage.path));
    await expectFaqToggles(page);
  });

  test('[BBM2-56] Do not show subject-specific FAQ content as general FAQ', async ({ page }) => {
    await openMain(page);
    const general = await faqQuestions(page).allInnerTexts();
    const [subpage] = Object.values(content.subpages);
    await expectLoaded(await page.goto(subpage.path));
    const specific = await faqQuestions(page).allInnerTexts();
    expect(general.map(text => text.trim()), 'The main page should not reuse the subpage FAQ list')
      .not.toEqual(specific.map(text => text.trim()));
  });

  test('[BBM2-56] Display required Customer Service main-page structure', async ({ page }) => {
    await openMain(page);
    await expect(subjectNav(page)).toBeVisible();
    await expect(faqHeading(page)).toBeVisible();
    await expect(page.locator('footer').getByRole('link', { name: content.footerLabel, exact: true })).toBeAttached();
    const names = await subjectNames(page);
    expect(names, 'Subject blocks should not be duplicated').toEqual([...new Set(names)]);
  });

  test('[BBM2-56] Load Customer Service main staging page successfully', async ({ page }) => {
    await openMain(page);
    await expect(subjectNav(page)).toBeVisible();
  });
});
