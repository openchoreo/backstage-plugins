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
    template?: Record<string, unknown>;
  }[];
}

type Json = Record<string, any>;

const POD_TEMPLATE_KINDS = new Set([
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ReplicaSet',
  'Job',
]);

function asObject(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function asArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(v => asObject(v)) : [];
}

/** The pod spec a workload template renders, if it renders one. */
function podSpecOf(template: Json): Json | undefined {
  const spec = asObject(template.spec);
  switch (template.kind) {
    case 'Pod':
      return spec;
    case 'CronJob':
      return asObject(
        asObject(asObject(asObject(spec?.jobTemplate)?.spec)?.template)?.spec,
      );
    default:
      return POD_TEMPLATE_KINDS.has(template.kind)
        ? asObject(asObject(spec?.template)?.spec)
        : undefined;
  }
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Whether a container list is an expression, or holds one, so the
 * containers it renders can't be read from the template.
 */
function hasOpaqueContainers(podSpec: Json): boolean {
  return [podSpec.containers, podSpec.initContainers].some(list =>
    Array.isArray(list) ? list.some(entry => !asObject(entry)) : hasValue(list),
  );
}

/**
 * Facts about what a component type lets components do and how its
 * templates run them.
 *
 * Template values are often CEL expressions such as
 * `${parameters.privileged}`. A security setting counts as enforced only when
 * it is a literal value, since an expression can render to anything, while
 * any value other than a literal `false` counts as allowing privileged
 * containers. A container list that is, or holds, an expression is treated
 * the same way: limits and non-root count as not enforced, and privileged
 * containers as allowed. A component type with no pod-rendering template (a
 * proxy, for example) reports false for the enforcement facts.
 */
export function componentTypeFacts(spec: ComponentTypeSpec) {
  const podSpecs = (spec.resources ?? [])
    .filter(resource => (resource.targetPlane ?? 'dataplane') === 'dataplane')
    .map(resource => asObject(resource.template))
    .map(template => (template ? podSpecOf(template) : undefined))
    .filter((podSpec): podSpec is Json => Boolean(podSpec));

  const containers = podSpecs.flatMap(podSpec =>
    [...asArray(podSpec.containers), ...asArray(podSpec.initContainers)].map(
      container => ({
        container,
        podSecurity: asObject(podSpec.securityContext),
      }),
    ),
  );

  const opaque = podSpecs.some(hasOpaqueContainers);

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
      !opaque && containers.length > 0 && containers.every(setsLimits),
    openchoreoTemplatesRunAsNonRoot:
      !opaque && containers.length > 0 && containers.every(runsAsNonRoot),
    openchoreoTemplatesAllowPrivileged:
      opaque || containers.some(allowsPrivileged),
  };
}
