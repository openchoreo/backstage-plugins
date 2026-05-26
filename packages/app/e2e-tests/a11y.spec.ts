/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Subset of the 18 routes scanned in the Phase B audit
// (audit-artifacts/axe/_summary.json). Six high-traffic routes are enough
// to catch regressions on the patterns Phase 1 + Phase 2 + Phase 3 fixed.
// `/search` was added in the Phase 3 tail so the `list`-rule fix in
// SearchResultItem stays gated by the advisory CI job.
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
    // "the gate is clean" while no content was actually scanned.
    if (!(await isPostLogin(page))) {
      throw new Error(
        `axe gate could not reach the post-login layout for ${route.id}; ` +
          'check OPENCHOREO_FEATURES_AUTH_ENABLED / app-config.local.yaml.',
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

    // Phase 3 lands the gate as advisory (`continue-on-error: true` in CI).
    // We still assert here so test runs *flag* regressions in the local
    // report, even when CI ignores them. Once the violation curve flattens,
    // flip the workflow to blocking and these expects start enforcing.
    expect.soft(critical, 'critical violations').toEqual([]);
    expect.soft(serious, 'serious violations').toEqual([]);
  });
}
