import createEngine, { DiagramEngine } from '@projectstorm/react-diagrams';
import {
  OverlayLayerFactory,
  ComponentFactory,
  ComponentLinkFactory,
  ComponentPortFactory,
  CellFactory,
  CellLinkFactory,
  CellPortFactory,
  EmptyFactory,
  ExternalFactory,
  ExternalLinkFactory,
  ConnectionPortFactory,
  ConnectionFactory,
  ProjectLinkFactory,
  ProjectPortFactory,
  ProjectFactory,
  DefaultLinkFactory,
} from '../components';
import {
  CELL_LINK,
  COMPONENT_LINK,
  COMPONENT_NODE,
  CONNECTION_NODE,
  EXTERNAL_LINK,
  MAIN_CELL,
  PROJECT_NODE,
} from '../resources';
import { ZoomCanvasAction } from '@projectstorm/react-canvas-core';
import { REVEAL_DURATION, RevealClass } from './animations';

// Diagram engine utils

export function generateEngine(previewMode?: boolean): DiagramEngine {
  const engine: DiagramEngine = createEngine({
    registerDefaultPanAndZoomCanvasAction: false,
    registerDefaultZoomCanvasAction: false,
  });
  engine.getLinkFactories().registerFactory(new ProjectLinkFactory());
  engine.getPortFactories().registerFactory(new ProjectPortFactory());
  engine.getNodeFactories().registerFactory(new ProjectFactory());
  engine.getLinkFactories().registerFactory(new DefaultLinkFactory());

  engine.getLinkFactories().registerFactory(new ComponentLinkFactory());
  engine.getPortFactories().registerFactory(new ComponentPortFactory());
  engine.getNodeFactories().registerFactory(new ComponentFactory());

  engine.getPortFactories().registerFactory(new ConnectionPortFactory());
  engine.getNodeFactories().registerFactory(new ConnectionFactory());

  engine.getLinkFactories().registerFactory(new CellLinkFactory());
  engine.getPortFactories().registerFactory(new CellPortFactory());
  engine.getNodeFactories().registerFactory(new CellFactory());

  engine.getLinkFactories().registerFactory(new ExternalLinkFactory());
  engine.getNodeFactories().registerFactory(new ExternalFactory());

  engine.getNodeFactories().registerFactory(new EmptyFactory());

  engine.getLayerFactories().registerFactory(new OverlayLayerFactory());

  if (!previewMode) {
    engine
      .getActionEventBus()
      .registerAction(new ZoomCanvasAction({ inverseZoom: true }));
  }
  return engine;
}

// Diagram reveal animations (CSS keyframes, see `./animations`)

type RevealClassName = (typeof RevealClass)[keyof typeof RevealClass];

/**
 * Applies a reveal animation class to every element matching `selector`.
 * Returns the number of elements that were animated so callers can
 * sequence later animations only when something actually rendered.
 */
export function revealElements(
  selector: string,
  className: RevealClassName,
  delaySeconds = 0,
  root: ParentNode = document,
): number {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement | SVGElement>(selector),
  );
  // restart the animation if the class is already present: removing and
  // re-adding the class in the same task is a no-op for the browser, so flush
  // styles once in between (one read for the whole set avoids layout thrash)
  elements.forEach(element => element.classList.remove(className));
  if (elements.length > 0) {
    elements[0].getBoundingClientRect();
  }
  elements.forEach(element => {
    element.style.animationDelay = delaySeconds > 0 ? `${delaySeconds}s` : '';
    element.classList.add(className);
  });
  return elements.length;
}

// reveal diagram with animation
export function animateProjectDiagram(root: ParentNode = document) {
  // the main cell scales in first; everything inside it fades in once the
  // cell is fully visible (same sequence as the previous timeline)
  const cellCount = revealElements(
    `div[data-nodeid="${MAIN_CELL}"]`,
    RevealClass.SCALE,
    0,
    root,
  );
  const showNodeTime = cellCount > 0 ? REVEAL_DURATION : 0;
  [
    `g[data-linkid^="${EXTERNAL_LINK}|"]`,
    `div[data-nodeid^="${COMPONENT_NODE}|"]`,
    `div[data-nodeid^="${CONNECTION_NODE}|"]`,
    `g[data-linkid^="${COMPONENT_LINK}|"]`,
    `g[data-linkid^="${CELL_LINK}|"]`,
  ].forEach(selector => {
    revealElements(selector, RevealClass.FADE, showNodeTime, root);
  });
}

export function animateOrgDiagram(root: ParentNode = document) {
  // project nodes scale in first, then their links fade in
  const nodeCount = revealElements(
    `div[data-nodeid^="${PROJECT_NODE}|"]`,
    RevealClass.SCALE_HALF,
    0,
    root,
  );
  revealElements(
    `g[data-default-link-test^="${PROJECT_NODE}|"]`,
    RevealClass.FADE,
    nodeCount > 0 ? REVEAL_DURATION : 0,
    root,
  );
}
