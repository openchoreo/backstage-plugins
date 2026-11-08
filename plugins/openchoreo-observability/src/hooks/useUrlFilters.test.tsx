import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUrlFilters } from './useUrlFilters';

function renderWithUrl(initialUrl: string, defaultTimeRange?: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      ...useUrlFilters({ environments: [], defaultTimeRange }),
      search: useLocation().search,
    }),
    { wrapper },
  );
}

describe('useUrlFilters', () => {
  it('defaults to 10 minutes when no default is given', () => {
    const { result } = renderWithUrl('/rca');

    expect(result.current.filters.timeRange).toBe('10m');
  });

  it('uses defaultTimeRange when the URL has no timeRange', () => {
    const { result } = renderWithUrl('/rca', '24h');

    expect(result.current.filters.timeRange).toBe('24h');
  });

  it('prefers the timeRange in the URL over defaultTimeRange', () => {
    const { result } = renderWithUrl('/rca?timeRange=1h', '24h');

    expect(result.current.filters.timeRange).toBe('1h');
  });

  it('keeps defaultTimeRange out of the URL when it is selected', () => {
    const { result } = renderWithUrl('/rca?timeRange=1h', '24h');

    act(() => result.current.updateFilters({ timeRange: '24h' }));

    expect(result.current.filters.timeRange).toBe('24h');
    expect(result.current.search).not.toContain('timeRange');
  });

  it('writes a non-default timeRange to the URL', () => {
    const { result } = renderWithUrl('/rca', '24h');

    act(() => result.current.updateFilters({ timeRange: '1h' }));

    expect(result.current.filters.timeRange).toBe('1h');
    expect(result.current.search).toContain('timeRange=1h');
  });
});
