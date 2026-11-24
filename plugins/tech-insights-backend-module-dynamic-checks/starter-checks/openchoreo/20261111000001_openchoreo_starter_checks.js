// @ts-check

// Starter checks for an OpenChoreo portal. Each is inserted once, published,
// and never updated again, so platform engineers can edit, unpublish or
// delete them. The data is written out here rather than imported, so this
// file seeds the same checks however the code around it changes.
//
// Databases that already ran this file won't run it again, so editing a check
// here only changes what databases that haven't run it get. Never rename or
// delete a file here once it has shipped: knex refuses to migrate when its
// ledger names a file that's gone.

// A release line is held to the same checks as its component's main line,
// judged on its own facts.
const COMPONENT = { kind: ['Component', 'ReleaseLine'] };
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
      "In every environment the line is bound to, no environment variable whose name looks like a secret holds a plain value, in the released Workload or in that environment's overrides.",
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: BRONZE,
      category: 'Security',
      solution:
        'Read the value from a secret reference instead of setting it in the env.',
    },
    rule: {
      conditions: {
        all: [
          {
            fact: 'openchoreoEnvironmentDeployments',
            path: '$[*].plainTextSecretEnvVarCount',
            operator: 'everyFact:equal',
            value: 0,
          },
        ],
      },
    },
  },
  {
    id: 'openchoreo-starter-image-pinned',
    name: 'Image is pinned to a version',
    description:
      'In every environment the line is bound to, the released container image names a digest, or a tag other than a moving one such as latest, main or dev.',
    factIds: [DEPLOYMENT],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution: 'Reference the image by a version tag or a digest.',
    },
    rule: {
      conditions: {
        all: [
          {
            fact: 'openchoreoEnvironmentDeployments',
            path: '$[*].isImagePinned',
            operator: 'everyFact:equal',
            value: true,
          },
        ],
      },
    },
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
    filter: COMPONENT_TYPE_WITH_PODS,
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
      'The branch the component builds from has classic branch protection or a protecting ruleset, and force pushes to it are blocked.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: SILVER,
      category: 'Security',
      solution:
        'Add a branch protection rule or a ruleset for the branch, with force pushes left blocked.',
    },
    rule: {
      conditions: {
        all: [
          { fact: 'githubBranchProtected', operator: 'equal', value: true },
          { fact: 'githubAllowsForcePushes', operator: 'equal', value: false },
        ],
      },
    },
  },
  {
    id: 'openchoreo-starter-gh-codeowners',
    name: 'CODEOWNERS file exists',
    description:
      'The build branch has a CODEOWNERS file in .github/, the repository root or docs/.',
    factIds: [GITHUB],
    filter: COMPONENT,
    metadata: {
      rank: BRONZE,
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
      category: 'Documentation',
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
