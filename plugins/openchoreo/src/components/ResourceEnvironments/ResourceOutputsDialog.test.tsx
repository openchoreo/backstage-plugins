import { fireEvent, render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { ResourceOutputsDialog } from './ResourceOutputsDialog';
import type { ResourceBindingOutput } from '../../api/OpenChoreoClientApi';

// The dialog calls useNotification (via the openchoreo notification context).
// Wire a minimal stub so toast calls don't blow up the render.
jest.mock('../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

function renderDialog(outputs: ResourceBindingOutput[], envName = 'dev') {
  return render(
    <TestApiProvider apis={[]}>
      <ResourceOutputsDialog
        open
        onClose={() => {}}
        environmentName={envName}
        outputs={outputs}
      />
    </TestApiProvider>,
  );
}

describe('ResourceOutputsDialog', () => {
  it('renders the env name in the title', () => {
    renderDialog([]);
    expect(screen.getByText(/outputs — dev/i)).toBeInTheDocument();
  });

  it('renders an empty state when no outputs are present', () => {
    renderDialog([]);
    expect(
      screen.getByText(/no outputs published by this binding yet/i),
    ).toBeInTheDocument();
  });

  it('renders value-kind outputs with their value inline', () => {
    renderDialog([
      { name: 'host', value: 'db.dev.svc.cluster.local' },
      { name: 'port', value: '5432' },
    ]);
    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('db.dev.svc.cluster.local')).toBeInTheDocument();
    expect(screen.getByText('port')).toBeInTheDocument();
    expect(screen.getByText('5432')).toBeInTheDocument();
  });

  it('renders http(s) value outputs as a link that opens in a new tab', () => {
    renderDialog([
      {
        name: 'adminURL',
        value: 'http://admin.example.com/dashboard',
      },
    ]);
    const link = screen.getByRole('link', {
      name: 'http://admin.example.com/dashboard',
    });
    expect(link).toHaveAttribute('href', 'http://admin.example.com/dashboard');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders non-URL value outputs as plain text (no link)', () => {
    renderDialog([{ name: 'host', value: 'db.dev.svc.cluster.local' }]);
    expect(screen.getByText('db.dev.svc.cluster.local')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('hides secretRef details behind a Show reference toggle by default', () => {
    renderDialog([
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ]);
    expect(screen.getByText(/stored in secret/i)).toBeInTheDocument();
    expect(screen.queryByText('Secret/db-creds.password')).toBeNull();
    expect(
      screen.getByRole('button', { name: /show reference/i }),
    ).toBeInTheDocument();
  });

  it('expands the secretRef Kind/name.key when Show reference is clicked', () => {
    renderDialog([
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: /show reference/i }));
    expect(screen.getByText('Secret/db-creds.password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /hide reference/i }),
    ).toBeInTheDocument();
    // Copy button is only exposed once the ref is visible.
    expect(
      screen.getByRole('button', { name: /copy password/i }),
    ).toBeInTheDocument();
  });

  it('collapses secretRef details when Hide reference is clicked', () => {
    renderDialog([
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: /show reference/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide reference/i }));
    expect(screen.queryByText('Secret/db-creds.password')).toBeNull();
  });

  it('hides configMapRef details behind a toggle with ConfigMap wording', () => {
    renderDialog([
      {
        name: 'database',
        configMapKeyRef: { name: 'db-config', key: 'database' },
      },
    ]);
    expect(screen.getByText(/stored in configmap/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show reference/i }));
    expect(
      screen.getByText('ConfigMap/db-config.database'),
    ).toBeInTheDocument();
  });

  it('exposes a copy button on value-kind outputs', () => {
    renderDialog([{ name: 'host', value: 'db.dev.svc' }]);
    expect(
      screen.getByRole('button', { name: /copy host/i }),
    ).toBeInTheDocument();
  });

  it('invokes onClose when the Close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <TestApiProvider apis={[]}>
        <ResourceOutputsDialog
          open
          onClose={onClose}
          environmentName="dev"
          outputs={[]}
        />
      </TestApiProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
