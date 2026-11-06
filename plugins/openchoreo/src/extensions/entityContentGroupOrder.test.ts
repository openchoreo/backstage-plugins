import { sortByGroupOrder } from './entityContentGroupOrder';

const order = (...tabs: Array<[id: string, group: string]>) =>
  sortByGroupOrder(
    tabs.map(([id, group]) => ({ id, group })),
    t => t.group,
  ).map(t => t.id);

describe('sortByGroupOrder', () => {
  it('orders the APIs tab after the workflow tabs, whichever order they register in', () => {
    // `development` is the group of the upstream api-docs "APIs" tab, which is
    // only shown on components that provide or consume an API. Ordering it
    // after `build` and `deploy` is what keeps those two in the same place on
    // every component (openchoreo/openchoreo#5282).
    expect(
      order(
        ['apis', 'development'],
        ['deploy', 'deploy'],
        ['build', 'build'],
        ['definition', 'definition'],
      ),
    ).toEqual(['definition', 'build', 'deploy', 'apis']);
  });

  it('puts overview first and groups it does not know last', () => {
    expect(
      order(
        ['logs', 'logs'],
        ['mystery', 'not-a-known-group'],
        ['deploy', 'deploy'],
        ['overview', 'overview'],
      ),
    ).toEqual(['overview', 'deploy', 'logs', 'mystery']);
  });

  it('keeps registration order between tabs of the same group', () => {
    expect(
      order(
        ['second', 'deploy'],
        ['logs', 'logs'],
        ['first', 'deploy'],
        ['third', 'deploy'],
      ),
    ).toEqual(['second', 'first', 'third', 'logs']);
  });
});
