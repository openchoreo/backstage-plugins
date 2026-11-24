import { generateKeyPairSync, sign } from 'crypto';
import {
  DsseEnvelope,
  VULN_PREDICATE_TYPE,
  decodeStatement,
  loadPublicKey,
  pae,
  statementCoversDigest,
  summarizeVulnPredicate,
  verifyEnvelope,
} from './attestation';
import { attestationTag, parseImageRef } from './registry';

const DIGEST = `sha256:${'a'.repeat(64)}`;

const predicate = {
  scanner: {
    uri: 'pkg:github/aquasecurity/trivy@0.69.3',
    version: '0.69.3',
    result: {
      Results: [
        {
          Target: 'app (alpine 3.20.1)',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2026-0002',
              PkgName: 'libssl3',
              InstalledVersion: '3.3.1-r0',
              FixedVersion: '3.3.2-r0',
              Severity: 'HIGH',
            },
            {
              VulnerabilityID: 'CVE-2026-0001',
              PkgName: 'busybox',
              InstalledVersion: '1.36.1-r29',
              FixedVersion: '1.36.1-r30',
              Severity: 'CRITICAL',
              Title: 'busybox: overflow',
            },
            {
              VulnerabilityID: 'CVE-2026-0003',
              PkgName: 'zlib',
              InstalledVersion: '1.3.1-r0',
              FixedVersion: '',
              Severity: 'CRITICAL',
            },
            {
              VulnerabilityID: 'CVE-2026-0004',
              PkgName: 'curl',
              InstalledVersion: '8.9.0-r0',
              FixedVersion: '8.9.1-r0',
              Severity: 'MEDIUM',
            },
          ],
        },
      ],
    },
  },
  metadata: { scanFinishedOn: '2026-10-12T12:00:00Z' },
};

function signedEnvelope(privateKey: any, digest = DIGEST): DsseEnvelope {
  const statement = {
    _type: 'https://in-toto.io/Statement/v0.1',
    subject: [
      { name: 'registry/app', digest: { sha256: digest.split(':')[1] } },
    ],
    predicateType: VULN_PREDICATE_TYPE,
    predicate,
  };
  const payload = Buffer.from(JSON.stringify(statement));
  const payloadType = 'application/vnd.in-toto+json';
  return {
    payloadType,
    payload: payload.toString('base64'),
    signatures: [
      {
        keyid: '',
        sig: sign('sha256', pae(payloadType, payload), privateKey).toString(
          'base64',
        ),
      },
    ],
  };
}

describe('attestation', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  it('encodes DSSE PAE', () => {
    expect(pae('t', Buffer.from('ab')).toString()).toBe('DSSEv1 1 t 2 ab');
  });

  it('verifies a signature from the matching key only', () => {
    const envelope = signedEnvelope(privateKey);
    expect(verifyEnvelope(envelope, loadPublicKey(pem))).toBe(true);

    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey;
    expect(verifyEnvelope(envelope, other)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const envelope = signedEnvelope(privateKey);
    const statement = decodeStatement(envelope);
    statement.predicate.scanner.result.Results = [];
    const tampered = {
      ...envelope,
      payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
    };
    expect(verifyEnvelope(tampered, loadPublicKey(pem))).toBe(false);
  });

  it('checks that the statement is about the image digest', () => {
    const statement = decodeStatement(signedEnvelope(privateKey));
    expect(statementCoversDigest(statement, DIGEST)).toBe(true);
    expect(statementCoversDigest(statement, `sha256:${'b'.repeat(64)}`)).toBe(
      false,
    );
  });

  it('keeps only fixable findings at the requested severities, worst first', () => {
    const report = summarizeVulnPredicate(predicate, ['CRITICAL', 'HIGH']);
    expect(report.vulnerabilities.map(v => v.id)).toEqual([
      'CVE-2026-0001',
      'CVE-2026-0002',
    ]);
    expect(report.counts).toEqual({ CRITICAL: 1, HIGH: 1 });
    expect(report.scannedAt).toBe('2026-10-12T12:00:00Z');
    expect(report.scanner).toBe('trivy 0.69.3');
  });
});

describe('image references', () => {
  it('splits host, repository and tag', () => {
    expect(
      parseImageRef('registry.example.com:5000/acme/apps/shop/web:v1-2f0f79e6'),
    ).toEqual({
      registry: 'registry.example.com:5000',
      repository: 'acme/apps/shop/web',
      tag: 'v1-2f0f79e6',
      digest: undefined,
    });
  });

  it('keeps a pinned digest', () => {
    const ref = parseImageRef(`ghcr.io/org/app@${DIGEST}`);
    expect(ref.repository).toBe('org/app');
    expect(ref.digest).toBe(DIGEST);
  });

  it('names the cosign attestation tag', () => {
    expect(attestationTag(DIGEST)).toBe(`sha256-${'a'.repeat(64)}.att`);
  });
});
