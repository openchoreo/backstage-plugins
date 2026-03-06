import { useEffect } from 'react';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';
import { DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR } from '@openchoreo/backstage-plugin-react';

type GraphTransform = { x: number; y: number; k: number };

const DEP_GRAPH_SELECTOR = 'svg#dependency-graph';

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
      const minScale = Math.min(current.k || 1, 1);

      const zoomBehavior = d3Zoom
        .zoom<SVGSVGElement, null>()
        .scaleExtent([minScale, Infinity])
        .on('zoom', event => {
          workspace.setAttribute('transform', event.transform.toString());
        });

      selection.call(zoomBehavior);
      zoomBehavior.transform(
        selection,
        d3Zoom.zoomIdentity.translate(current.x, current.y).scale(current.k),
      );
    };

    const scan = () => {
      const nodes = document.querySelectorAll<SVGSVGElement>(
        DEP_GRAPH_SELECTOR,
      );
      nodes.forEach(svg => applyPatch(svg));
    };

    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });

    const interval = window.setInterval(scan, 1000);
    scan();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      document
        .querySelectorAll<SVGSVGElement>(DEP_GRAPH_SELECTOR)
        .forEach(svg => {
          const selection = d3Selection.select<SVGSVGElement, null>(svg);
          selection.on('.zoom', null);
          svg.removeAttribute(DEPENDENCY_GRAPH_CUSTOM_ZOOM_ATTR);
        });
    };
  }, []);

  return null;
};
