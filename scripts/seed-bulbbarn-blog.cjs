// Seeds permanent TEST blog content on BulbBarn staging through Magento Admin (Amasty Blog).
// Idempotent: posts that already exist (by URL key) are skipped. Staging only.
//
//   node scripts/seed-bulbbarn-blog.cjs            create missing posts
//   node scripts/seed-bulbbarn-blog.cjs --dry-run  list what would be created
//   node scripts/seed-bulbbarn-blog.cjs --limit=1  create at most one post (trial)
//
// Creates 13 list posts (so the overview has more than 12 posts and paginates) and one
// "Content showcase" post with H2/H3 headings, three images and three related posts.
require('dotenv').config({ quiet: true });
const { chromium, expect } = require('@playwright/test');
const { adminLogin, adminMenu, openGridRow, orderGrid, saveAdminForm } = require('../tests/bulbbarn/admin');
const seed = require('../tests/bulbbarn/fixtures/blog-seed.json');

const dryRun = process.argv.includes('--dry-run');
const base = process.env.BULBBARN_BASE_URL;
if (!/staging|\.mbu\.dev/.test(new URL(base).hostname)) throw new Error('Refusing to seed a non-staging host.');

const setField = (page, index, value) => page.evaluate(([i, v]) => new Promise((resolve, reject) => require(['uiRegistry'], registry => {
  const field = registry.get(c => c.index === i && typeof c.value === 'function');
  if (!field) return reject(new Error(`Field ${i} not found`));
  field.value(v);
  resolve();
})), [index, value]);

async function existingUrlKeys(page) {
  await adminMenu(page, /^\s*Content/, 'Posts');
  await orderGrid(page).locator('tbody tr.data-row').first().waitFor({ timeout: 60_000 });
  // The grid renders in stages; wait until the row count stops changing.
  let count = -1;
  for (let next = await orderGrid(page).locator('tbody tr.data-row').count(); next !== count;) {
    count = next;
    await page.waitForTimeout(2000);
    next = await orderGrid(page).locator('tbody tr.data-row').count();
  }
  const text = (await orderGrid(page).locator('tbody tr.data-row').allInnerTexts()).join('\n');
  if (!/highlighted-post/.test(text)) throw new Error('Posts grid did not load completely; refusing to guess which posts exist.');
  return text;
}

async function openNewPost(page) {
  await adminMenu(page, /^\s*Content/, 'Posts');
  await page.locator('.page-actions-buttons button').filter({ hasText: 'Add Post' }).click();
  await page.waitForLoadState('load');
  await expect.poll(() => page.evaluate(() => new Promise(r => require(['uiRegistry'], reg => r(Boolean(reg.get(c => c.index === 'full_content')))))),
    { timeout: 60_000 }).toBe(true);
}

async function uploadImage(page, index, file) {
  // The Uppy uploader has a file input and a folder input; use the file one.
  await page.locator(`[data-index="${index}"] input[type="file"]:not([webkitdirectory])`).setInputFiles(file);
  await expect.poll(() => page.evaluate(i => new Promise(r => require(['uiRegistry'], reg =>
    r((reg.get(c => c.index === i && typeof c.value === 'function').value() || []).length))), index),
  { message: `${index} should upload`, timeout: 60_000 }).toBeGreaterThan(0);
}

const getField = (page, index) => page.evaluate(i => new Promise(r => require(['uiRegistry'], registry => {
  const field = registry.get(c => c.index === i && typeof c.value === 'function');
  r(field ? field.value() : null);
})), index);

// Page Builder overwrites the field from its stage on save, so open the Content section and
// let the stage load before setting the body.
async function setFullContent(page, html) {
  await page.locator('.fieldset-wrapper-title').filter({ hasText: /^\s*Content\s*$/ }).first().click();
  await expect(page.locator('.pagebuilder-stage, [data-role="pagebuilder-stage"]').first()).toBeAttached({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  await setField(page, 'full_content', html);
}

async function fillPost(page, post, isNew) {
  if (isNew) {
    await setField(page, 'title', post.title);
    await setField(page, 'url_key', post.urlKey);
    await setField(page, 'status', '2');
    await setField(page, 'categories', [seed.categoryId]);
    await setField(page, 'author_id', [seed.authorId]);
    await setField(page, 'short_content', post.shortContent);
    for (const index of ['post_thumbnail_file', 'list_thumbnail_file']) await uploadImage(page, index, seed.imageFile);
  }
  await setFullContent(page, post.fullContent);
  if (post.related?.length) await addRelatedPosts(page, post.related);
  await saveAdminForm(page);
}

async function createPost(page, post) {
  await openNewPost(page);
  await fillPost(page, post, true);
}

// Repairs a seed post whose body was not saved (returns true when it changed something).
async function repairPost(page, post) {
  await openGridRow(page, /^\s*Content/, 'Posts', post.title);
  await expect.poll(() => getField(page, 'full_content').then(v => v !== null), { timeout: 60_000 }).toBe(true);
  if (String(await getField(page, 'full_content')).includes(post.fullContent.slice(0, 40))) return false;
  await fillPost(page, post, false);
  return true;
}

async function addRelatedPosts(page, titles) {
  await page.locator('.fieldset-wrapper-title').filter({ hasText: 'Related Posts' }).click();
  await page.getByRole('button', { name: 'Add Related Posts' }).click();
  const modal = page.locator('.modal-slide._show, .modal-popup._show').last();
  const grid = modal.locator('.admin__data-grid-wrap').filter({ visible: true }).first();
  await expect(grid.locator('tbody tr.data-row').first()).toBeVisible({ timeout: 60_000 });
  for (const title of titles) {
    await grid.locator('tbody tr.data-row').filter({ hasText: title }).first().locator('input[type="checkbox"]').check();
  }
  await modal.getByRole('button', { name: /Add Selected/i }).click();
  await expect(page.locator('[data-index="related_posts_container"] tbody tr')).toHaveCount(titles.length);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: base,
    httpCredentials: { username: process.env.BULBBARN_HTTP_USER, password: process.env.BULBBARN_HTTP_PASSWORD },
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  try {
    await adminLogin(page);
    const existing = await existingUrlKeys(page);
    const exists = post => new RegExp(`\\b${post.urlKey}\\b`).test(existing);
    const missing = seed.posts.filter(post => !exists(post));
    console.log(`Seed posts missing: ${missing.length} of ${seed.posts.length}`);
    if (!dryRun) {
      for (const post of seed.posts.filter(exists)) {
        if (await repairPost(page, post)) console.log(`repaired: ${post.title}`);
      }
    }
    const limit = Number(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] ?? Infinity);
    for (const post of missing.slice(0, limit)) {
      if (dryRun) { console.log(`would create: ${post.title}`); continue; }
      await createPost(page, post);
      console.log(`created: ${post.title}`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
