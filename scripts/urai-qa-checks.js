#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] || 'public');
const protectedNames = ['admin', 'portal', 'dashboard', 'reports', 'audit', 'privacy-center'];
const placeholderWords = ['lorem ipsum', 'TODO', 'FIXME', 'placeholder', 'debug', 'dummy data', 'fake metric'];

if (!fs.existsSync(root)) {
  console.error(`URAI QA failed: directory not found: ${root}`);
  process.exit(2);
}

const files = walk(root).filter((file) => file.endsWith('.html'));
const errors = [];
const warnings = [];
let checked = 0;
let publicChecked = 0;
let protectedChecked = 0;
let skippedFrameworkInternals = 0;

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const segments = rel.split('/');
  if (segments.some((segment) => segment.startsWith('_'))) {
    skippedFrameworkInternals += 1;
    continue;
  }

  checked += 1;
  const html = fs.readFileSync(file, 'utf8');
  const lower = html.toLowerCase();
  const protectedRoute = protectedNames.some((name) => rel.toLowerCase().includes(name));
  if (protectedRoute) protectedChecked += 1;
  else publicChecked += 1;

  const hasNoIndex = lower.includes('noindex');
  const hasPrivacy = lower.includes('uraiprivacy.com') || lower.includes('/privacy');

  for (const word of placeholderWords) {
    if (lower.includes(word.toLowerCase())) errors.push(`${rel}: forbidden placeholder/debug text: ${word}`);
  }

  if (protectedRoute && !hasNoIndex) errors.push(`${rel}: protected route missing noindex`);
  if (!protectedRoute && hasNoIndex) warnings.push(`${rel}: public-looking route has noindex; verify intentional`);
  if (!protectedRoute && !hasPrivacy) errors.push(`${rel}: public route missing privacy link`);
  if (!protectedRoute && !/<title>[^<]{8,}<\/title>/i.test(html)) errors.push(`${rel}: missing title metadata`);
  if (!protectedRoute && !/<meta\s+name=['"]description['"]/i.test(html)) errors.push(`${rel}: missing description metadata`);
}

if (checked === 0) errors.push('no rendered product HTML files were checked');
if (publicChecked === 0) errors.push('no rendered public product route was checked');
if (protectedChecked === 0) errors.push('no rendered protected privacy/admin route was checked');

for (const warning of warnings) console.log(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
console.log(`URAI QA checked ${checked} product HTML file(s): ${publicChecked} public and ${protectedChecked} protected; skipped ${skippedFrameworkInternals} framework-internal artifact(s).`);
process.exit(errors.length ? 1 : 0);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
