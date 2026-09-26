// CI gate: validates all content and prints every issue. Exits non-zero on errors.
import { loadContent } from '../src/load.js';

const { bundle, issues } = loadContent();
for (const i of issues) console.log(`[${i.level}] ${i.where}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;
console.log(
  `content ${bundle.version}: ${Object.keys(bundle.skills).length} skills, ${Object.keys(bundle.statuses).length} statuses, ` +
    `${Object.keys(bundle.minions).length} minions, ${Object.keys(bundle.classes).length} classes, ${Object.keys(bundle.items).length} items — ${errors} errors, ${warnings} warnings`,
);
process.exit(errors ? 1 : 0);
