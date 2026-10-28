/**
 * Ruleset rule types that restrict changes to a branch. Rules outside this
 * set (e.g. `copilot_code_review`) can be active on a branch without making
 * it protected in the sense these facts describe.
 */
export const PROTECTING_RULE_TYPES = [
  'pull_request',
  'required_status_checks',
  'non_fast_forward',
  'deletion',
  'required_linear_history',
  'required_signatures',
];

/** One entry of `GET /repos/{owner}/{repo}/rules/branches/{branch}`. */
export interface BranchRule {
  type: string;
  parameters?: {
    required_approving_review_count?: number;
    require_code_owner_review?: boolean;
  };
}

/** The subset of `GET .../branches/{branch}/protection` read here. */
export interface ClassicBranchProtection {
  required_pull_request_reviews?: {
    required_approving_review_count?: number;
    require_code_owner_reviews?: boolean;
  };
  required_status_checks?: {
    contexts?: string[];
    checks?: unknown[];
  };
  allow_force_pushes?: { enabled?: boolean };
  allow_deletions?: { enabled?: boolean };
}

export interface BranchProtectionInput {
  branch: string;
  /** `protected` from `GET .../branches/{branch}`. */
  classicProtected: boolean;
  /**
   * Classic protection settings: undefined when the branch has none,
   * `'unknown'` when it has some but they could not be read (the endpoint
   * needs Administration: read).
   */
  classic: ClassicBranchProtection | undefined | 'unknown';
  rules: BranchRule[];
}

/**
 * Combines classic branch protection and repository rulesets into one set of
 * facts, taking whichever of the two is stricter for each setting. When
 * classic settings exist but are unreadable only the facts that do not
 * depend on them are returned, so checks on the rest are skipped rather than
 * evaluated against understated values.
 */
export function branchProtectionFacts(input: BranchProtectionInput) {
  const rules = input.rules.filter(rule =>
    PROTECTING_RULE_TYPES.includes(rule.type),
  );
  const ruleTypes = new Set(rules.map(rule => rule.type));
  const pullRequestRules = rules.filter(rule => rule.type === 'pull_request');

  const facts: Record<string, string | number | boolean> = {
    githubBranch: input.branch,
    githubBranchProtected: input.classicProtected || rules.length > 0,
  };
  if (input.classic === 'unknown') {
    return facts;
  }

  const classic = input.classic;
  const reviews = classic?.required_pull_request_reviews;
  const statusChecks = classic?.required_status_checks;

  facts.githubRequiresPullRequest =
    Boolean(reviews) || pullRequestRules.length > 0;
  facts.githubRequiredApprovingReviewCount = Math.max(
    reviews?.required_approving_review_count ?? 0,
    ...pullRequestRules.map(
      rule => rule.parameters?.required_approving_review_count ?? 0,
    ),
  );
  facts.githubRequiresCodeOwnerReviews =
    Boolean(reviews?.require_code_owner_reviews) ||
    pullRequestRules.some(rule => rule.parameters?.require_code_owner_review);
  facts.githubRequiresStatusChecks =
    (statusChecks?.contexts?.length ?? 0) +
      (statusChecks?.checks?.length ?? 0) >
      0 || ruleTypes.has('required_status_checks');
  facts.githubAllowsForcePushes =
    !ruleTypes.has('non_fast_forward') &&
    (classic ? Boolean(classic.allow_force_pushes?.enabled) : true);
  facts.githubAllowsDeletions =
    !ruleTypes.has('deletion') &&
    (classic ? Boolean(classic.allow_deletions?.enabled) : true);
  return facts;
}
