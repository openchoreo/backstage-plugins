import { useEffect, useRef, type ComponentProps } from 'react';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';

/**
 * Wrapper around upstream `EntityCatalogGraphCard` that restores the
 * pre-v1.51 "small graph centered in card" default zoom.
 *
 * Upstream v1.51's `DependencyGraph` (used by `EntityCatalogGraphCard`)
 * clamps `containerWidth/Height` to the graph's natural size via a
 * `newContainerWidth <= maxWidth` guard. With a small graph in a large
 * card, the SVG's `viewBox` ends up as the graph's natural size (e.g.
 * `0 0 478 330`) while the SVG is painted at the card's size (e.g.
 * `1430x700`). The browser then scales the viewBox content up to fill,
 * making nodes appear oversized.
 *
 * Fixing the React state in upstream is gated by an intentional
 * `<= maxWidth` check, so we work around at the DOM layer instead:
 * apply an inverse `transform: scale()` on the inner workspace group so
 * its painted size matches its natural viewBox size, and translate it to
 * the visual centre of the SVG. We never touch the SVG's `viewBox` attr,
 * which React owns — that avoids fighting React over the same property.
 */
export function ContainedCatalogGraphCard(
  props: ComponentProps<typeof EntityCatalogGraphCard>,
) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let frame = 0;
    const sync = () => {
      const svg = host.querySelector<SVGSVGElement>('svg#dependency-graph');
      if (!svg) return;
      const workspace = svg.querySelector<SVGGElement>('g#workspace');
      if (!workspace) return;

      const r = svg.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const viewBox = svg.viewBox?.baseVal;
      if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return;

      // Browser uses `meet` scaling: the smaller axis ratio wins.
      const scaleX = r.width / viewBox.width;
      const scaleY = r.height / viewBox.height;
      const browserScale = Math.min(scaleX, scaleY);

      // If the painted SVG already fits its viewBox (browser is scaling
      // down or 1:1), upstream rendering matches the old portal — clear
      // any prior transform we may have applied during a transient state.
      if (browserScale <= 1.01) {
        if (workspace.style.transform) {
          workspace.style.transform = '';
          workspace.style.transformOrigin = '';
        }
        return;
      }

      // Inverse-scale the workspace so the user sees content at natural
      // size. Compensate for `xMidYMid meet` so the workspace stays at
      // the same visual centre after scaling around (0, 0).
      const inverse = 1 / browserScale;
      const cx = viewBox.width / 2;
      const cy = viewBox.height / 2;
      const value =
        `translate(${cx * (1 - inverse)}px, ${cy * (1 - inverse)}px) ` +
        `scale(${inverse})`;
      if (workspace.style.transform !== value) {
        workspace.style.transformOrigin = '0 0';
        workspace.style.transform = value;
      }
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    // `host` is `display: contents` and has no layout box, so observing it
    // never fires. Watch the parent layout box (the card) instead.
    const ro = new ResizeObserver(schedule);
    const resizeTarget = host.parentElement;
    if (resizeTarget) ro.observe(resizeTarget);
    const mo = new MutationObserver(schedule);
    mo.observe(host, { childList: true, subtree: true, attributes: true });
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <div ref={hostRef} style={{ display: 'contents' }}>
      <EntityCatalogGraphCard {...props} />
    </div>
  );
}
