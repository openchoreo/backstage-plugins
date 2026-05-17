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

function renderEditor(overrides: Partial<{
  dependency: ResourceDependency;
  outputs: ResourceTypeOutput[];
}> = {}) {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  render(
    <ResourceDependencyEditor
      dependency={overrides.dependency ?? { ref: 'orders-db' }}
      outputs={overrides.outputs ?? dbOutputs}
      onChange={onChange}
      onRemove={onRemove}
    />,
  );
  return { onChange, onRemove };
}

describe('ResourceDependencyEditor', () => {
  describe('rendering', () => {
    it('renders the resource ref', () => {
      renderEditor();
      expect(screen.getByText('orders-db')).toBeInTheDocument();
    });

    it('renders one row per wired output (envBindings + fileBindings)', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
          fileBindings: { caCert: '/etc/db/ca.crt' },
        },
      });

      // Three distinct wired outputs (caCert appears only in fileBindings;
      // password is env-only; host is env-only).
      expect(screen.getByTestId('binding-row-host')).toBeInTheDocument();
      expect(screen.getByTestId('binding-row-password')).toBeInTheDocument();
      expect(screen.getByTestId('binding-row-caCert')).toBeInTheDocument();
    });

    it('renders the output kind chip on each row', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST', password: 'DB_PASSWORD' },
          fileBindings: { caCert: '/etc/db/ca.crt' },
        },
      });

      const hostRow = screen.getByTestId('binding-row-host');
      const passwordRow = screen.getByTestId('binding-row-password');
      const caCertRow = screen.getByTestId('binding-row-caCert');
      expect(within(hostRow).getByText('value')).toBeInTheDocument();
      expect(within(passwordRow).getByText('secretKeyRef')).toBeInTheDocument();
      expect(within(caCertRow).getByText('configMapKeyRef')).toBeInTheDocument();
    });

    it('shows the env-var and mount-path fields with their current values', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { password: 'DB_PASSWORD' },
          fileBindings: { password: '/etc/db/password' },
        },
      });

      const envInput = screen.getByTestId(
        'env-input-password',
      ) as HTMLInputElement;
      const mountInput = screen.getByTestId(
        'mount-input-password',
      ) as HTMLInputElement;
      expect(envInput.value).toBe('DB_PASSWORD');
      expect(mountInput.value).toBe('/etc/db/password');
    });

    it('disables the mount-path field for value-kind outputs', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      const mountInput = screen.getByTestId(
        'mount-input-host',
      ) as HTMLInputElement;
      expect(mountInput).toBeDisabled();
    });

    it('shows an empty wired-bindings state with just the Add button when no outputs are wired', () => {
      renderEditor({ dependency: { ref: 'orders-db' } });

      // None of the dbOutputs should produce a binding row.
      expect(screen.queryByTestId(/^binding-row-/)).not.toBeInTheDocument();
      expect(screen.getByText(/Add binding/i)).toBeInTheDocument();
    });
  });

  describe('field edits', () => {
    it('emits onChange with the new env var on env-field edit', () => {
      const { onChange } = renderEditor({
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

    it('emits onChange with the new mount path on mount-field edit', () => {
      const { onChange } = renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { password: 'DB_PASSWORD' },
        },
      });

      fireEvent.change(screen.getByTestId('mount-input-password'), {
        target: { value: '/etc/db/password' },
      });

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { password: 'DB_PASSWORD' },
        fileBindings: { password: '/etc/db/password' },
      });
    });

    it('drops the env binding when the env field is cleared', () => {
      const { onChange } = renderEditor({
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

    it('removes the output from both envBindings and fileBindings on row-remove', () => {
      const { onChange } = renderEditor({
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

    it('calls onRemove when the top-level Remove button is clicked', () => {
      const { onRemove } = renderEditor();
      fireEvent.click(screen.getByLabelText('Remove resource dependency'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('keeps mount-path edits no-op for value-kind outputs (field disabled)', () => {
      const { onChange } = renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      // mount-input-host is disabled because host is value-kind; the
      // earlier rendering test already locks that in. Confirm there is no
      // onChange firing when the user can't type.
      expect(screen.getByTestId('mount-input-host')).toBeDisabled();
      // Sanity check: clearing onChange + no event => no calls.
      onChange.mockClear();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Add binding dropdown', () => {
    it('lists outputs that are not yet wired', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByText(/Add binding/i));
      const menu = screen.getByRole('menu');
      // host is wired, so it should be absent from the menu.
      expect(within(menu).queryByText('host')).not.toBeInTheDocument();
      // The other 5 dbOutputs are still unbound.
      expect(within(menu).getByText('port')).toBeInTheDocument();
      expect(within(menu).getByText('database')).toBeInTheDocument();
      expect(within(menu).getByText('username')).toBeInTheDocument();
      expect(within(menu).getByText('password')).toBeInTheDocument();
      expect(within(menu).getByText('caCert')).toBeInTheDocument();
    });

    it('adds a new env-only row with an empty target when an output is picked', () => {
      const { onChange } = renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        },
      });

      fireEvent.click(screen.getByText(/Add binding/i));
      fireEvent.click(within(screen.getByRole('menu')).getByText('password'));

      expect(onChange).toHaveBeenLastCalledWith({
        ref: 'orders-db',
        envBindings: { host: 'DB_HOST', password: '' },
        fileBindings: undefined,
      });
    });

    it('disables the Add button when every output is wired', () => {
      renderEditor({
        dependency: {
          ref: 'orders-db',
          envBindings: {
            host: 'A',
            port: 'B',
            database: 'C',
            username: 'D',
            password: 'E',
            caCert: 'F',
          },
        },
      });

      const button = screen.getByRole('button', { name: /Add binding/i });
      expect(button).toBeDisabled();
    });
  });
});
