/**
 * Short-lived session store for component exec WebSocket connections.
 *
 * The browser WebSocket API cannot set custom headers (such as
 * x-openchoreo-token), so authentication is split across two requests:
 *
 *   1. POST /exec/init  — authenticated HTTP; backend creates a session and
 *      returns a sessionId (UUID, valid for 30 s, single-use).
 *   2. WS  /exec/ws     — unauthenticated upgrade; backend looks up the
 *      sessionId and uses the stored token to connect upstream.
 *
 * Sessions are keyed by a random UUID and are consumed on first lookup,
 * preventing replay attacks.
 */

const SESSION_TTL_MS = 30_000; // 30 seconds

export interface ExecSession {
  /** User's IDP token (x-openchoreo-token) forwarded to OpenChoreo API */
  token: string;
  namespaceName: string;
  projectName: string;
  componentName: string;
  environment: string;
  /**
   * Target pod name. Present when exec is launched from a specific Pod node in
   * the K8s resource tree; omitted for the component/environment-level fallback
   * where the control plane resolves the pod.
   */
  podName?: string;
  /** Target container within the pod. Defaults (upstream) to the primary container. */
  containerName?: string;
  createdAt: number;
}

class ExecSessionStore {
  private readonly sessions = new Map<string, ExecSession>();

  /**
   * Creates a new session and returns its UUID.
   * The session auto-expires after SESSION_TTL_MS milliseconds.
   */
  create(params: Omit<ExecSession, 'createdAt'>): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, { ...params, createdAt: Date.now() });
    setTimeout(() => this.sessions.delete(id), SESSION_TTL_MS);
    return id;
  }

  /**
   * Retrieves and deletes a session (one-time use).
   * Returns undefined if the session does not exist or has expired.
   */
  consume(id: string): ExecSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(id);
      return undefined;
    }
    this.sessions.delete(id);
    return session;
  }
}

/**
 * Module-level singleton shared between the router (HTTP /exec/init) and the
 * WebSocket upgrade proxy (execWebSocketProxy.ts), which this plugin registers
 * via its httpRouter middleware in plugin.ts.
 *
 * Node.js module caching guarantees both import sites receive the same
 * instance as long as they run in the same process.
 */
export const execSessionStore = new ExecSessionStore();
