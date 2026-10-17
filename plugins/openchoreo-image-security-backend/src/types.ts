export interface Vulnerability {
  id: string;
  severity: string;
  packageName: string;
  installedVersion: string;
  fixedVersion: string;
  title?: string;
  url?: string;
  /** Where Trivy found the package, e.g. the OS or a lock file. */
  target?: string;
}

export interface VulnerabilityReport {
  scannedAt?: string;
  scanner?: string;
  /** Fixable findings per severity. */
  counts: Record<string, number>;
  vulnerabilities: Vulnerability[];
  /** The attestation signature was checked against the configured key. */
  verified: boolean;
}

/**
 * - `ok`: signed scan without fixable findings at the configured severities
 * - `findings`: signed scan with fixable findings
 * - `unverified`: a scan exists but its signature could not be confirmed
 * - `not-scanned`: no vulnerability attestation for this image
 * - `error`: the image or its attestation could not be read
 */
export type ImageSecurityStatus =
  | 'ok'
  | 'findings'
  | 'unverified'
  | 'not-scanned'
  | 'error';

export interface EnvironmentImageSecurity {
  environment: string;
  releaseName?: string;
  image?: string;
  digest?: string;
  status: ImageSecurityStatus;
  report?: VulnerabilityReport;
  message?: string;
}

export interface ComponentImageSecurity {
  severities: string[];
  environments: EnvironmentImageSecurity[];
}
