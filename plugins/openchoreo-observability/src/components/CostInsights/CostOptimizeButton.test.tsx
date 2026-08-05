import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CostOptimizeButton } from './CostOptimizeButton';
import type { CostRowRecommendation, CostScope } from './types';

jest.mock('../../utils/applyResourceChange', () => ({
  applyResourceChange: jest.fn(),
}));
import { applyResourceChange } from '../../utils/applyResourceChange';

const mockApply = applyResourceChange as jest.MockedFunction<
  typeof applyResourceChange
>;

jest.mock('./optimizeChange', () => {
  const actual = jest.requireActual('./optimizeChange');
  return {
    ...actual,
    resolveReleaseBindingName: jest.fn(),
    buildOptimizeChange: jest.fn(() => ({
      release_binding: 'ad-dev',
      fields: [{ json_pointer: '/spec/x', value: '50m' }],
    })),
  };
});
import {
  resolveReleaseBindingName,
  buildOptimizeChange,
} from './optimizeChange';

const mockResolve = resolveReleaseBindingName as jest.MockedFunction<
  typeof resolveReleaseBindingName
>;

const mockPermission = jest.fn();
const mockUseOpenChoreoQuery = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEnvScopedPermission: (opts: unknown) => mockPermission(opts),
  useOpenChoreoQuery: () => mockUseOpenChoreoQuery(),
  // Lightweight stand-in for the real ChangesList diff renderer.
  ChangesList: ({
    sections,
  }: {
    sections: Array<{
      title: string;
      changes: Array<{ path: string; oldValue?: string; newValue?: string }>;
    }>;
  }) => (
    <div>
      {sections.map(s => (
        <div key={s.title}>
          <div>
            {s.title} ({s.changes.length} changes)
          </div>
          {s.changes.map(c => (
            <div key={c.path}>
              {c.path}: {c.oldValue ? `"${c.oldValue}" → ` : '[New] '}"
              {c.newValue}"
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-common', () => ({
  CHOREO_ANNOTATIONS: { NAMESPACE: 'ns', PROJECT: 'proj' },
  openchoreoReleaseBindingUpdatePermission: { name: 'releasebinding.update' },
}));

const mockGetBaseUrl = jest.fn(async (id: string) => `http://backend/${id}`);
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => ({ fetch: jest.fn(), getBaseUrl: mockGetBaseUrl }),
  fetchApiRef: {},
  discoveryApiRef: {},
}));
jest.mock('@backstage/plugin-catalog-react', () => ({ catalogApiRef: {} }));
jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/ad',
}));

const recommendation: CostRowRecommendation = {
  cpuRequest: '50m',
  cpuLimit: '100m',
  memoryRequest: '64Mi',
  memoryLimit: '128Mi',
  cpuCost: 1,
  memoryCost: 1,
  total: 2,
};

const scope: CostScope = {
  namespace: 'default',
  project: 'demo',
  component: 'ad',
};

function renderButton() {
  return render(
    <CostOptimizeButton
      env="dev"
      recommendation={recommendation}
      scope={scope}
      onOptimized={jest.fn()}
    />,
  );
}

describe('CostOptimizeButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission.mockReturnValue({ allowed: true, loading: false });
    mockUseOpenChoreoQuery.mockReturnValue({ data: 'component:default/ad' });
    mockResolve.mockResolvedValue('ad-dev');
    mockApply.mockResolvedValue(undefined);
  });

  it('disables the Apply button when permission is denied', () => {
    mockPermission.mockReturnValue({ allowed: false, loading: false });
    renderButton();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('disables the Apply button with a tooltip when there is nothing to apply', () => {
    render(
      <CostOptimizeButton
        env="dev"
        recommendation={recommendation}
        scope={scope}
        onOptimized={jest.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Apply' }).closest('span'),
    ).toBeInTheDocument();
  });

  it('disables the Apply button until the component entity ref resolves', () => {
    mockUseOpenChoreoQuery.mockReturnValue({ data: undefined });
    renderButton();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('checks the releasebinding:update permission scoped to the environment', () => {
    renderButton();
    expect(mockPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: 'dev',
        resourceRef: 'component:default/ad',
      }),
    );
  });

  it('opens a confirmation dialog showing the changes and redeploy note', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(/Confirm Save Changes/)).toBeInTheDocument();
    expect(
      screen.getByText('Component Overrides (4 changes)'),
    ).toBeInTheDocument();
    // Recommended values render as diff entries (quoted quantity strings).
    expect(screen.getByText(/"50m"/)).toBeInTheDocument();
    expect(screen.getByText(/"128Mi"/)).toBeInTheDocument();
    expect(screen.getByText(/trigger a redeployment/)).toBeInTheDocument();
  });

  it('resolves the binding and applies the change on confirm', async () => {
    const onOptimized = jest.fn();
    render(
      <CostOptimizeButton
        env="dev"
        recommendation={recommendation}
        scope={scope}
        onOptimized={onOptimized}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));

    await waitFor(() =>
      expect(mockResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          namespaceName: 'default',
          projectName: 'demo',
          componentName: 'ad',
          environment: 'dev',
        }),
      ),
    );
    expect(buildOptimizeChange).toHaveBeenCalledWith('ad-dev', recommendation);
    await waitFor(() =>
      expect(mockApply).toHaveBeenCalledWith(
        expect.objectContaining({
          namespaceName: 'default',
          change: { release_binding: 'ad-dev', fields: [expect.anything()] },
        }),
      ),
    );
    await waitFor(() => expect(onOptimized).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole('button', { name: /applied/i }),
    ).toBeInTheDocument();
  });

  it('shows an error and a Retry action when apply fails', async () => {
    mockApply.mockRejectedValue(new Error('binding not found'));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));

    await waitFor(() =>
      expect(screen.getByText(/binding not found/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
