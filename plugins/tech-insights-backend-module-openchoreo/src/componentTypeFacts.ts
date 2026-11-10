/** The subset of a ComponentType or ClusterComponentType spec read here. */
export interface ComponentTypeSpec {
  workloadType?: string;
  allowedTraits?: { name: string }[];
  traits?: { name: string }[];
  allowedWorkflows?: { name: string }[];
  validations?: unknown[];
  resources?: {
    id?: string;
    targetPlane?: string;
    template?: unknown;
  }[];
}

type Json = Record<string, any>;

const POD_SPEC_PATHS = new Map([
  ['Pod', ['spec']],
  ['Deployment', ['spec', 'template', 'spec']],
  ['StatefulSet', ['spec', 'template', 'spec']],
  ['DaemonSet', ['spec', 'template', 'spec']],
  ['ReplicaSet', ['spec', 'template', 'spec']],
  ['Job', ['spec', 'template', 'spec']],
  ['CronJob', ['spec', 'jobTemplate', 'spec', 'template', 'spec']],
]);

function asObject(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function asArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(v => asObject(v)) : [];
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** The pod spec a template writes out, if it renders pods and writes one. */
function podSpecOf(template: unknown): Json | undefined {
  const kind = asObject(template)?.kind;
  const path = typeof kind === 'string' ? POD_SPEC_PATHS.get(kind) : undefined;
  return path?.reduce<Json | undefined>(
    (value, key) => asObject(value?.[key]),
    asObject(template),
  );
}

/**
 * Facts about what a component type lets components do and how its
 * templates run them.
 *
 * The container facts cover only what the definition fixes. A template, kind,
 * pod spec, container list, container or securityContext written as a CEL
 * expression is decided per component, so it is skipped here and needs a
 * component-level check.
 *
 * Within a container that is written out, a limit counts as set when it has
 * any value, since the template always renders one. Non-root counts as
 * enforced only through a literal `runAsNonRoot: true` or non-zero
 * `runAsUser`, since an expression can render to anything. Any `privileged`
 * value other than a literal `false` counts as allowing privileged
 * containers, since the type lets components turn it on. A component type
 * with no written-out pod template (a proxy, for example) reports false for
 * all three.
 */
export function componentTypeFacts(spec: ComponentTypeSpec) {
  const podSpecs = (spec.resources ?? [])
    .filter(resource => (resource.targetPlane ?? 'dataplane') === 'dataplane')
    .map(resource => podSpecOf(resource.template))
    .filter((podSpec): podSpec is Json => Boolean(podSpec));

  const containers = podSpecs.flatMap(podSpec =>
    [...asArray(podSpec.containers), ...asArray(podSpec.initContainers)].map(
      container => ({
        container,
        podSecurity: asObject(podSpec.securityContext),
      }),
    ),
  );

  const runsAsNonRoot = ({
    container,
    podSecurity,
  }: (typeof containers)[number]) => {
    const security = asObject(container.securityContext);
    const nonRoot = security?.runAsNonRoot ?? podSecurity?.runAsNonRoot;
    const user = security?.runAsUser ?? podSecurity?.runAsUser;
    return nonRoot === true || (typeof user === 'number' && user > 0);
  };

  const setsLimits = ({ container }: (typeof containers)[number]) => {
    const limits = asObject(asObject(container.resources)?.limits);
    return hasValue(limits?.cpu) && hasValue(limits?.memory);
  };

  const allowsPrivileged = ({ container }: (typeof containers)[number]) => {
    const privileged = asObject(container.securityContext)?.privileged;
    return hasValue(privileged) && privileged !== false;
  };

  return {
    openchoreoComponentTypeResolved: true,
    openchoreoWorkloadType: spec.workloadType ?? '',
    openchoreoAllowedTraits: (spec.allowedTraits ?? []).map(t => t.name),
    openchoreoEmbeddedTraits: (spec.traits ?? []).map(t => t.name),
    openchoreoAllowedWorkflows: (spec.allowedWorkflows ?? []).map(w => w.name),
    openchoreoValidationRuleCount: spec.validations?.length ?? 0,
    openchoreoTemplatesSetResourceLimits:
      containers.length > 0 && containers.every(setsLimits),
    openchoreoTemplatesRunAsNonRoot:
      containers.length > 0 && containers.every(runsAsNonRoot),
    openchoreoTemplatesAllowPrivileged: containers.some(allowsPrivileged),
  };
}
