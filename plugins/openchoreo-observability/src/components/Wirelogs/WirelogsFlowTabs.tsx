import { FC, useMemo, useState } from 'react';
import { Box, Button, Tab, Tabs, Typography } from '@material-ui/core';
import BlockIcon from '@material-ui/icons/Block';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { JsonViewer } from '@openchoreo/backstage-design-system';
import { useWirelogsDetailStyles } from './styles';
import {
  directionInfo,
  dropReasonText,
  endpointMeta,
  formatAddress,
  getDestinationPort,
  getSourcePort,
  isL7,
  isResponse,
  l4Protocol,
} from './flowFormat';
import type { WirelogEndpoint, WirelogFlow } from './types';

export function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }
}

const KeyValue: FC<{ label: string; value?: string }> = ({ label, value }) => {
  const classes = useWirelogsDetailStyles();
  if (!value) return null;
  return (
    <Box className={classes.kvRow}>
      <span className={classes.kvKey}>{label}</span>
      <span className={classes.kvValue}>{value}</span>
    </Box>
  );
};

const EndpointCard: FC<{
  label: string;
  endpoint: WirelogEndpoint | undefined;
}> = ({ label, endpoint }) => {
  const classes = useWirelogsDetailStyles();
  const meta = endpointMeta(endpoint);
  return (
    <Box className={classes.endpointCard}>
      <Typography className={classes.endpointCardLabel}>{label}</Typography>
      <Typography className={classes.endpointCardTitle}>
        {meta.name ?? '—'}
      </Typography>
      <KeyValue label="namespace" value={meta.namespace} />
      <KeyValue label="component" value={meta.component} />
      <KeyValue label="project" value={meta.project} />
      <KeyValue label="environment" value={meta.environment} />
    </Box>
  );
};

const OverviewPanel: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsDetailStyles();
  const dropped = flow.verdict === 'DROPPED';
  const dir = directionInfo(flow);
  const http = flow.l7?.http;

  return (
    <Box className={classes.tabPanel}>
      {dropped && (
        <Box className={classes.droppedBanner}>
          <BlockIcon fontSize="small" />
          <span>Dropped: {dropReasonText(flow)}</span>
        </Box>
      )}

      <Box className={classes.section}>
        <Typography className={classes.sectionTitle}>Endpoints</Typography>
        <Box className={classes.endpointsGrid}>
          <EndpointCard label="Source" endpoint={flow.source} />
          <Box className={classes.endpointArrow}>
            <ArrowForwardIcon fontSize="small" />
          </Box>
          <EndpointCard label="Destination" endpoint={flow.destination} />
        </Box>
      </Box>

      <Box className={classes.section}>
        <Typography className={classes.sectionTitle}>Networking</Typography>
        <KeyValue label="protocol" value={l4Protocol(flow.l4) ?? '—'} />
        <KeyValue
          label="direction"
          value={
            flow.traffic_direction
              ? flow.traffic_direction.toLowerCase()
              : dir.label
          }
        />
        <KeyValue
          label="source"
          value={formatAddress(flow.IP?.source, getSourcePort(flow.l4))}
        />
        <KeyValue
          label="destination"
          value={formatAddress(
            flow.IP?.destination,
            getDestinationPort(flow.l4),
          )}
        />
      </Box>

      {http && (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>
            L7 ({flow.l7?.http?.protocol ?? 'HTTP'})
          </Typography>
          <KeyValue
            label="kind"
            value={isResponse(flow) ? 'response' : 'request'}
          />
          {isResponse(flow) && http.code !== undefined && (
            <KeyValue label="status" value={String(http.code)} />
          )}
          {!isResponse(flow) && (
            <>
              <KeyValue label="method" value={http.method} />
              <KeyValue label="url" value={http.url} />
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

const HeadersPanel: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsDetailStyles();
  const headers = flow.l7?.http?.headers ?? [];
  const kind = isResponse(flow) ? 'Response' : 'Request';

  if (headers.length === 0) {
    return (
      <Box className={classes.tabPanel}>
        <Typography className={classes.emptyTab}>
          No {kind.toLowerCase()} headers captured for this flow.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.tabPanel}>
      <Typography className={classes.sectionTitle}>
        {kind} headers ({headers.length})
      </Typography>
      <Box className={classes.headersList}>
        {headers.map((h, i) => (
          <Box className={classes.headerRow} key={`${h.key}-${i}`}>
            <span className={classes.headerKey}>{h.key}</span>
            <span className={classes.headerValue}>{h.value}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const RawPanel: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsDetailStyles();
  return (
    <Box className={classes.tabPanel}>
      <Box className={classes.rawHeader}>
        <Button
          className={classes.rawCopyButton}
          startIcon={<FileCopyOutlinedIcon fontSize="small" />}
          onClick={() => copyText(JSON.stringify(flow, null, 2))}
        >
          Copy as JSON
        </Button>
      </Box>
      <JsonViewer
        value={flow}
        showLineNumbers
        wrapLongLines
        maxHeight="calc(100vh - 320px)"
      />
    </Box>
  );
};

export const WirelogsFlowTabs: FC<{ flow: WirelogFlow }> = ({ flow }) => {
  const classes = useWirelogsDetailStyles();
  const showHeaders = isL7(flow);
  const headerCount = flow.l7?.http?.headers?.length ?? 0;

  const tabKeys = useMemo(
    () => ['overview', ...(showHeaders ? ['headers'] : []), 'raw'],
    [showHeaders],
  );
  const [activeTab, setActiveTab] = useState('overview');
  const currentTab = tabKeys.includes(activeTab) ? activeTab : 'overview';

  return (
    <>
      <Tabs
        className={classes.tabs}
        value={currentTab}
        onChange={(_, value) => setActiveTab(value)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab className={classes.tab} value="overview" label="Overview" />
        {showHeaders && (
          <Tab
            className={classes.tab}
            value="headers"
            label={headerCount > 0 ? `Headers ${headerCount}` : 'Headers'}
          />
        )}
        <Tab className={classes.tab} value="raw" label="Raw" />
      </Tabs>

      {currentTab === 'overview' && <OverviewPanel flow={flow} />}
      {currentTab === 'headers' && <HeadersPanel flow={flow} />}
      {currentTab === 'raw' && <RawPanel flow={flow} />}
    </>
  );
};
