import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Alert, { Color as AlertSeverity } from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import LinkIcon from '@material-ui/icons/Link';
import { parseEntityRef } from '@backstage/catalog-model';
import { Link, MarkdownContent } from '@backstage/core-components';
import { useApp, useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import type { ScaffolderTaskOutput } from '@backstage/plugin-scaffolder-common';

const useStyles = makeStyles({
  section: {
    padding: 16,
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  link: {
    '&:hover': {
      textDecoration: 'none',
    },
  },
  alert: {
    // MarkdownContent renders its text in a <p>; drop the default block margins
    // so the note reads as a single alert-bar line.
    '& p': {
      margin: 0,
    },
  },
});

const ALERT_SEVERITIES: readonly AlertSeverity[] = [
  'error',
  'warning',
  'info',
  'success',
];

/**
 * Maps a scaffolder `output.text` entry's `icon` field to an Alert severity.
 * `output.text` has no dedicated severity field, so templates signal intent via
 * `icon` (e.g. `icon: 'warning'`). Anything unset/unrecognised renders as a
 * neutral info bar.
 */
const toSeverity = (icon?: string): AlertSeverity =>
  ALERT_SEVERITIES.includes(icon as AlertSeverity)
    ? (icon as AlertSeverity)
    : 'info';

/** A single `output.text` entry rendered as a severity-coloured alert bar. */
function TemplateTextOutput(props: {
  severity: AlertSeverity;
  title?: string;
  content: string;
}) {
  const classes = useStyles();
  return (
    <Box paddingBottom={2}>
      <Alert severity={props.severity} className={classes.alert}>
        {props.title && <AlertTitle>{props.title}</AlertTitle>}
        <MarkdownContent content={props.content} />
      </Alert>
    </Box>
  );
}

/**
 * Scaffolder task-page outputs renderer used across all OpenChoreo templates
 * (wired as `EXPERIMENTAL_TemplateOutputsComponent` in OpenChoreoScaffolderPage).
 *
 * Renders the standard "links in a centered box" (e.g. the "View Project"
 * link), then each `output.text` entry as an alert bar below it instead of the
 * default plain card. Each bar's variant is data-driven: `text.icon` selects
 * the severity ('error' | 'warning' | 'info' | 'success', default 'info') and
 * `text.title` renders as an optional heading. The project wizard's manual-
 * deploy note, for example, sets `icon: 'warning'` and no title.
 */
export function OpenChoreoTemplateOutputs(props: {
  output?: ScaffolderTaskOutput;
}) {
  const classes = useStyles();
  const app = useApp();
  const entityRoute = useRouteRef(entityRouteRef);

  const output = props.output;
  const links = (output?.links ?? []).filter(({ url, entityRef }) =>
    Boolean(url || entityRef),
  );
  const texts = (output?.text ?? []).filter(text => Boolean(text.content));

  if (links.length === 0 && texts.length === 0) {
    return null;
  }

  const resolveIcon = (key?: string) =>
    (key && app.getSystemIcon(key)) || LinkIcon;

  return (
    <>
      {links.length > 0 && (
        <Box paddingBottom={2}>
          <Paper>
            <Box className={classes.section}>
              {links.map(({ url, entityRef, title, icon }, index) => {
                const Icon = resolveIcon(icon);
                const to = entityRef
                  ? entityRoute(parseEntityRef(entityRef))
                  : url!;
                return (
                  <Link key={index} to={to} classes={{ root: classes.link }}>
                    <Button
                      startIcon={<Icon />}
                      component="div"
                      color="primary"
                    >
                      {title}
                    </Button>
                  </Link>
                );
              })}
            </Box>
          </Paper>
        </Box>
      )}
      {texts.map((text, index) => (
        <TemplateTextOutput
          key={index}
          severity={toSeverity(text.icon)}
          title={text.title}
          content={text.content ?? ''}
        />
      ))}
    </>
  );
}
