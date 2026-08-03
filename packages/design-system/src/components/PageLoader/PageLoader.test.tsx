import { render } from '@testing-library/react';
import { PageLoader } from './PageLoader';

describe('PageLoader', () => {
  it('renders a spinner in a busy status region', () => {
    const { getByRole } = render(<PageLoader />);
    const status = getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    // The centered Spinner renders a progressbar.
    expect(getByRole('progressbar')).toBeInTheDocument();
  });

  it('defaults to a viewport-relative min height so it centers on a full page', () => {
    const { getByRole } = render(<PageLoader />);
    expect(getByRole('status').style.minHeight).toBe('60vh');
  });

  it('forwards a custom minHeight for section-level use', () => {
    const { getByRole } = render(<PageLoader minHeight={120} />);
    expect(getByRole('status').style.minHeight).toBe('120px');
  });
});
