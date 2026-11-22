// Minimal WebDriver smoke test for the SpawnDroid e2e demo repo.
// Uses only Node 20+ built-ins: the runner injects SPAWNDROID_WD_URL and friends.
const WD = (process.env.SPAWNDROID_WD_URL || '').replace(/\/+$/, '');
const PKG = process.env.SPAWNDROID_APP_PACKAGE || '';
const REPORT = 'test-results/junit.xml';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

let name = 'app-launches-and-renders';
let failure = null;
const t0 = Date.now();
try {
  if (!WD) throw new Error('SPAWNDROID_WD_URL is not set');
  const res = await fetch(`${WD}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          platformName: 'Android',
          'appium:automationName': 'UiAutomator2',
          'appium:appPackage': PKG,
          'appium:newCommandTimeout': 120,
        },
      },
    }),
  });
  const created = await res.json();
  const sid = created?.value?.sessionId;
  if (!sid) throw new Error('WebDriver session not created: ' + JSON.stringify(created).slice(0, 400));
  try {
    const srcRes = await fetch(`${WD}/session/${sid}/source`);
    const src = await srcRes.json();
    const xml = typeof src?.value === 'string' ? src.value : JSON.stringify(src?.value || '');
    if (PKG && !xml.includes(PKG)) throw new Error(`package ${PKG} not found in UI tree`);
    if (xml.length < 500) throw new Error('UI tree suspiciously small: ' + xml.length + ' bytes');
    console.log('UI tree contains', PKG, '-', xml.length, 'bytes');
  } finally {
    await fetch(`${WD}/session/${sid}`, { method: 'DELETE' }).catch(() => {});
  }
} catch (e) {
  failure = String(e && e.message || e);
}
const secs = ((Date.now() - t0) / 1000).toFixed(3);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="spawndroid-e2e-demo" tests="1" failures="${failure ? 1 : 0}" time="${secs}">\n  <testcase classname="smoke" name="${name}" time="${secs}">${failure ? `\n    <failure message="${failure.replace(/[<>&"]/g, '_')}"/>\n  ` : ''}</testcase>\n</testsuite>\n`;
mkdirSync(dirname(REPORT), { recursive: true });
writeFileSync(REPORT, xml);
if (failure) {
  console.error('FAILED:', failure);
  process.exit(1);
}
console.log('PASSED');
