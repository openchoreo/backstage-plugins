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
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
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

    it('renders Save / Cancel buttons in the footer', () => {
      renderEditor({ isEditing: true });
      expect(
        screen.getByRole('button', { name: /Save changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Cancel editing/i }),
      ).toBeInTheDocument();
    });

    it('invokes onApply / onCancel via footer buttons', () => {
      const { onApply, onCancel } = renderEditor({ isEditing: true });
      fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
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

    it('renders only the env field when an output is wired as env only', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });
      expect(screen.getByTestId('env-input-host')).toBeInTheDocument();
      expect(screen.queryByTestId('mount-input-host')).not.toBeInTheDocument();
    });

    it('renders only the mount field when an output is wired as file only', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          fileBindings: { password: '/etc/db/password' },
        },
      });
      expect(screen.getByTestId('mount-input-password')).toBeInTheDocument();
      expect(
        screen.queryByTestId('env-input-password'),
      ).not.toBeInTheDocument();
    });

    it('keeps the env entry with an empty value when the env field is cleared (no auto-delete)', () => {
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
        envBindings: { host: '', password: 'DB_PASSWORD' },
        fileBindings: undefined,
      });
    });

    it('removes only the env binding via the per-field remove button', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { password: 'DB_PASSWORD' },
          fileBindings: { password: '/etc/db/password' },
        },
      });

      fireEvent.click(screen.getByLabelText('Remove env binding password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: undefined,
        fileBindings: { password: '/etc/db/password' },
      });
    });

    it('removes only the file mount via the per-field remove button', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { password: 'DB_PASSWORD' },
          fileBindings: { password: '/etc/db/password' },
        },
      });

      fireEvent.click(screen.getByLabelText('Remove file mount password'));

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

    it('Add env binding dropdown lists outputs not yet in envBindings', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add env binding/i }));
      const menu = screen.getByRole('menu');
      expect(within(menu).queryByText('host')).not.toBeInTheDocument();
      expect(within(menu).getByText('password')).toBeInTheDocument();
      // Value-kind outputs are still eligible for env binding.
      expect(within(menu).getByText('port')).toBeInTheDocument();
    });

    it('Add file mount dropdown excludes outputs already mounted and value-kind outputs', () => {
      renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          fileBindings: { password: '/etc/db/password' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add file mount/i }));
      const menu = screen.getByRole('menu');
      // password is already mounted, host/port/etc. are value-kind.
      expect(within(menu).queryByText('password')).not.toBeInTheDocument();
      expect(within(menu).queryByText('host')).not.toBeInTheDocument();
      expect(within(menu).getByText('caCert')).toBeInTheDocument();
    });

    it('Add env binding adds a new entry with an empty env value', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add env binding/i }));
      fireEvent.click(within(screen.getByRole('menu')).getByText('password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST', password: '' },
        fileBindings: undefined,
      });
    });

    it('Add file mount adds a new entry with an empty mount path', () => {
      const { onChange } = renderEditor({
        isEditing: true,
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /Add file mount/i }));
      fireEvent.click(within(screen.getByRole('menu')).getByText('password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST' },
        fileBindings: { password: '' },
      });
    });

    it('disables Save when applyDisabled is true', () => {
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
        screen.getByRole('button', { name: /Save changes/i }),
      ).toBeDisabled();
    });
  });

  describe('in-row Resource picker (edit mode)', () => {
    // Material-UI v4 Select renders the option list via a Portal that the
    // jsdom test environment opens reliably via mouseDown on the
    // `MuiSelect-root` div (the visible "button" with aria-haspopup).
    const openSelect = () => {
      const trigger = document.querySelector('.MuiSelect-root') as HTMLElement;
      expect(trigger).not.toBeNull();
      fireEvent.mouseDown(trigger);
    };

    it('renders the Resource select with available resources as options', () => {
      render(
        <ResourceDependencyEditor
          dependency={{ ref: '' }}
          outputs={[]}
          availableResources={[
            { name: 'orders-db', resourceType: 'postgres' },
            { name: 'orders-cache', resourceType: 'valkey' },
          ]}
          isEditing
          onEdit={jest.fn()}
          onApply={jest.fn()}
          onCancel={jest.fn()}
          onChange={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
      openSelect();
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('orders-db')).toBeInTheDocument();
      expect(within(listbox).getByText('orders-cache')).toBeInTheDocument();
    });

    it('emits onChange with the new ref and cleared bindings when the picker changes', () => {
      const onChange = jest.fn();
      render(
        <ResourceDependencyEditor
          dependency={{
            ref: 'orders-db',
            envBindings: { host: 'DB_HOST' },
            fileBindings: { password: '/etc/db/password' },
          }}
          outputs={dbOutputs}
          availableResources={[{ name: 'orders-db' }, { name: 'orders-cache' }]}
          isEditing
          onEdit={jest.fn()}
          onApply={jest.fn()}
          onCancel={jest.fn()}
          onChange={onChange}
          onRemove={jest.fn()}
        />,
      );
      openSelect();
      fireEvent.click(
        within(screen.getByRole('listbox')).getByText('orders-cache'),
      );

      expect(onChange).toHaveBeenCalledWith({
        ref: 'orders-cache',
        envBindings: undefined,
        fileBindings: undefined,
      });
    });

    it('keeps the current ref selectable even if not in availableResources', () => {
      render(
        <ResourceDependencyEditor
          dependency={{ ref: 'orders-db' }}
          outputs={[]}
          availableResources={[{ name: 'orders-cache' }]}
          isEditing
          onEdit={jest.fn()}
          onApply={jest.fn()}
          onCancel={jest.fn()}
          onChange={jest.fn()}
          onRemove={jest.fn()}
        />,
      );
      openSelect();
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('orders-db')).toBeInTheDocument();
      expect(within(listbox).getByText('orders-cache')).toBeInTheDocument();
    });
  });
});
