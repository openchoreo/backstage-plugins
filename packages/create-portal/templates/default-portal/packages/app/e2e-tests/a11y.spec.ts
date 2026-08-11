import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Subset of the 18 routes scanned in the Phase B audit
// (audit-artifacts/axe/_summary.json). Six high-traffic routes are enough
// to catch regressions on the patterns Phase 1 + Phase 2 + Phase 3 fixed.
//
// Run locally: start the portal (`yarn start`) against an OpenChoreo
// runtime, then `PLAYWRIGHT_URL=http://localhost:3000 yarn test:e2e:a11y`.
// Not wired to CI yet — the portal needs a live OpenChoreo backend
// (catalog, IDP, observer, k8s) to render any post-login route, which
// GH Actions can't provide today. Wire back into CI once we have a
// portable runtime story (mocked APIs / fixture container / …).
const ROUTES = [
  { id: 'home', path: '/' },
  { id: 'catalog', path: '/catalog' },
  { id: 'catalog-import', path: '/catalog-import' },
  { id: 'settings-general', path: '/settings/general' },
  { id: 'create', path: '/create' },
  { id: 'search', path: '/search?query=&types%5B%5D=software-catalog' },
];

// WCAG 2.1 AA is the standard cited in the BITV §7 accessibility statement.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

// The portal puts a sign-in card on `/` before any protected route. Two
// flavours exist:
//   - Guest mode (`openchoreo.features.auth.enabled=false`) — the card
//     auto-signs the user in and the `Enter` button appears momentarily.
//   - OAuth mode (default) — a `Sign In` button kicks an OIDC flow.
// We only want to scan the post-login layout, so dismiss whichever card
// is present. If neither button shows up, the session is already live
// and we proceed.
async function dismissSignIn(page: import('@playwright/test').Page) {
  for (const name of ['Enter', 'Sign In'] as const) {
    const btn = page.getByRole('button', { name });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

// If the page is still showing the sign-in card after dismissal (e.g. OAuth
// redirected and we landed on the IDP), we can't scan content meaningfully.
// Detect by looking for the sidebar — when it's missing, the session never
// reached the post-login layout.
async function isPostLogin(page: import('@playwright/test').Page) {
  const sidebar = page
    .locator('nav[aria-label*="sidebar" i], a[href="/"][aria-label="Home"]')
    .first();
  return sidebar.isVisible().catch(() => false);
}

for (const route of ROUTES) {
  test(`axe — ${route.id}`, async ({ page }, testInfo) => {
    await page.goto(route.path);
    await dismissSignIn(page);
    if (page.url().endsWith('/') && route.path !== '/') {
      await page.goto(route.path);
    }
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // Fail loudly if we're still on the sign-in card — silent passes against
    // an empty card are worse than a red test, because they normalise
    // "the spec is clean" while no content was actually scanned.
    if (!(await isPostLogin(page))) {
      throw new Error(
        `axe spec could not reach the post-login layout for ${route.id}; ` +
          'make sure the portal is running and you are signed in.',
      );
    }

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    await testInfo.attach(`axe-${route.id}.json`, {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    const critical = results.violations.filter(v => v.impact === 'critical');
    const serious = results.violations.filter(v => v.impact === 'serious');

    if (critical.length || serious.length) {
      const lines = [...critical, ...serious].map(
        v => `  ${v.id} (${v.impact}, ${v.nodes.length}): ${v.help}`,
      );
      // Print so the workflow log shows the violation list without needing
      // to download the JSON attachment.
      // eslint-disable-next-line no-console
      console.log(
        `[a11y:${route.id}] critical/serious findings:\n${lines.join('\n')}`,
      );
    }

    // Soft expects so the full per-route report comes back in one run
    // rather than bailing on the first failing route.
    expect.soft(critical, 'critical violations').toEqual([]);
    expect.soft(serious, 'serious violations').toEqual([]);
  });
}
