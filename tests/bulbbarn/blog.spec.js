const { test, expect } = require('@playwright/test');
const content = require('./fixtures/blog.json');
const seed = require('./fixtures/blog-seed.json');

const listSection = page => page.locator('section')
  .filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(content.listHeading) }) });
const postLinks = page => listSection(page).getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) });
// Titles only: card text also holds relative dates ("15 seconds ago") that change between loads.
const postTitles = page => listSection(page).getByRole('heading', { level: 3 });
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
    const firstPage = await postTitles(page).allInnerTexts();
    await page.getByRole('link', { name: /next|volgende/i }).click();
    await expect(page).toHaveURL(/[?&]p=2/);
    expect(await postTitles(page).allInnerTexts(), 'Page 2 should show different posts').not.toEqual(firstPage);
    await page.getByRole('link', { name: /previous|vorige/i }).click();
    await expect(postTitles(page)).toHaveText(firstPage);
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

// Uses the permanent TEST content created by scripts/seed-bulbbarn-blog.cjs.
test.describe('BBM2-65 Blog single (seeded TEST content)', () => {
  const showcase = seed.showcase;
  const body = page => page.locator('.amblog-post-content');

  async function openShowcase(page) {
    await expectLoaded(await page.goto(`/blog/${showcase.urlKey}.html`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(showcase.title);
  }

  test('[BBM2-65] Render H2 and H3 heading styles', async ({ page }) => {
    await openShowcase(page);
    const h2 = body(page).getByRole('heading', { level: 2 });
    const h3 = body(page).getByRole('heading', { level: 3 });
    await expect(h2).toHaveCount(showcase.h2);
    await expect(h3).toHaveCount(showcase.h3);
    const size = locator => locator.first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(await size(h2), 'H2 should render larger than H3').toBeGreaterThan(await size(h3));
  });

  test('[BBM2-65] Display multiple images in a blog post', async ({ page }) => {
    await openShowcase(page);
    const images = body(page).getByRole('img', { name: /^TEST image \d$/ });
    await expect(images).toHaveCount(showcase.images);
    const boxes = [];
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { message: 'Image should load' }).toBe(true);
      // Page coordinates, so scrolling between images does not affect the order check.
      boxes.push(await image.evaluate(img => {
        const box = img.getBoundingClientRect();
        return { top: box.top + window.scrollY, right: box.right };
      }));
    }
    const tops = boxes.map(box => box.top);
    expect(tops, 'Images should keep their content order').toEqual([...tops].sort((a, b) => a - b));
    for (const box of boxes) expect(box.right, 'Images should fit the page').toBeLessThanOrEqual(page.viewportSize().width + 1);
  });

  test('[BBM2-65] Display three client-selected related blogs at bottom (seeded post)', async ({ page }) => {
    await openShowcase(page);
    const related = page.getByRole('main').getByRole('link', { name: new RegExp(showcase.related.map(t => t.replace(/[–-]/g, '.')).join('|')) });
    await expect(related.filter({ visible: true }), 'The three related posts selected in Admin should be shown').toHaveCount(showcase.related.length);
    const first = related.filter({ visible: true }).first();
    const clicked = (await first.innerText()).trim();
    await first.click();
    await expect(page.getByRole('heading', { level: 1 }), 'A related post link should open that post')
      .toHaveText(showcase.related.find(name => clicked.includes(name)) ?? clicked);
  });

  // The post form has no hero-video field, so the seeded post puts a Page Builder video block
  // first in the body ("first media position"). It does not replace the post image.
  for (const width of [1440, 390]) {
    test(`[BBM2-65] Support video in blog hero media (${width}px)`, async ({ page }) => {
      const video = seed.video;
      await page.setViewportSize({ width, height: 900 });
      await expectLoaded(await page.goto(`/blog/${video.urlKey}.html`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(video.title);
      const frame = body(page).locator('iframe').first();
      await frame.scrollIntoViewIfNeeded();
      await expect(frame).toBeVisible();
      await expect(frame).toHaveAttribute('src', new RegExp(`/embed/${video.youtubeId}`));
      const layout = await body(page).evaluate(root => {
        const iframe = root.querySelector('iframe');
        const media = [...root.querySelectorAll('iframe, img, video')];
        const text = [...root.querySelectorAll('p')].find(p => p.textContent.trim());
        const box = iframe.getBoundingClientRect();
        return {
          firstMedia: media[0] === iframe,
          ratio: box.width / box.height,
          right: box.right,
          beforeText: text ? box.bottom <= text.getBoundingClientRect().top + 1 : true,
        };
      });
      expect(layout.firstMedia, 'The video should be the first media in the post').toBe(true);
      expect(layout.ratio, 'The video should keep a 16:9 frame').toBeCloseTo(16 / 9, 1);
      expect(layout.right, 'The video should fit the page').toBeLessThanOrEqual(width + 1);
      expect(layout.beforeText, 'The video should not overlap the text below it').toBe(true);
    });
  }
});
