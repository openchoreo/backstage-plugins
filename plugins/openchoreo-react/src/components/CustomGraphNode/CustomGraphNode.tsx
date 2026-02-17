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
  getNodeKindLabel,
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
    kindBadgeText: {
      fontSize: '0.6rem',
      fill: theme.palette.text.secondary,
      fontWeight: 500,
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
  const [badgeWidth, setBadgeWidth] = useState(0);
  const idRef = useRef<SVGTextElement | null>(null);
  const badgeRef = useRef<SVGTextElement | null>(null);
  const entityRefPresentationSnapshot = useEntityPresentation(entityObj, {
    defaultNamespace: DEFAULT_NAMESPACE,
  });

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    if (badgeRef.current) {
      const renderedWidth = Math.round(badgeRef.current.getBBox().width);
      if (renderedWidth !== badgeWidth) {
        setBadgeWidth(renderedWidth);
      }
    }
  }, [badgeWidth]);

  const hasKindIcon = !!entityRefPresentationSnapshot.Icon;
  const padding = 10;
  const accentWidth = 8;
  const iconSize = height;
  const paddedIconWidth = hasKindIcon ? iconSize + padding : 0;
  const paddedWidth = accentWidth + paddedIconWidth + width + padding * 2;
  const paddedHeight = height + padding * 2;

  // Get the base display title and kind label
  const baseTitle = entityRefPresentationSnapshot.primaryTitle ?? id;
  const kindLabel = getNodeKindLabel(entity.kind);

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
          x={accentWidth + width + padding * 2}
          width={iconSize}
          height={iconSize}
          className={clsx(classes.text, focused && 'focused')}
        />
      )}
      {/* Kind badge — tab integrated into node top border */}
      {kindLabel &&
        (() => {
          const badgePadX = 5;
          const badgeH = 14;
          const badgeX = accentWidth + 4;
          const badgeY = -(badgeH / 2);
          const badgeW = badgeWidth + badgePadX * 2;
          const r = 4;
          return (
            <g>
              {/* Fill covers badge area and node border beneath */}
              <rect
                x={badgeX + 0.75}
                y={badgeY}
                width={badgeW - 1.5}
                height={badgeH / 2 + 1}
                fill={tintFill}
              />
              {/* Open-bottom border (top + sides only) */}
              <path
                d={[
                  `M ${badgeX},0`,
                  `L ${badgeX},${badgeY + r}`,
                  `Q ${badgeX},${badgeY} ${badgeX + r},${badgeY}`,
                  `L ${badgeX + badgeW - r},${badgeY}`,
                  `Q ${badgeX + badgeW},${badgeY} ${badgeX + badgeW},${
                    badgeY + r
                  }`,
                  `L ${badgeX + badgeW},0`,
                ].join(' ')}
                fill="none"
                stroke={borderColor}
                strokeWidth={1.5}
              />
              <text
                ref={badgeRef}
                x={badgeX + badgePadX}
                y={badgeY + badgeH / 2}
                textAnchor="start"
                dominantBaseline="central"
                className={classes.kindBadgeText}
              >
                {kindLabel}
              </text>
            </g>
          );
        })()}
      <text
        ref={idRef}
        className={clsx(classes.text, focused && 'focused')}
        y={paddedHeight / 2}
        x={accentWidth + (width + padding * 2) / 2}
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {baseTitle}
      </text>
      <title>{entityRefPresentationSnapshot.entityRef}</title>
    </g>
  );
}
