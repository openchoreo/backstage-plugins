import { renderHook } from '@testing-library/react';
import {
  useOpenChoreoFeatures,
  useWorkflowsEnabled,
  useObservabilityEnabled,
  useAuthEnabled,
  useAuthzEnabled,
  useCiliumEnabled,
} from './useOpenChoreoFeatures';

const mockGetOptionalConfig = jest.fn();
const mockConfigApi = {
  getOptionalConfig: (key: string) => mockGetOptionalConfig(key),
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockConfigApi,
  configApiRef: { id: 'core.config' },
}));

function makeFeaturesConfig(values: Record<string, boolean | undefined>) {
  return {
    getOptionalBoolean: (key: string) => values[key],
  };
}

describe('useOpenChoreoFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all features enabled by default when no config', () => {
    mockGetOptionalConfig.mockReturnValue(undefined);
    const { result } = renderHook(() => useOpenChoreoFeatures());
    expect(result.current).toEqual({
      workflows: { enabled: true },
      observability: { enabled: true },
      auth: { enabled: true },
      authz: { enabled: true },
      cilium: { enabled: false },
    });
  });

  it('reads feature values from config when present', () => {
    mockGetOptionalConfig.mockReturnValue(
      makeFeaturesConfig({
        'workflows.enabled': false,
        'observability.enabled': true,
        'auth.enabled': false,
        'authz.enabled': true,
      }),
    );
    const { result } = renderHook(() => useOpenChoreoFeatures());
    expect(result.current).toEqual({
      workflows: { enabled: false },
      observability: { enabled: true },
      auth: { enabled: false },
      authz: { enabled: true },
      cilium: { enabled: false },
    });
  });

  it('defaults individual features to true when not set in config', () => {
    mockGetOptionalConfig.mockReturnValue(
      makeFeaturesConfig({ 'workflows.enabled': false }),
    );
    const { result } = renderHook(() => useOpenChoreoFeatures());
    expect(result.current.workflows.enabled).toBe(false);
    expect(result.current.observability.enabled).toBe(true);
    expect(result.current.auth.enabled).toBe(true);
    expect(result.current.authz.enabled).toBe(true);
  });

  it('returns defaults when config throws', () => {
    mockGetOptionalConfig.mockImplementation(() => {
      throw new Error('config error');
    });
    const { result } = renderHook(() => useOpenChoreoFeatures());
    expect(result.current).toEqual({
      workflows: { enabled: true },
      observability: { enabled: true },
      auth: { enabled: true },
      authz: { enabled: true },
      cilium: { enabled: false },
    });
  });
});

describe('helper hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOptionalConfig.mockReturnValue(
      makeFeaturesConfig({
        'workflows.enabled': true,
        'observability.enabled': false,
        'auth.enabled': true,
        'authz.enabled': false,
        'cilium.enabled': true,
      }),
    );
  });

  it('useWorkflowsEnabled returns workflow flag', () => {
    const { result } = renderHook(() => useWorkflowsEnabled());
    expect(result.current).toBe(true);
  });

  it('useObservabilityEnabled returns observability flag', () => {
    const { result } = renderHook(() => useObservabilityEnabled());
    expect(result.current).toBe(false);
  });

  it('useAuthEnabled returns auth flag', () => {
    const { result } = renderHook(() => useAuthEnabled());
    expect(result.current).toBe(true);
  });

  it('useAuthzEnabled returns authz flag', () => {
    const { result } = renderHook(() => useAuthzEnabled());
    expect(result.current).toBe(false);
  });

  it('useCiliumEnabled returns cilium flag', () => {
    const { result } = renderHook(() => useCiliumEnabled());
    expect(result.current).toBe(true);
  });
});
