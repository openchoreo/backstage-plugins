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
  /**
   * Whether the branch has classic protection: `protected` from
   * `GET .../branches/{branch}`, but false when its protection endpoint
   * reports the branch unprotected (it is covered only by rulesets).
   */
  classicProtected: boolean;
  /**
   * Classic protection settings: undefined when the branch has none,
   * `'unknown'` when it has some but they could not be read (the endpoint
   * needs Administration: read).
   */
  classic: ClassicBranchProtection | undefined | 'unknown';
  /** Active ruleset rules, or `'unknown'` when they could not be read. */
  rules: BranchRule[] | 'unknown';
}

/** Each setting as one source settles it; undefined when it can't tell. */
interface Settings {
  protected?: boolean;
  requiresPullRequest?: boolean;
  approvingReviewCount?: number;
  requiresCodeOwnerReviews?: boolean;
  requiresStatusChecks?: boolean;
  allowsForcePushes?: boolean;
  allowsDeletions?: boolean;
}

function rulesetSettings(input: BranchProtectionInput['rules']): Settings {
  if (input === 'unknown') {
    return {};
  }
  const rules = input.filter(rule => PROTECTING_RULE_TYPES.includes(rule.type));
  const types = new Set(rules.map(rule => rule.type));
  const pullRequestRules = rules.filter(rule => rule.type === 'pull_request');
  return {
    protected: rules.length > 0,
    requiresPullRequest: pullRequestRules.length > 0,
    approvingReviewCount: Math.max(
      0,
      ...pullRequestRules.map(
        rule => rule.parameters?.required_approving_review_count ?? 0,
      ),
    ),
    requiresCodeOwnerReviews: pullRequestRules.some(
      rule => rule.parameters?.require_code_owner_review,
    ),
    requiresStatusChecks: types.has('required_status_checks'),
    allowsForcePushes: !types.has('non_fast_forward'),
    allowsDeletions: !types.has('deletion'),
  };
}

function classicSettings({
  classicProtected,
  classic,
}: BranchProtectionInput): Settings {
  if (classic === 'unknown') {
    return { protected: classicProtected };
  }
  const reviews = classic?.required_pull_request_reviews;
  const statusChecks = classic?.required_status_checks;
  return {
    protected: classicProtected,
    requiresPullRequest: Boolean(reviews),
    approvingReviewCount: reviews?.required_approving_review_count ?? 0,
    requiresCodeOwnerReviews: Boolean(reviews?.require_code_owner_reviews),
    requiresStatusChecks:
      (statusChecks?.contexts?.length ?? 0) +
        (statusChecks?.checks?.length ?? 0) >
      0,
    allowsForcePushes: classic
      ? Boolean(classic.allow_force_pushes?.enabled)
      : true,
    allowsDeletions: classic ? Boolean(classic.allow_deletions?.enabled) : true,
  };
}

/**
 * The stricter of two values, where `strict` is the stricter one. One source
 * giving `strict` settles it, since the other can't loosen it; otherwise
 * both must be known.
 */
function stricter(
  strict: boolean,
  a: boolean | undefined,
  b: boolean | undefined,
): boolean | undefined {
  if (a === strict || b === strict) return strict;
  if (a === undefined || b === undefined) return undefined;
  return !strict;
}

/**
 * Combines classic branch protection and repository rulesets into one set of
 * facts, taking whichever of the two is stricter for each setting. When one
 * source can't be read, a setting is reported only when the other settles it
 * on its own: requiring a pull request, code owner review or status checks,
 * or forbidding force pushes or deletion can't be loosened by the other
 * source. Every other setting is omitted, including the approving review
 * count, which one source only bounds from below, so checks on them are
 * skipped rather than evaluated against understated values.
 */
export function branchProtectionFacts(input: BranchProtectionInput) {
  const classic = classicSettings(input);
  const rulesets = rulesetSettings(input.rules);

  const facts: Record<string, string | number | boolean> = {
    githubBranch: input.branch,
  };
  const set = (name: string, value: boolean | number | undefined) => {
    if (value !== undefined) {
      facts[name] = value;
    }
  };
  set(
    'githubBranchProtected',
    stricter(true, classic.protected, rulesets.protected),
  );
  set(
    'githubRequiresPullRequest',
    stricter(true, classic.requiresPullRequest, rulesets.requiresPullRequest),
  );
  set(
    'githubRequiredApprovingReviewCount',
    classic.approvingReviewCount !== undefined &&
      rulesets.approvingReviewCount !== undefined
      ? Math.max(classic.approvingReviewCount, rulesets.approvingReviewCount)
      : undefined,
  );
  set(
    'githubRequiresCodeOwnerReviews',
    stricter(
      true,
      classic.requiresCodeOwnerReviews,
      rulesets.requiresCodeOwnerReviews,
    ),
  );
  set(
    'githubRequiresStatusChecks',
    stricter(true, classic.requiresStatusChecks, rulesets.requiresStatusChecks),
  );
  set(
    'githubAllowsForcePushes',
    stricter(false, classic.allowsForcePushes, rulesets.allowsForcePushes),
  );
  set(
    'githubAllowsDeletions',
    stricter(false, classic.allowsDeletions, rulesets.allowsDeletions),
  );
  return facts;
}
