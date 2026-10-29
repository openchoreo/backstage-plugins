// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import {
  isMainReleaseLine,
  isSameReleaseLine,
  reservedReleaseLineNameError,
  toStoredReleaseLine,
} from './mainReleaseLine';

describe('mainReleaseLine', () => {
  it('treats an empty line and the main keyword as the main line', () => {
    expect(isMainReleaseLine(undefined)).toBe(true);
    expect(isMainReleaseLine('')).toBe(true);
    expect(isMainReleaseLine(' main ')).toBe(true);
    expect(isMainReleaseLine('default')).toBe(false);
    expect(isMainReleaseLine('next')).toBe(false);
  });

  it('never stores the main keyword', () => {
    expect(toStoredReleaseLine('main')).toBeUndefined();
    expect(toStoredReleaseLine(null)).toBeUndefined();
    expect(toStoredReleaseLine(' next ')).toBe('next');
    expect(toStoredReleaseLine('default')).toBe('default');
  });

  it('matches the main line by name or as empty', () => {
    expect(isSameReleaseLine(undefined, 'main')).toBe(true);
    expect(isSameReleaseLine('', undefined)).toBe(true);
    expect(isSameReleaseLine('next', 'next')).toBe(true);
    expect(isSameReleaseLine(undefined, 'next')).toBe(false);
    expect(isSameReleaseLine(undefined, 'default')).toBe(false);
  });

  it('rejects main and the reserved default as release line names', () => {
    expect(reservedReleaseLineNameError('main')).toBe(
      'main is the implicit line of every component',
    );
    expect(reservedReleaseLineNameError('default')).toBe(
      "default is reserved, the component's implicit line is main",
    );
    expect(reservedReleaseLineNameError('next')).toBeUndefined();
  });
});
