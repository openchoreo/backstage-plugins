// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { componentLineName, scopedName } from './releaseLineNames';

describe('componentLineName', () => {
  it('keeps the component name for the main line', () => {
    expect(componentLineName('hello')).toBe('hello');
    expect(componentLineName('hello', '')).toBe('hello');
  });

  // Names computed by OpenChoreo's releaseline.ComponentLineName.
  it.each([
    ['hello', 'next', 'hello-next-4833a175'],
    ['api-service', 'next', 'api-service-next-89391e40'],
    [
      'customer-notification-service',
      'feature-new-checkout-flow',
      'customer-notification-servi-feature-new-checkout-flow-39473eeb',
    ],
    [
      'c'.repeat(40),
      'l'.repeat(40),
      `${'c'.repeat(27)}-${'l'.repeat(26)}-4d283671`,
    ],
    ['a-', 'b', 'a-b-233f0b0d'],
    [
      'abcdefghijklmnopqrstuvwxyz-abcd',
      'x',
      'abcdefghijklmnopqrstuvwxyz--x-1a97984f',
    ],
  ])('names component %s on line %s as OpenChoreo does', (c, l, want) => {
    expect(componentLineName(c, l)).toBe(want);
  });
});

describe('scopedName', () => {
  it('names the main line as {component}-{suffix}', () => {
    expect(scopedName('hello', undefined, 'workload')).toBe('hello-workload');
    expect(scopedName('hello', '', 'development')).toBe('hello-development');
  });

  it('names a release line from its componentLineName', () => {
    expect(scopedName('hello', 'next', 'workload')).toBe(
      'hello-next-4833a175-workload',
    );
    expect(scopedName('hello', 'next', 'development')).toBe(
      'hello-next-4833a175-development',
    );
  });

  it("never gives a line another component's names", () => {
    expect(scopedName('orders', 'v2', 'workload')).not.toBe(
      scopedName('orders-v2', undefined, 'workload'),
    );
  });
});
