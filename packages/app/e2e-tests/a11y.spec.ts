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
// (audit-artifacts/axe/_summary.json). Five high-traffic routes are enough
// to catch regressions on the patterns Phase 1 + Phase 2 fixed.
const ROUTES = [
  { id: 'home', path: '/' },
  { id: 'catalog', path: '/catalog' },
  { id: 'catalog-import', path: '/catalog-import' },
  { id: 'settings-general', path: '/settings/general' },
  { id: 'create', path: '/create' },
];

// WCAG 2.1 AA is the standard cited in the BITV §7 accessibility statement.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

// The dev/staging app puts a guest sign-in card on `/`. Each fresh page hits
// it first; clicking Enter lands us on the post-login layout that the audit
// actually scanned.
async function dismissGuestLogin(page: import('@playwright/test').Page) {
  const enter = page.getByRole('button', { name: 'Enter' });
  if (await enter.isVisible().catch(() => false)) {
    await enter.click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
  }
}

for (const route of ROUTES) {
  test(`axe — ${route.id}`, async ({ page }, testInfo) => {
    await page.goto(route.path);
    await dismissGuestLogin(page);
    if (page.url().endsWith('/') && route.path !== '/') {
      await page.goto(route.path);
    }
    await page.waitForLoadState('networkidle').catch(() => undefined);

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
