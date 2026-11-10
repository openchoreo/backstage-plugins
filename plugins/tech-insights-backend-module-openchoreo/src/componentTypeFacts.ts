/** A trait or workflow reference; `kind` is unset when it is the default. */
interface Reference {
  kind?: string;
  name: string;
}

/** The subset of a ComponentType or ClusterComponentType spec read here. */
export interface ComponentTypeSpec {
  workloadType?: string;
  allowedTraits?: Reference[];
  traits?: Reference[];
  allowedWorkflows?: Reference[];
  /** Deprecated upstream in favour of `preRenderValidations`. */
  validations?: unknown[];
  preRenderValidations?: unknown[];
  postRenderValidations?: unknown[];
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

function isExpression(value: unknown): boolean {
  return typeof value === 'string' && value.includes('${');
}

/** `oc_omit()` drops the key from the rendered output. */
function mayOmit(value: unknown): boolean {
  return typeof value === 'string' && /\boc_omit\s*\(/.test(value);
}

/**
 * `Kind/name`, with the CRD's default kind filled in, since a Trait and a
 * ClusterTrait (or a Workflow and a ClusterWorkflow) can share a name.
 */
function qualifiedNames(
  references: Reference[] | undefined,
  defaultKind: string,
): string[] {
  return (references ?? []).map(
    reference => `${reference.kind || defaultKind}/${reference.name}`,
  );
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
 * pod spec, container list or container written as a CEL expression is
 * decided per component, so it is skipped here and needs a component-level
 * check.
 *
 * Within a container that is written out, a limit counts as set when it has
 * any value, since the template always renders one, unless it calls
 * `oc_omit()`, which can drop it. Non-root counts as enforced only through a
 * literal `runAsNonRoot: true` or non-zero `runAsUser`, since an expression
 * can render to anything. Any `privileged` value other than a literal `false`
 * counts as allowing privileged containers, since the type lets components
 * turn it on. A container `securityContext` written as one expression is
 * read as if each of its fields were one: it allows privileged and doesn't
 * enforce non-root, since it can override the pod's setting. A component
 * type with no written-out pod template (a proxy, for example) reports false
 * for all three. Patches from embedded traits aren't applied.
 */
export function componentTypeFacts(
  spec: ComponentTypeSpec,
  { clusterScoped = false }: { clusterScoped?: boolean } = {},
) {
  // A ClusterComponentType may only reference cluster-scoped traits and
  // workflows, so its references default to those kinds.
  const traitKind = clusterScoped ? 'ClusterTrait' : 'Trait';
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
    if (isExpression(container.securityContext)) {
      return false;
    }
    const security = asObject(container.securityContext);
    const nonRoot = security?.runAsNonRoot ?? podSecurity?.runAsNonRoot;
    const user = security?.runAsUser ?? podSecurity?.runAsUser;
    return nonRoot === true || (typeof user === 'number' && user > 0);
  };

  const isSetLimit = (value: unknown) => hasValue(value) && !mayOmit(value);
  const setsLimits = ({ container }: (typeof containers)[number]) => {
    const limits = asObject(asObject(container.resources)?.limits);
    return isSetLimit(limits?.cpu) && isSetLimit(limits?.memory);
  };

  const allowsPrivileged = ({ container }: (typeof containers)[number]) => {
    if (isExpression(container.securityContext)) {
      return true;
    }
    const privileged = asObject(container.securityContext)?.privileged;
    return hasValue(privileged) && privileged !== false;
  };

  return {
    openchoreoComponentTypeResolved: true,
    openchoreoWorkloadType: spec.workloadType ?? '',
    openchoreoAllowedTraits: qualifiedNames(spec.allowedTraits, traitKind),
    openchoreoEmbeddedTraits: qualifiedNames(spec.traits, traitKind),
    openchoreoAllowedWorkflows: qualifiedNames(
      spec.allowedWorkflows,
      'ClusterWorkflow',
    ),
    openchoreoValidationRuleCount:
      (spec.validations?.length ?? 0) +
      (spec.preRenderValidations?.length ?? 0) +
      (spec.postRenderValidations?.length ?? 0),
    openchoreoTemplatesSetResourceLimits:
      containers.length > 0 && containers.every(setsLimits),
    openchoreoTemplatesRunAsNonRoot:
      containers.length > 0 && containers.every(runsAsNonRoot),
    openchoreoTemplatesAllowPrivileged: containers.some(allowsPrivileged),
  };
}
