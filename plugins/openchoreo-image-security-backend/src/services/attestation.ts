import { createPublicKey, verify, KeyObject } from 'crypto';
import type { Vulnerability, VulnerabilityReport } from '../types';

export const VULN_PREDICATE_TYPE =
  'https://cosign.sigstore.dev/attestation/vuln/v1';

export interface DsseEnvelope {
  payloadType: string;
  payload: string;
  signatures: { keyid?: string; sig: string }[];
}

export interface InTotoStatement {
  _type: string;
  subject: { name: string; digest: Record<string, string> }[];
  predicateType: string;
  predicate: any;
}

/** DSSE pre-authentication encoding, the bytes that are actually signed. */
export function pae(payloadType: string, payload: Buffer): Buffer {
  const type = Buffer.from(payloadType, 'utf8');
  return Buffer.concat([
    Buffer.from(`DSSEv1 ${type.length} `, 'utf8'),
    type,
    Buffer.from(` ${payload.length} `, 'utf8'),
    payload,
  ]);
}

export function loadPublicKey(pem: string): KeyObject {
  return createPublicKey(pem);
}

/** True when any signature on the envelope verifies with the key. */
export function verifyEnvelope(
  envelope: DsseEnvelope,
  key: KeyObject,
): boolean {
  const payload = Buffer.from(envelope.payload, 'base64');
  const message = pae(envelope.payloadType, payload);
  return envelope.signatures.some(s => {
    try {
      return verify('sha256', message, key, Buffer.from(s.sig, 'base64'));
    } catch {
      return false;
    }
  });
}

export function decodeStatement(envelope: DsseEnvelope): InTotoStatement {
  return JSON.parse(
    Buffer.from(envelope.payload, 'base64').toString('utf8'),
  ) as InTotoStatement;
}

/** The statement must be about exactly this image, not merely next to it. */
export function statementCoversDigest(
  statement: InTotoStatement,
  digest: string,
): boolean {
  const [algorithm, hex] = digest.split(':');
  return statement.subject.some(s => s.digest?.[algorithm] === hex);
}

/**
 * Turns a cosign vuln predicate produced by `trivy --format cosign-vuln`
 * into a report. Only fixable findings at the given severities are kept;
 * the build already drops unfixed ones, this guards against other producers.
 */
export function summarizeVulnPredicate(
  predicate: any,
  severities: string[],
): Omit<VulnerabilityReport, 'verified'> {
  const wanted = new Set(severities.map(s => s.toUpperCase()));
  const results: any[] = predicate?.scanner?.result?.Results ?? [];
  const seen = new Set<string>();
  const vulnerabilities: Vulnerability[] = [];

  for (const result of results) {
    for (const v of result.Vulnerabilities ?? []) {
      const severity = String(v.Severity ?? '').toUpperCase();
      if (!wanted.has(severity) || !v.FixedVersion) continue;
      const key = `${v.VulnerabilityID}|${v.PkgName}|${v.InstalledVersion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      vulnerabilities.push({
        id: v.VulnerabilityID,
        severity,
        packageName: v.PkgName,
        installedVersion: v.InstalledVersion,
        fixedVersion: v.FixedVersion,
        title: v.Title,
        url: v.PrimaryURL,
        target: result.Target,
      });
    }
  }

  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  vulnerabilities.sort(
    (a, b) =>
      order.indexOf(a.severity) - order.indexOf(b.severity) ||
      a.id.localeCompare(b.id),
  );

  const counts: Record<string, number> = {};
  for (const v of vulnerabilities) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }

  return {
    scannedAt:
      predicate?.metadata?.scanFinishedOn ?? predicate?.metadata?.scanStartedOn,
    scanner: predicate?.scanner?.version
      ? `trivy ${predicate.scanner.version}`
      : predicate?.scanner?.uri,
    counts,
    vulnerabilities,
  };
}
