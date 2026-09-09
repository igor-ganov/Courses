import { chromium, devices } from '@playwright/test';
const b = await chromium.launch();
const [out, url, w, h] = process.argv.slice(2);
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
await p.goto(url, { waitUntil: 'networkidle' });
for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(90); }
await p.evaluate(() => scrollTo(0, 0));
await p.waitForTimeout(1500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
