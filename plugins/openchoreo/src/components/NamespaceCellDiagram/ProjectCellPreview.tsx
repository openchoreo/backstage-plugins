import { lazy, Suspense, useMemo } from 'react';
import Popper from '@material-ui/core/Popper';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { Progress } from '@backstage/core-components';
import { Project } from '@openchoreo/cell-diagram';
import { useProjectCellPreviewStyles } from './styles';

const CellView = lazy(() =>
  import('@openchoreo/cell-diagram').then(module => ({
    default: module.CellDiagram,
  })),
);

// popper.js (v1) modifiers: flip above the cell when there's no room below,
// keep the panel within the viewport, and leave an 8px gap from the cell.
const POPPER_MODIFIERS = {
  offset: { offset: '0,8' },
  flip: { enabled: true },
  preventOverflow: { enabled: true, boundariesElement: 'viewport' as const },
};

interface ProjectCellPreviewProps {
  anchorEl: HTMLElement | null;
  project?: Project;
  mode?: string;
  onClose: () => void;
  onOpenFull: () => void;
}

/**
 * Non-modal popover that previews a project in-place, anchored to the clicked
 * cell. A title bar carries the project name and actions; the diagram (with the
 * library's default dotted canvas) renders below. Data comes from the namespace
 * fetch (no extra request); "Open full view" navigates to the project's
 * cell-diagram tab. The org diagram stays interactive/pannable underneath.
 */
export function ProjectCellPreview(props: ProjectCellPreviewProps) {
  const { anchorEl, project, mode, onClose, onOpenFull } = props;
  const classes = useProjectCellPreviewStyles();

  // Strip org-level connections so the preview matches the standalone
  // single-project view (cross-project deps still show via component links).
  const previewProject = useMemo(
    () => (project ? { ...project, connections: [] } : undefined),
    [project],
  );

  const open = Boolean(anchorEl && previewProject);

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="bottom"
      modifiers={POPPER_MODIFIERS}
      className={classes.popper}
    >
      {/* Dismiss on outside click, in addition to the close button. onMouseDown
          (not onClick) so clicking another cell closes this one on mousedown and
          the cell's click then re-opens the new preview — no flicker/race. */}
      <ClickAwayListener onClickAway={onClose} mouseEvent="onMouseDown">
        <Paper elevation={8} className={classes.paper}>
          <Box className={classes.header}>
            <Box className={classes.title} data-testid="preview-project-name">
              {project?.name}
            </Box>
            <Box className={classes.headerActions}>
              <Button
                size="small"
                color="primary"
                variant="outlined"
                startIcon={<OpenInNewIcon fontSize="small" />}
                onClick={onOpenFull}
              >
                Go to Project
              </Button>
              <IconButton
                size="small"
                aria-label="Close preview"
                onClick={onClose}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box className={classes.canvas}>
            {open && previewProject && (
              <Suspense fallback={<Progress />}>
                <CellView
                  project={previewProject}
                  mode={mode as any}
                  showControls={false}
                />
              </Suspense>
            )}
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  );
}
