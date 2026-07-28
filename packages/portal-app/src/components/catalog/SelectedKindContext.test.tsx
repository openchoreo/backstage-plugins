import { render, screen, act } from '@testing-library/react';
import { SelectedKindProvider, useSelectedKind } from './SelectedKindContext';

/** Reads the context and exposes a way to publish a new kind. */
const Probe = () => {
  const { selectedKind, setSelectedKind } = useSelectedKind();
  return (
    <div>
      <span data-testid="kind">{selectedKind ?? 'undefined'}</span>
      <button type="button" onClick={() => setSelectedKind('Environment')}>
        set-env
      </button>
    </div>
  );
};

describe('SelectedKindContext', () => {
  it('starts undefined and publishes a lowercased kind on set', () => {
    render(
      <SelectedKindProvider>
        <Probe />
      </SelectedKindProvider>,
    );

    expect(screen.getByTestId('kind')).toHaveTextContent('undefined');

    act(() => {
      screen.getByText('set-env').click();
    });

    // Kind is lowercased so it composes with the lowercase kind keys elsewhere.
    expect(screen.getByTestId('kind')).toHaveTextContent('environment');
  });

  it('degrades to an undefined kind and a no-op setter outside a provider', () => {
    // No provider: the hook must not throw, and setSelectedKind is a safe no-op.
    render(<Probe />);

    expect(screen.getByTestId('kind')).toHaveTextContent('undefined');
    act(() => {
      screen.getByText('set-env').click();
    });
    // Still undefined — the no-op setter changed nothing.
    expect(screen.getByTestId('kind')).toHaveTextContent('undefined');
  });
});
