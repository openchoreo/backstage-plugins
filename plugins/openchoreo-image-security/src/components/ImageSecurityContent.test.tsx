import { screen } from '@testing-library/react';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import {
  ComponentImageSecurity,
  imageSecurityApiRef,
} from '../api/ImageSecurityApi';
import { ImageSecurityContent } from './ImageSecurityContent';

const DIGEST = `sha256:${'a'.repeat(64)}`;

function renderContent(getComponentImageSecurity: jest.Mock) {
  return renderInTestApp(
    <TestApiProvider
      apis={[[imageSecurityApiRef, { getComponentImageSecurity }]]}
    >
      <EntityProvider entity={mockComponentEntity()}>
        <ImageSecurityContent />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('ImageSecurityContent', () => {
  it('shows one card per environment with its findings', async () => {
    const value: ComponentImageSecurity = {
      severities: ['CRITICAL', 'HIGH'],
      environments: [
        {
          environment: 'development',
          image: 'registry.example.com/acme/web:v1',
          digest: DIGEST,
          status: 'findings',
          report: {
            scannedAt: '2026-10-12T12:00:00Z',
            scanner: 'trivy 0.69.3',
            counts: { CRITICAL: 1 },
            verified: true,
            vulnerabilities: [
              {
                id: 'CVE-2026-0001',
                severity: 'CRITICAL',
                packageName: 'busybox',
                installedVersion: '1.36.1-r29',
                fixedVersion: '1.36.1-r30',
                url: 'https://avd.aquasec.com/nvd/cve-2026-0001',
              },
            ],
          },
        },
        {
          environment: 'production',
          status: 'unverified',
          report: { counts: {}, vulnerabilities: [], verified: false },
        },
        {
          environment: 'staging',
          status: 'not-scanned',
          message: 'No vulnerability scan attached',
        },
      ],
    };
    await renderContent(jest.fn().mockResolvedValue(value));

    expect(
      await screen.findByText(/Fixable CRITICAL and HIGH vulnerabilities/),
    ).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
    expect(screen.getByText('Fixable vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText('CVE-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('1 CRITICAL')).toBeInTheDocument();
    expect(screen.getByText(/signature verified/)).toBeInTheDocument();
    expect(screen.getByText('Signature not verified')).toBeInTheDocument();
    expect(screen.getByText(/shown for information only/)).toBeInTheDocument();
    expect(
      screen.getByText('No vulnerability scan attached'),
    ).toBeInTheDocument();
  });

  it('shows an empty state before the first deployment', async () => {
    await renderContent(
      jest.fn().mockResolvedValue({ severities: [], environments: [] }),
    );

    expect(await screen.findByText('Not deployed yet')).toBeInTheDocument();
  });

  it('shows the error when loading fails', async () => {
    await renderContent(jest.fn().mockRejectedValue(new Error('backend down')));

    expect((await screen.findAllByText(/backend down/)).length).toBeGreaterThan(
      0,
    );
  });
});
