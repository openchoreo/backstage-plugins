// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { componentLogsUrl } from './componentLogsUrl';

const params = (query: string) => new URLSearchParams(query);

describe('componentLogsUrl', () => {
  it("links to the component's logs page", () => {
    expect(componentLogsUrl('default', 'cart', params(''))).toBe(
      '/catalog/default/component/cart/runtime-logs',
    );
  });

  it('keeps the time range and filters', () => {
    const url = componentLogsUrl(
      'default',
      'cart',
      params(
        'env=development&timeRange=1h&logLevel=ERROR,WARN&search=timeout&sort=desc&live=true',
      ),
    );
    const query = new URLSearchParams(url.split('?')[1]);

    expect(
      url.startsWith('/catalog/default/component/cart/runtime-logs?'),
    ).toBe(true);
    expect(query.get('env')).toBe('development');
    expect(query.get('timeRange')).toBe('1h');
    expect(query.get('logLevel')).toBe('ERROR,WARN');
    expect(query.get('search')).toBe('timeout');
    expect(query.get('sort')).toBe('desc');
    expect(query.get('live')).toBe('true');
  });

  it('keeps a custom time range', () => {
    const url = componentLogsUrl(
      'default',
      'cart',
      params(
        'timeRange=custom&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z',
      ),
    );
    const query = new URLSearchParams(url.split('?')[1]);

    expect(query.get('timeRange')).toBe('custom');
    expect(query.get('from')).toBe('2026-01-01T00:00:00Z');
    expect(query.get('to')).toBe('2026-01-02T00:00:00Z');
  });

  it('drops the project-only component selection and columns', () => {
    const url = componentLogsUrl(
      'default',
      'cart',
      params('env=development&components=cart,checkout&fields=Timestamp,Log'),
    );

    expect(url).toBe(
      '/catalog/default/component/cart/runtime-logs?env=development',
    );
  });

  it('does not change the page URL parameters', () => {
    const current = params('env=development&components=cart');
    componentLogsUrl('default', 'cart', current);

    expect(current.get('components')).toBe('cart');
  });

  it('encodes the namespace and component name', () => {
    expect(componentLogsUrl('my ns', 'a/b', params(''))).toBe(
      '/catalog/my%20ns/component/a%2Fb/runtime-logs',
    );
  });

  describe('release lines', () => {
    it("selects the entry's release line", () => {
      expect(
        componentLogsUrl('default', 'hello', params('env=development'), 'next'),
      ).toBe(
        '/catalog/default/component/hello/runtime-logs?env=development&releaseLine=next',
      );
    });

    it("replaces the project's line filter with the entry's line", () => {
      const url = componentLogsUrl(
        'default',
        'hello',
        params('releaseLine=canary&timeRange=1h'),
        'next',
      );
      const query = new URLSearchParams(url.split('?')[1]);

      expect(query.getAll('releaseLine')).toEqual(['next']);
      expect(query.get('timeRange')).toBe('1h');
    });

    it.each([
      ['no line', undefined],
      ['an empty line', ''],
      ['the main line by name', 'main'],
    ])(
      "leaves a main-line entry on the component's default line (%s)",
      (_label, releaseLineName) => {
        expect(
          componentLogsUrl(
            'default',
            'hello',
            params('env=development&releaseLine=next'),
            releaseLineName,
          ),
        ).toBe('/catalog/default/component/hello/runtime-logs?env=development');
      },
    );

    it("does not carry the project's all-lines filter", () => {
      expect(
        componentLogsUrl('default', 'hello', params('releaseLine=*')),
      ).toBe('/catalog/default/component/hello/runtime-logs');
    });
  });
});
