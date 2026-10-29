import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Dependency } from '@openchoreo/backstage-plugin-common';
import {
  DependencyEditor,
  type DependencyEditorProps,
} from './DependencyEditor';

const noop = () => {};

function renderEditor(
  dependency: Dependency,
  props: Partial<DependencyEditorProps> = {},
) {
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
      {...props}
    />,
  );
}

const renderReadOnly = (dependency: Dependency) => renderEditor(dependency);

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

describe('DependencyEditor release line', () => {
  const dependency: Dependency = {
    project: 'default',
    component: 'payments-svc',
    name: 'orders',
    visibility: 'project',
  };
  const endpoints = [{ name: 'orders' }];

  it('shows the release line in the read-only row', () => {
    renderReadOnly({ ...dependency, releaseLine: 'v2' });

    expect(screen.getByText('Release line: v2')).toBeInTheDocument();
  });

  it('omits the release line chip when none is set', () => {
    renderReadOnly(dependency);

    expect(screen.queryByText(/Release line/)).not.toBeInTheDocument();
  });

  it('hides the release line select when the target has no release lines', () => {
    renderEditor(dependency, { isEditing: true, endpoints });

    expect(screen.queryByLabelText(/Release line/)).not.toBeInTheDocument();
  });

  it('lists the target release lines and reports the selection', () => {
    const onReleaseLineChange = jest.fn();
    renderEditor(dependency, {
      isEditing: true,
      endpoints,
      releaseLines: [{ name: 'v1' }, { name: 'v2' }],
      onReleaseLineChange,
    });

    fireEvent.mouseDown(screen.getByLabelText(/Release line/));
    const listbox = within(screen.getByRole('listbox'));
    expect(listbox.getByText('v1')).toBeInTheDocument();
    fireEvent.click(listbox.getByText('v2'));

    expect(onReleaseLineChange).toHaveBeenCalledWith('v2');
  });
});
