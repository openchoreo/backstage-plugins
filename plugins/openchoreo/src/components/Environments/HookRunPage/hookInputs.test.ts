import { resolveHookInputs } from './hookInputs';

describe('resolveHookInputs', () => {
  // Users debug a failed run by what it actually received, and need to know
  // which value they can change on the binding versus in the hook.
  it('shows the value the run received and where it came from', () => {
    const inputs = resolveHookInputs(
      { image: 'reg/app:v1', severity: 'HIGH', ignoreUnfixed: 'false' },
      [
        { name: 'image', from: '${deployment.workload.containers.main.image}' },
        { name: 'severity', default: 'CRITICAL' },
        {
          name: 'ignoreUnfixed',
          from: '${deployment.environment.isProduction ? "false" : "true"}',
          overridable: true,
        },
        { name: 'mode', value: 'strict' },
      ],
      { severity: 'HIGH' },
    );
    expect(inputs).toEqual([
      { name: 'image', value: 'reg/app:v1', source: 'from release' },
      { name: 'severity', value: 'HIGH', source: 'binding' },
      {
        name: 'ignoreUnfixed',
        value: 'false',
        source: 'from release · overridable',
      },
      // Fixed values can't be overridden, so they are never "binding".
      { name: 'mode', value: '—', source: 'fixed' },
    ]);
  });

  it('lists run parameters the hook no longer declares, without a source', () => {
    expect(resolveHookInputs({ extra: 3 }, [], undefined)).toEqual([
      { name: 'extra', value: '3', source: '' },
    ]);
  });
});
