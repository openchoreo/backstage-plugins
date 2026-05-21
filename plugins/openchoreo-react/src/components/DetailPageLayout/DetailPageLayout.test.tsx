import { render, screen, fireEvent } from '@testing-library/react';
import { DetailPageLayout } from './DetailPageLayout';

describe('DetailPageLayout', () => {
  it('calls onBack when Escape is pressed', () => {
    const onBack = jest.fn();
    render(
      <DetailPageLayout title="Test" onBack={onBack}>
        <div>body</div>
      </DetailPageLayout>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not call onBack when Escape is pressed while an input is focused', () => {
    const onBack = jest.fn();
    render(
      <DetailPageLayout title="Test" onBack={onBack}>
        <input data-testid="field" />
      </DetailPageLayout>,
    );

    const input = screen.getByTestId('field') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('does not call onBack when Escape is pressed inside an open dialog', () => {
    const onBack = jest.fn();
    render(
      <DetailPageLayout title="Test" onBack={onBack}>
        <div role="dialog" aria-modal="true" data-testid="overlay">
          <button type="button" data-testid="dialog-button">
            OK
          </button>
        </div>
      </DetailPageLayout>,
    );

    fireEvent.keyDown(screen.getByTestId('dialog-button'), { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('does not call onBack when another handler has already preventDefault-ed the Escape event', () => {
    const onBack = jest.fn();
    render(
      <DetailPageLayout title="Test" onBack={onBack}>
        <div />
      </DetailPageLayout>,
    );

    // Simulate an overlay/MUI dialog that intercepts Escape first by calling
    // preventDefault before our listener runs.
    const intercept = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', intercept, true /* capture */);
    try {
      fireEvent.keyDown(window, { key: 'Escape' });
    } finally {
      window.removeEventListener('keydown', intercept, true);
    }
    expect(onBack).not.toHaveBeenCalled();
  });

  it('renders the Esc shortcut chip in the header', () => {
    render(
      <DetailPageLayout title="Test" onBack={jest.fn()}>
        <div />
      </DetailPageLayout>,
    );
    expect(screen.getByLabelText(/press escape to go back/i)).toHaveTextContent(
      'Esc',
    );
  });
});
