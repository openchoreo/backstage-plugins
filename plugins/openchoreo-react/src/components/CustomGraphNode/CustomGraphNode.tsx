/**
 * Custom graph node renderer for the catalog graph.
 * Provides kind-based coloring and labels for better entity differentiation.
 *
 * Based on Backstage's DefaultRenderNode but with custom colors and label prefixes.
 */
import { DependencyGraphTypes } from '@backstage/core-components';
import { IconComponent } from '@backstage/core-plugin-api';
import { useEntityPresentation } from '@backstage/plugin-catalog-react';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';
import SvgIcon from '@material-ui/core/SvgIcon';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { SvgIconTypeMap } from '@material-ui/core/SvgIcon/SvgIcon';
import { DEFAULT_NAMESPACE, Entity } from '@backstage/catalog-model';
import { EntityNodeData } from '@backstage/plugin-catalog-graph';
import {
  getNodeColor,
  getNodeDisplayLabel,
  getNodeTintFill,
} from '../../utils/graphUtils';

// Inline EntityIcon component to avoid import issues
function EntityIcon({
  icon,
  ...props
}: {
  icon: IconComponent | undefined;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  const Icon = (icon as OverridableComponent<SvgIconTypeMap>) ?? SvgIcon;
  return <Icon {...props} />;
}

const useStyles = makeStyles(
  theme => ({
    node: {
      fill: theme.palette.grey[300],
      stroke: theme.palette.grey[300],
    },
    text: {
      fill: theme.palette.text.primary,
      '&.focused': {
        fontWeight: 'bold',
      },
    },
    clickable: {
      cursor: 'pointer',
      '&:hover .node-body': {
        filter: 'url(#node-hover-glow)',
      },
    },
  }),
  { name: 'CustomCatalogGraphNode' },
);

/**
 * Custom render node component for the EntityCatalogGraphCard.
 * Applies kind-based colors and adds prefixes to labels for OpenChoreo entity kinds.
 */
export function CustomGraphNode({
  node: { id, entity, focused, onClick },
}: DependencyGraphTypes.RenderNodeProps<EntityNodeData>) {
  // Cast entity to Entity type for useEntityPresentation
  const entityObj = entity as Entity;
  const classes = useStyles();
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const idRef = useRef<SVGTextElement | null>(null);
  const entityRefPresentationSnapshot = useEntityPresentation(entityObj, {
    defaultNamespace: DEFAULT_NAMESPACE,
  });

  useLayoutEffect(() => {
    // Set the width to the length of the ID
    if (idRef.current) {
      let { height: renderedHeight, width: renderedWidth } =
        idRef.current.getBBox();
      renderedHeight = Math.round(renderedHeight);
      renderedWidth = Math.round(renderedWidth);

      if (renderedHeight !== height || renderedWidth !== width) {
        setWidth(renderedWidth);
        setHeight(renderedHeight);
      }
    }
  }, [width, height]);

  const hasKindIcon = !!entityRefPresentationSnapshot.Icon;
  const padding = 10;
  const accentWidth = 8;
  const iconSize = height;
  const paddedIconWidth = hasKindIcon ? iconSize + padding : 0;
  const paddedWidth = accentWidth + paddedIconWidth + width + padding * 2;
  const paddedHeight = height + padding * 2;

  // Get the base display title
  const baseTitle = entityRefPresentationSnapshot.primaryTitle ?? id;

  // Apply kind prefix for custom OpenChoreo kinds
  const displayTitle = getNodeDisplayLabel(entity.kind, baseTitle);

  // Get kind-based color and tint fill
  const nodeColor = getNodeColor(entity.kind);
  const tintFill = getNodeTintFill(nodeColor, isDark);
  const borderColor = `${nodeColor}B3`; // accent color at 70% opacity

  // Sanitize entity ref for use as a unique clipPath ID
  const clipId = `accent-clip-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <g onClick={onClick} className={clsx(onClick && classes.clickable)}>
      <defs>
        <clipPath id={clipId}>
          <rect width={paddedWidth} height={paddedHeight} rx={10} />
        </clipPath>
      </defs>
      {/* Main body */}
      <rect
        className={clsx(classes.node, 'node-body')}
        style={{
          fill: tintFill,
          stroke: borderColor,
        }}
        width={paddedWidth}
        height={paddedHeight}
        rx={10}
        strokeWidth={1.5}
        filter="url(#node-shadow)"
      />
      {/* Left accent stripe — clipped to the node's rounded shape */}
      <rect
        width={accentWidth}
        height={paddedHeight}
        fill={nodeColor}
        clipPath={`url(#${clipId})`}
      />
      {hasKindIcon && (
        <EntityIcon
          icon={entityRefPresentationSnapshot.Icon as IconComponent}
          y={padding}
          x={accentWidth + padding}
          width={iconSize}
          height={iconSize}
          className={clsx(classes.text, focused && 'focused')}
        />
      )}
      <text
        ref={idRef}
        className={clsx(classes.text, focused && 'focused')}
        y={paddedHeight / 2}
        x={accentWidth + paddedIconWidth + (width + padding * 2) / 2}
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {displayTitle}
      </text>
      <title>{entityRefPresentationSnapshot.entityRef}</title>
    </g>
  );
}
