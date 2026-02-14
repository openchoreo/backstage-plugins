import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';

export type GraphTransform = { x: number; y: number; k: number };
export type GraphViewBox = { width: number; height: number };
export type GraphViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface UseGraphZoomResult {
  /** Callback ref — attach to the container element wrapping DependencyGraph */
  containerRef: (node: HTMLElement | null) => void;
  transform: GraphTransform;
  viewBox: GraphViewBox;
  viewport: GraphViewport;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  panTo: (svgX: number, svgY: number) => void;
}

function parseTransform(attr: string): GraphTransform {
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

function parseViewBox(attr: string): GraphViewBox {
  const parts = attr.split(/[\s,]+/).map(Number);
  return { width: parts[2] || 0, height: parts[3] || 0 };
}

const ZOOM_SCALE_FACTOR = 1.3;
const ZOOM_ATTACH_DELAY_MS = 300;

export function useGraphZoom(): UseGraphZoomResult {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [transform, setTransform] = useState<GraphTransform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const [viewBox, setViewBox] = useState<GraphViewBox>({
    width: 0,
    height: 0,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const workspaceRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    SVGSVGElement,
    null
  > | null>(null);

  // Callback ref for the container element
  const containerRef = useCallback((node: HTMLElement | null) => {
    setContainer(node);
  }, []);

  // Detect SVG and workspace elements, set up zoom behavior and MutationObservers
  useEffect(() => {
    if (!container) return undefined;

    let workspaceObserver: MutationObserver | null = null;
    let svgObserver: MutationObserver | null = null;
    let attachTimer: ReturnType<typeof setTimeout> | null = null;

    function attach() {
      const svg = container!.querySelector(
        'svg#dependency-graph',
      ) as SVGSVGElement | null;
      const workspace = svg?.querySelector('g#workspace') as SVGGElement | null;

      if (!svg || !workspace) return;

      svgRef.current = svg;
      workspaceRef.current = workspace;

      // Set up observers BEFORE reading initial values to avoid race
      // conditions where the attribute changes between read and observe.

      // Observe workspace transform changes
      workspaceObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.attributeName === 'transform') {
            const val = workspace.getAttribute('transform');
            if (val) setTransform(parseTransform(val));
          }
        }
      });
      workspaceObserver.observe(workspace, {
        attributes: true,
        attributeFilter: ['transform'],
      });

      // Observe SVG viewBox changes
      svgObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.attributeName === 'viewBox') {
            const val = svg.getAttribute('viewBox');
            if (val) setViewBox(parseViewBox(val));
          }
        }
      });
      svgObserver.observe(svg, {
        attributes: true,
        attributeFilter: ['viewBox'],
      });

      // Read initial values after observers are attached
      const vbAttr = svg.getAttribute('viewBox');
      if (vbAttr) setViewBox(parseViewBox(vbAttr));

      const tAttr = workspace.getAttribute('transform');
      if (tAttr) setTransform(parseTransform(tAttr));

      // Attach our own d3-zoom instance after a short delay to let the
      // upstream DependencyGraph finish its initial zoom setup.
      attachTimer = setTimeout(() => {
        const vb = svg.getAttribute('viewBox');
        const { width: maxWidth, height: maxHeight } = vb
          ? parseViewBox(vb)
          : { width: 0, height: 0 };

        const zoomBehavior = d3Zoom
          .zoom<SVGSVGElement, null>()
          .scaleExtent([1, Infinity])
          .on('zoom', event => {
            // Clamp transform to prevent panning beyond content bounds
            // (mirrors upstream DependencyGraph logic)
            event.transform.x = Math.min(
              0,
              Math.max(
                event.transform.x,
                maxWidth - maxWidth * event.transform.k,
              ),
            );
            event.transform.y = Math.min(
              0,
              Math.max(
                event.transform.y,
                maxHeight - maxHeight * event.transform.k,
              ),
            );
            workspace.setAttribute('transform', event.transform.toString());
          });

        zoomBehaviorRef.current = zoomBehavior;

        const selection = d3Selection.select<SVGSVGElement, null>(svg);
        selection.call(zoomBehavior);

        // Sync d3's internal zoom state with the current workspace transform
        const currentAttr = workspace.getAttribute('transform');
        if (currentAttr) {
          const current = parseTransform(currentAttr);
          const initialTransform = d3Zoom.zoomIdentity
            .translate(current.x, current.y)
            .scale(current.k);
          zoomBehavior.transform(selection, initialTransform);
        }
      }, ZOOM_ATTACH_DELAY_MS);
    }

    // Try attaching immediately
    attach();

    // Also observe the container for child changes (DependencyGraph renders with debounce)
    // Re-attach whenever the SVG element is replaced (React may unmount/remount it).
    const containerObserver = new MutationObserver(() => {
      const currentSvg = container!.querySelector('svg#dependency-graph');
      if (currentSvg !== svgRef.current) {
        workspaceObserver?.disconnect();
        svgObserver?.disconnect();
        if (attachTimer) clearTimeout(attachTimer);
        svgRef.current = null;
        workspaceRef.current = null;
        zoomBehaviorRef.current = null;
        attach();
      }
    });
    containerObserver.observe(container, { childList: true, subtree: true });

    return () => {
      if (attachTimer) clearTimeout(attachTimer);
      containerObserver.disconnect();
      workspaceObserver?.disconnect();
      svgObserver?.disconnect();
      zoomBehaviorRef.current = null;
    };
  }, [container]);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior) return;
    const selection = d3Selection.select<SVGSVGElement, null>(svg);
    zoomBehavior.scaleBy(selection, ZOOM_SCALE_FACTOR);
  }, []);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior) return;
    const selection = d3Selection.select<SVGSVGElement, null>(svg);
    zoomBehavior.scaleBy(selection, 1 / ZOOM_SCALE_FACTOR);
  }, []);

  const fitToView = useCallback(() => {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior) return;
    const selection = d3Selection.select<SVGSVGElement, null>(svg);
    zoomBehavior.transform(selection, d3Zoom.zoomIdentity);
  }, []);

  const panTo = useCallback((svgX: number, svgY: number) => {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior) return;

    const vbAttr = svg.getAttribute('viewBox');
    const vb = vbAttr ? parseViewBox(vbAttr) : { width: 0, height: 0 };
    if (vb.width === 0 || vb.height === 0) return;

    // Read current scale from d3's internal zoom state
    const currentTransform = d3Zoom.zoomTransform(svg);
    const k = currentTransform.k;

    const vpWidth = vb.width / k;
    const vpHeight = vb.height / k;

    // Center the viewport at (svgX, svgY)
    const newX = -(svgX - vpWidth / 2) * k;
    const newY = -(svgY - vpHeight / 2) * k;

    const newTransform = d3Zoom.zoomIdentity.translate(newX, newY).scale(k);

    const selection = d3Selection.select<SVGSVGElement, null>(svg);
    zoomBehavior.transform(selection, newTransform);
  }, []);

  const viewport: GraphViewport = {
    x: viewBox.width > 0 ? -transform.x / transform.k : 0,
    y: viewBox.height > 0 ? -transform.y / transform.k : 0,
    width: viewBox.width > 0 ? viewBox.width / transform.k : 0,
    height: viewBox.height > 0 ? viewBox.height / transform.k : 0,
  };

  return {
    containerRef,
    transform,
    viewBox,
    viewport,
    zoomIn,
    zoomOut,
    fitToView,
    panTo,
  };
}
