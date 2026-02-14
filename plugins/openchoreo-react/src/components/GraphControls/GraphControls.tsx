import IconButton from '@material-ui/core/IconButton';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import RemoveIcon from '@material-ui/icons/Remove';
import CenterFocusStrongIcon from '@material-ui/icons/CenterFocusStrong';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(30, 30, 30, 0.75)'
        : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onToggleLegend?: () => void;
  showLegend?: boolean;
};

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFitToView,
  onToggleFullscreen,
  isFullscreen,
  onToggleLegend,
  showLegend,
}: GraphControlsProps) {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
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
      <Tooltip title="Fit to view" placement="left">
        <IconButton
          className={classes.button}
          onClick={onFitToView}
          size="small"
        >
          <CenterFocusStrongIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        placement="left"
      >
        <IconButton
          className={classes.button}
          onClick={onToggleFullscreen}
          size="small"
        >
          {isFullscreen ? (
            <FullscreenExitIcon fontSize="small" />
          ) : (
            <FullscreenIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
