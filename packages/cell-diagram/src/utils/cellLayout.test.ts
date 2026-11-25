import { DiagramModel } from '@projectstorm/react-diagrams';
import {
  getDiagramDataFromProject,
  getComponentDiagramWidth,
  manualDistribute,
} from './projectUtils';
import { CellModel } from '../components/Cell/CellNode/CellModel';
import { ComponentModel } from '../components/Component/ComponentNode/ComponentModel';
import { SplitModel } from '../components/Split/SplitModel';
import { MAIN_CELL } from '../resources';
import { CellBounds, ComponentType, Project, RouteBranch } from '../types';

const service = (id: string, badge?: string, calls: string[] = []) => ({
  id,
  label: id.split('@')[0],
  badge,
  version: '1',
  type: ComponentType.WEB_APP,
  services: {},
  connections: calls.map(target => ({ id: `default:bookstore:${target}` })),
});

const callers = ['storefront', 'storefront@buy-now', 'storefront@redesign'];

const bookstore = (shop: RouteBranch[]): Project => ({
  id: 'bookstore',
  name: 'bookstore',
  modelVersion: '0.4.0',
  components: [
    ...callers.map(id =>
      service(id, id.split('@')[1] ?? 'main', ['catalog', 'reviews']),
    ),
    service('catalog'),
    service('reviews', 'main'),
    service('reviews@star-ratings', 'star-ratings'),
  ],
  routes: [
    {
      id: 'shop',
      name: 'Shop',
      from: { boundary: CellBounds.NorthBound },
      branches: shop,
    },
    ...callers.map(componentId => ({
      id: 'reviews-api',
      name: 'Reviews API',
      from: { componentId },
      branches: [{ componentId: 'reviews' }],
    })),
  ],
});

/** How far inside the cell's octagon each node's centre stands. */
function slack(project: Project) {
  const data = getDiagramDataFromProject(project);
  const cell = new CellModel(
    MAIN_CELL,
    getComponentDiagramWidth(data),
    data.gateways,
    [],
    [],
  );
  const model = new DiagramModel();
  model.addAll(
    cell,
    ...data.nodes.componentNodes.values(),
    ...data.nodes.emptyNodes.values(),
    ...data.nodes.splitNodes.values(),
    ...data.links.componentLinks.values(),
    ...data.links.cellLinks.values(),
    ...data.links.routeLinks.values(),
  );
  manualDistribute(model);
  const { x, y } = cell.getPosition();
  const w = cell.width;
  const cut = w / (2 + Math.SQRT2);
  return model
    .getNodes()
    .filter(n => n instanceof ComponentModel || n instanceof SplitModel)
    .map(n => {
      const u = n.getPosition().x + n.width / 2 - x;
      const v = n.getPosition().y + n.height / 2 - y;
      const edge = Math.min(u, v, w - u, w - v);
      const corner =
        (Math.min(u + v, w - u + v, u + w - v, 2 * w - u - v) - cut) /
        Math.SQRT2;
      return { id: n.getID(), inside: Math.min(edge, corner) };
    });
}

describe('cell layout', () => {
  it.each([
    ['one backend', [{ componentId: 'storefront' }]],
    [
      'a split',
      [
        { componentId: 'storefront', label: '0%' },
        { componentId: 'storefront@redesign', label: '100%' },
      ],
    ],
  ])(
    'keeps every node and point inside the cell with %s at the gateway',
    (_, shop) => {
      for (const { id, inside } of slack(bookstore(shop))) {
        expect({ id, inside: inside >= 0 }).toEqual({ id, inside: true });
      }
    },
  );

  it('leaves room for a node nothing reaches in a corner', () => {
    const star = slack(bookstore([{ componentId: 'storefront' }])).find(n =>
      n.id.endsWith('reviews@star-ratings'),
    );
    expect(star!.inside).toBeGreaterThanOrEqual(80);
  });
});
