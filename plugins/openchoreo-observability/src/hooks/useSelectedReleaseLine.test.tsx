// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  componentDefaultReleaseLine,
  useSelectedReleaseLine,
} from './useSelectedReleaseLine';

let mockPageLine: string | undefined;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useReleaseLine: () => ({ releaseLine: mockPageLine }),
}));

function selected(url: string, defaultLine?: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => useSelectedReleaseLine(defaultLine), { wrapper })
    .result.current;
}

const component = (targetRefs: string[]) =>
  ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'hello' },
    relations: targetRefs.map(targetRef => ({ type: 'hasPart', targetRef })),
  } as any);

describe('useSelectedReleaseLine', () => {
  beforeEach(() => {
    mockPageLine = undefined;
  });

  it('falls back to the default line while the URL names none', () => {
    expect(selected('/', 'main')).toBe('main');
    expect(selected('/')).toBeUndefined();
  });

  it('reads every line from the all-lines value', () => {
    expect(selected('/?releaseLine=*', 'main')).toBeUndefined();
  });

  it('prefers the URL line, and the page line over both', () => {
    expect(selected('/?releaseLine=next', 'main')).toBe('next');
    mockPageLine = 'canary';
    expect(selected('/?releaseLine=next', 'main')).toBe('canary');
  });
});

describe('componentDefaultReleaseLine', () => {
  it('is the main line for a component with release lines', () => {
    expect(
      componentDefaultReleaseLine(component(['releaseline:default/next'])),
    ).toBe('main');
  });

  it('is every line for a component without them', () => {
    expect(
      componentDefaultReleaseLine(component(['api:default/hello-api'])),
    ).toBeUndefined();
    expect(componentDefaultReleaseLine(component([]))).toBeUndefined();
  });
});
