import { render, screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { AnnotationGatedContent } from './AnnotationGatedContent';

// Mock @backstage/core-components EmptyState to make assertions simpler
jest.mock('@backstage/core-components', () => ({
  EmptyState: (props: any) => (
    <div data-testid="backstage-empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
}));

describe('AnnotationGatedContent', () => {
  const makeEntity = (annotations: Record<string, string> = {}) => ({
    apiVersion: 'backstage.io/v1alpha1' as const,
    kind: 'Component',
    metadata: {
      name: 'test-entity',
      annotations,
    },
    spec: {},
  });

  it('shows children when annotation is present', () => {
    render(
      <EntityProvider entity={makeEntity({ 'ci/build-url': 'http://ci' })}>
        <AnnotationGatedContent annotation="ci/build-url">
          <div>Build Info</div>
        </AnnotationGatedContent>
      </EntityProvider>,
    );

    expect(screen.getByText('Build Info')).toBeInTheDocument();
    expect(
      screen.queryByTestId('backstage-empty-state'),
    ).not.toBeInTheDocument();
  });

  it('shows EmptyState guidance when annotation is missing', () => {
    render(
      <EntityProvider entity={makeEntity({})}>
        <AnnotationGatedContent annotation="ci/build-url">
          <div>Build Info</div>
        </AnnotationGatedContent>
      </EntityProvider>,
    );

    expect(screen.queryByText('Build Info')).not.toBeInTheDocument();
    expect(screen.getByTestId('backstage-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Annotation Required')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add the ci/build-url annotation to this entity to enable this feature.',
      ),
    ).toBeInTheDocument();
  });
});
