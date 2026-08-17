import { useEffect, useRef, type ComponentProps } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { EntityCatalogGraphCard } from '@backstage/plugin-catalog-graph';
import { CustomGraphNode } from '@openchoreo/backstage-plugin-react';

/**
 * Match the OverviewCard title convention used by DeploymentStatusCard /
 * RuntimeHealthCard / OpenChoreoAboutCard so the "Relations" title on the
 * graph card doesn't shout in `h5` while every neighbor sits at `h6`.
 * Upstream `EntityCatalogGraphCard` renders through Backstage's `InfoCard`
 * which passes `variant="h5"` to `CardHeader.titleTypographyProps` — no
 * public prop to override that. We overwrite the resulting
 * `.MuiCardHeader-title` styles from the outer wrapper instead.
 */
const useStyles = makeStyles(theme => ({
  host: {
    display: 'contents',
    '& .MuiCardHeader-title': {
      fontWeight: 600,
      fontSize: theme.typography.h6.fontSize,
      color: theme.palette.text.primary,
    },
  },
}));

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
  const classes = useStyles();

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

      const scaleX = r.width / viewBox.width;
      const scaleY = r.height / viewBox.height;
      const browserScale = Math.min(scaleX, scaleY);

      if (browserScale <= 1.01) {
        if (workspace.style.transform) {
          workspace.style.transform = '';
          workspace.style.transformOrigin = '';
        }
        return;
      }

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

  // `renderNode` defaults to `CustomGraphNode` — the OpenChoreo-styled
  // graph node with per-kind chip colors + icons. Callers can pass a
  // different `renderNode` function to override (note: `renderNode={undefined}`
  // does NOT restore the vanilla Backstage node because the destructuring
  // default triggers on `undefined`; pass an explicit `renderNode` component
  // if that's the intent).
  const { renderNode = CustomGraphNode, ...rest } = props;

  return (
    <div ref={hostRef} className={classes.host}>
      <EntityCatalogGraphCard renderNode={renderNode} {...rest} />
    </div>
  );
}
