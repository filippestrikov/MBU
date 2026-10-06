require('dotenv').config({ quiet: true });
const { defineConfig, devices } = require('@playwright/test');

// One project per client site. Values come from the Git-ignored .env file.
const clients = [
  {
    name: 'bulbbarn',
    baseURL: process.env.BULBBARN_BASE_URL,
    httpCredentials: process.env.BULBBARN_HTTP_USER && {
      username: process.env.BULBBARN_HTTP_USER,
      password: process.env.BULBBARN_HTTP_PASSWORD,
    },
  },
  {
    name: 'parfumdeo',
    baseURL: process.env.PARFUMDEO_BASE_URL,
    httpCredentials: process.env.PARFUMDEO_HTTP_USER && {
      username: process.env.PARFUMDEO_HTTP_USER,
      password: process.env.PARFUMDEO_HTTP_PASSWORD,
    },
  },
  {
    name: 'velder',
    baseURL: process.env.VELDER_BASE_URL,
    httpCredentials: process.env.VELDER_HTTP_USER && {
      username: process.env.VELDER_HTTP_USER,
      password: process.env.VELDER_HTTP_PASSWORD,
    },
    storageState: '.auth/velder-customer.json',
  },
  {
    name: 'portofoonweb',
    baseURL: process.env.PORTOFOONWEB_BASE_URL,
    httpCredentials: process.env.PORTOFOONWEB_HTTP_USER && {
      username: process.env.PORTOFOONWEB_HTTP_USER,
      password: process.env.PORTOFOONWEB_HTTP_PASSWORD,
    },
  },
];

// Live sites must never be tested: only staging/test/dev hosts are allowed.
const nonLiveHost = /(^|[.-])(staging|stage|stg|tst|test|dev|acc|acceptance)([.-]|$)|\.mbu\.dev$/i;
for (const { name, baseURL } of clients.filter(client => client.baseURL)) {
  const host = new URL(baseURL).hostname;
  if (!nonLiveHost.test(host)) throw new Error(`${name}: ${host} does not look like a staging/test host; refusing to run against a live site.`);
}

const missing = clients.filter(client => !client.baseURL).map(client => client.name);
if (missing.length) console.warn(`Skipping projects without a base URL in .env: ${missing.join(', ')}`);

module.exports = defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Shared staging servers (and MyParcel delivery slots) get unreliable under heavier parallel load.
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }]] : []),
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: clients.filter(client => client.baseURL).flatMap(({ name, baseURL, httpCredentials, storageState }) => {
    const use = { ...devices['Desktop Chrome'], baseURL, httpCredentials: httpCredentials || undefined };
    // Clients with a login wall log in once in a setup project and reuse the stored session.
    if (storageState) {
      return [
        { name: `${name}-setup`, testDir: `./tests/${name}`, testMatch: '**/auth.setup.js', use },
        { name, testDir: `./tests/${name}`, testIgnore: ['**/*.cms.spec.js', '**/auth.setup.js'], dependencies: [`${name}-setup`], use: { ...use, storageState } },
      ];
    }
    return [
      { name, testDir: `./tests/${name}`, testIgnore: '**/*.cms.spec.js', use },
      // Tests that temporarily edit shared staging content run only on request (npm run test:cms).
      ...(process.env.MBU_CMS_EDITS === '1' ? [{ name: `${name}-cms`, testDir: `./tests/${name}`, testMatch: '**/*.cms.spec.js', use }] : []),
    ];
  }),
});
