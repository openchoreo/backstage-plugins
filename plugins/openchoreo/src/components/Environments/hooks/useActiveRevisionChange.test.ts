import { renderHook } from '@testing-library/react';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import { useActiveRevisionChange } from './useActiveRevisionChange';

const rev = (n: number, health: string): BindingRevision =>
  ({
    metadata: { name: `api-development-r${n}` },
    spec: { revision: n },
    status: { active: true, health },
  } as unknown as BindingRevision);

describe('useActiveRevisionChange', () => {
  const render = (initial: BindingRevision | undefined) => {
    const onChange = jest.fn();
    const hook = renderHook(
      ({ active }: { active: BindingRevision | undefined }) =>
        useActiveRevisionChange(active, onChange),
      { initialProps: { active: initial } },
    );
    return { onChange, ...hook };
  };

  it('does not fire when the history first loads', () => {
    const { onChange, rerender } = render(undefined);
    rerender({ active: rev(4, 'Healthy') });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires when another revision becomes active, and when its health settles', () => {
    const { onChange, rerender } = render(rev(4, 'Healthy'));
    rerender({ active: rev(2, 'Progressing') });
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender({ active: rev(2, 'Healthy') });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('does not fire while nothing changes', () => {
    const { onChange, rerender } = render(rev(4, 'Healthy'));
    rerender({ active: rev(4, 'Healthy') });
    rerender({ active: rev(4, 'Healthy') });
    expect(onChange).not.toHaveBeenCalled();
  });
});
