import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { ReleaseBrowserDialog } from './ReleaseBrowserDialog';

const mockFetchComponentRelease = jest.fn();
const mockApi = { fetchComponentRelease: mockFetchComponentRelease };

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockApi,
  createApiRef: jest.fn(),
}));

const mockEntity = { metadata: { name: 'my-component' } };
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

jest.mock('yaml', () => ({
  stringify: (obj: unknown) =>
    `name: ${
      (obj as { metadata?: { name?: string } })?.metadata?.name ?? 'unknown'
    }`,
}));

const makeRelease = (
  name: string,
  opts: { image?: string; created?: string } = {},
): ComponentRelease =>
  ({
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ComponentRelease',
    metadata: {
      name,
      creationTimestamp: opts.created ?? new Date().toISOString(),
    },
    spec: {
      workload: {
        spec: { container: { image: opts.image ?? 'ghcr.io/x/img:1' } },
      },
    },
  } as unknown as ComponentRelease);

const releases: ComponentRelease[] = [
  makeRelease('rel-newest', { image: 'ghcr.io/x/svc:3' }),
  makeRelease('rel-middle', { image: 'ghcr.io/x/svc:2' }),
  makeRelease('rel-oldest', { image: 'ghcr.io/x/svc:1' }),
];

describe('ReleaseBrowserDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchComponentRelease.mockResolvedValue({
      success: true,
      data: { metadata: { name: 'rel-newest' } },
    });
  });

  const renderDialog = (
    overrides: Partial<React.ComponentProps<typeof ReleaseBrowserDialog>> = {},
  ) =>
    render(
      <ReleaseBrowserDialog
        open
        onClose={jest.fn()}
        releases={releases}
        deployments={{ 'rel-middle': ['development'] }}
        selectedReleaseName="rel-middle"
        onConfirm={jest.fn()}
        environmentName="development"
        {...overrides}
      />,
    );

  it('highlights the currently selected release by default and loads its YAML', async () => {
    renderDialog();

    // Header of the right pane shows the highlighted name.
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 6, name: 'rel-middle' }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockFetchComponentRelease).toHaveBeenCalledWith(
        expect.any(Object),
        'rel-middle',
      );
    });
    expect(await screen.findByTestId('yaml-viewer')).toBeInTheDocument();
  });

  it('filters the list by search query', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByTestId('release-row-rel-newest')).toBeInTheDocument();
    expect(screen.getByTestId('release-row-rel-oldest')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search by name/i), 'oldest');

    expect(screen.queryByTestId('release-row-rel-newest')).toBeNull();
    expect(screen.getByTestId('release-row-rel-oldest')).toBeInTheDocument();
  });

  it('double-clicking a row confirms and closes', async () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderDialog({ onConfirm, onClose });

    await user.dblClick(screen.getByTestId('release-row-rel-oldest'));

    expect(onConfirm).toHaveBeenCalledWith('rel-oldest');
    expect(onClose).toHaveBeenCalled();
  });

  it('Select is disabled when there are no releases', () => {
    renderDialog({ releases: [], selectedReleaseName: null });

    const select = screen.getByRole('button', { name: 'Select' });
    expect(select).toBeDisabled();
    expect(screen.getByText(/no releases yet/i)).toBeInTheDocument();
  });

  it('renders the YAML fetch error in the right pane', async () => {
    mockFetchComponentRelease.mockRejectedValueOnce(new Error('boom'));
    renderDialog({ selectedReleaseName: 'rel-newest' });

    const error = await screen.findByTestId('yaml-error');
    expect(within(error).getByText(/boom/i)).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-viewer')).toBeNull();
  });
});
