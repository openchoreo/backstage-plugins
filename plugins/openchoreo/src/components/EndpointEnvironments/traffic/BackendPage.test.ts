import { backendMatchProblems } from '@openchoreo/backstage-plugin-common';
import { toMatch } from './BackendPage';

describe('toMatch', () => {
  it('drops untouched rows', () => {
    expect(
      toMatch([
        { type: 'header', name: '', compare: 'Exact', value: '' },
        { type: 'path', name: '', compare: 'PathPrefix', value: '' },
      ]),
    ).toEqual({});
  });

  it('keeps a header with a name but no value, so saving says why it can’t', () => {
    const match = toMatch([
      { type: 'header', name: 'x-version', compare: 'Exact', value: 'green' },
      { type: 'header', name: 'x-beta', compare: 'Exact', value: '' },
    ]);
    expect(match.headers).toHaveLength(2);
    expect(backendMatchProblems(match)).toContain('Give a value for x-beta');
  });
});
