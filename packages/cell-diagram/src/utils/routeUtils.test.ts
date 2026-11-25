import { getDiagramDataFromProject } from './projectUtils';
import { DiagramModel } from '@projectstorm/react-diagrams';
import { positionSplitNodes, routeLayoutLinks, routeMarks } from './routeUtils';
import { CellBounds } from '../components/Cell/CellNode/CellModel';
import { ComponentLinkModel } from '../components';
import {
  Component,
  ComponentType,
  ConnectionType,
  Links,
  Project,
  Route,
} from '../types';

const component = (id: string, calls: string[] = []): Component => ({
  id,
  version: '1',
  type: ComponentType.SERVICE,
  services: {},
  connections: calls.map(target => ({
    id: `o:p:${target}`,
    type: ConnectionType.HTTP,
  })),
});

const project = (routes: Route[], extra: Component[] = []): Project => ({
  id: 'p',
  name: 'p',
  components: [
    component('storefront', ['reviews']),
    component('reviews'),
    component('reviews@star-ratings'),
    ...extra,
  ],
  routes,
});

const reviewsApi = (
  from: Route['from'],
  branches?: Route['branches'],
): Route => ({
  id: 'reviews-api',
  name: 'Reviews API',
  ...(from && { from }),
  branches: branches ?? [
    { componentId: 'reviews', label: '90%' },
    { componentId: 'reviews@star-ratings', label: '10%' },
  ],
});

type LinkMap = Links[string];

const labels = (links: LinkMap) =>
  [...links.values()]
    .map(l => (l as ComponentLinkModel).label)
    .filter(Boolean)
    .sort();

const portsOf = (links: LinkMap) =>
  [...links.values()].map(l => [
    l.getSourcePort().getOptions().alignment,
    l.getTargetPort().getOptions().alignment,
  ]);

describe('routes in the project diagram', () => {
  it('forks a caller’s line at the Endpoint’s point, left to right', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ componentId: 'storefront' })]),
    );
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(data.links.componentLinks.size).toBe(0);
    expect(labels(data.links.routeLinks)).toEqual(['10%', '90%']);
    expect(portsOf(data.links.routeLinks)).toEqual([
      ['right', 'left'],
      ['right', 'left'],
      ['right', 'left'],
    ]);
  });

  it('draws a one-backend Endpoint through its point, without a label', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ componentId: 'storefront' }, [{ componentId: 'reviews' }]),
      ]),
    );
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(data.links.componentLinks.size).toBe(0);
    expect(labels(data.links.routeLinks)).toEqual([]);
  });

  it('draws one line, with both labels, to a node two backends share', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ componentId: 'storefront' }, [
          { componentId: 'reviews', label: '100%' },
          { componentId: 'reviews', label: 'if cookie beta=yes' },
          { componentId: 'reviews@star-ratings', label: '0%', faded: true },
        ]),
      ]),
    );
    expect(labels(data.links.routeLinks)).toEqual([
      '0%',
      '100% · if cookie beta=yes',
    ]);
    expect(data.links.routeLinks.size).toBe(3);
  });

  it('keeps a backend that also calls the Endpoint', () => {
    const data = getDiagramDataFromProject(
      project(
        [
          reviewsApi({ componentId: 'reviews' }),
          reviewsApi({ componentId: 'storefront' }),
        ],
        [],
      ),
    );
    expect(labels(data.links.routeLinks)).toEqual(['10%', '90%']);
    const [point] = data.nodes.splitNodes.values();
    expect(
      routeLayoutLinks(data.nodes.splitNodes).every(
        l => l.getSourcePort().getNode() !== l.getTargetPort().getNode(),
      ),
    ).toBe(true);
    expect(point).toBeDefined();
  });

  it('keeps a branch that gets nothing, faded', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ componentId: 'storefront' }, [
          { componentId: 'reviews', label: '100%' },
          { componentId: 'reviews@star-ratings', label: '0%', faded: true },
        ]),
      ]),
    );
    expect(labels(data.links.routeLinks)).toEqual(['0%', '100%']);
    const faded = [...data.links.routeLinks.values()].filter(
      l => (l as ComponentLinkModel).faded,
    );
    expect(faded).toHaveLength(1);
  });

  it('gives every caller of an Endpoint one point', () => {
    const data = getDiagramDataFromProject(
      project(
        [
          reviewsApi({ componentId: 'storefront' }),
          reviewsApi({ componentId: 'storefront@redesign' }),
        ],
        [component('storefront@redesign', ['reviews'])],
      ),
    );
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(labels(data.links.routeLinks)).toEqual(['10%', '90%']);
    expect(data.links.componentLinks.size).toBe(0);
  });

  it('brings an external Endpoint in from the north gateway', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ boundary: CellBounds.NorthBound })]),
    );
    expect(data.gateways).toEqual({ internet: true, intranet: false });
    expect(data.links.cellLinks.size).toBe(0);
    expect(portsOf(data.links.routeLinks)).toEqual([
      ['bottom', 'top'],
      ['bottom', 'left'],
      ['bottom', 'left'],
    ]);
  });

  it('brings an internal Endpoint in from the west gateway', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ boundary: CellBounds.WestBound })]),
    );
    expect(data.gateways).toEqual({ internet: false, intranet: true });
    expect(data.links.cellLinks.size).toBe(0);
    expect(portsOf(data.links.routeLinks)[0]).toEqual(['right', 'left']);
  });

  it('gives an Endpoint on both gateways one point', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ boundary: CellBounds.NorthBound }),
        reviewsApi({ boundary: CellBounds.WestBound }),
      ]),
    );
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(portsOf(data.links.routeLinks)).toEqual([
      ['bottom', 'top'],
      ['right', 'left'],
      ['bottom', 'left'],
      ['bottom', 'left'],
    ]);
  });

  it('drops a lone backend the north gateway reaches in from above', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ boundary: CellBounds.NorthBound }, [
          { componentId: 'reviews' },
        ]),
      ]),
    );
    expect(portsOf(data.links.routeLinks)).toEqual([
      ['bottom', 'top'],
      ['bottom', 'top'],
    ]);
  });

  it('keeps points from neighbouring groups off each other', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi(undefined),
        { ...reviewsApi(undefined), id: 'reviews-admin' },
        {
          id: 'shop',
          name: 'Shop',
          branches: [{ componentId: 'storefront' }],
        },
      ]),
    );
    const points = [...data.nodes.splitNodes.values()];
    const ends = (i: number) =>
      [...data.links.routeLinks.values()]
        .filter(l => l.getSourcePort().getNode() === points[i])
        .map(l => l.getTargetPort());
    // Two points on reviews stand at x 160, y 100 and are spread to 30 and
    // 170; the Shop point stands at x 160, y 170 in the next group.
    [...ends(0), ...ends(1)].forEach(port => port.setPosition(400, 100));
    ends(2).forEach(port => port.setPosition(240, 170));
    const model = new DiagramModel();
    model.addAll(...points);

    positionSplitNodes(model);

    const at = points.map(p => [p.getX(), p.getY()]);
    at.forEach(([x, y], i) =>
      at.slice(i + 1).forEach(([x2, y2]) => {
        expect(Math.abs(x - x2) >= 16 || Math.abs(y - y2) >= 16).toBe(true);
      }),
    );
  });

  it('spreads apart points of Endpoints on the same backends', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi(undefined),
        { ...reviewsApi(undefined), id: 'reviews-admin' },
      ]),
    );
    const points = [...data.nodes.splitNodes.values()];
    const model = new DiagramModel();
    model.addAll(...points);

    positionSplitNodes(model);

    expect(points[0].getX()).toBe(points[1].getX());
    expect(Math.abs(points[0].getY() - points[1].getY())).toBe(140);
  });

  it('stands an Endpoint nothing calls before its backends', () => {
    const data = getDiagramDataFromProject(project([reviewsApi(undefined)]));
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(data.links.routeLinks.size).toBe(2);
    expect(data.links.componentLinks.size).toBe(1);
  });

  it('puts several Endpoints on one component side by side', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ boundary: CellBounds.NorthBound }),
        { ...reviewsApi({ componentId: 'storefront' }), id: 'reviews-admin' },
      ]),
    );
    expect(data.nodes.splitNodes.size).toBe(2);
  });

  it('stands a north point before its backends, level with their middle', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ boundary: CellBounds.NorthBound })]),
    );
    const [point] = data.nodes.splitNodes.values();
    const links = [...data.links.routeLinks.values()];
    links
      .find(l => l.getTargetPort().getNode() === point)!
      .getSourcePort()
      .setPosition(300, 0);
    const ends = links
      .filter(l => l.getSourcePort().getNode() === point)
      .map(l => l.getTargetPort());
    ends[0].setPosition(200, 200);
    ends[1].setPosition(200, 400);
    const model = new DiagramModel();
    model.addAll(point);

    positionSplitNodes(model);

    expect(point.getX()).toBe(200 - 240 - point.width / 2);
    expect(point.getY()).toBe(300 - point.height / 2);
  });

  it('keeps a caller’s point beside its backends, halfway across', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ componentId: 'storefront' })]),
    );
    const [point] = data.nodes.splitNodes.values();
    const links = [...data.links.routeLinks.values()];
    links
      .find(l => l.getTargetPort().getNode() === point)!
      .getSourcePort()
      .setPosition(0, 500);
    const ends = links
      .filter(l => l.getSourcePort().getNode() === point)
      .map(l => l.getTargetPort());
    ends[0].setPosition(200, 300);
    ends[1].setPosition(220, 500);
    const model = new DiagramModel();
    model.addAll(point);

    positionSplitNodes(model);

    expect(point.getX()).toBe(100 - point.width / 2);
    expect(point.getY()).toBe(400 - point.height / 2);
  });

  it('lays components out as if the points were not there', () => {
    const data = getDiagramDataFromProject(
      project([reviewsApi({ componentId: 'storefront' })]),
    );
    const layout = routeLayoutLinks(data.nodes.splitNodes);
    expect(portsOf(new Map(layout.map(l => [l.getID(), l])))).toEqual([
      ['right', 'left'],
      ['right', 'left'],
    ]);
    expect(layout.map(l => l.getTargetPort().getNode().getID()).sort()).toEqual(
      [...data.nodes.componentNodes.values()]
        .filter(n => n.getID().includes('reviews'))
        .map(n => n.getID())
        .sort(),
    );
  });

  it('drops branches whose component is not drawn', () => {
    const data = getDiagramDataFromProject(
      project([
        reviewsApi({ boundary: CellBounds.NorthBound }, [
          { componentId: 'reviews', label: '90%' },
          { componentId: 'gone', label: '10%' },
        ]),
      ]),
    );
    expect(data.nodes.splitNodes.size).toBe(1);
    expect(data.links.routeLinks.size).toBe(2);
    expect(labels(data.links.routeLinks)).toEqual([]);
  });

  it('reports the point and copy marks for the legend', () => {
    expect(
      routeMarks(
        project([
          reviewsApi({ componentId: 'storefront' }, [
            { componentId: 'reviews', label: '100%' },
            {
              componentId: 'reviews@star-ratings',
              label: 'copy 10%',
              copy: true,
            },
          ]),
        ]),
      ),
    ).toEqual({ split: true, copy: true });
    expect(routeMarks(project([]))).toEqual({ split: false, copy: false });
  });
});
