import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { conditionalSonarQube } from './sonarqube';

describe('conditionalSonarQube backend module', () => {
  it('should start successfully without a sonarqube configuration section', async () => {
    // The test will fail (promise rejects) if the feature loader crashes.
    const backend = await startTestBackend({
      features: [
        conditionalSonarQube,
        mockServices.rootConfig.factory({ data: {} }), // empty configuration (no 'sonarqube')
      ],
    });

    expect(backend).toBeDefined();
  });
});
