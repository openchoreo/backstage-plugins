import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type NamespaceSummary,
  type ProjectSummary,
  type ComponentSummary,
} from '../../../api/OpenChoreoClientApi';
import { useNamespaces, useProjects, useComponents } from './useHierarchyData';

function makeNamespace(name: string): NamespaceSummary {
  return { name };
}
function makeProject(name: string): ProjectSummary {
  return { name };
}
function makeComponent(name: string): ComponentSummary {
  return { name };
}

function wrapper(client: any) {
  return createQueryWrapper([[openChoreoClientApiRef, client]]);
}

describe('useNamespaces', () => {
  it('starts loading with no namespaces', () => {
    const client = {
      listNamespaces: jest.fn().mockResolvedValue([makeNamespace('default')]),
    };
    const { result } = renderHook(() => useNamespaces(), {
      wrapper: wrapper(client),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.namespaces).toEqual([]);
  });

  it('loads namespaces and exposes them once resolved', async () => {
    const client = {
      listNamespaces: jest
        .fn()
        .mockResolvedValue([makeNamespace('default'), makeNamespace('team-a')]),
    };
    const { result } = renderHook(() => useNamespaces(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.namespaces).toEqual([
      makeNamespace('default'),
      makeNamespace('team-a'),
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });
});

describe('useProjects', () => {
  it('loads projects for a namespace once resolved', async () => {
    const client = {
      listProjects: jest.fn().mockResolvedValue([makeProject('svc')]),
    };
    const { result } = renderHook(() => useProjects('default'), {
      wrapper: wrapper(client),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.projects).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(client.listProjects).toHaveBeenCalledWith('default');
    expect(result.current.projects).toEqual([makeProject('svc')]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('does not fetch while the namespace is undefined', () => {
    const client = { listProjects: jest.fn() };
    const { result } = renderHook(() => useProjects(undefined), {
      wrapper: wrapper(client),
    });

    expect(client.listProjects).not.toHaveBeenCalled();
    expect(result.current.projects).toEqual([]);
  });
});

describe('useComponents', () => {
  it('loads components for a namespace + project once resolved', async () => {
    const client = {
      listComponents: jest.fn().mockResolvedValue([makeComponent('api')]),
    };
    const { result } = renderHook(() => useComponents('default', 'svc'), {
      wrapper: wrapper(client),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.components).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(client.listComponents).toHaveBeenCalledWith('default', 'svc');
    expect(result.current.components).toEqual([makeComponent('api')]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('does not fetch until both namespace and project are set', () => {
    const client = { listComponents: jest.fn() };
    const { result } = renderHook(() => useComponents('default', undefined), {
      wrapper: wrapper(client),
    });

    expect(client.listComponents).not.toHaveBeenCalled();
    expect(result.current.components).toEqual([]);
  });
});
