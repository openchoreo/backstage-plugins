import { render } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders a progressbar', () => {
    const { getByRole } = render(<Spinner />);
    expect(getByRole('progressbar')).toBeInTheDocument();
  });

  it('defaults to the inline size (20px)', () => {
    const { getByRole } = render(<Spinner />);
    const el = getByRole('progressbar');
    expect(el.style.width).toBe('20px');
    expect(el.style.height).toBe('20px');
  });

  it('maps named sizes to pixel values', () => {
    const { getByRole } = render(<Spinner size="button" />);
    expect(getByRole('progressbar').style.width).toBe('16px');
  });

  it('accepts an explicit pixel size', () => {
    const { getByRole } = render(<Spinner size={32} />);
    expect(getByRole('progressbar').style.width).toBe('32px');
  });

  it('forwards an accessible label', () => {
    const { getByLabelText } = render(<Spinner aria-label="Loading" />);
    expect(getByLabelText('Loading')).toBeInTheDocument();
  });
});
