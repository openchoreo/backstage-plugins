import { render, screen } from '@testing-library/react';
import type { Dependency } from '@openchoreo/backstage-plugin-common';
import { DependencyEditor } from './DependencyEditor';

const noop = () => {};

function renderReadOnly(dependency: Dependency) {
  return render(
    <DependencyEditor
      index={0}
      dependency={dependency}
      isEditing={false}
      onEdit={noop}
      onApply={noop}
      onCancel={noop}
      onRemove={noop}
      projects={[]}
      components={[]}
      endpoints={[]}
      onProjectChange={noop}
      onComponentChange={noop}
      onEndpointChange={noop}
      availableVisibilities={['project']}
      onVisibilityChange={noop}
      onEnvBindingChange={noop}
    />,
  );
}

describe('DependencyEditor read-only row', () => {
  it('renders a Component type chip alongside the dependency name', () => {
    renderReadOnly({
      project: 'default',
      component: 'payments-svc',
      name: 'orders',
      visibility: 'project',
      envBindings: { address: 'PAYMENTS_ADDR' },
    });

    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('payments-svc')).toBeInTheDocument();
  });
});
