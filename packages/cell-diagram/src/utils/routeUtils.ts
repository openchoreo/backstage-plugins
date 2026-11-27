import {
  DiagramModel,
  PortModel,
  PortModelAlignment,
} from '@projectstorm/react-diagrams';
import { CellLinkModel } from '../components/Cell/CellLink/CellLinkModel';
import { ComponentLinkModel } from '../components/Component/ComponentLink/ComponentLinkModel';
import { ComponentModel } from '../components/Component/ComponentNode/ComponentModel';
import { EmptyModel } from '../components/Cell/EmptyNode/EmptyModel';
import { SplitModel } from '../components/Split/SplitModel';
import { CellBounds } from '../components/Cell/CellNode/CellModel';
import {
  getCellLinkName,
  getEmptyNodeName,
  getNodePortId,
} from '../components/Cell/cell-util';
import {
  getComponentLinkName,
  getComponentNameById,
} from '../components/Component/component-node-util';
import {
  CommonModel,
  Observations,
  Project,
  Route,
  RouteBranch,
} from '../types';
import { MAIN_CELL, SPLIT_DOT_WIDTH } from '../resources/constants';

export interface RouteDiagramData {
  splitNodes: Map<string, SplitModel>;
  routeLinks: Map<string, ComponentLinkModel>;
}

interface Source {
  node: ComponentModel | EmptyModel;
  port: PortModel;
  /** The side a plain line from this source enters a backend by. */
  side: 'top' | 'left';
  boundary?: CellBounds;
}

function sourceOf(
  from: Route['from'],
  emptyNodes: Map<string, EmptyModel>,
  nodes: Map<string, CommonModel>,
): Source | undefined {
  if (!from) return undefined;
  if ('boundary' in from) {
    const { boundary } = from;
    if (
      boundary !== CellBounds.NorthBound &&
      boundary !== CellBounds.WestBound
    ) {
      return undefined;
    }
    const empty = emptyNodes.get(getEmptyNodeName(boundary));
    const north = boundary === CellBounds.NorthBound;
    const port = empty?.getPort(
      getNodePortId(
        empty.getID(),
        north ? PortModelAlignment.BOTTOM : PortModelAlignment.RIGHT,
      ),
    );
    if (!empty || !port) return undefined;
    return { node: empty, port, side: north ? 'top' : 'left', boundary };
  }
  const caller = nodes.get(getComponentNameById(from.componentId));
  if (!(caller instanceof ComponentModel)) return undefined;
  const port = caller.getPort(`right-${caller.getID()}`);
  return port ? { node: caller, port, side: 'left' } : undefined;
}

function connect<L extends ComponentLinkModel | CellLinkModel>(
  link: L,
  source: PortModel,
  target: PortModel,
): L {
  link.setSourcePort(source);
  link.setTargetPort(target);
  link.setSourceNode(source.getNode().getID());
  link.setTargetNode(target.getNode().getID());
  return link;
}

/**
 * Draws each Endpoint through one point that forks to its backends. The
 * north gateway comes down into the point, and a caller or the west gateway
 * comes in from the left; an Endpoint nothing calls still draws its point.
 * The point forks into each backend from its left, or, for a lone backend
 * the north gateway reaches, from above. Branches carry labels when there
 * are several, a branch that gets nothing is faded, and a copy is dashed. A
 * plain line the Endpoint replaces is removed, and its observations move to
 * the line into the point.
 */
export function generateRouteDiagram(
  project: Project,
  nodes: Map<string, CommonModel>,
  emptyNodes: Map<string, EmptyModel>,
  componentLinks: Map<string, ComponentLinkModel>,
  cellLinks: Map<string, CellLinkModel>,
): RouteDiagramData {
  const data: RouteDiagramData = {
    splitNodes: new Map(),
    routeLinks: new Map(),
  };

  const endpoints = new Map<string, Route[]>();
  project.routes?.forEach(route => {
    endpoints.set(route.id, [...(endpoints.get(route.id) ?? []), route]);
  });

  endpoints.forEach(routes => {
    const sources = routes.flatMap(route => {
      const source = sourceOf(route.from, emptyNodes, nodes);
      return source ? [source] : [];
    });
    if (!sources.length && routes.some(route => route.from)) return;
    const [route] = routes;
    // One line per backend node: backends on the same node, such as one by
    // weight and one by condition, share it and its label. A caller that is
    // also a backend keeps its branch, so the cycle shows.
    const byNode = new Map<ComponentModel, RouteBranch[]>();
    route.branches.forEach(branch => {
      const node = nodes.get(getComponentNameById(branch.componentId));
      if (node instanceof ComponentModel) {
        byNode.set(node, [...(byNode.get(node) ?? []), branch]);
      }
    });
    const branches = [...byNode].map(([node, same]) => ({
      node,
      branch: {
        componentId: same[0].componentId,
        label:
          same
            .map(b => b.label)
            .filter(Boolean)
            .join(' · ') || undefined,
        faded: same.every(b => b.faded),
        copy: same.every(b => b.copy),
      },
    }));
    if (!branches.length) return;

    const down = sources.some(source => source.side === 'top');
    const entry = down && branches.length === 1 ? 'top' : 'left';
    const split = new SplitModel(route);
    const splitId = split.getID();
    const outPort = split.getPort(`${down ? 'bottom' : 'right'}-${splitId}`);
    if (!outPort) return;
    data.splitNodes.set(splitId, split);

    sources.forEach(source => {
      const inPort = split.getPort(`${source.side}-${splitId}`);
      if (!inPort) return;
      const inLink = connect(
        new ComponentLinkModel(
          getComponentLinkName(source.port.getID(), inPort.getID()),
        ),
        source.port,
        inPort,
      );
      inLink.hideArrow = true;
      const plain: Map<string, ComponentLinkModel | CellLinkModel> =
        source.boundary ? cellLinks : componentLinks;
      const observations: Observations[] = [];
      branches.forEach(({ node }) => {
        const plainPort = node.getPort(`${source.side}-${node.getID()}`);
        if (!plainPort) return;
        const id = source.boundary
          ? getCellLinkName(source.port.getID(), plainPort.getID())
          : getComponentLinkName(source.port.getID(), plainPort.getID());
        const existing = plain.get(id);
        if (!existing) return;
        if (existing.observations?.length) {
          observations.push(...existing.observations);
        }
        existing.remove();
        plain.delete(id);
      });
      if (observations.length) inLink.setObservations(observations, false);
      data.routeLinks.set(inLink.getID(), inLink);
    });

    branches.forEach(({ branch, node }) => {
      const port = node.getPort(`${entry}-${node.getID()}`);
      if (!port) return;
      const link = connect(
        new ComponentLinkModel(
          getComponentLinkName(outPort.getID(), port.getID()),
        ),
        outPort,
        port,
      );
      link.label = branches.length > 1 ? branch.label : undefined;
      link.faded = branch.faded;
      link.copy = branch.copy;
      data.routeLinks.set(link.getID(), link);
    });
  });

  return data;
}

/** How far before its backends a point with nothing in front of it stands. */
export const POINT_GAP = 240;
/** How far above a lone backend its point stands when there is no cell yet. */
const POINT_RISE = 100;

function linksOf(node: SplitModel) {
  const links = Object.values(node.getPorts()).flatMap(port =>
    Object.values(port.getLinks()),
  );
  return {
    sources: links
      .filter(l => l.getTargetPort()?.getNode() === node)
      .map(l => ({ port: l.getSourcePort(), into: l.getTargetPort() })),
    targets: links
      .filter(l => l.getSourcePort()?.getNode() === node)
      .map(l => l.getTargetPort()),
  };
}

/**
 * Whether a point stands before its backends with nothing coming in from the
 * left, so where it stands depends on the components alone.
 */
export function isFreeStanding(node: unknown): node is SplitModel {
  if (!(node instanceof SplitModel)) return false;
  const { sources, targets } = linksOf(node);
  return (
    !sources.some(({ into }) => into.getOptions().alignment === 'left') &&
    targets.every(port => port.getOptions().alignment === 'left')
  );
}

/** Whether a point stands before its backends with no caller in front of it. */
export function needsRoom(node: unknown): boolean {
  if (!(node instanceof SplitModel)) return false;
  const { sources, targets } = linksOf(node);
  return (
    !sources.some(({ port }) => port.getNode() instanceof ComponentModel) &&
    targets.every(port => port.getOptions().alignment === 'left')
  );
}

/** How far apart points of different Endpoints on the same backends stand. */
const POINT_SPREAD = 140;

/**
 * Keeps each Endpoint's point beside its backends, so it follows whenever a
 * component moves. A point that forks to a lone backend from above stands
 * halfway down the north gateway's line to it. Any other point stands
 * halfway from what comes in from the left, or just before its backends when
 * nothing does, level with their middle.
 * Points that would meet are spread apart.
 */
export function positionSplitNodes(model: DiagramModel) {
  const planned: { node: SplitModel; x: number; y: number }[] = [];
  model.getNodes().forEach(node => {
    if (!(node instanceof SplitModel)) return;
    const { sources, targets } = linksOf(node);
    if (!targets.length) return;
    const ends = targets.map(p => p.getPosition());
    const end = Math.min(...ends.map(p => p.x));
    const top = Math.min(...ends.map(p => p.y));
    const before = sources
      .filter(({ into }) => into.getOptions().alignment === 'left')
      .map(({ port }) => port.getPosition().x);
    // a lone branch carries no label, so its point needs less room
    const gap = targets.length > 1 ? POINT_GAP : POINT_GAP / 3;
    if (targets[0].getOptions().alignment === 'top') {
      // halfway down the gateway's line, so it stays inside the cell
      const cell = model.getNode(MAIN_CELL);
      const gate = cell && {
        x: cell.getPosition().x + cell.width / 2,
        y: cell.getPosition().y,
      };
      planned.push(
        gate
          ? { node, x: (gate.x + ends[0].x) / 2, y: (gate.y + top) / 2 }
          : { node, x: ends[0].x, y: top - POINT_RISE },
      );
    } else {
      const start = before.length ? Math.max(...before) : end;
      planned.push({
        node,
        x: start < end ? (start + end) / 2 : end - gap,
        y: ends.reduce((acc, p) => acc + p.y, 0) / ends.length,
      });
    }
  });

  const near = new Map<string, typeof planned>();
  planned.forEach(p => {
    const key = `${Math.round(p.x / 40)}:${Math.round(p.y / 40)}`;
    near.set(key, [...(near.get(key) ?? []), p]);
  });
  near.forEach(group =>
    group.forEach((p, i) => {
      p.y += (i - (group.length - 1) / 2) * POINT_SPREAD;
    }),
  );
  // Points from neighbouring buckets can still land on each other; move a
  // later one down until it stands clear. Points already apart stay put.
  planned.forEach((p, i) => {
    const overlaps = () =>
      planned
        .slice(0, i)
        .some(
          q =>
            Math.abs(q.x - p.x) < SPLIT_DOT_WIDTH &&
            Math.abs(q.y - p.y) < SPLIT_DOT_WIDTH,
        );
    while (overlaps()) p.y += POINT_SPREAD;
  });

  planned.forEach(({ node, x, y }) => {
    const next = { x: x - node.width / 2, y: y - node.height / 2 };
    const now = node.getPosition();
    if (Math.abs(now.x - next.x) > 0.5 || Math.abs(now.y - next.y) > 0.5) {
      node.setPosition(next.x, next.y);
    }
  });
}

/**
 * Plain lines from each point's sources straight to its backends, for laying
 * the components out as if the points were not there. Remove them after.
 */
export function routeLayoutLinks(
  splitNodes: Map<string, CommonModel>,
): ComponentLinkModel[] {
  return [...splitNodes.values()].flatMap(node => {
    if (!(node instanceof SplitModel)) return [];
    const { sources, targets } = linksOf(node);
    return sources.flatMap(({ port: source }) =>
      targets
        .filter(target => target.getNode() !== source.getNode())
        .map(target =>
          connect(
            new ComponentLinkModel(
              getComponentLinkName(source.getID(), target.getID()),
            ),
            source,
            target,
          ),
        ),
    );
  });
}

/** Whether the project draws any Endpoint point, and any copy. */
export function routeMarks(project: Project) {
  const present = new Set(project.components?.map(c => c.id));
  let split = false;
  let copy = false;
  project.routes?.forEach(route => {
    const shown = route.branches.filter(b => present.has(b.componentId));
    if (shown.length) {
      split = true;
      copy = copy || shown.some(b => b.copy);
    }
  });
  return { split, copy };
}
