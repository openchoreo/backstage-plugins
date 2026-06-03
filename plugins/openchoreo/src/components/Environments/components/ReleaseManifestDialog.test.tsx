import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';

const mockFetchComponentRelease = jest.fn();
const mockApi = { fetchComponentRelease: mockFetchComponentRelease };

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockApi,
  createApiRef: jest.fn(),
}));

const mockEntity = { metadata: { name: 'my-component' } };
const mockEntityResult = { entity: mockEntity };
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockEntityResult,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

jest.mock('yaml', () => ({
  stringify: (obj: unknown) =>
    `kind: ${(obj as { kind?: string })?.kind ?? 'unknown'}`,
}));

describe('ReleaseManifestDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "no release" message when releaseName is undefined', () => {
    render(
      <ReleaseManifestDialog
        open
        onClose={jest.fn()}
        environmentName="staging"
        releaseName={undefined}
      />,
    );
    expect(
      screen.getByText(/no release on this environment yet/i),
    ).toBeInTheDocument();
    expect(mockFetchComponentRelease).not.toHaveBeenCalled();
  });

  it('unwraps the response envelope and renders the inner manifest as YAML', async () => {
    mockFetchComponentRelease.mockResolvedValue({
      success: true,
      data: {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'ComponentRelease',
        metadata: { name: 'my-comp-rel-7' },
      },
    });

    render(
      <ReleaseManifestDialog
        open
        onClose={jest.fn()}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('yaml-viewer')).toBeInTheDocument();
    });
    expect(mockFetchComponentRelease).toHaveBeenCalledWith(
      expect.any(Object),
      'my-comp-rel-7',
    );
    // The viewer should show the inner manifest (kind: ComponentRelease),
    // not the envelope (which would start with `success: true`).
    const yamlText = screen.getByTestId('yaml-viewer').textContent ?? '';
    expect(yamlText).toContain('kind: ComponentRelease');
    expect(yamlText).not.toContain('success: true');
  });

  it('renders an error when the response indicates failure', async () => {
    mockFetchComponentRelease.mockResolvedValue({ success: false });

    render(
      <ReleaseManifestDialog
        open
        onClose={jest.fn()}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/release manifest is not available/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('yaml-viewer')).toBeNull();
  });

  it('renders an error message when fetch fails', async () => {
    mockFetchComponentRelease.mockRejectedValue(new Error('boom'));

    render(
      <ReleaseManifestDialog
        open
        onClose={jest.fn()}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/boom/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('yaml-viewer')).toBeNull();
  });

  it('calls onClose when the Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockFetchComponentRelease.mockResolvedValue({});

    render(
      <ReleaseManifestDialog
        open
        onClose={onClose}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides the Open Release Browser button when onOpenReleaseBrowser is absent', () => {
    // Set the fetch mock explicitly so this test doesn't rely on a prior
    // test's mockImplementation — `ReleaseManifestDialog` always calls
    // `api.fetchComponentRelease(...).then(...)` whenever it has an
    // `open` + `releaseName`.
    mockFetchComponentRelease.mockResolvedValue({});
    render(
      <ReleaseManifestDialog
        open
        onClose={jest.fn()}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );
    expect(
      screen.queryByRole('button', { name: /open release browser/i }),
    ).not.toBeInTheDocument();
  });

  it('closes the dialog and invokes the pivot when Open Release Browser is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onOpenReleaseBrowser = jest.fn();
    mockFetchComponentRelease.mockResolvedValue({});

    render(
      <ReleaseManifestDialog
        open
        onClose={onClose}
        onOpenReleaseBrowser={onOpenReleaseBrowser}
        environmentName="staging"
        releaseName="my-comp-rel-7"
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /open release browser/i }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onOpenReleaseBrowser).toHaveBeenCalled();
    // Close must fire before the pivot so the next dialog doesn't stack.
    const closeOrder = onClose.mock.invocationCallOrder[0];
    const pivotOrder = onOpenReleaseBrowser.mock.invocationCallOrder[0];
    expect(closeOrder).toBeLessThan(pivotOrder);
  });
});
