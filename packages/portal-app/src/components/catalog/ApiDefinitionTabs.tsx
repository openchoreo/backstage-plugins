import { useState } from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { WarningPanel } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { YamlEditor } from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles(theme => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  editorWrapper: {
    position: 'relative',
    flex: 1,
    minHeight: 400,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  copyButton: {
    position: 'absolute',
    top: theme.spacing(1),
    // Match the editor's own floating buttons (right: spacing(3)) so this
    // clears the CodeMirror vertical scrollbar.
    right: theme.spacing(3),
    // Sit above the editor's own (empty) floating-button layer (zIndex 10).
    zIndex: 11,
    backgroundColor: theme.palette.background.paper,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

/**
 * Renders the raw API definition (the "Definition" tab) using the shared
 * OpenChoreo `YamlEditor` in read-only mode — matching the resource/component
 * Definition tab — with a copy-to-clipboard button.
 */
export const ApiRawDefinitionCard = () => {
  const { entity } = useEntity();
  const classes = useStyles();
  const [copied, setCopied] = useState(false);

  const definition = entity.spec?.definition as string | undefined;
  if (!definition) {
    return (
      <WarningPanel title="No API definition available for this entity." />
    );
  }

  const handleCopy = () => {
    // Only signal success once the write actually resolves — a silent
    // fire-and-forget would show "Copied" even when the clipboard API is
    // unavailable (insecure context) or the write is rejected.
    navigator.clipboard?.writeText(definition).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* clipboard write failed; leave the button state unchanged */
      },
    );
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.editorWrapper}>
        <Tooltip title={copied ? 'Copied' : 'Copy'}>
          <IconButton
            size="small"
            aria-label="Copy definition"
            className={classes.copyButton}
            onClick={handleCopy}
          >
            <FileCopyOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <YamlEditor content={definition} onChange={() => undefined} readOnly />
      </Box>
    </Box>
  );
};
