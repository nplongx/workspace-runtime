#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'docs/source-manifest.json');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function walk(directory, prefix = '') {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'coverage') continue;
    if (relative === 'docs/source-manifest.json' || relative.endsWith('.tgz')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(absolute, relative));
    else if (entry.isFile()) results.push(relative);
    else throw new Error(`unsupported source-manifest entry type: ${relative}`);
  }
  return results;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length < 1) {
  throw new Error('source manifest schema or file inventory is invalid');
}
const expectedFiles = walk(ROOT).sort();
const manifestFiles = manifest.files.map(item => item?.path).sort();
if (JSON.stringify(expectedFiles) !== JSON.stringify(manifestFiles)) {
  const expected = new Set(expectedFiles);
  const observed = new Set(manifestFiles);
  const missing = expectedFiles.filter(file => !observed.has(file));
  const extra = manifestFiles.filter(file => !expected.has(file));
  throw new Error(`source manifest inventory mismatch; missing=${missing.join(',')}; extra=${extra.join(',')}`);
}
const seen = new Set();
for (const entry of manifest.files) {
  if (!entry || typeof entry.path !== 'string' || path.isAbsolute(entry.path) ||
      entry.path.split(/[\\/]/).includes('..') || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0 || seen.has(entry.path)) {
    throw new Error(`invalid source manifest entry: ${String(entry?.path)}`);
  }
  seen.add(entry.path);
  const absolute = path.join(ROOT, entry.path);
  const bytes = fs.readFileSync(absolute);
  if (bytes.length !== entry.sizeBytes || sha256(bytes) !== entry.sha256) {
    throw new Error(`source manifest mismatch: ${entry.path}`);
  }
}
for (const required of ['index.js', 'package.json', 'src/runtime/workspace-runtime.js']) {
  if (!seen.has(required)) throw new Error(`source manifest omits required file: ${required}`);
}
console.log(`Workspace Runtime source manifest PASS: ${manifest.files.length} pinned files`);
