import { render, screen, fireEvent, within } from '@testing-library/react';
import type {
  ResourceDependency,
  ResourceTypeOutput,
} from '@openchoreo/backstage-plugin-common';
import { ResourceDependencyEditor } from './ResourceDependencyEditor';

const dbOutputs: ResourceTypeOutput[] = [
  { name: 'host', value: '${applied.claim.status.host}' },
  { name: 'port', value: '${applied.claim.status.port}' },
  { name: 'database', value: '${applied.claim.status.database}' },
  { name: 'username', value: '${applied.claim.status.username}' },
  {
    name: 'password',
    secretKeyRef: { name: 'db-secret', key: 'password' },
  },
  {
    name: 'caCert',
    configMapKeyRef: { name: 'db-cm', key: 'ca.crt' },
  },
];

function renderEditor(
  overrides: Partial<{
    dependency: ResourceDependency;
    outputs: ResourceTypeOutput[];
    isEditing: boolean;
  }> = {},
) {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  const onEdit = jest.fn();
  const onApply = jest.fn();
  const onCancel = jest.fn();
  render(
    <ResourceDependencyEditor
      dependency={overrides.dependency ?? { ref: 'orders-db' }}
      outputs={overrides.outputs ?? dbOutputs}
      isEditing={overrides.isEditing ?? false}
      onEdit={onEdit}
      onApply={onApply}
      onCancel={onCancel}
      onChange={onChange}
      onRemove={onRemove}
    />,
  );
  return { onChange, onRemove, onEdit, onApply, onCancel };
}

describe('ResourceDependencyEditor', () => {
  describe('read-only (collapsed) mode', () => {
    it('renders ref + Resource chip + summary + Edit/Remove buttons', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
          fileBindings: { password: '/etc/db/password' },
        },
      });

      expect(screen.getByText('orders-db')).toBeInTheDocument();
      expect(screen.getByText('Resource')).toBeInTheDocument();
      expect(screen.getByText('2 env, 1 file bindings')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Edit/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Remove resource dependency'),
      ).toBeInTheDocument();
    });

    it('shows "no bindings" when nothing is wired', () => {
      renderEditor({ dependency: { ref: 'orders-db' } });
      expect(screen.getByText('no bindings')).toBeInTheDocument();
    });

    it('invokes onEdit when the Edit button is clicked', () => {
      const { onEdit } = renderEditor();
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('invokes onRemove when the Remove icon is clicked', () => {
      const { onRemove } = renderEditor();
      fireEvent.click(screen.getByLabelText('Remove resource dependency'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders no expanded fields in read-only mode', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });
      expect(screen.queryByTestId(/^binding-row-/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/^env-input-/)).not.toBeInTheDocument();
    });
  });

  describe('edit (expanded) mode', () => {
    it('renders one binding row per wired output', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
          fileBindings: { caCert: '/etc/db/ca.crt' },
        },
      });

      expect(screen.getByTestId('binding-row-host')).toBeInTheDocument();
      expect(screen.getByTestId('binding-row-password')).toBeInTheDocument();
      expect(screen.getByTestId('binding-row-caCert')).toBeInTheDocument();
    });

    it('renders Apply / Cancel buttons in the footer', () => {
      renderEditor({ isEditing: true });
      expect(
        screen.getByRole('button', { name: /Apply changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Cancel editing/i }),
      ).toBeInTheDocument();
    });

    it('invokes onApply / onCancel via footer buttons', () => {
      const { onApply, onCancel } = renderEditor({ isEditing: true });
      fireEvent.click(screen.getByRole('button', { name: /Apply changes/i }));
      fireEvent.click(screen.getByRole('button', { name: /Cancel editing/i }));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('emits onChange with the new env var on env-field edit', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.change(screen.getByTestId('env-input-host'), {
        target: { value: 'POSTGRES_HOST' },
      });

      expect(onChange).toHaveBeenCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'POSTGRES_HOST' },
        fileBindings: undefined,
      });
    });

    it('disables the mount-path field for value-kind outputs', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });
      expect(screen.getByTestId('mount-input-host')).toBeDisabled();
    });

    it('drops the env binding when the env field is cleared', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
        },
      });

      fireEvent.change(screen.getByTestId('env-input-host'), {
        target: { value: '' },
      });

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { password: 'DB_PASSWORD' },
        fileBindings: undefined,
      });
    });

    it('removes the output from both maps on row-remove', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { password: 'DB_PASSWORD', host: 'DB_HOST' },
          fileBindings: { password: '/etc/db/password' },
        },
      });

      const row = screen.getByTestId('binding-row-password');
      fireEvent.click(within(row).getByLabelText('Remove binding password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST' },
        fileBindings: undefined,
      });
    });

    it('Add binding dropdown lists unbound outputs only', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add binding/i }));
      const menu = screen.getByRole('menu');
      expect(within(menu).queryByText('host')).not.toBeInTheDocument();
      expect(within(menu).getByText('password')).toBeInTheDocument();
      expect(within(menu).getByText('caCert')).toBeInTheDocument();
    });

    it('adds a new env-only row with an empty target when an output is picked', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add binding/i }));
      fireEvent.click(within(screen.getByRole('menu')).getByText('password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST', password: '' },
        fileBindings: undefined,
      });
    });

    it('disables Apply when applyDisabled is true', () => {
      render(
        <ResourceDependencyEditor
          dependency={{ ref: 'orders-db' }}
          outputs={dbOutputs}
          isEditing
          onEdit={jest.fn()}
          onApply={jest.fn()}
          onCancel={jest.fn()}
          onChange={jest.fn()}
          onRemove={jest.fn()}
          applyDisabled
        />,
      );
      expect(
        screen.getByRole('button', { name: /Apply changes/i }),
      ).toBeDisabled();
    });
  });
});
