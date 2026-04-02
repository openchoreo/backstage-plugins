import { render, screen, fireEvent } from '@testing-library/react';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

describe('UnsavedChangesDialog', () => {
  const defaultProps = {
    open: true,
    onDiscard: jest.fn(),
    onStay: jest.fn(),
    changeCount: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog when open=true', () => {
    render(<UnsavedChangesDialog {...defaultProps} />);

    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(
      screen.getByText(/Your changes will be lost if you leave without saving/),
    ).toBeInTheDocument();
  });

  it('shows singular "1 change" text', () => {
    render(<UnsavedChangesDialog {...defaultProps} changeCount={1} />);

    expect(screen.getByText(/You have 1 unsaved change\./)).toBeInTheDocument();
  });

  it('shows plural "5 changes" text', () => {
    render(<UnsavedChangesDialog {...defaultProps} changeCount={5} />);

    expect(
      screen.getByText(/You have 5 unsaved changes\./),
    ).toBeInTheDocument();
  });

  it('Discard button calls onDiscard', () => {
    render(<UnsavedChangesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Discard Changes'));
    expect(defaultProps.onDiscard).toHaveBeenCalledTimes(1);
  });

  it('Stay button calls onStay', () => {
    render(<UnsavedChangesDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('Stay'));
    expect(defaultProps.onStay).toHaveBeenCalledTimes(1);
  });

  it('does not render when open=false', () => {
    render(<UnsavedChangesDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();
  });
});
