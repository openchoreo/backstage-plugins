import { Fragment, useContext } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import {
  createComponentImplementation,
  type ReactComponentImplementation,
} from '@a2ui/react';
import { ButtonApi, Catalog, RowApi, TextApi } from '@a2ui/web_core/v1_0';
import { AskCard, AskField, AskOption, ValueEditor } from './AskCard';
import { ChangeCard, ChangeRow, OptionTile, RuleLine } from './ChangeCard';
import { ExistingCheckCard } from './ExistingCheckCard';
import { MessageCard } from './MessageCard';
import { NoticeCard, PickChip, PickRow } from './NoticeCard';
import { ReplyCard, ReplyLine, ReplySection } from './ReplyCard';
import { SaveCard } from './SaveCard';
import { TestCard } from './TestCard';
import { useButtonStyles } from './cardStyles';
import { AgentUiDisabled } from './context';

/**
 * The catalog the agent names on its surfaces (`createSurface.catalogId`):
 * A2UI's basic Row / Text / Button APIs plus the agent's cards — the
 * ChangeCard of a check edit question, the AskCard of an edit reply that
 * asks instead of proposing, the SaveCard of a check change, the
 * NoticeCard of a reply that drafts no rule, the ExistingCheckCard of a new
 * check like a saved one, the TestCard of a dry-run, the
 * ReplyCard the model fills for its other replies and the MessageCard when
 * it doesn't — drawn with
 * the portal's Material UI components so they look like the rest of the
 * drawer.
 */
export const AGENT_UI_CATALOG_ID = 'openchoreo.dev:portal-assistant/v1';

export { AgentUiDisabled } from './context';

const Row = createComponentImplementation(RowApi, ({ props, buildChild }) => (
  <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
    {(props.children ?? []).map(child => {
      const id = typeof child === 'string' ? child : child.id;
      const basePath = typeof child === 'string' ? undefined : child.basePath;
      return <Fragment key={id}>{buildChild(id, basePath)}</Fragment>;
    })}
  </Box>
));

const Text = createComponentImplementation(TextApi, ({ props }) => (
  <Typography variant="body2" component="span" color="inherit">
    {String(props.text ?? '')}
  </Typography>
));

const AgentButton = createComponentImplementation(
  ButtonApi,
  ({ props, buildChild }) => {
    const classes = useButtonStyles();
    const disabled = useContext(AgentUiDisabled);
    const kind =
      props.variant === 'primary' || props.variant === 'borderless'
        ? props.variant
        : 'outlined';
    return (
      <Button
        size="small"
        className={`${classes.button} ${classes[kind]}`}
        variant={
          { primary: 'contained', borderless: 'text', outlined: 'outlined' }[
            kind
          ] as 'contained' | 'text' | 'outlined'
        }
        disabled={disabled}
        onClick={() => props.action?.()}
      >
        {buildChild(props.child)}
      </Button>
    );
  },
);

export const agentUiCatalog: Catalog<ReactComponentImplementation> =
  new Catalog(AGENT_UI_CATALOG_ID, '1.0', [
    Row,
    Text,
    AgentButton,
    ChangeCard,
    RuleLine,
    ChangeRow,
    OptionTile,
    AskCard,
    ValueEditor,
    AskOption,
    AskField,
    SaveCard,
    NoticeCard,
    PickRow,
    PickChip,
    ReplyCard,
    ReplySection,
    ReplyLine,
    ExistingCheckCard,
    TestCard,
    MessageCard,
  ]);
