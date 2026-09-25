import { render, screen, within } from '@testing-library/react';
import { EnvironmentHooksCard } from './EnvironmentHooksCard';

let spec: unknown;
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: { metadata: { name: 'prod-kpop', namespace: 'team-a' }, spec },
  }),
  EntityRefLink: ({
    entityRef,
    title,
  }: {
    entityRef: string;
    title: string;
  }) => <a href={entityRef}>{title}</a>,
}));
jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  lightTokens: { grey: {}, shadow: {} },
  darkTokens: { border: {}, shadow: {} },
}));

describe('EnvironmentHooksCard', () => {
  // Pre- and post-deploy hooks run at different points and fail differently,
  // so the environment page lists them apart with their failure policy.
  it('lists pre- and post-deploy bindings separately with what a failure does', () => {
    spec = {
      hooks: {
        preDeploy: [
          {
            name: 'image-scan',
            hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
            timeout: '20m',
          },
          {
            name: 'smoke',
            hookRef: { name: 'e2e' },
            onFailure: 'Ignore',
            appliesTo: [{ kind: 'ClusterComponentType', name: 'service' }],
            parameters: { suite: 'smoke' },
          },
        ],
        postDeploy: [
          {
            name: 'notify',
            hookRef: { kind: 'ClusterHook', name: 'print-message' },
            mode: 'Async',
          },
        ],
      },
    };
    render(<EnvironmentHooksCard />);

    const pre = within(screen.getByTestId('env-hooks-preDeploy'));
    const scanRow = pre.getByText('image-scan').closest('tr')!;
    expect(scanRow).toHaveTextContent('Block');
    expect(scanRow).toHaveTextContent('20m');
    expect(scanRow).toHaveTextContent('all components');
    // ClusterHooks live in the cluster catalog namespace; Hooks in the env's.
    expect(pre.getByText('trivy-image-scan')).toHaveAttribute(
      'href',
      'clusterhook:openchoreo-cluster/trivy-image-scan',
    );
    const smokeRow = pre.getByText('smoke').closest('tr')!;
    expect(smokeRow).toHaveTextContent('Ignore');
    expect(smokeRow).toHaveTextContent('service');
    expect(smokeRow).toHaveTextContent('suite=smoke');
    expect(pre.getByText('e2e')).toHaveAttribute('href', 'hook:team-a/e2e');

    const post = within(screen.getByTestId('env-hooks-postDeploy'));
    const notifyRow = post.getByText('notify').closest('tr')!;
    expect(notifyRow).toHaveTextContent('Async');
    expect(notifyRow).toHaveTextContent('never blocks');
  });

  it('says so when a phase has no hooks', () => {
    spec = { hooks: { preDeploy: [{ name: 'scan', hookRef: { name: 'h' } }] } };
    render(<EnvironmentHooksCard />);
    expect(screen.getByText('No post-deploy hooks.')).toBeInTheDocument();
    expect(screen.queryByText('No pre-deploy hooks.')).toBeNull();
  });
});
