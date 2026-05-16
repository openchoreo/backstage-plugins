import { render, screen } from '@testing-library/react';
import { ResourceOutputsList } from './ResourceOutputsList';
import type { ResourceBindingOutput } from '../../api/OpenChoreoClientApi';

describe('ResourceOutputsList', () => {
  it('renders value-kind outputs inline', () => {
    const outputs: ResourceBindingOutput[] = [
      { name: 'host', value: 'db.dev.svc.cluster.local' },
      { name: 'port', value: '5432' },
    ];
    render(<ResourceOutputsList outputs={outputs} />);

    expect(screen.getByText('host')).toBeInTheDocument();
    expect(screen.getByText('db.dev.svc.cluster.local')).toBeInTheDocument();
    expect(screen.getByText('port')).toBeInTheDocument();
    expect(screen.getByText('5432')).toBeInTheDocument();
  });

  it('renders secretKeyRef outputs as secretRef Secret/<name>.<key>', () => {
    const outputs: ResourceBindingOutput[] = [
      {
        name: 'password',
        secretKeyRef: { name: 'db-creds', key: 'password' },
      },
    ];
    render(<ResourceOutputsList outputs={outputs} />);

    expect(screen.getByText('password')).toBeInTheDocument();
    expect(screen.getByText('secretRef')).toBeInTheDocument();
    expect(screen.getByText(/Secret\/db-creds\.password/)).toBeInTheDocument();
  });

  it('renders configMapKeyRef outputs as configMapRef ConfigMap/<name>.<key>', () => {
    const outputs: ResourceBindingOutput[] = [
      {
        name: 'database',
        configMapKeyRef: { name: 'db-config', key: 'dbname' },
      },
    ];
    render(<ResourceOutputsList outputs={outputs} />);

    expect(screen.getByText('configMapRef')).toBeInTheDocument();
    expect(
      screen.getByText(/ConfigMap\/db-config\.dbname/),
    ).toBeInTheDocument();
  });

  it('renders a mixed list', () => {
    const outputs: ResourceBindingOutput[] = [
      { name: 'host', value: 'db.dev.svc' },
      { name: 'password', secretKeyRef: { name: 'creds', key: 'pw' } },
      { name: 'database', configMapKeyRef: { name: 'cfg', key: 'db' } },
    ];
    render(<ResourceOutputsList outputs={outputs} />);

    expect(screen.getByText('db.dev.svc')).toBeInTheDocument();
    expect(screen.getByText('secretRef')).toBeInTheDocument();
    expect(screen.getByText('configMapRef')).toBeInTheDocument();
  });

  it('shows an unresolved placeholder when the output has no value or ref', () => {
    const outputs: ResourceBindingOutput[] = [{ name: 'pending' }];
    render(<ResourceOutputsList outputs={outputs} />);

    expect(screen.getByText('(unresolved)')).toBeInTheDocument();
  });
});
