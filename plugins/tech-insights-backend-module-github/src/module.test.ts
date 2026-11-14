import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { techInsightsFactRetrieversExtensionPoint } from '@backstage-community/plugin-tech-insights-node';
import { techInsightsModuleGithub } from './module';

async function start(codeScanning?: object) {
  const addFactRetrievers = jest.fn();
  await startTestBackend({
    extensionPoints: [
      [techInsightsFactRetrieversExtensionPoint, { addFactRetrievers }],
    ],
    features: [
      techInsightsModuleGithub,
      mockServices.rootConfig.factory({
        data: { techInsights: { github: { codeScanning } } },
      }),
    ],
  });
  return addFactRetrievers.mock.calls[0][0];
}

describe('techInsightsModuleGithub', () => {
  it('registers one code scanning retriever, not one per scanner', async () => {
    const retrievers = await start();
    expect(Object.keys(retrievers).sort()).toEqual([
      'githubCodeScanningFactRetriever',
      'githubRepositoryFactRetriever',
    ]);
  });

  it('builds the retriever from the configured scanners', async () => {
    const { githubCodeScanningFactRetriever: retriever } = await start({
      schemaVersion: 2,
      tools: [{ id: 'semgrep', toolName: 'Semgrep OSS', label: 'Semgrep' }],
    });
    expect(retriever.version).toBe('0.2.0');
    expect(Object.keys(retriever.schema)).toContain(
      'githubSemgrepOpenAlertCount',
    );
    expect(Object.keys(retriever.schema)).not.toContain(
      'githubCodeqlOpenAlertCount',
    );
  });

  it('fails startup on config that would produce unusable facts', async () => {
    await expect(
      start({
        schemaVersion: 1,
        tools: [{ id: 'my-scanner', toolName: 'x', label: 'x' }],
      }),
    ).rejects.toThrow('part of fact names');
  });
});
