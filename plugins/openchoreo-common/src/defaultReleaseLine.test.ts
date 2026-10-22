// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import {
  isDefaultReleaseLine,
  isSameReleaseLine,
  toStoredReleaseLine,
} from './defaultReleaseLine';

describe('mainReleaseLine', () => {
  it('treats an empty line and the default keyword as the default line', () => {
    expect(isDefaultReleaseLine(undefined)).toBe(true);
    expect(isDefaultReleaseLine('')).toBe(true);
    expect(isDefaultReleaseLine(' default ')).toBe(true);
    expect(isDefaultReleaseLine('next')).toBe(false);
  });

  it('never stores the default keyword', () => {
    expect(toStoredReleaseLine('default')).toBeUndefined();
    expect(toStoredReleaseLine(null)).toBeUndefined();
    expect(toStoredReleaseLine(' next ')).toBe('next');
  });

  it('matches the default line by name or as empty', () => {
    expect(isSameReleaseLine(undefined, 'default')).toBe(true);
    expect(isSameReleaseLine('', undefined)).toBe(true);
    expect(isSameReleaseLine('next', 'next')).toBe(true);
    expect(isSameReleaseLine(undefined, 'next')).toBe(false);
  });
});
