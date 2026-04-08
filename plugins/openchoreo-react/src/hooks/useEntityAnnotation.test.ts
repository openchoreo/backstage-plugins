import { renderHook } from '@testing-library/react';
import {
  useEntityAnnotation,
  useHasAnnotation,
  useHasAnyAnnotation,
} from './useEntityAnnotation';

const mockUseEntity = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

const makeEntity = (annotations: Record<string, string> = {}) => ({
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'test', namespace: 'default', annotations },
  },
});

describe('useEntityAnnotation', () => {
  it('returns annotation value when present', () => {
    mockUseEntity.mockReturnValue(
      makeEntity({ 'jenkins.io/job-full-name': 'my-job' }),
    );
    const { result } = renderHook(() =>
      useEntityAnnotation('jenkins.io/job-full-name'),
    );
    expect(result.current).toBe('my-job');
  });

  it('returns undefined when annotation is absent', () => {
    mockUseEntity.mockReturnValue(makeEntity());
    const { result } = renderHook(() => useEntityAnnotation('missing'));
    expect(result.current).toBeUndefined();
  });

  it('returns undefined when annotations object is missing', () => {
    mockUseEntity.mockReturnValue({
      entity: { metadata: { name: 'test' } } as any,
    });
    const { result } = renderHook(() => useEntityAnnotation('any'));
    expect(result.current).toBeUndefined();
  });
});

describe('useHasAnnotation', () => {
  it('returns true when annotation is present', () => {
    mockUseEntity.mockReturnValue(makeEntity({ 'my-key': 'value' }));
    const { result } = renderHook(() => useHasAnnotation('my-key'));
    expect(result.current).toBe(true);
  });

  it('returns true for empty string annotation', () => {
    mockUseEntity.mockReturnValue(makeEntity({ 'my-key': '' }));
    const { result } = renderHook(() => useHasAnnotation('my-key'));
    expect(result.current).toBe(true);
  });

  it('returns false when annotation is missing', () => {
    mockUseEntity.mockReturnValue(makeEntity());
    const { result } = renderHook(() => useHasAnnotation('missing'));
    expect(result.current).toBe(false);
  });
});

describe('useHasAnyAnnotation', () => {
  it('returns true when at least one annotation is present', () => {
    mockUseEntity.mockReturnValue(
      makeEntity({ 'github.com/project-slug': 'org/repo' }),
    );
    const { result } = renderHook(() =>
      useHasAnyAnnotation([
        'jenkins.io/job-full-name',
        'github.com/project-slug',
        'gitlab.com/project-slug',
      ]),
    );
    expect(result.current).toBe(true);
  });

  it('returns false when none of the annotations are present', () => {
    mockUseEntity.mockReturnValue(makeEntity({ 'other-key': 'value' }));
    const { result } = renderHook(() => useHasAnyAnnotation(['a', 'b', 'c']));
    expect(result.current).toBe(false);
  });

  it('returns false for empty annotations array', () => {
    mockUseEntity.mockReturnValue(makeEntity({ key: 'value' }));
    const { result } = renderHook(() => useHasAnyAnnotation([]));
    expect(result.current).toBe(false);
  });
});
