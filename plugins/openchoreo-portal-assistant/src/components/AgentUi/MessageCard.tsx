import { useContext } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { useCardStyles } from './cardStyles';
import { AgentUiMarkdown } from './context';

/**
 * A check authoring reply that no other card shows: its text (Markdown) in
 * the card frame, so every reply in the chat reads the same way. The agent
 * sends it (message_card_surface in src/agent/a2ui.py); the drawer renders
 * the Markdown through AgentUi's `renderMarkdown`.
 */

export const MessageCardApi = {
  name: 'MessageCard',
  schema: z.object({
    text: CommonSchemas.DynamicString,
  }),
};

const useStyles = makeStyles(theme => ({
  body: {
    padding: theme.spacing(1.5, 1.75),
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
    '& > :first-child': { marginTop: 0 },
    '& > :last-child': { marginBottom: 0 },
    '& p, & ul, & ol': { margin: theme.spacing(0, 0, 1) },
    '& ul, & ol': { paddingLeft: theme.spacing(2.5) },
    '& code': {
      fontFamily: 'monospace',
      fontSize: '0.92em',
      padding: theme.spacing(0, 0.5),
      borderRadius: 4,
      backgroundColor: alpha(theme.palette.text.primary, 0.08),
    },
    '& pre': {
      overflowX: 'auto',
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
      backgroundColor: alpha(theme.palette.text.primary, 0.06),
    },
    '& pre code': { padding: 0, backgroundColor: 'transparent' },
    '& a': { color: theme.palette.primary.main },
  },
  plain: { whiteSpace: 'pre-wrap' },
}));

export const MessageCard = createComponentImplementation(
  MessageCardApi,
  ({ props }) => {
    const cardClasses = useCardStyles();
    const classes = useStyles();
    const renderMarkdown = useContext(AgentUiMarkdown);
    const text = String(props.text ?? '');
    return (
      <Box className={cardClasses.card} role="group" aria-label="Reply">
        <Box className={classes.body}>
          {renderMarkdown ? (
            renderMarkdown(text)
          ) : (
            <Typography variant="body2" className={classes.plain}>
              {text}
            </Typography>
          )}
        </Box>
      </Box>
    );
  },
);
