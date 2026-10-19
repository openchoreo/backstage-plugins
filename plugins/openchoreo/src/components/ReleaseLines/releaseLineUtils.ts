import type { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  type ReleaseLineOverrides,
  type ReleaseLineResource,
  type ReleaseLineSummary,
} from '@openchoreo/backstage-plugin-common';

/** Release line names are Kubernetes object names (DNS-1123 labels). */
export const RELEASE_LINE_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/** Validation message for a release line name, or undefined when valid. */
export function validateReleaseLineName(name: string): string | undefined {
  if (!name) {
    return 'Name is required';
  }
  if (name.length > 63) {
    return 'Name must be at most 63 characters';
  }
  if (!RELEASE_LINE_NAME_PATTERN.test(name)) {
    return 'Use lowercase letters, numbers and hyphens, starting and ending with a letter or number';
  }
  return undefined;
}

/** Catalog path of a release line entity. */
export function releaseLineEntityPath(
  namespace: string,
  releaseLineName: string,
): string {
  return `/catalog/${namespace}/releaseline/${releaseLineName}`;
}

/** Catalog path of a component entity's tab. */
export function componentEntityPath(entity: Entity, tab?: string): string {
  const base = `/catalog/${entity.metadata.namespace ?? 'default'}/component/${
    entity.metadata.name
  }`;
  return tab ? `${base}/${tab}` : base;
}

/** The properties a release line can override, picked from a spec. */
export function pickOverridableProperties(
  spec: Record<string, unknown> | undefined,
): ReleaseLineOverrides {
  if (!spec) {
    return {};
  }
  const workflow = spec.workflow as
    | { parameters?: Record<string, unknown> }
    | undefined;
  return {
    ...(spec.autoDeploy !== undefined && {
      autoDeploy: spec.autoDeploy as boolean,
    }),
    ...(spec.parameters !== undefined && {
      parameters: spec.parameters as Record<string, unknown>,
    }),
    ...(spec.traits !== undefined && {
      traits: spec.traits as ReleaseLineOverrides['traits'],
    }),
    ...(workflow?.parameters !== undefined && {
      workflow: { parameters: workflow.parameters },
    }),
  };
}

/**
 * The catalog entity of a release line listed under a component, enough for
 * the shared row delete button, its permission check and the delete dispatch.
 */
export function releaseLineRowEntity(
  component: Entity,
  line: ReleaseLineSummary,
): Entity {
  const namespace = component.metadata.namespace ?? 'default';
  const annotations = component.metadata.annotations ?? {};
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ReleaseLine',
    metadata: {
      name: line.name,
      namespace,
      title: `${component.metadata.name}:${line.name}`,
      labels: { [CHOREO_LABELS.MANAGED]: 'true' },
      annotations: {
        [CHOREO_ANNOTATIONS.NAMESPACE]:
          annotations[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespace,
        [CHOREO_ANNOTATIONS.PROJECT]:
          annotations[CHOREO_ANNOTATIONS.PROJECT] ?? '',
        [CHOREO_ANNOTATIONS.COMPONENT]:
          annotations[CHOREO_ANNOTATIONS.COMPONENT] ?? component.metadata.name,
        [CHOREO_ANNOTATIONS.RELEASE_LINE]: line.name,
      },
    },
    spec: {
      component: `component:${namespace}/${component.metadata.name}`,
    },
  };
}

/** Metadata the server manages, left out of the editable YAML. */
const SERVER_MANAGED_METADATA = [
  'uid',
  'resourceVersion',
  'generation',
  'creationTimestamp',
  'deletionTimestamp',
  'managedFields',
];

/**
 * A release line as shown in its YAML editor: the server-managed metadata and
 * the read-only status are left out.
 */
export function toEditableReleaseLine(
  releaseLine: ReleaseLineResource,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...releaseLine.metadata };
  for (const field of SERVER_MANAGED_METADATA) {
    delete metadata[field];
  }
  return {
    apiVersion: releaseLine.apiVersion ?? 'openchoreo.dev/v1alpha1',
    kind: releaseLine.kind ?? 'ReleaseLine',
    metadata,
    spec: releaseLine.spec ?? {},
  };
}

const SPEC_KEYS = new Set([
  'owner',
  'autoDeploy',
  'parameters',
  'traits',
  'workflow',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates an edited release line against the one being edited: it must stay
 * the same ReleaseLine of the same component, and its spec may only hold the
 * properties a release line can override. Annotations (such as the
 * `openchoreo.dev/description`) and labels may change.
 */
export function parseReleaseLineYaml(
  value: unknown,
  current: ReleaseLineResource,
): ReleaseLineResource {
  if (!isObject(value)) {
    throw new Error('The release line must be a YAML mapping');
  }
  if (value.kind !== undefined && value.kind !== 'ReleaseLine') {
    throw new Error('kind must be ReleaseLine');
  }
  const metadata = value.metadata;
  if (!isObject(metadata) || metadata.name !== current.metadata.name) {
    throw new Error(
      `metadata.name must stay ${current.metadata.name}; a release line cannot be renamed`,
    );
  }
  for (const field of ['annotations', 'labels'] as const) {
    const map = metadata[field];
    if (
      map !== undefined &&
      (!isObject(map) || Object.values(map).some(v => typeof v !== 'string'))
    ) {
      throw new Error(`metadata.${field} must map names to strings`);
    }
  }

  const spec = value.spec ?? {};
  if (!isObject(spec)) {
    throw new Error('spec must be a mapping');
  }
  const unknownKeys = Object.keys(spec).filter(key => !SPEC_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `A release line can only override autoDeploy, parameters, traits and workflow. ` +
        `Edit ${unknownKeys.join(', ')} on the component's Definition page.`,
    );
  }
  const currentOwner = current.spec?.owner;
  const owner = spec.owner ?? currentOwner;
  if (
    !isObject(owner) ||
    owner.componentName !== currentOwner?.componentName ||
    owner.projectName !== currentOwner?.projectName
  ) {
    throw new Error(
      'spec.owner cannot change; a release line belongs to its component',
    );
  }
  if (spec.autoDeploy !== undefined && typeof spec.autoDeploy !== 'boolean') {
    throw new Error('spec.autoDeploy must be true or false');
  }
  if (spec.parameters !== undefined && !isObject(spec.parameters)) {
    throw new Error('spec.parameters must be a mapping');
  }
  if (spec.traits !== undefined && !Array.isArray(spec.traits)) {
    throw new Error('spec.traits must be a list');
  }
  if (spec.workflow !== undefined) {
    if (
      !isObject(spec.workflow) ||
      Object.keys(spec.workflow).some(key => key !== 'parameters')
    ) {
      throw new Error('spec.workflow can only set parameters');
    }
  }

  return {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ReleaseLine',
    metadata: {
      name: current.metadata.name,
      namespace: current.metadata.namespace,
      annotations: (metadata.annotations as Record<string, string>) ?? {},
      ...(metadata.labels !== undefined && { labels: metadata.labels }),
    },
    spec: {
      ...(spec as ReleaseLineOverrides),
      owner: owner as { projectName: string; componentName: string },
    },
  };
}
