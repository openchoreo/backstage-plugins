import IconButton from '@material-ui/core/IconButton';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import CenterFocusStrongIcon from '@material-ui/icons/CenterFocusStrong';
import CropFreeOutlinedIcon from '@material-ui/icons/CropFreeOutlined';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--controls-bg)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: 'var(--controls-shadow)',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5),
  },
  button: {
    color: theme.palette.text.secondary,
    padding: theme.spacing(0.75),
    '&:hover': {
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

export type GraphControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  /** Optional reset-to-100% (1:1) action. Hidden when omitted. */
  onResetZoom?: () => void;
  /** Optional fullscreen toggle. When omitted, the fullscreen button is hidden. */
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onToggleLegend?: () => void;
  showLegend?: boolean;
};

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onResetZoom,
  onToggleFullscreen,
  isFullscreen,
  onToggleLegend,
  showLegend,
}: GraphControlsProps) {
  const classes = useStyles();
  const tokens = useChoreoTokens();

  return (
    <Box
      className={classes.root}
      style={{
        ['--controls-bg' as string]: tokens.graph.minimapMask,
        ['--controls-shadow' as string]: tokens.shadow.md,
      }}
    >
      {onToggleLegend && (
        <Tooltip
          title={showLegend ? 'Hide legend' : 'Show legend'}
          placement="left"
        >
          <IconButton
            className={classes.button}
            onClick={onToggleLegend}
            size="small"
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Zoom in" placement="left">
        <IconButton className={classes.button} onClick={onZoomIn} size="small">
          <AddIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom out" placement="left">
        <IconButton className={classes.button} onClick={onZoomOut} size="small">
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom to fit" placement="left">
        <IconButton
          className={classes.button}
          onClick={onFitToView}
          size="small"
        >
          <CenterFocusStrongIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {onResetZoom && (
        <Tooltip title="Zoom to actual size" placement="left">
          <IconButton
            className={classes.button}
            onClick={onResetZoom}
            size="small"
            aria-label="Zoom to actual size"
          >
            <CropFreeOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {onToggleFullscreen && (
        <Tooltip
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          placement="left"
        >
          <IconButton
            className={classes.button}
            onClick={onToggleFullscreen}
            size="small"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
