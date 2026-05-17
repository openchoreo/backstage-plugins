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

  it('renders value-kind outputs with a VALUE chip', () => {
    renderDialog([
      { name: 'host', value: 'db.dev.svc.cluster.local' },
      { name: 'port', value: '5432' },
    ]);
    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('db.dev.svc.cluster.local')).toBeInTheDocument();
    expect(screen.getByText('port')).toBeInTheDocument();
    // Each value output gets a VALUE chip.
    expect(screen.getAllByText('VALUE')).toHaveLength(2);
  });

  it('renders secretRef outputs as Secret/name.key with a SECRETREF chip', () => {
    renderDialog([
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ]);
    expect(screen.getByText('SECRETREF')).toBeInTheDocument();
    expect(screen.getByText('Secret/db-creds.password')).toBeInTheDocument();
  });

  it('renders configMapRef outputs with a CONFIGMAPREF chip', () => {
    renderDialog([
      {
        name: 'database',
        configMapKeyRef: { name: 'db-config', key: 'database' },
      },
    ]);
    expect(screen.getByText('CONFIGMAPREF')).toBeInTheDocument();
    expect(
      screen.getByText('ConfigMap/db-config.database'),
    ).toBeInTheDocument();
  });

  it('exposes a copy button per output', () => {
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
