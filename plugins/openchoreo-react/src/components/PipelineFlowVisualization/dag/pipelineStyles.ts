import { makeStyles } from '@material-ui/core/styles';

export const usePipelineStyles = makeStyles(theme => ({
  pipelineContainer: {
    width: '100%',
    position: 'relative',
  },
  scrollArea: {
    overflow: 'auto',
    position: 'relative',
    // Constrain to viewport so only the canvas scrolls, not the page
    maxHeight: 'calc(100vh - 220px)',
  },
  canvas: {
    position: 'relative',
    minWidth: '100%',
  },
  nodeWrapper: {
    position: 'absolute',
  },
  setupNodeWrapper: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
  },
  edgeLine: {
    position: 'absolute',
    borderTop: `1.5px solid ${theme.palette.grey[400]}`,
    transformOrigin: 'center',
    zIndex: 0,
    pointerEvents: 'none',
  },
  arrowHead: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderTop: '4px solid transparent',
    borderBottom: '4px solid transparent',
    borderLeft: `6px solid ${theme.palette.grey[400]}`,
    zIndex: 0,
    pointerEvents: 'none',
  },
}));
