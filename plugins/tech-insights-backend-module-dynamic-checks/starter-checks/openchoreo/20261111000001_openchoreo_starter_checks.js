// @ts-check

// Starter checks for an OpenChoreo portal. Each is inserted once, published,
// and never updated again, so platform engineers can edit, unpublish or
// delete them. New defaults ship as new files in this directory. The data is
// written out here rather than imported, so this file seeds the same checks
// however the code around it changes.

const COMPONENT = { kind: 'Component' };
const COMPONENT_TYPE = { kind: ['ClusterComponentType', 'ComponentType'] };
// Proxy types render no pods, so their container facts are always false.
const COMPONENT_TYPE_WITH_PODS = {
  ...COMPONENT_TYPE,
  'spec.workloadType': ['deployment', 'statefulset', 'cronjob', 'job'],
};

const BRONZE = 1;
const SILVER = 2;
const GOLD = 3;

const DEPLOYMENT = 'openchoreoDeploymentFactRetriever';
const COMPONENT_TYPE_FACTS = 'openchoreoComponentTypeFactRetriever';
const GITHUB = 'githubRepositoryFactRetriever';

/**
 * @param {string} fact
 * @param {string} operator
 * @param {unknown} value
 */
function rule(fact, operator, value) {
  return { conditions: { all: [{ fact, operator, value }] } };
}

const checks = [
  {
    id: 'openchoreo-starter-no-plaintext-secrets',
    name: 'No plain-text secrets in env',
    description:
      'No environment variable whose name looks like a secret holds a plain value, in the Workload or in a release binding override.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: BRONZE,
      category: 'Security',
      solution:
        'Read the value from a secret reference instead of setting it in the env.',
    },
    rule: rule('openchoreoPlainTextSecretEnvCount', 'equal', 0),
  },
  {
    id: 'openchoreo-starter-image-pinned',
    name: 'Image is pinned to a version',
    description:
      'The container image names a digest, or a tag other than a moving one such as latest, main or dev.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution: 'Reference the image by a version tag or a digest.',
    },
    rule: rule('openchoreoImagePinned', 'equal', true),
  },
  {
    id: 'openchoreo-starter-ready-everywhere',
    name: 'Ready in every environment it is deployed to',
    description:
      'The component is deployed, and its release is ready in every environment it is bound to.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Reliability',
      solution:
        'Deploy the component, and fix the environments where its release is not ready.',
    },
    rule: rule('openchoreoReadyInAllEnvironments', 'equal', true),
  },
  {
    id: 'openchoreo-starter-runs-latest-release',
    name: 'Runs its latest release everywhere',
    description:
      'Every environment runs the latest release. Applies to components with autoDeploy on.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Reliability',
      solution: 'Promote the latest release to the environments behind it.',
    },
    rule: rule('openchoreoRunsLatestRelease', 'equal', true),
  },
  {
    id: 'openchoreo-starter-in-production',
    name: 'Deployed to production',
    description:
      'The component is deployed to an environment marked as production.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: GOLD,
      category: 'Reliability',
      solution: 'Promote the component to a production environment.',
    },
    rule: rule('openchoreoDeployedToProduction', 'equal', true),
  },
  {
    id: 'openchoreo-starter-ct-resource-limits',
    name: 'Templates set resource limits',
    description:
      'Every container the component type writes out sets CPU and memory limits.',
    factIds: [COMPONENT_TYPE_FACTS],
    filter: COMPONENT_TYPE_WITH_PODS,
    metadata: {
      rank: BRONZE,
      category: 'Reliability',
      solution:
        "Add resources.limits.cpu and resources.limits.memory to every container in the component type's templates.",
    },
    rule: rule('openchoreoTemplatesSetResourceLimits', 'equal', true),
  },
  {
    id: 'openchoreo-starter-ct-no-privileged',
    name: 'Templates do not allow privileged containers',
    description:
      'No container the component type writes out can run privileged.',
    factIds: [COMPONENT_TYPE_FACTS],
    filter: COMPONENT_TYPE,
    metadata: {
      rank: BRONZE,
      category: 'Security',
      solution:
        "Remove securityContext.privileged from the component type's templates, or set it to false.",
    },
    rule: rule('openchoreoTemplatesAllowPrivileged', 'equal', false),
  },
  {
    id: 'openchoreo-starter-ct-non-root',
    name: 'Templates run containers as non-root',
    description:
      'Every container the component type writes out runs as a non-root user.',
    factIds: [COMPONENT_TYPE_FACTS],
    filter: COMPONENT_TYPE_WITH_PODS,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution:
        "Set securityContext.runAsNonRoot to true, or runAsUser to a non-zero user, on the pod or every container in the component type's templates.",
    },
    rule: rule('openchoreoTemplatesRunAsNonRoot', 'equal', true),
  },
  {
    id: 'openchoreo-starter-gh-branch-protected',
    name: 'Build branch is protected',
    description:
      'The branch the component builds from has classic branch protection or a protecting ruleset.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution: 'Add a branch protection rule or a ruleset for the branch.',
    },
    rule: rule('githubBranchProtected', 'equal', true),
  },
  {
    id: 'openchoreo-starter-gh-no-force-push',
    name: 'Force pushes are blocked',
    description: 'Force pushes to the build branch are not allowed.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution:
        'Turn off force pushes in the branch protection rule, or add a ruleset that blocks them.',
    },
    rule: rule('githubAllowsForcePushes', 'equal', false),
  },
  {
    id: 'openchoreo-starter-gh-codeowners',
    name: 'CODEOWNERS file exists',
    description:
      'The build branch has a CODEOWNERS file in .github/, the repository root or docs/.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution:
        'Add a CODEOWNERS file to .github/, the repository root or docs/.',
    },
    rule: rule('githubHasCodeowners', 'equal', true),
  },
  {
    id: 'openchoreo-starter-gh-security-policy',
    name: 'Security policy exists',
    description:
      "The repository has a SECURITY.md, or the owner's public .github repository has a default one.",
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution:
        "Add a SECURITY.md to the repository, or a default one to the owner's .github repository.",
    },
    rule: rule('githubHasSecurityPolicy', 'equal', true),
  },
  {
    id: 'openchoreo-starter-gh-approving-review',
    name: 'Requires an approving review',
    description:
      'Changes to the build branch need at least one approving review before merging.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: GOLD,
      category: 'Security',
      solution:
        'Require at least one approving review in the branch protection rule or a ruleset.',
    },
    rule: rule('githubRequiredApprovingReviewCount', 'greaterThanInclusive', 1),
  },
];

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  // A check someone already created with one of these ids is theirs to keep.
  await knex('dynamic_checks')
    .insert(
      checks.map(check => ({
        id: check.id,
        type: 'json-rules-engine',
        name: check.name,
        description: check.description,
        fact_ids: JSON.stringify(check.factIds),
        metadata: JSON.stringify(check.metadata),
        filter: JSON.stringify(check.filter),
        rule: JSON.stringify(check.rule),
        status: 'published',
      })),
    )
    .onConflict('id')
    .ignore();
};

// Rolling back would delete checks platform engineers may have edited since.
exports.down = async function down() {};
