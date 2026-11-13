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
  // An address without a scheme (a TCP Endpoint, say) isn't a link.
  const linkable = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
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
}

export const InvokeUrlsDialog = ({
  open,
  onClose,
  endpoints,
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
              </Box>
              <Divider style={{ marginBottom: 12 }} />

              {endpoint.externalURLs &&
                Object.entries(endpoint.externalURLs).map(
                  ([protocol, details]) => (
                    <URLRow
                      key={`ext-${protocol}`}
                      url={buildUrl(details)}
                      label="External"
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
                    />
                  ),
                )}

              {endpoint.serviceURL && (
                <URLRow
                  url={buildServiceUrl(endpoint.serviceURL)}
                  label="Project"
                />
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
