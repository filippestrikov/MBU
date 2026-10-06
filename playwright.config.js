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
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }]] : []),
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: clients.filter(client => client.baseURL).map(({ name, baseURL, httpCredentials }) => ({
    name,
    testDir: `./tests/${name}`,
    use: { ...devices['Desktop Chrome'], baseURL, httpCredentials: httpCredentials || undefined },
  })),
});
