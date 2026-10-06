const { test, expect } = require('@playwright/test');
const content = require('./fixtures/blog.json');

const listSection = page => page.locator('section')
  .filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(content.listHeading) }) });
const postLinks = page => listSection(page).getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) });
const featured = page => page.getByRole('main').getByRole('article').first();

async function expectLoaded(response) {
  expect(response, 'The page should return a response').not.toBeNull();
  expect(response.ok(), 'The page should load successfully').toBeTruthy();
}

async function openOverview(page) {
  await expectLoaded(await page.goto(content.overviewPath));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.overviewHeading);
}

// The list heading carries the total, e.g. "Alle blogs en updates 2".
async function totalPosts(page) {
  const heading = await listSection(page).getByRole('heading', { level: 2 }).innerText();
  return Number(heading.match(/(\d+)\s*$/)?.[1] ?? 0);
}

test.describe('BBM2-65 Blog overview and single', () => {
  test('[BBM2-65] Display selected featured blog at top of Blog Overview', async ({ page }) => {
    await openOverview(page);
    await expect(featured(page)).toHaveAccessibleName(content.featuredPost);
    const card = featured(page).getByRole('link', { name: content.featuredPost });
    await expect(card).toBeVisible();
    const [featuredBox, listBox] = await Promise.all([featured(page).boundingBox(), listSection(page).boundingBox()]);
    expect(featuredBox.y, 'The featured post should be above the post list').toBeLessThan(listBox.y);
  });

  test('[BBM2-65] Show 12 blog posts per overview page', async ({ page }) => {
    await openOverview(page);
    const total = await totalPosts(page);
    test.skip(total <= content.postsPerPage, `Needs more than ${content.postsPerPage} posts on staging; found ${total}.`);
    await expect(postLinks(page)).toHaveCount(content.postsPerPage);
  });

  test('[BBM2-65] Paginate Blog Overview like category pages', async ({ page }) => {
    await openOverview(page);
    const total = await totalPosts(page);
    test.skip(total <= content.postsPerPage, `Needs more than ${content.postsPerPage} posts on staging; found ${total}.`);
    const firstPage = await postLinks(page).allInnerTexts();
    await page.getByRole('link', { name: /next|volgende/i }).click();
    await expect(page).toHaveURL(/[?&]p=2/);
    expect(await postLinks(page).allInnerTexts(), 'Page 2 should show different posts').not.toEqual(firstPage);
    await page.getByRole('link', { name: /previous|vorige/i }).click();
    await expect(postLinks(page)).toHaveText(firstPage);
  });

  test('[BBM2-65] Render Blog Overview responsively', async ({ page }) => {
    for (const width of [1440, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await openOverview(page);
      await expect(featured(page).getByRole('link').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.soft(overflow, `No horizontal scrolling at ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test('[BBM2-65] Return to Blog Overview from bottom button', async ({ page }) => {
    await openOverview(page);
    await featured(page).getByRole('link', { name: content.featuredPost }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.featuredPost);
    const back = page.getByRole('link', { name: content.backLink });
    await back.scrollIntoViewIfNeeded();
    await back.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(content.overviewHeading);
  });
});
