// Checks tests/ against the mechanical part of docs/test-writing-rules.md.
// Usage: npm run lint:tests  (exit code 1 when a rule is broken)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'tests');
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
})(root);

// Selector text without template expressions, attribute values and pseudo-class arguments,
// e.g. `a[href*=".com"]` -> `a[]`.
const bare = selector => selector.replace(/\$\{[^}]*\}/g, 'x').replace(/\[[^\]]*\]/g, '[]').replace(/\([^)]*\)/g, '()');

const checks = [
  { rule: 'No fixed waits (rule 3)', test: line => /\bwaitForTimeout\(/.test(line) },
  { rule: 'No XPath (rule 1)', test: (line, selectors) => selectors.some(s => /^xpath=|^\/\/|^\.\.$/.test(s)) },
  { rule: 'No wildcard class matches (rule 1)', test: (line, selectors) => selectors.some(s => /\[class[*^$~|]?=/.test(s)) },
  { rule: 'No comma-separated selector lists (rule 1)', test: (line, selectors) => selectors.some(s => bare(s).includes(',')) },
  {
    rule: 'CSS class needs a "// stable:" reason (rule 1)',
    test: (line, selectors, previous) => selectors.some(s => /(^|[\s>+~])?[a-z]*\.[a-z_-]/i.test(bare(s)))
      && !/\/\/ stable:/.test(line) && !/\/\/ stable:/.test(previous),
  },
];

const problems = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const selectors = [...line.matchAll(/\.locator\((['"`])((?:\\.|(?!\1).)*)\1/g)].map(m => m[2]);
    for (const { rule, test } of checks) {
      if (test(line, selectors, lines[i - 1] || '')) problems.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${rule}\n    ${line.trim()}`);
    }
  });
}

if (problems.length) {
  console.error(`${problems.length} rule violation(s) — see docs/test-writing-rules.md\n\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`${files.length} files follow docs/test-writing-rules.md`);
