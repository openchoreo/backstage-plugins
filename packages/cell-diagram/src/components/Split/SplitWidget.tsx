import {
  CSSProperties,
  FocusEvent,
  MouseEvent,
  useContext,
  useMemo,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {
  DiagramEngine,
  LinkModel,
  PortWidget,
} from '@projectstorm/react-diagrams';
import Popper from '@mui/material/Popper';
import Box from '@mui/material/Box';
import { SplitModel } from './SplitModel';
import { DiagramContext } from '../DiagramContext/DiagramContext';
import { DiagramLayer } from '../../types';
import { SPLIT_DOT_WIDTH } from '../../resources';
import { useColors } from '../../theme';

const Dot = styled.div<{ active: boolean; clickable: boolean }>`
  position: relative;
  box-sizing: border-box;
  width: ${SPLIT_DOT_WIDTH}px;
  height: ${SPLIT_DOT_WIDTH}px;
  border-radius: 50%;
  background-color: ${({ theme, active }) =>
    active ? theme.colors.SECONDARY_CONTAINER : theme.colors.SURFACE_DIM};
  border: 3px solid
    ${({ theme, active }) =>
      active ? theme.colors.SECONDARY : theme.colors.OUTLINE};
  cursor: ${({ clickable }) => (clickable ? 'pointer' : 'default')};
  pointer-events: all;
  /* Rendered as a button when it opens the Endpoint. */
  padding: 0;
  margin: 0;
  font: inherit;
  appearance: none;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.SECONDARY};
    outline-offset: 2px;
  }
`;

const Title = styled.div`
  font-family: 'GilmerMedium';
  font-size: 14px;
  color: ${({ theme }) => theme.colors.ON_SURFACE};
`;

const Subtitle = styled.div`
  font-family: 'GilmerRegular';
  font-size: 12px;
  color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-family: 'GilmerRegular';
  font-size: 13px;
  color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
  font-variant-numeric: tabular-nums;
`;

const Value = styled.span`
  font-family: 'GilmerMedium';
  color: ${({ theme }) => theme.colors.ON_SURFACE};
`;

const Hint = styled.div`
  font-family: 'GilmerRegular';
  font-size: 12px;
  color: ${({ theme }) => theme.colors.PRIMARY};
`;

const centred: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 0,
  height: 0,
};

interface SplitWidgetProps {
  node: SplitModel;
  engine: DiagramEngine;
}

export function SplitWidget(props: SplitWidgetProps) {
  const { node, engine } = props;
  const colors = useColors();
  const {
    diagramLayers: { hasLayer },
    onRouteClick,
    previewMode,
  } = useContext(DiagramContext);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { route } = node;

  const hidden =
    hasLayer(DiagramLayer.OBSERVABILITY) &&
    !hasLayer(DiagramLayer.ARCHITECTURE) &&
    !hasLayer(DiagramLayer.DIFF);

  const links = () => {
    const all: LinkModel[] = [];
    Object.values(node.getPorts()).forEach(port =>
      all.push(...Object.values(port.getLinks())),
    );
    return all;
  };

  const highlight = (event: 'SELECT' | 'UNSELECT') =>
    links().forEach(link => link.fireEvent({}, event));

  const handleMouseEnter = (
    e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>,
  ) => {
    if (previewMode || hidden) return;
    highlight('SELECT');
    setAnchorEl(e.currentTarget);
  };

  const handleMouseLeave = () => {
    if (previewMode) return;
    highlight('UNSELECT');
    setAnchorEl(null);
  };

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!previewMode && onRouteClick) onRouteClick(route.id);
  };

  const clickable = Boolean(onRouteClick) && !previewMode;

  const cardStyle = useMemo(
    () => ({
      backgroundColor: colors.SURFACE,
      border: `1px solid ${colors.SECONDARY}`,
      padding: '10px 12px',
      borderRadius: '5px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '6px',
      minWidth: '200px',
      maxWidth: '320px',
      pointerEvents: 'none' as const,
    }),
    [colors],
  );

  return (
    <>
      <Dot
        as={clickable ? 'button' : 'div'}
        {...(clickable && { type: 'button' as const })}
        // Without a click it still shows its card on focus.
        {...(!clickable && !previewMode && { tabIndex: 0, role: 'img' })}
        active={Boolean(anchorEl)}
        clickable={clickable}
        style={hidden ? { visibility: 'hidden' } : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onClick={handleClick}
        aria-label={
          clickable ? `Open Endpoint ${route.name}` : `${route.name} split`
        }
      >
        {Object.values(node.getPorts()).map(port => (
          <PortWidget
            key={port.getID()}
            engine={engine}
            port={port}
            style={centred}
          />
        ))}
      </Dot>
      {!previewMode && (
        <Popper open={Boolean(anchorEl)} anchorEl={anchorEl} placement="right">
          <Box sx={cardStyle}>
            <Title>{route.name}</Title>
            {route.details?.subtitle && (
              <Subtitle>{route.details.subtitle}</Subtitle>
            )}
            {route.details?.rows?.map(row => (
              <Row key={row.label}>
                <span>{row.label}</span>
                <Value>{row.value}</Value>
              </Row>
            ))}
            {onRouteClick && <Hint>Click to open the Endpoint</Hint>}
          </Box>
        </Popper>
      )}
    </>
  );
}
