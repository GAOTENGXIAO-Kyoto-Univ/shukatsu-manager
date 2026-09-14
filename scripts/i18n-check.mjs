import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

import { SUPPORTED_LOCALES } from '../src/i18n/locale.ts';
import { translationResources } from '../src/i18n/resources.ts';

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]] : flatten(child, path);
  });
}

const referenceLocale = SUPPORTED_LOCALES[0];
const referenceEntries = flatten(translationResources[referenceLocale]);
const referenceKeys = referenceEntries.map(([key]) => key).sort();
const errors = [];

for (const locale of SUPPORTED_LOCALES) {
  const entries = flatten(translationResources[locale]);
  const keys = entries.map(([key]) => key).sort();
  const missing = referenceKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !referenceKeys.includes(key));
  const empty = entries.filter(([, value]) => value.trim().length === 0).map(([key]) => key);

  if (missing.length) errors.push(`${locale} missing: ${missing.join(', ')}`);
  if (extra.length) errors.push(`${locale} extra: ${extra.join(', ')}`);
  if (empty.length) errors.push(`${locale} empty: ${empty.join(', ')}`);
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });
}

const scanRoots = ['src/app', 'src/components'];
const allowedFiles = new Set([
  'src/components/selection/selectionConstants.ts',
]);
const hanPattern = /\p{Script=Han}/u;

for (const root of scanRoots) {
  for (const path of sourceFiles(root)) {
    const displayPath = relative('.', path).replaceAll('\\', '/');
    if (allowedFiles.has(displayPath)) continue;

    readFileSync(path, 'utf8').split(/\r?\n/u).forEach((line, index) => {
      if (hanPattern.test(line)) errors.push(`${displayPath}:${index + 1}: ${line.trim()}`);
    });
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`i18n integrity passed: ${referenceKeys.length} keys across ${SUPPORTED_LOCALES.length} locales; no unapproved Han copy in app/components.`);
}
