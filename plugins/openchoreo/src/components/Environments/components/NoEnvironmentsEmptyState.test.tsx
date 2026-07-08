import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { NoEnvironmentsEmptyState } from './NoEnvironmentsEmptyState';

function makeEntity(annotations: Record<string, string>, name = 'api-service') {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'default', annotations },
  };
}

function renderWith(entity: any, fetchDeploymentPipeline: jest.Mock) {
  return renderInTestApp(
    <TestApiProvider
      apis={[[openChoreoClientApiRef, { fetchDeploymentPipeline } as any]]}
    >
      <EntityProvider entity={entity}>
        <NoEnvironmentsEmptyState />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('NoEnvironmentsEmptyState', () => {
  it('links to the resolved deployment pipeline entity (project from annotation)', async () => {
    const fetchDeploymentPipeline = jest
      .fn()
      .mockResolvedValue({ name: 'prod-pipeline' });

    await renderWith(
      makeEntity({
        [CHOREO_ANNOTATIONS.PROJECT]: 'my-project',
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'dev-ns',
      }),
      fetchDeploymentPipeline,
    );

    expect(
      screen.getByText('No environments available to deploy'),
    ).toBeInTheDocument();

    const link = await screen.findByRole('link', {
      name: 'pipeline configuration',
    });
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/deploymentpipeline/prod-pipeline',
    );
    expect(fetchDeploymentPipeline).toHaveBeenCalledWith(
      'my-project',
      'dev-ns',
    );
  });

  it('falls back to the entity name as the project when no PROJECT annotation (Project entity)', async () => {
    const fetchDeploymentPipeline = jest
      .fn()
      .mockResolvedValue({ name: 'proj-pipeline' });

    await renderWith(
      makeEntity({ [CHOREO_ANNOTATIONS.NAMESPACE]: 'dev-ns' }, 'my-project'),
      fetchDeploymentPipeline,
    );

    await screen.findByRole('link', { name: 'pipeline configuration' });
    expect(fetchDeploymentPipeline).toHaveBeenCalledWith(
      'my-project',
      'dev-ns',
    );
  });

  it('degrades to plain guidance when the pipeline cannot be resolved', async () => {
    const fetchDeploymentPipeline = jest
      .fn()
      .mockRejectedValue(new Error('boom'));

    await renderWith(
      makeEntity({
        [CHOREO_ANNOTATIONS.PROJECT]: 'my-project',
        [CHOREO_ANNOTATIONS.NAMESPACE]: 'dev-ns',
      }),
      fetchDeploymentPipeline,
    );

    expect(
      await screen.findByText(/Contact your administrator to configure it/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'pipeline configuration' }),
    ).not.toBeInTheDocument();
  });
});
