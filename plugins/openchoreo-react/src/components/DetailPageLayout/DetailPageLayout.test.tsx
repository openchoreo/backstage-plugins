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
