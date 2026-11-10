// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useUrlFiltersForRuntimeLogs } from './useUrlFiltersForRuntimeLogs';
import {
  LogEntryField,
  SELECTED_FIELDS,
} from '../components/RuntimeLogs/types';

jest.mock('./useAutoSelectFirstEnvironment', () => ({
  useAutoSelectFirstEnvironment: jest.fn(),
}));

const environments = [{ name: 'development' }] as any;

const withReleaseLine = [
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.ReleaseLine,
  LogEntryField.Log,
];

const renderFilters = (releaseLineColumn: boolean, initialEntry = '/') =>
  renderHook(
    props => ({
      ...useUrlFiltersForRuntimeLogs({
        environments,
        releaseLineColumn: props.releaseLineColumn,
      }),
      search: useLocation().search,
    }),
    {
      initialProps: { releaseLineColumn },
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
      ),
    },
  );

describe('useUrlFiltersForRuntimeLogs', () => {
  it('offers no release line column by default', () => {
    const { result } = renderFilters(false);
    expect(result.current.fieldOptions).toEqual(SELECTED_FIELDS);
    expect(result.current.filters.selectedFields).toEqual(SELECTED_FIELDS);
  });

  it('shows the release line column by default where it is offered', () => {
    const { result } = renderFilters(true);
    expect(result.current.fieldOptions).toEqual(withReleaseLine);
    expect(result.current.filters.selectedFields).toEqual(withReleaseLine);
  });

  it('keeps the release line column off once it is turned off', () => {
    const { result, rerender } = renderFilters(true);
    act(() =>
      result.current.updateFilters({ selectedFields: [...SELECTED_FIELDS] }),
    );
    expect(result.current.filters.selectedFields).toEqual(SELECTED_FIELDS);

    rerender({ releaseLineColumn: false });
    rerender({ releaseLineColumn: true });
    expect(result.current.filters.selectedFields).toEqual(SELECTED_FIELDS);
  });

  it('turning the release line column back on returns to the default', () => {
    const { result } = renderFilters(true, '/?fields=Timestamp,LogLevel,Log');
    act(() =>
      result.current.updateFilters({ selectedFields: [...withReleaseLine] }),
    );
    expect(result.current.filters.selectedFields).toEqual(withReleaseLine);
    expect(result.current.search).not.toContain('fields');
  });

  it('always shows the component name column where it is offered', () => {
    const { result } = renderHook(
      () =>
        useUrlFiltersForRuntimeLogs({
          environments,
          componentNameColumn: true,
        }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter initialEntries={['/?fields=Timestamp,Log']}>
            {children}
          </MemoryRouter>
        ),
      },
    );
    expect(result.current.fieldOptions).toEqual([
      LogEntryField.Timestamp,
      LogEntryField.LogLevel,
      LogEntryField.ComponentName,
      LogEntryField.Log,
    ]);
    expect(result.current.filters.selectedFields).toEqual([
      LogEntryField.Timestamp,
      LogEntryField.ComponentName,
      LogEntryField.Log,
    ]);

    act(() =>
      result.current.updateFilters({
        selectedFields: [LogEntryField.LogLevel],
      }),
    );
    expect(result.current.filters.selectedFields).toEqual([
      LogEntryField.LogLevel,
      LogEntryField.ComponentName,
      LogEntryField.Log,
    ]);
  });

  it('drops the release line column where it is not offered', () => {
    const { result } = renderFilters(
      false,
      '/?fields=Timestamp,Release+Line,Log',
    );
    expect(result.current.filters.selectedFields).toEqual([
      LogEntryField.Timestamp,
      LogEntryField.Log,
    ]);
  });

  it('puts the release line column after the component name column', () => {
    const { result } = renderHook(
      () =>
        useUrlFiltersForRuntimeLogs({
          environments,
          releaseLineColumn: true,
          componentNameColumn: true,
        }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter
            initialEntries={['/?fields=Release+Line,Component+Name,Log']}
          >
            {children}
          </MemoryRouter>
        ),
      },
    );
    expect(result.current.fieldOptions).toEqual([
      LogEntryField.Timestamp,
      LogEntryField.LogLevel,
      LogEntryField.ComponentName,
      LogEntryField.ReleaseLine,
      LogEntryField.Log,
    ]);
    expect(result.current.filters.selectedFields).toEqual([
      LogEntryField.ComponentName,
      LogEntryField.ReleaseLine,
      LogEntryField.Log,
    ]);
  });
});
