import { branchProtectionFacts } from './branchProtectionFacts';

describe('branchProtectionFacts', () => {
  it('reports an unprotected branch with real values', () => {
    expect(
      branchProtectionFacts({
        branch: 'main',
        classicProtected: false,
        classic: undefined,
        rules: [],
      }),
    ).toEqual({
      githubBranch: 'main',
      githubBranchProtected: false,
      githubRequiresPullRequest: false,
      githubRequiredApprovingReviewCount: 0,
      githubRequiresCodeOwnerReviews: false,
      githubRequiresStatusChecks: false,
      githubAllowsForcePushes: true,
      githubAllowsDeletions: true,
    });
  });

  it('does not treat non-protecting ruleset rules as protection', () => {
    expect(
      branchProtectionFacts({
        branch: 'main',
        classicProtected: false,
        classic: undefined,
        rules: [{ type: 'copilot_code_review' }],
      }).githubBranchProtected,
    ).toBe(false);
  });

  it('combines classic protection and rulesets, taking the stricter setting', () => {
    expect(
      branchProtectionFacts({
        branch: 'master',
        classicProtected: true,
        classic: {
          required_pull_request_reviews: {
            required_approving_review_count: 1,
            require_code_owner_reviews: false,
          },
          required_status_checks: { contexts: ['DCO'], checks: [] },
          allow_force_pushes: { enabled: true },
          allow_deletions: { enabled: true },
        },
        rules: [
          { type: 'deletion' },
          { type: 'non_fast_forward' },
          {
            type: 'pull_request',
            parameters: {
              required_approving_review_count: 2,
              require_code_owner_review: true,
            },
          },
        ],
      }),
    ).toEqual({
      githubBranch: 'master',
      githubBranchProtected: true,
      githubRequiresPullRequest: true,
      githubRequiredApprovingReviewCount: 2,
      githubRequiresCodeOwnerReviews: true,
      githubRequiresStatusChecks: true,
      githubAllowsForcePushes: false,
      githubAllowsDeletions: false,
    });
  });

  it('omits settings that depend on unreadable classic protection', () => {
    expect(
      branchProtectionFacts({
        branch: 'master',
        classicProtected: true,
        classic: 'unknown',
        rules: [{ type: 'deletion' }],
      }),
    ).toEqual({ githubBranch: 'master', githubBranchProtected: true });
  });

  it('reports ruleset-only protection without classic protection', () => {
    expect(
      branchProtectionFacts({
        branch: 'main',
        classicProtected: false,
        classic: undefined,
        rules: [
          {
            type: 'pull_request',
            parameters: { required_approving_review_count: 1 },
          },
        ],
      }),
    ).toMatchObject({
      githubBranchProtected: true,
      githubRequiresPullRequest: true,
      githubRequiredApprovingReviewCount: 1,
      githubAllowsForcePushes: true,
    });
  });
});
