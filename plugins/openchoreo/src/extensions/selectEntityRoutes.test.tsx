import type { Entity } from '@backstage/catalog-model';
import type { OpenChoreoRoute } from './OpenChoreoCatalogEntityPageContent';
import { selectEntityRoutes } from './selectEntityRoutes';

const managed = { 'openchoreo.io/managed': 'true' };

const component = (releaseLinesEnabled = false): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'hello',
    namespace: 'default',
    labels: managed,
    annotations: releaseLinesEnabled
      ? { 'openchoreo.io/release-lines-enabled': 'true' }
      : {},
  },
  spec: { type: 'service' },
});

const releaseLine: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ReleaseLine',
  metadata: { name: 'next', namespace: 'default', labels: managed },
  spec: { component: 'component:default/hello' },
};

const isKind =
  (...kinds: string[]) =>
  (entity: Entity) =>
    kinds.includes(entity.kind.toLowerCase());

const route = (
  id: string,
  path: string,
  group?: string,
  filter?: (entity: Entity) => boolean,
): OpenChoreoRoute => ({
  id,
  path,
  title: id,
  group,
  element: <div>{id}</div>,
  if: filter,
});

const routes = [
  route('overview', '/'),
  route('definition', '/definition', 'definition', isKind('component')),
  route(
    'release-line-definition',
    '/definition',
    'definition',
    isKind('releaseline'),
  ),
  route('build', '/workflows', 'build', isKind('component')),
  route('deploy', '/environments', 'deploy', isKind('component')),
  route('docs', '/docs'),
  route('project-deploy', '/deploy', 'deploy', isKind('system')),
];

const ids = (selected: OpenChoreoRoute[]) => selected.map(r => r.id);

describe('selectEntityRoutes', () => {
  it('keeps every tab of a component without release lines', () => {
    expect(ids(selectEntityRoutes(routes, component()))).toEqual(ids(routes));
  });

  it('keeps only Overview and Definition for a component with release lines', () => {
    expect(ids(selectEntityRoutes(routes, component(true)))).toEqual([
      'overview',
      'definition',
      'release-line-definition',
    ]);
  });

  it('gives a release line its own tabs plus its component tabs', () => {
    const selected = selectEntityRoutes(routes, releaseLine, component(true));

    expect(ids(selected)).toEqual([
      'overview',
      'definition',
      'release-line-definition',
      'build',
      'deploy',
      'docs',
    ]);
    // Component tabs were matched against the component; the page must not
    // re-filter them against the release line.
    expect(selected.find(r => r.id === 'build')?.if).toBeUndefined();
  });

  it('shows only the release line tabs until its component loads', () => {
    expect(ids(selectEntityRoutes(routes, releaseLine))).toEqual([
      'overview',
      'definition',
      'release-line-definition',
    ]);
  });
});
