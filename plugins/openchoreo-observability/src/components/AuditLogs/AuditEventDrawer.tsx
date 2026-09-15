import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { Box, Button, Drawer, IconButton, Typography } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { JsonViewer } from '@openchoreo/backstage-design-system';
import { useAuditDrawerStyles, useAuditResultPillStyles } from './styles';
import { AUDIT_RESULTS, AuditFilterPath, AuditLogRecord } from './types';
import { fullTime, relativeAge, resultLabel } from './format';

export interface AuditEventDrawerProps {
  record?: AuditLogRecord;
  open: boolean;
  onClose: () => void;
  /** Adds a filter for a value in the record — the "show me everything like this" move. */
  onAddToken: (path: AuditFilterPath, value: string) => void;
}

interface FieldProps {
  label: string;
  children?: ReactNode;
  /** Shown in place of a value the record does not carry, saying why. */
  absent?: string;
  hint?: string;
  mono?: boolean;
}

const Field = ({ label, children, absent, hint, mono }: FieldProps) => {
  const classes = useAuditDrawerStyles();
  const hasValue =
    children !== undefined && children !== null && children !== '';
  return (
    <>
      <dt className={classes.key}>{label}</dt>
      <dd className={`${classes.value} ${mono ? classes.valueMono : ''}`}>
        {hasValue ? (
          children
        ) : (
          <span className={classes.absent}>{absent ?? 'Not recorded.'}</span>
        )}
        {hint && <span className={classes.valueHint}>{hint}</span>}
      </dd>
    </>
  );
};

/**
 * One audit record in full: who, what, where, and what it correlates with —
 * then the record exactly as it was published.
 *
 * Values that the API can filter on are buttons: the fastest path from "this
 * looks odd" to "show me everything like it". Values with no filter
 * (`resource.uid`, the request line, `schema_version`) are plain text rather
 * than buttons that would send a filter the query cannot express.
 */
export const AuditEventDrawer = ({
  record,
  open,
  onClose,
  onAddToken,
}: AuditEventDrawerProps) => {
  const classes = useAuditDrawerStyles();
  const pills = useAuditResultPillStyles();
  const [copied, setCopied] = useState(false);

  // Adds to the query rather than replacing it, then closes: the point of the
  // drill is to see the records that share this value, and the drawer sits over
  // the list that now shows them.
  const drill = (path: AuditFilterPath, value: string) => (
    <button
      type="button"
      className={classes.drill}
      title={`Filter by ${path}:${value}`}
      onClick={() => {
        onAddToken(path, value);
        onClose();
      }}
    >
      {value}
    </button>
  );

  const resetTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async () => {
    if (!record) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(record, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const resource = record?.resource ?? undefined;
  const resultNote = AUDIT_RESULTS.find(r => r.id === record?.result)?.note;
  // A result this client predates gets no pill styling rather than borrowing
  // another outcome's, which would misreport it.
  const pillClass = record
    ? pills[record.result as keyof typeof pills] ?? ''
    : '';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ className: classes.paper }}
      aria-label="Audit event detail"
    >
      {record && (
        <>
          <Box className={classes.head}>
            <Box className={classes.eyebrow}>
              Audit event
              <span className={classes.grow} />
              <IconButton size="small" aria-label="Close" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <div className={classes.title}>
              {record.action || 'authentication rejected'}
            </div>
            <Box className={classes.meta}>
              <span className={`${classes.pill} ${pillClass}`}>
                {resultLabel(record.result)}
              </span>
              {record.surface && (
                <span>
                  {record.surface === 'mcp' ? 'via MCP' : 'via the REST API'}
                </span>
              )}
              <span>
                {fullTime(record.event_time)} · {relativeAge(record.event_time)}
              </span>
            </Box>
          </Box>

          <Box className={classes.body}>
            {record.result === 'unauthenticated' && (
              <Box className={classes.notice}>
                <span>
                  <b>Refused at the boundary.</b> The request never resolved to
                  an operation, so there is no action, category or resource to
                  record, and no reason for the rejection. OpenChoreo does not
                  see sign-in attempts. Check your identity provider's logs for
                  why this was refused.
                </span>
              </Box>
            )}

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Who</Typography>
              <dl className={classes.kv}>
                <Field
                  label="Actor"
                  mono
                  hint="From the token's sub claim. Only unique within the issuer."
                >
                  {drill('actor.id', record.actor.id)}
                </Field>
                <Field label="Type">
                  {drill('actor.type', record.actor.type)}
                </Field>
                <Field label="Issuer" mono absent="No validated token.">
                  {record.actor.issuer
                    ? drill('actor.issuer', record.actor.issuer)
                    : undefined}
                </Field>
                <Field
                  label="Session"
                  mono
                  hint={
                    record.actor.session_id
                      ? "From the sid claim. Match it against the IdP's login record."
                      : undefined
                  }
                  absent="No sid claim. OIDC makes it optional, and client-credentials tokens never carry one."
                >
                  {record.actor.session_id
                    ? drill('actor.session_id', record.actor.session_id)
                    : undefined}
                </Field>
                <Field
                  label="Entitlements"
                  absent="No entitlement claim on the token."
                >
                  {record.actor.entitlements &&
                  Object.keys(record.actor.entitlements).length > 0
                    ? Object.entries(record.actor.entitlements).map(
                        ([claim, values]) => (
                          <Fragment key={claim}>
                            {values.map((value, index) => (
                              <Fragment key={value}>
                                {index > 0 && ', '}
                                {drill('actor.entitlements', value)}
                              </Fragment>
                            ))}
                            <span className={classes.valueHint}>
                              from the {claim} claim
                            </span>
                          </Fragment>
                        ),
                      )
                    : undefined}
                </Field>
              </dl>
            </Box>

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>What</Typography>
              <dl className={classes.kv}>
                <Field label="Action" mono absent="No operation resolved.">
                  {record.action ? drill('action', record.action) : undefined}
                </Field>
                <Field label="Category" absent="No operation resolved.">
                  {record.category
                    ? drill('category', record.category)
                    : undefined}
                </Field>
                <Field label="Operation ID" mono absent="None.">
                  {record.operation_id
                    ? drill('operation_id', record.operation_id)
                    : undefined}
                </Field>
                <Field
                  label="Surface"
                  mono
                  hint={
                    record.surface === 'mcp'
                      ? 'MCP calls the REST API, so this is the only record of it. The tool name is not stored.'
                      : undefined
                  }
                >
                  {record.surface
                    ? drill('surface', record.surface)
                    : undefined}
                </Field>
                <Field
                  label="Request line"
                  mono
                  // No filter accepts a method or path, so this stays text.
                  absent="An MCP tools/call has no request line of its own."
                >
                  {record.http?.path
                    ? `${record.http.method ?? ''} ${record.http.path}`.trim()
                    : undefined}
                </Field>
                <Field label="Outcome" hint={resultNote}>
                  {drill('result', record.result)}
                </Field>
              </dl>
            </Box>

            {resource && (
              <Box className={classes.section}>
                <Box className={classes.whereHead}>
                  <Typography className={classes.sectionTitle}>
                    Where
                  </Typography>
                  <Box className={classes.path}>
                    {[
                      resource.namespace
                        ? (['namespace', resource.namespace] as const)
                        : (['scope', 'cluster'] as const),
                      ...(resource.project
                        ? [['project', resource.project] as const]
                        : []),
                      ...(resource.component
                        ? [['component', resource.component] as const]
                        : []),
                      ...(resource.resource
                        ? [['resource', resource.resource] as const]
                        : []),
                    ].map(([key, value]) => (
                      <span key={key} className={classes.pathSegment}>
                        <span className={classes.pathKey}>{key}</span>
                        <span className={classes.pathValue}>{value}</span>
                      </span>
                    ))}
                  </Box>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  What the decision was made against. It is recorded before
                  policy runs, so denied events carry it too.
                </Typography>
                <Box marginTop={1}>
                  <dl className={classes.kv}>
                    <Field label="Resource type" mono>
                      {resource.type
                        ? drill('resource.type', resource.type)
                        : undefined}
                    </Field>
                    <Field
                      label="Environment"
                      mono
                      hint="Namespace-qualified. Not a level of the hierarchy; it comes from the ABAC attributes a CEL condition reads."
                      absent="This operation is not environment-scoped."
                    >
                      {resource.environment
                        ? drill('resource.environment', resource.environment)
                        : undefined}
                    </Field>
                    <Field label="Name" mono>
                      {resource.name
                        ? drill('resource.name', resource.name)
                        : undefined}
                    </Field>
                    <Field
                      label="Resource UID"
                      mono
                      // No filter accepts uid: it is absent on deletes and on
                      // non-CRUD mutations, so filtering by it would exclude
                      // exactly the operations an investigation wants.
                      hint={
                        resource.uid
                          ? 'Server-generated and never reused, so a delete and recreate cannot be mistaken for an update.'
                          : undefined
                      }
                      absent="The operation returned no object."
                    >
                      {resource.uid}
                    </Field>
                  </dl>
                </Box>
              </Box>
            )}

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>
                Correlation
              </Typography>
              <dl className={classes.kv}>
                <Field
                  label="Event ID"
                  mono
                  hint="A UUID v7, so sorting by it sorts by time."
                >
                  {drill('event_id', record.event_id)}
                </Field>
                <Field
                  label="Request ID"
                  mono
                  hint="Matches the access log line for the same request."
                >
                  {record.request_id
                    ? drill('request_id', record.request_id)
                    : undefined}
                </Field>
                <Field
                  label="Client"
                  mono
                  hint={
                    record.user_agent
                      ? 'Client-supplied, so treat it as a claim, not proof.'
                      : undefined
                  }
                  absent="no User-Agent header sent"
                >
                  {record.user_agent
                    ? drill('user_agent', record.user_agent)
                    : undefined}
                </Field>
                <Field
                  label="Source IP"
                  mono
                  absent={
                    record.surface === 'mcp'
                      ? 'Not available for a direct MCP client. There is no RemoteAddr and no forwarding header.'
                      : 'not recorded'
                  }
                >
                  {record.source_ip
                    ? drill('source_ip', record.source_ip)
                    : undefined}
                </Field>
                <Field label="Producer" mono>
                  {record.producer
                    ? drill('producer', record.producer)
                    : undefined}
                </Field>
                <Field
                  label="Collected from"
                  mono
                  hint="Stamped by the collector, not by the service. Worth comparing with Producer."
                  absent="Not reported by this backend."
                >
                  {record.collector?.podName}
                </Field>
                <Field
                  label="Schema version"
                  mono
                  hint="Major bumps on a removal or a changed field, minor on an addition."
                >
                  {record.schema_version}
                </Field>
              </dl>
            </Box>

            <Box className={classes.section}>
              <Box className={classes.sectionHead}>
                <Typography className={classes.sectionTitle}>
                  Record as published
                </Typography>
                <span className={classes.grow} />
                <Button size="small" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Box>
              <JsonViewer value={record} maxHeight={320} />
            </Box>
          </Box>
        </>
      )}
    </Drawer>
  );
};

export default AuditEventDrawer;
