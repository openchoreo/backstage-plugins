import { Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { Box, Button, Drawer, IconButton, Typography } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { JsonViewer } from '@openchoreo/backstage-design-system';
import { useAuditDrawerStyles, useAuditResultPillStyles } from './styles';
import { AuditFilterPath, AuditLogRecord } from './types';
import { fullTime, relativeAge, surfaceLabel } from './format';

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
        {hasValue && hint && <span className={classes.valueHint}>{hint}</span>}
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
  const addFilter = (path: AuditFilterPath, value: string) => {
    onAddToken(path, value);
    onClose();
  };

  const drill = (path: AuditFilterPath, value: string) => (
    <button
      type="button"
      className={classes.drill}
      title={`Filter by ${path}:${value}`}
      onClick={() => addFilter(path, value)}
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
  const scope: Array<{ key: string; value: string; path?: AuditFilterPath }> =
    resource
      ? [
          resource.namespace
            ? {
                key: 'namespace',
                value: resource.namespace,
                path: 'resource.namespace',
              }
            : { key: 'scope', value: 'cluster' },
          ...(resource.project
            ? [
                {
                  key: 'project',
                  value: resource.project,
                  path: 'resource.project' as const,
                },
              ]
            : []),
          ...(resource.component
            ? [
                {
                  key: 'component',
                  value: resource.component,
                  path: 'resource.component' as const,
                },
              ]
            : []),
          ...(resource.resource
            ? [
                {
                  key: 'resource',
                  value: resource.resource,
                  path: 'resource.resource' as const,
                },
              ]
            : []),
        ]
      : [];
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
                {record.result}
              </span>
              {record.surface && <span>{surfaceLabel(record.surface)}</span>}
              <span>
                {fullTime(record.event_time)} · {relativeAge(record.event_time)}
              </span>
            </Box>
          </Box>

          <Box className={classes.body}>
            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>Who</Typography>
              <dl className={classes.kv}>
                <Field
                  label="Actor"
                  mono
                  hint="Token's sub claim. Only unique within the issuer."
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
                  hint="Token's sid claim."
                  absent="No sid claim."
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
                <Field label="Surface" mono>
                  {record.surface
                    ? drill('surface', record.surface)
                    : undefined}
                </Field>
                <Field
                  label="Request line"
                  mono
                  // No filter accepts a method or path, so this stays text.
                  absent="No request line."
                >
                  {record.http?.path
                    ? `${record.http.method ?? ''} ${record.http.path}`.trim()
                    : undefined}
                </Field>
                <Field label="Outcome">{drill('result', record.result)}</Field>
              </dl>
            </Box>

            {resource && (
              <Box className={classes.section}>
                <Box className={classes.whereHead}>
                  <Typography
                    className={`${classes.sectionTitle} ${classes.inlineSectionTitle}`}
                  >
                    Where
                  </Typography>
                  <Box className={classes.path}>
                    {scope.map(({ key, value, path }) => {
                      const content = (
                        <>
                          <span className={classes.pathKey}>{key}</span>
                          <span className={classes.pathValue}>{value}</span>
                        </>
                      );
                      return path ? (
                        <button
                          key={key}
                          type="button"
                          className={`${classes.pathSegment} ${classes.pathSegmentDrill}`}
                          title={`Filter by ${path}:${value}`}
                          onClick={() => addFilter(path, value)}
                        >
                          {content}
                        </button>
                      ) : (
                        <span key={key} className={classes.pathSegment}>
                          {content}
                        </span>
                      );
                    })}
                  </Box>
                </Box>
                <dl className={classes.kv}>
                  <Field label="Resource type" mono>
                    {resource.type
                      ? drill('resource.type', resource.type)
                      : undefined}
                  </Field>
                  <Field
                    label="Environment"
                    mono
                    hint="Namespace-qualified environment."
                    absent="No environment."
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
                    hint="Kubernetes object UID."
                    absent="No Kubernetes object UID."
                  >
                    {resource.uid}
                  </Field>
                </dl>
              </Box>
            )}

            <Box className={classes.section}>
              <Typography className={classes.sectionTitle}>
                Correlation
              </Typography>
              <dl className={classes.kv}>
                <Field label="Event ID" mono>
                  {drill('event_id', record.event_id)}
                </Field>
                <Field label="Request ID" mono>
                  {record.request_id
                    ? drill('request_id', record.request_id)
                    : undefined}
                </Field>
                <Field label="Client" mono absent="no User-Agent header sent">
                  {record.user_agent
                    ? drill('user_agent', record.user_agent)
                    : undefined}
                </Field>
                <Field label="Source IP" mono absent="No source IP found.">
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
                  hint="Collector provided information."
                  absent="No collector information found."
                >
                  {record.collector?.podName}
                </Field>
                <Field
                  label="Schema version"
                  mono
                  hint="Audit event schema version."
                >
                  {record.schema_version}
                </Field>
              </dl>
            </Box>

            <Box className={classes.section}>
              <Box className={classes.sectionHead}>
                <Typography
                  className={`${classes.sectionTitle} ${classes.inlineSectionTitle}`}
                >
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
