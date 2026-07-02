import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalPanelStyles } from './styles';

interface TerminalPanelProps {
  /** Called with each keystroke / paste — caller sends bytes to the WebSocket */
  onInput: (data: Uint8Array) => void;
  /**
   * Ref-like callback — caller receives the `write` function once the terminal
   * is mounted, so it can push incoming bytes from the WebSocket.
   */
  onReady: (write: (data: Uint8Array) => void) => void;
  /**
   * Called whenever the terminal is (re)sized — on mount after the initial
   * fitAddon.fit() and on every subsequent window resize.  Caller should
   * forward these dimensions to the exec session as a resize frame (0x03).
   */
  onResize?: (cols: number, rows: number) => void;
}

/**
 * Thin wrapper around xterm.js + FitAddon.
 *
 * The component owns the Terminal instance lifecycle (create on mount, dispose
 * on unmount). Callers communicate through two callbacks:
 *   - `onInput`  — fired when the user types / pastes (stdin → WebSocket)
 *   - `onReady`  — provides a `write` function (WebSocket stdout/stderr → terminal)
 */
export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  onInput,
  onReady,
  onResize,
}) => {
  const classes = useTerminalPanelStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return () => {};

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    // Report initial dimensions so the caller can send a resize frame as soon
    // as the WebSocket opens (the exec API needs this to set up the PTY).
    if (onResize) onResize(term.cols, term.rows);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Forward user keystrokes to the caller (→ WebSocket stdin)
    term.onData(raw => {
      const bytes = new TextEncoder().encode(raw);
      // Prefix byte 0x00 = stdin stream type
      const frame = new Uint8Array(1 + bytes.length);
      frame[0] = 0x00;
      frame.set(bytes, 1);
      onInput(frame);
    });

    // Expose a write function to the caller (← WebSocket stdout/stderr)
    onReady((data: Uint8Array) => {
      // Strip the 1-byte stream-type prefix before writing to the terminal
      if (data.length > 1) {
        const payload = data.slice(1);
        term.write(payload);
      }
    });

    // Resize handler — refit the terminal and report new dimensions so the
    // caller can send a resize frame to the exec session. Skip while the
    // container is detached / zero-size (fit() would compute bad rows/cols).
    const handleResize = () => {
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
      fitAddon.fit();
      if (onResize) onResize(term.cols, term.rows);
    };
    window.addEventListener('resize', handleResize);

    // Observe the container itself — drawer / full-window layout changes resize
    // the terminal without firing window.resize.
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // onInput and onReady are stable callbacks from useExecSession — intentionally
    // not in deps to avoid re-creating the terminal on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={classes.root} />;
};
