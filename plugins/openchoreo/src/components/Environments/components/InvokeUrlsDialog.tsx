import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Chip,
} from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import LockOpenOutlinedIcon from '@material-ui/icons/LockOpenOutlined';
import type {
  EndpointInfo,
  EndpointURLSecurity,
} from '../hooks/useEnvironmentData';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import {
  buildServiceUrl,
  buildUrl,
  describeSecurity,
} from '../utils/invokeUrlUtils';

interface URLRowProps {
  url: string;
  label: string;
  /** What a caller must present, for URLs that come from an Endpoint. */
  security?: EndpointURLSecurity;
}

/** Keeps a long URL on one line, cut off with an ellipsis. */
const urlTextStyle = {
  display: 'block',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

/**
 * One URL with its visibility label, a copy button and, for URLs that come
 * from an Endpoint, a padlock describing the security a caller must present.
 */
export const URLRow = ({ url, label, security }: URLRowProps) => {
  const theme = useTheme();
  const securityLabel = describeSecurity(security);
  const LockIcon =
    security?.scheme === 'none' ? LockOpenOutlinedIcon : LockOutlinedIcon;
  // Only a web URL opens in a browser tab. An address without a scheme (a
  // TCP Endpoint, say) or with another one (ws://, grpc://) is shown as text.
  const linkable = /^https?:\/\//i.test(url);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box mb={1.5}>
      <Box display="flex" alignItems="center" mb={0.5}>
        <Chip
          label={label}
          size="small"
          style={{ fontSize: '0.7rem', height: 20 }}
        />
        {securityLabel && (
          <Tooltip title={securityLabel}>
            <LockIcon
              // SvgIcon hides itself from assistive tech by default; this
              // one carries the security, so it's announced.
              aria-hidden={false}
              role="img"
              aria-label={securityLabel}
              color="action"
              style={{ fontSize: 16, marginLeft: 6 }}
            />
          </Tooltip>
        )}
      </Box>
      <Box display="flex" alignItems="flex-start">
        <Box
          style={{
            flex: 1,
            // Lets the URL shrink below its width, so it's cut off instead
            // of pushing the copy button out.
            minWidth: 0,
            backgroundColor: 'rgba(0,0,0,0.04)',
            borderRadius: 4,
            padding: '6px 8px',
          }}
        >
          {linkable ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              style={{
                ...urlTextStyle,
                color: theme.palette.primary.main,
                textDecoration: 'none',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.textDecoration =
                  'underline';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.textDecoration = 'none';
              }}
            >
              {url}
            </a>
          ) : (
            <span title={url} style={urlTextStyle}>
              {url}
            </span>
          )}
        </Box>
        <Tooltip
          title={copied ? 'Copied!' : 'Copy URL'}
          open={copied ? true : undefined}
          leaveDelay={copied ? 0 : 200}
        >
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label="Copy URL"
            style={{ marginLeft: 4, flexShrink: 0 }}
          >
            <FileCopyOutlinedIcon style={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

interface InvokeUrlsDialogProps {
  open: boolean;
  onClose: () => void;
  endpoints: EndpointInfo[];
  /** Catalog namespace of the component, which its Endpoints share. */
  namespaceName?: string;
}

/**
 * Lists every URL of a component's workload endpoints in one environment.
 * A workload endpoint exposed through one of the component's Endpoints shows
 * the Endpoint's URLs, with the security each enforces and a link to the
 * Endpoint; any other shows the URLs from the component's ReleaseBinding.
 */
export const InvokeUrlsDialog = ({
  open,
  onClose,
  endpoints,
  namespaceName = 'default',
}: InvokeUrlsDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="invoke-urls-dialog-title"
    >
      <DialogTitle id="invoke-urls-dialog-title">Endpoint URLs</DialogTitle>
      <DialogContent dividers>
        {endpoints.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No invoke URLs available.
          </Typography>
        ) : (
          endpoints.map((endpoint, idx) => (
            <Box key={endpoint.name} mb={idx < endpoints.length - 1 ? 3 : 0}>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {endpoint.name}
                </Typography>
                {endpoint.type && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ marginLeft: 8 }}
                  >
                    ({endpoint.type})
                  </Typography>
                )}
                {endpoint.endpointName && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    style={{ marginLeft: 'auto' }}
                  >
                    via Endpoint{' '}
                    <EntityRefLink
                      entityRef={{
                        kind: 'endpoint',
                        namespace: namespaceName,
                        name: endpoint.endpointName,
                      }}
                      onClick={onClose}
                    />
                  </Typography>
                )}
              </Box>
              <Divider style={{ marginBottom: 12 }} />

              {endpoint.externalURLs &&
                Object.entries(endpoint.externalURLs).map(
                  ([protocol, details]) => (
                    <URLRow
                      key={`ext-${protocol}`}
                      url={buildUrl(details)}
                      label="External"
                      security={details.security}
                    />
                  ),
                )}

              {endpoint.internalURLs &&
                Object.entries(endpoint.internalURLs).map(
                  ([protocol, details]) => (
                    <URLRow
                      key={`int-${protocol}`}
                      url={buildUrl(details)}
                      label="Internal"
                      security={details.security}
                    />
                  ),
                )}

              {endpoint.namespaceURLs &&
                Object.entries(endpoint.namespaceURLs).map(
                  ([protocol, details]) => (
                    <URLRow
                      key={`ns-${protocol}`}
                      url={buildUrl(details)}
                      label="Namespace"
                      security={details.security}
                    />
                  ),
                )}

              {endpoint.projectURL ? (
                <URLRow
                  url={buildUrl(endpoint.projectURL)}
                  label="Project"
                  security={endpoint.projectURL.security}
                />
              ) : (
                endpoint.serviceURL && (
                  <URLRow
                    url={buildServiceUrl(endpoint.serviceURL)}
                    label="Project"
                  />
                )
              )}
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
