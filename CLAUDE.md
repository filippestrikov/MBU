# MBU Playwright suite

- Write and review every test against `docs/test-writing-rules.md`. When asked to check the tests,
  check them against that file.
- Run `npm run lint:tests` after changing tests; it must pass before a commit.
- Never run against live sites; only the staging/test hosts in `.env` (see README).
- Reuse `tests/common/magento-admin.js` for Magento Admin steps.
