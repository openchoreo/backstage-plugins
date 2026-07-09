import { render, screen } from '@testing-library/react';
import { RefreshOverlay } from './RefreshOverlay';

describe('RefreshOverlay', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<RefreshOverlay active={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a status indicator when active', () => {
    render(<RefreshOverlay active />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Refreshing');
  });

  it('uses a custom label when provided', () => {
    render(<RefreshOverlay active label="Refreshing planes" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Refreshing planes',
    );
  });

  it('renders the corner spinner variant by default', () => {
    const { container } = render(<RefreshOverlay active />);
    // MUI CircularProgress carries role="progressbar".
    expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });

  it('renders the bar variant when requested', () => {
    render(<RefreshOverlay active variant="bar" />);
    // The LinearProgress itself is the status node.
    const status = screen.getByRole('status');
    expect(status).toHaveClass('MuiLinearProgress-root');
  });
});
