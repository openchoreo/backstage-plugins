/**
 * The audit trail's distinguishable failures. Each one asks the UI for a
 * different answer, which a flattened error string cannot carry.
 */

/**
 * The configured logs adapter does not serve the audit trail (`501`), or the
 * deployment publishes forward-only to a SIEM and keeps no queryable copy.
 * Distinct from "nothing happened", which is what an empty result would say.
 */
export class AuditLogsNotSupportedError extends Error {
  constructor(message?: string) {
    super(message || 'Audit logs are not supported by this adapter');
    this.name = 'AuditLogsNotSupportedError';
  }
}

/**
 * The installation reports that audit logs cannot be queried: no observer is
 * configured to serve the trail, so there is nothing to send a query to.
 */
export class AuditLogsNotEnabledError extends Error {
  constructor(message?: string) {
    super(message || 'Audit logs are not enabled for this installation');
    this.name = 'AuditLogsNotEnabledError';
  }
}

/**
 * The observer refused the read. `auditlogs:view` is evaluated at cluster
 * scope there, so this can happen even when the portal's own permission check
 * passed — the observer is the authority.
 */
export class AuditLogsForbiddenError extends Error {
  constructor(message?: string) {
    super(message || 'You do not have permission to read the audit trail');
    this.name = 'AuditLogsForbiddenError';
  }
}

/**
 * A filter picker's values are unavailable while the records themselves are
 * served — an adapter may aggregate nothing. A picker treats this as "no pick
 * list", falling back to free-text entry, not as "this filter has no values".
 */
export class AuditFilterValuesNotSupportedError extends Error {
  constructor(message?: string) {
    super(
      message || 'Audit log filter values are not supported by this adapter',
    );
    this.name = 'AuditFilterValuesNotSupportedError';
  }
}
