import { fireEvent, render, screen } from '@testing-library/react';
import type {
  EndpointTrafficBackend,
  EndpointTrafficInfo,
  EndpointTrafficOverride,
} from '@openchoreo/backstage-plugin-common';
import type { EndpointEnvironment } from '../../../api/OpenChoreoClientApi';
import { TrafficBlock } from './TrafficBlock';
import { EndpointTrafficProvider } from './useEndpointTraffic';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEndpointReleaseBindingUpdatePermission: () => ({
    canUpdate: true,
    loading: false,
  }),
}));

const backend = (
  name: string,
  weight: number,
  extra: Partial<EndpointTrafficBackend> = {},
): EndpointTrafficBackend => ({
  name,
  componentName: name,
  endpoint: 'http',
  weight,
  ...extra,
});

const recs = { path: { value: '/recs' } };

function renderBlock(
  release: EndpointTrafficBackend[],
  overrides: EndpointTrafficOverride[] = [],
  envBackends: EndpointEnvironment['backends'] = [],
) {
  const info: EndpointTrafficInfo = {
    backends: release,
    environments: [
      {
        environment: 'development',
        bindingName: 'trips-development',
        endpointRelease: 'trips-1',
        release,
        overrides,
      },
    ],
  };
  const env = {
    name: 'Development',
    resourceName: 'development',
    backends: envBackends,
  } as unknown as EndpointEnvironment;
  return render(
    <EndpointTrafficProvider
      value={{ info, loading: false, error: null, refetch: jest.fn() }}
    >
      <TrafficBlock env={env} />
    </EndpointTrafficProvider>,
  );
}

describe('TrafficBlock', () => {
  it('lists each backend that gets requests, with its share, condition or copy', () => {
    renderBlock([
      backend('python', 60),
      backend('stale', 40),
      backend('recs', 0, {
        match: {
          path: { value: '/recs' },
          headers: [{ name: 'x-beta', value: 'true' }],
        },
      }),
      backend('go', 0, { mirror: { percent: 10 } }),
      backend('idle', 0),
    ]);

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('recs')).toBeInTheDocument();
    expect(
      screen.getByText('if path /recs and header x-beta: true'),
    ).toBeInTheDocument();
    expect(screen.getByText('copy 10%')).toBeInTheDocument();
    expect(screen.queryByText('idle')).not.toBeInTheDocument();
  });

  it('marks the environment’s own condition', () => {
    renderBlock(
      [backend('python', 100), backend('recs', 0, { match: recs })],
      [{ name: 'recs', match: { path: { value: '/beta' } } }],
    );

    expect(screen.getByText('if path /beta').className).toMatch(/ownRule/);
  });

  it('shows no bar for a single share, and opens Configure', () => {
    renderBlock([backend('python', 100), backend('stale', 0)]);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      'overrides/development?tab=traffic',
    );
  });
});
