import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';
import type {
  GraphTransform,
  GraphViewBox,
  GraphViewport,
} from './useGraphZoom';

export interface UseHtmlGraphZoomOptions {
  /** Natural width of the unscaled content (e.g. dagre layout.width). */
  contentWidth: number;
  /** Natural height of the unscaled content (e.g. dagre layout.height). */
  contentHeight: number;
  /** Lower bound for d3-zoom's scaleExtent. */
  minScale?: number;
  /** Upper bound for d3-zoom's scaleExtent. */
  maxScale?: number;
}

export interface UseHtmlGraphZoomResult {
  /** Attach to the outer container element (the one users wheel/drag on). */
  containerRef: (node: HTMLElement | null) => void;
  /** Attach to the inner content element that should receive the CSS transform. */
  contentRef: (node: HTMLElement | null) => void;
  transform: GraphTransform;
  viewBox: GraphViewBox;
  viewport: GraphViewport;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  panTo: (svgX: number, svgY: number) => void;
}

const ZOOM_SCALE_FACTOR = 1.3;
const DEFAULT_MIN_SCALE = 0.2;
const DEFAULT_MAX_SCALE = 4;

/**
 * Pan/zoom controller for an HTML-DOM graph (positioned `<div>` nodes,
 * dagre-computed layout). Mirrors the public shape of `useGraphZoom`,
 * but instead of mutating an SVG `<g>` transform attribute it applies a
 * CSS `transform: translate(x,y) scale(k)` to a content `<div>`.
 *
 * Use the synthesized `transform` / `viewBox` / `viewport` with the
 * sibling `HtmlGraphMinimap` (or with a custom minimap that consumes the
 * same triple).
 */
export function useHtmlGraphZoom({
  contentWidth,
  contentHeight,
  minScale = DEFAULT_MIN_SCALE,
  maxScale = DEFAULT_MAX_SCALE,
}: UseHtmlGraphZoomOptions): UseHtmlGraphZoomResult {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [transform, setTransform] = useState<GraphTransform>({
    x: 0,
    y: 0,
    k: 1,
  });
  const [viewBox, setViewBox] = useState<GraphViewBox>({
    width: 0,
    height: 0,
  });

  const zoomBehaviorRef = useRef<d3Zoom.ZoomBehavior<
    HTMLElement,
    unknown
  > | null>(null);

  const containerRef = useCallback((node: HTMLElement | null) => {
    setContainer(node);
  }, []);
  const contentRef = useCallback((node: HTMLElement | null) => {
    setContent(node);
  }, []);

  // Track the container's rendered size as the synthesized viewBox.
  // The minimap math expects viewBox to represent the visible window in
  // content coordinates, which equals containerWidth / k after scaling.
  useEffect(() => {
    if (!container) return undefined;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setViewBox({ width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  // Apply the current transform to the content element via CSS.
  useEffect(() => {
    if (!content) return;
    content.style.transformOrigin = '0 0';
    content.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
  }, [content, transform]);

  // Attach d3-zoom to the container.
  useEffect(() => {
    if (!container) return undefined;
    const selection = d3Selection.select<HTMLElement, unknown>(container);
    const zoomBehavior = d3Zoom
      .zoom<HTMLElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .filter(event => {
        // Allow wheel + drag-to-pan on the container itself but ignore
        // events whose target is interactive (button, input, link, etc.)
        // so node clicks don't start a pan gesture.
        if (event.type === 'wheel') return true;
        const target = event.target as HTMLElement | null;
        if (!target) return true;
        if (target.closest('button, a, input, textarea, select, [role="menu"]'))
          return false;
        return true;
      })
      .on('zoom', event => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      });

    zoomBehaviorRef.current = zoomBehavior;
    selection.call(zoomBehavior);

    // Sync d3's internal zoom state to the React transform on mount.
    zoomBehavior.transform(
      selection,
      d3Zoom.zoomIdentity
        .translate(transform.x, transform.y)
        .scale(transform.k),
    );

    return () => {
      selection.on('.zoom', null);
      zoomBehaviorRef.current = null;
    };
    // We intentionally don't depend on `transform` here — re-attaching the
    // zoom behavior on every transform change would create a feedback loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, minScale, maxScale]);

  const zoomIn = useCallback(() => {
    if (!container || !zoomBehaviorRef.current) return;
    const selection = d3Selection.select<HTMLElement, unknown>(container);
    zoomBehaviorRef.current.scaleBy(selection, ZOOM_SCALE_FACTOR);
  }, [container]);

  const zoomOut = useCallback(() => {
    if (!container || !zoomBehaviorRef.current) return;
    const selection = d3Selection.select<HTMLElement, unknown>(container);
    zoomBehaviorRef.current.scaleBy(selection, 1 / ZOOM_SCALE_FACTOR);
  }, [container]);

  const fitToView = useCallback(() => {
    if (!container || !zoomBehaviorRef.current) return;
    if (contentWidth === 0 || contentHeight === 0) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const margin = 24;
    const k = Math.min(
      (rect.width - margin * 2) / contentWidth,
      (rect.height - margin * 2) / contentHeight,
      maxScale,
    );
    const finalK = Math.max(minScale, k);
    const x = (rect.width - contentWidth * finalK) / 2;
    const y = (rect.height - contentHeight * finalK) / 2;
    const selection = d3Selection.select<HTMLElement, unknown>(container);
    zoomBehaviorRef.current.transform(
      selection,
      d3Zoom.zoomIdentity.translate(x, y).scale(finalK),
    );
  }, [container, contentWidth, contentHeight, minScale, maxScale]);

  const panTo = useCallback(
    (svgX: number, svgY: number) => {
      if (!container || !zoomBehaviorRef.current) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const k = transform.k;
      const newX = -(svgX * k) + rect.width / 2;
      const newY = -(svgY * k) + rect.height / 2;
      const selection = d3Selection.select<HTMLElement, unknown>(container);
      zoomBehaviorRef.current.transform(
        selection,
        d3Zoom.zoomIdentity.translate(newX, newY).scale(k),
      );
    },
    [container, transform.k],
  );

  // Synthesize the viewport rectangle in content coordinates so a
  // GraphMinimap-style overlay can highlight the visible portion.
  const viewport: GraphViewport =
    viewBox.width > 0 && viewBox.height > 0 && transform.k > 0
      ? {
          x: -transform.x / transform.k,
          y: -transform.y / transform.k,
          width: viewBox.width / transform.k,
          height: viewBox.height / transform.k,
        }
      : { x: 0, y: 0, width: 0, height: 0 };

  // The minimap's viewBox should describe the *content* coordinate
  // system, not the container. We expose contentWidth/Height so the
  // overlay can scale node thumbnails directly.
  const contentViewBox: GraphViewBox = {
    width: contentWidth,
    height: contentHeight,
  };

  return {
    containerRef,
    contentRef,
    transform,
    viewBox: contentViewBox,
    viewport,
    zoomIn,
    zoomOut,
    fitToView,
    panTo,
  };
}
