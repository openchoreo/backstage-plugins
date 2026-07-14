import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { PageLoader } from '@openchoreo/backstage-design-system';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

import { useExecPermission } from '@openchoreo/backstage-plugin-react';
import { TerminalPanel, useExecSession } from '../../../Terminal';
import { useTreeStyles } from './treeStyles';
import type { ExecContext } from './treeTypes';

interface ResourcePodTerminalViewerProps {
  execContext: ExecContext;
  /** Target pod name. Omitted for the component/environment-level fallback. */
  podName?: string;
  /** Container names available in the pod (drives the picker). */
  containers?: string[];
  /** Pre-selected container (defaults to the first). */
  initialContainer?: string;
  /** Auto-start the session on mount (used by the full-window page). */
  autoConnect?: boolean;
  /** Full-window mode: hide the "open in new tab" action (already standalone). */
  fullWindow?: boolean;
}

/**
 * Interactive shell for a deployed component, hosted inside a resource-tree
 * node drawer. When `podName` is provided (Pod node) the session targets that
 * exact pod and the picked container; otherwise the control plane resolves the
 * pod for the component + environment (ReleaseBinding fallback).
 *
 * Reuses the shared `TerminalPanel` (xterm.js) and `useExecSession` primitives.
 * Permission is gated by `useExecPermission(environment)` — the same per-env
 * ABAC check the rest of the UI uses; the backend re-enforces it on /exec/init.
 */
export const ResourcePodTerminalViewer: FC<ResourcePodTerminalViewerProps> = ({
  execContext,
  podName,
  containers,
  initialContainer,
  autoConnect,
  fullWindow,
}) => {
  const classes = useTreeStyles();

  const {
    canExec,
    loading: permLoading,
    deniedTooltip,
  } = useExecPermission(execContext.environmentName || undefined);

  const containerOptions = useMemo(() => containers ?? [], [containers]);
  const [selectedContainer, setSelectedContainer] = useState(
    initialContainer || containerOptions[0] || '',
  );
  useEffect(() => {
    // Reset when the current selection isn't valid for the (possibly new) pod's
    // container list — not only when it's empty. Otherwise switching pods while
    // the drawer stays mounted keeps a stale, unattachable containerName.
    if (
      containerOptions.length > 0 &&
      !containerOptions.includes(selectedContainer)
    ) {
      setSelectedContainer(containerOptions[0]);
    }
  }, [containerOptions, selectedContainer]);

  const { state, errorMessage, connect, disconnect, sendData, onData } =
    useExecSession();

  // Terminal write function — stored in a ref so the TerminalPanel callback can
  // be invoked from the WebSocket message handler.
  const writeRef = useRef<((data: Uint8Array) => void) | null>(null);
  // Latest terminal dimensions — populated by TerminalPanel on mount/resize.
  const termDimsRef = useRef<{ cols: number; rows: number } | null>(null);
  // Mirror of `state` so the stable resize callback can read the live value.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleTerminalReady = useCallback(
    (write: (data: Uint8Array) => void) => {
      writeRef.current = write;
    },
    [],
  );

  // Wire WebSocket output → terminal
  useEffect(() => {
    onData(data => {
      if (writeRef.current) {
        writeRef.current(data);
      }
    });
  }, [onData]);

  // Build and send a PTY resize frame (stream type 0x03). The OpenChoreo exec
  // handler requires this to allocate the PTY; without it the shell exits
  // immediately after the WebSocket opens.
  const sendResizeFrame = useCallback(
    (cols: number, rows: number) => {
      const json = JSON.stringify({ width: cols, height: rows });
      const bytes = new TextEncoder().encode(json);
      const frame = new Uint8Array(1 + bytes.length);
      frame[0] = 0x03;
      frame.set(bytes, 1);
      sendData(frame);
    },
    [sendData],
  );

  // Store the latest dimensions and, when a session is live, forward them as a
  // PTY resize frame. TerminalPanel calls this on mount and on every window /
  // container resize, so drawer and full-window layout changes are covered.
  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      termDimsRef.current = { cols, rows };
      if (stateRef.current === 'connected') {
        sendResizeFrame(cols, rows);
      }
    },
    [sendResizeFrame],
  );

  // Send the initial PTY resize frame as soon as the WebSocket opens — xterm's
  // first fit happens before connect, so handleTerminalResize can't send it yet.
  useEffect(() => {
    if (state === 'connected' && termDimsRef.current) {
      sendResizeFrame(termDimsRef.current.cols, termDimsRef.current.rows);
    }
  }, [state, sendResizeFrame]);

  const handleConnect = useCallback(() => {
    connect({
      namespaceName: execContext.namespaceName,
      projectName: execContext.projectName,
      componentName: execContext.componentName,
      environment: execContext.environmentName,
      podName,
      containerName: selectedContainer || undefined,
    });
  }, [connect, execContext, podName, selectedContainer]);

  // Auto-start the session once (full-window page). Waits for the permission
  // check to resolve, then connects only on the initial idle state.
  const autoConnectedRef = useRef(false);
  useEffect(() => {
    if (
      autoConnect &&
      canExec &&
      !autoConnectedRef.current &&
      state === 'idle'
    ) {
      autoConnectedRef.current = true;
      handleConnect();
    }
  }, [autoConnect, canExec, state, handleConnect]);

  // Open the same session target in a standalone full-window browser tab.
  const openInNewTab = useCallback(() => {
    const params = new URLSearchParams({
      ns: execContext.namespaceName,
      project: execContext.projectName,
      component: execContext.componentName,
      env: execContext.environmentName,
      envLabel: execContext.environmentDisplayName,
      entityRef: execContext.entityRef,
    });
    if (podName) params.set('pod', podName);
    if (containerOptions.length > 0) {
      params.set('containers', containerOptions.join(','));
    }
    if (selectedContainer) params.set('container', selectedContainer);
    window.open(
      `${window.location.origin}/exec-terminal?${params.toString()}`,
      '_blank',
      'noopener',
    );
  }, [execContext, podName, containerOptions, selectedContainer]);

  if (permLoading) return <PageLoader />;

  if (!canExec) {
    return (
      <Box className={classes.drawerEmptyState}>
        <Typography variant="body2" color="textSecondary">
          {deniedTooltip ||
            'You do not have permission to exec into this component.'}
        </Typography>
      </Box>
    );
  }

  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting';
  const canConnect = !isConnected && !isConnecting;

  let connectLabel = 'Connect';
  if (isConnecting) connectLabel = 'Connecting…';
  else if (isConnected) connectLabel = 'Connected';

  return (
    <Box
      display="flex"
      flexDirection="column"
      gridGap={12}
      padding={1}
      height="100%"
    >
      <Box display="flex" alignItems="center" gridGap={12} flexWrap="wrap">
        {containerOptions.length > 0 && (
          <FormControl
            variant="outlined"
            size="small"
            style={{ minWidth: 180 }}
          >
            <InputLabel id="exec-container-label">Container</InputLabel>
            <Select
              labelId="exec-container-label"
              value={selectedContainer}
              label="Container"
              onChange={e => {
                setSelectedContainer(e.target.value as string);
                if (isConnected) disconnect();
              }}
              disabled={isConnected || isConnecting}
            >
              {containerOptions.map(name => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box marginLeft="auto" display="flex" alignItems="center" gridGap={8}>
          {!fullWindow && (
            <Tooltip title="Open in new tab">
              <IconButton
                size="small"
                onClick={openInNewTab}
                aria-label="Open terminal in a new tab"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!isConnected ? (
            <Button
              variant="contained"
              color="primary"
              onClick={handleConnect}
              disabled={!canConnect}
              startIcon={
                isConnecting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {state === 'disconnected' || state === 'error'
                ? 'Reconnect'
                : connectLabel}
            </Button>
          ) : (
            <Button variant="outlined" onClick={disconnect}>
              Disconnect
            </Button>
          )}
        </Box>
      </Box>

      {state === 'error' && errorMessage && (
        <Alert severity="error">{errorMessage}</Alert>
      )}

      {/* Terminal — mounted once a session starts so xterm's DOM node is always
          visible when fitAddon.fit() first runs (avoids the 0×0 dimension bug
          when fit() is called on a hidden element). Unmounting on idle /
          disconnected gives each new session a clean slate. */}
      {(isConnecting || isConnected || state === 'error') && (
        <Box flex={1} minHeight={320}>
          <TerminalPanel
            onInput={sendData}
            onReady={handleTerminalReady}
            onResize={handleTerminalResize}
          />
        </Box>
      )}

      {state === 'idle' && (
        <Typography variant="body2" color="textSecondary">
          {podName ? (
            <>
              A running pod is available in{' '}
              <strong>{execContext.environmentDisplayName}</strong>. Click{' '}
              <strong>Connect</strong> to open a terminal session.
            </>
          ) : (
            <>
              Click <strong>Connect</strong> to open an interactive shell into a
              running pod for{' '}
              <strong>{execContext.environmentDisplayName}</strong>.
            </>
          )}
        </Typography>
      )}

      {state === 'disconnected' && (
        <Typography variant="body2" color="textSecondary">
          Session ended. Click <strong>Reconnect</strong> to start a new
          session.
        </Typography>
      )}
    </Box>
  );
};
