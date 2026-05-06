#!/usr/bin/env node
// Crawl 9 specific Skool classroom lessons using Rob's logged-in Chrome profile
// (copied to fleet state dir). Saves each as markdown.

const { chromium } = require('playwright');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = '/Users/robert/.cortextos/default/state/.browser-profiles/skool-crawl';
const CLASSROOM_URL = 'https://www.skool.com/agent-architects/classroom/93e0ef05';
const OUTPUT_DIR = '/Users/robert/cortextos/orgs/click-to-acquire/knowledge-base/skool-agent-architects';

// Exact visible names from Rob's screenshot
const TARGET_LESSONS = [
  'Skill-Optimizer',
  'StatusLine Builder',
  'local-ultrareview Skill',
  'Claude Code /schedule Guide',
  'Claude Managed Agents',
  'Social Media Insights Skill',
  'Agent Security Audit Skill',
  'Infisical Vault Skill',
  'Blotato Posting Skill',
];

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const td = new TurndownService({ codeBlockStyle: 'fenced', headingStyle: 'atx' });
  // Drop noise nodes — Skool injects buttons/icons that aren't lesson content
  td.remove(['button', 'svg', 'nav']);

  console.log(`[skool-crawl] launching Chrome with profile: ${PROFILE_DIR}`);
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1400, height: 1000 },
    // Drop --use-mock-keychain so Chrome can decrypt cookies via the real Keychain.
    // Drop --enable-automation so Skool doesn't see the automation banner / fingerprint.
    ignoreDefaultArgs: ['--use-mock-keychain', '--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--password-store=keychain',
    ],
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  console.log(`[skool-crawl] navigating to classroom: ${CLASSROOM_URL}`);
  await page.goto(CLASSROOM_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  // Skool's React app renders the lesson list a beat after hydration
  await page.waitForTimeout(3500);

  // Verify auth — the URL should be the classroom, not /login
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
    console.error(`[skool-crawl] AUTH FAILED — landed on ${currentUrl}`);
    console.error('[skool-crawl] Profile copy may have lost session. Aborting.');
    await ctx.close();
    process.exit(2);
  }
  console.log(`[skool-crawl] landed at: ${currentUrl}`);

  // Diagnostic: dump what lesson titles the left rail actually shows
  const visibleLessons = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[role="button"], a, li, div'))
      .map((el) => (el.innerText || '').trim().split('\n')[0])
      .filter((t) => t.length > 3 && t.length < 80);
    return Array.from(new Set(items)).slice(0, 200);
  });
  console.log(`[skool-crawl] left-rail candidates: ${visibleLessons.length}`);

  const results = [];
  for (const target of TARGET_LESSONS) {
    console.log(`\n[skool-crawl] === ${target} ===`);
    try {
      // Click the lesson by exact visible text (Skool wraps each in a link/button)
      const locator = page.getByText(target, { exact: false }).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 });
      await locator.click();
      await page.waitForTimeout(2500); // let the right-pane render

      // Lesson body: Skool typically renders the lesson into a main content region.
      // Try a few selectors; fall back to whichever is biggest.
      const html = await page.evaluate(() => {
        // Heuristic: find the largest container that isn't the whole body
        const candidates = Array.from(
          document.querySelectorAll('article, [role="main"], main, [class*="lesson"], [class*="Lesson"], [class*="content"], [class*="Content"]')
        );
        let best = null;
        let bestSize = 0;
        for (const c of candidates) {
          const s = (c.innerText || '').length;
          if (s > bestSize && s > 200) {
            bestSize = s;
            best = c;
          }
        }
        return best ? best.outerHTML : document.body.outerHTML;
      });

      const md = td.turndown(html);
      const slug = slugify(target);
      const outPath = path.join(OUTPUT_DIR, `${slug}.md`);
      const finalMd = `# ${target}\n\n_Source: Skool — Agent Architects classroom (crawled ${new Date().toISOString()})_\n\n---\n\n${md}\n`;
      fs.writeFileSync(outPath, finalMd);
      console.log(`[skool-crawl]   ✓ saved ${outPath} (${finalMd.length} chars)`);
      results.push({ target, ok: true, chars: finalMd.length, path: outPath });
    } catch (err) {
      console.error(`[skool-crawl]   ✗ ${target}: ${err.message}`);
      results.push({ target, ok: false, error: err.message });
    }
  }

  // Summary
  console.log('\n[skool-crawl] === SUMMARY ===');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.target}${r.ok ? `  (${r.chars} chars)` : `  ERR: ${r.error}`}`);
  }

  await ctx.close();
  process.exit(0);
})();
