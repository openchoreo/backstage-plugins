import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';

export const useStyles = makeStyles(theme => ({
  metadataCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '120px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    wordBreak: 'break-all' as const,
  },
  copyableRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    minWidth: 0,
    overflow: 'hidden',
  },
  copyButton: {
    padding: theme.spacing(0.5),
    flexShrink: 0,
  },
  codeBlockWrapper: {
    position: 'relative' as const,
  },
  codeBlockCopyButton: {
    position: 'absolute' as const,
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    zIndex: 1,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    margin: 0,
    padding: theme.spacing(1.5),
    paddingRight: theme.spacing(4.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
    backgroundColor: alpha(theme.palette.background.default, 0.5),
    color: theme.palette.text.primary,
    overflow: 'auto',
    maxHeight: '300px',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
}));
