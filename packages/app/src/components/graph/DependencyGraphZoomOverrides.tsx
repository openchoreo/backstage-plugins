/**
 * Why this file exists:
 * Backstage's DependencyGraph applies default d3-zoom behavior that constrains
 * panning and can leave entity-card graphs framed poorly on first paint
 * (especially when the rendered SVG is larger than the visible card viewport).
 *
 * This app-level override replaces that default zoom wiring after render so
 * graph navigation remains usable and initial framing can be corrected, without
 * patching upstream packages in node_modules. Intended as a temporary shim.
 */
import { useEffect } from 'react';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';
import { DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR } from '@openchoreo/backstage-plugin-react';

type GraphTransform = { x: number; y: number; k: number };

const DEP_GRAPH_SELECTOR = 'svg#dependency-graph';
const MIN_ZOOM_SCALE = 0.2;
const USER_INTERACTED_ATTR = 'data-oc-user-interacted';
const FLOAT_TOLERANCE = 0.5;

function parseTransform(attr: string | null): GraphTransform {
  if (!attr) {
    return { x: 0, y: 0, k: 1 };
  }
  const translateMatch = attr.match(
    /translate\(\s*([-\d.e+]+)[,\s]+([-\d.e+]+)\s*\)/,
  );
  const scaleMatch = attr.match(/scale\(\s*([-\d.e+]+)\s*\)/);
  return {
    x: translateMatch ? parseFloat(translateMatch[1]) : 0,
    y: translateMatch ? parseFloat(translateMatch[2]) : 0,
    k: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
  };
}

function findClippedViewport(svg: SVGSVGElement) {
  const svgRect = svg.getBoundingClientRect();
  let ancestor = svg.parentElement;

  while (ancestor) {
    const rect = ancestor.getBoundingClientRect();
    const style = window.getComputedStyle(ancestor);
    const clipsContent =
      style.overflow === 'hidden' ||
      style.overflowX === 'hidden' ||
      style.overflowY === 'hidden';
    const clipsSvg =
      rect.width + FLOAT_TOLERANCE < svgRect.width ||
      rect.height + FLOAT_TOLERANCE < svgRect.height;

    if (clipsContent && clipsSvg && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }

    ancestor = ancestor.parentElement;
  }

  return undefined;
}

function getRootEntityRefFromLocation(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const currentUrl = new URL(window.location.href);
  const queryRoot =
    currentUrl.searchParams.get('rootEntityRefs[]') ??
    currentUrl.searchParams.get('rootEntityRefs');
  if (queryRoot) {
    return decodeURIComponent(queryRoot).trim();
  }

  const match = currentUrl.pathname.match(
    /^\/catalog\/([^/]+)\/([^/]+)\/([^/]+)/,
  );
  if (!match) {
    return undefined;
  }

  const namespace = decodeURIComponent(match[1]).toLowerCase();
  const kind = decodeURIComponent(match[2]).toLowerCase();
  const name = decodeURIComponent(match[3]).toLowerCase();

  return `${kind}:${namespace}/${name}`;
}

function getWorkspaceRootTitle(workspace: SVGGElement): string | undefined {
  for (const child of Array.from(workspace.children)) {
    if (child.tagName.toLowerCase() === 'title') {
      return child.textContent?.trim() || undefined;
    }
  }
  return undefined;
}

function findRootNode(
  workspace: SVGGElement,
  rootEntityRef: string,
): SVGGElement | undefined {
  const nodes = Array.from(
    workspace.querySelectorAll<SVGGElement>(
      'g[class*="BackstageDependencyGraphNode-node"]',
    ),
  );
  return nodes.find(node => {
    return node.querySelector('title')?.textContent?.trim() === rootEntityRef;
  });
}

function getNodeCenter(node: SVGGElement) {
  const nodeTransform = parseTransform(node.getAttribute('transform'));
  const nodeBox = node.getBBox();

  return {
    x: nodeTransform.x + nodeBox.x + nodeBox.width / 2,
    y: nodeTransform.y + nodeBox.y + nodeBox.height / 2,
  };
}

/**
 * Installs a site-wide zoom handler for Backstage dependency graphs.
 *
 * Upstream DependencyGraph clamps panning to the viewport bounds, which
 * prevents moving the diagram when k=1 and makes large graphs inaccessible.
 * Until Backstage ships a fix we replace the d3-zoom handler in-app so every
 * catalog graph regains free panning without patching node_modules. Components
 * that need bespoke controls (Platform Overview) set DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR
 * to skip this override and manage zoom themselves.
 */
export const DependencyGraphZoomOverrides = () => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const patchedSvgs = new Set<SVGSVGElement>();

    const applyPatch = (svg: SVGSVGElement) => {
      if (svg.getAttribute(DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR) === 'true') {
        return;
      }

      const workspace =
        svg.querySelector<SVGGElement>('g#workspace') ?? undefined;
      if (!workspace) {
        return;
      }

      const selection = d3Selection.select<SVGSVGElement, null>(svg);
      // Remove default zoom handlers so we can install our own behaviour.
      selection.on('.zoom', null);

      const current = parseTransform(workspace.getAttribute('transform'));
      const minScale = Math.min(current.k || 1, MIN_ZOOM_SCALE);
      let initialTransform = d3Zoom.zoomIdentity
        .translate(current.x, current.y)
        .scale(current.k);

      // Backstage can render the SVG taller than the visible Relations card viewport,
      // which pins the root node near the lower edge. Re-center around root until
      // the user manually pans/zooms.
      if (!svg.hasAttribute(USER_INTERACTED_ATTR)) {
        const viewport = findClippedViewport(svg);
        const rootEntityRef =
          getRootEntityRefFromLocation() ?? getWorkspaceRootTitle(workspace);
        const rootNode = rootEntityRef
          ? findRootNode(workspace, rootEntityRef)
          : undefined;

        if (viewport && rootNode && rootEntityRef) {
          const rootCenter = getNodeCenter(rootNode);
          const centeredX = viewport.width / 2 - rootCenter.x * current.k;
          const centeredY = viewport.height / 2 - rootCenter.y * current.k;
          const shouldRecenter =
            Math.abs(centeredX - current.x) > FLOAT_TOLERANCE ||
            Math.abs(centeredY - current.y) > FLOAT_TOLERANCE;

          if (shouldRecenter) {
            initialTransform = d3Zoom.zoomIdentity
              .translate(centeredX, centeredY)
              .scale(current.k);
          }
        }
      }

      const zoomBehavior = d3Zoom
        .zoom<SVGSVGElement, null>()
        .scaleExtent([minScale, Infinity])
        .on('zoom', event => {
          workspace.setAttribute('transform', event.transform.toString());
          if (event.sourceEvent) {
            svg.setAttribute(USER_INTERACTED_ATTR, 'true');
          }
        });

      selection.call(zoomBehavior);
      zoomBehavior.transform(selection, initialTransform);
      patchedSvgs.add(svg);
    };

    const scan = () => {
      const nodes =
        document.querySelectorAll<SVGSVGElement>(DEP_GRAPH_SELECTOR);
      nodes.forEach(svg => applyPatch(svg));
    };

    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(scan, 1000);
    scan();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      patchedSvgs.forEach(svg => {
        const selection = d3Selection.select<SVGSVGElement, null>(svg);
        selection.on('.zoom', null);
        svg.removeAttribute(DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR);
        svg.removeAttribute(USER_INTERACTED_ATTR);
      });
      patchedSvgs.clear();
    };
  }, []);

  return null;
};
