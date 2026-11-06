import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { CheckResultItem } from './CheckResultItem';

function result(passed: boolean): MaturityCheckResult {
  return {
    result: passed,
    facts: {
      githubBranchProtected: {
        id: 'githubBranchProtected',
        type: 'boolean',
        description: 'Default branch is protected',
        value: false,
      },
      environments: {
        id: 'environments',
        type: 'object' as never,
        description: '',
        value: { production: { ready: false } } as never,
      },
    },
    check: {
      id: 'branch-protected',
      type: 'json-rules-engine',
      name: 'Default branch protected',
      description: 'The default branch has protection rules.',
      factIds: ['githubBranchProtectionFactRetriever'],
      metadata: {
        rank: 1,
        category: 'Security',
        solution: 'Add a branch protection rule.',
        exp: 0,
      },
      links: [{ title: 'Branch protection', url: 'https://docs.github.com/' }],
    },
  };
}

describe('CheckResultItem', () => {
  it('shows how to pass, the collected values and links for a failing check', async () => {
    await renderInTestApp(
      <CheckResultItem
        result={result(false)}
        collectedAt={{
          githubBranchProtectionFactRetriever: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText('Add a branch protection rule.')).toBeVisible();
    expect(screen.getByText('Default branch is protected')).toBeVisible();
    expect(screen.getByText('false')).toBeVisible();
    // An object fact without a description falls back to its name and is
    // printed as JSON.
    expect(screen.getByText('environments')).toBeVisible();
    expect(screen.getByText(/"production"/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Branch protection/ }),
    ).toBeVisible();
    expect(screen.getByText('Facts collected')).toBeVisible();
  });

  it('starts collapsed for a passing check and leaves out collected values', async () => {
    await renderInTestApp(<CheckResultItem result={result(true)} />);
    expect(screen.getByText('Add a branch protection rule.')).not.toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Add a branch protection rule.')).toBeVisible();
    expect(screen.queryByText('Collected values')).not.toBeInTheDocument();
  });
});
