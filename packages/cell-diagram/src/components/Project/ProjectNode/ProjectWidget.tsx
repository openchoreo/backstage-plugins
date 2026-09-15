import { MouseEvent, useContext, useEffect, useRef, useState } from 'react';
import Fade from '@mui/material/Fade';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import { DiagramEngine, PortModel } from '@projectstorm/react-diagrams';
import { ProjectModel } from './ProjectModel';
import { ProjectHeadWidget } from './ProjectHeadWidget/ProjectHeadWidget';
import { ProjectName, ProjectNode } from './styles';
import { DiagramContext } from '../../DiagramContext/DiagramContext';
import { useColors } from '../../../theme';

interface ProjectWidgetProps {
  node: ProjectModel;
  engine: DiagramEngine;
}

export function ProjectWidget(props: ProjectWidgetProps) {
  const { node, engine } = props;
  const colors = useColors();
  const {
    selectedNodeId,
    focusedNodeId,
    componentMenu,
    onComponentDoubleClick,
  } = useContext(DiagramContext);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const headPorts = useRef<PortModel[]>([]);
  // Records the pointer position at mousedown so a click that follows a canvas
  // pan/node drag can be told apart from a genuine click (see handleOnWidgetClick).
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);

  const displayName: string = node.project.name;

  useEffect(() => {
    headPorts.current.push(node.getPortFromID(`right-${node.getID()}`)!);
  }, [node]);

  const handleOnHover = (task: string) => {
    setIsHovered(task === 'SELECT' ? true : false);
    node.handleHover(headPorts.current, task);
  };

  const handleOnWidgetDoubleClick = () => {
    if (onComponentDoubleClick) {
      onComponentDoubleClick(node.project.id);
    }
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    pointerDownAt.current = { x: event.clientX, y: event.clientY };
  };

  // Single-click activation (the host decides what it does — e.g. open a
  // preview). Only fires when the pointer didn't travel far between mousedown
  // and click, so panning the canvas or dragging the node doesn't trigger it.
  const handleOnWidgetClick = (event: MouseEvent<HTMLDivElement>) => {
    const start = pointerDownAt.current;
    pointerDownAt.current = null;
    if (!start) return;
    const moved =
      Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y);
    if (moved > 4) return;
    handleOnWidgetDoubleClick();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    handleOnHover('SELECT');
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    handleOnHover('UNSELECT');
  };

  const handleOnContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      <ProjectNode
        isSelected={node.getID() === selectedNodeId}
        isFocused={node.getID() === focusedNodeId}
        onMouseOver={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onClick={handleOnWidgetClick}
        onContextMenu={handleOnContextMenu}
      >
        <ProjectHeadWidget
          engine={engine}
          node={node}
          isSelected={node.getID() === selectedNodeId}
          isFocused={node.getID() === focusedNodeId || isHovered}
          menuItems={componentMenu}
        />
        <Tooltip
          title={displayName}
          placement="bottom"
          enterNextDelay={500}
          arrow
        >
          <ProjectName>{displayName}</ProjectName>
        </Tooltip>

        {/* Visual affordance only — activation is handled by the cell's onClick
            (which also covers clicks landing on this icon), so onComponentDoubleClick
            fires exactly once per click. */}
        <Box
          sx={{
            position: 'absolute',
            top: '26px',
            padding: '8px',
            cursor: 'pointer',
          }}
        >
          <Fade in={isHovered} timeout={350}>
            <Tooltip
              title="Preview Project"
              placement="bottom"
              enterNextDelay={1000}
            >
              <ZoomInRoundedIcon
                sx={{ color: colors.OUTLINE_VARIANT, fontSize: 26 }}
              />
            </Tooltip>
          </Fade>
        </Box>
      </ProjectNode>
    </>
  );
}
