import { render, screen } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { AnnotationGate } from './AnnotationGate';

describe('AnnotationGate', () => {
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
      <EntityProvider entity={makeEntity({ 'my-annotation': 'value' })}>
        <AnnotationGate annotation="my-annotation">
          <div>Content</div>
        </AnnotationGate>
      </EntityProvider>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('hides children when annotation is missing', () => {
    render(
      <EntityProvider entity={makeEntity({})}>
        <AnnotationGate annotation="my-annotation">
          <div>Content</div>
        </AnnotationGate>
      </EntityProvider>,
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows fallback when annotation is missing and fallback provided', () => {
    render(
      <EntityProvider entity={makeEntity({})}>
        <AnnotationGate
          annotation="my-annotation"
          fallback={<div>Fallback Content</div>}
        >
          <div>Content</div>
        </AnnotationGate>
      </EntityProvider>,
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    expect(screen.getByText('Fallback Content')).toBeInTheDocument();
  });
});
