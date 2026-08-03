import { render } from '@testing-library/react';
import { SkeletonRows } from './SkeletonRows';

const renderInTable = (ui: React.ReactElement) =>
  render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );

describe('SkeletonRows', () => {
  it('renders rows × cols placeholder cells', () => {
    const { container } = renderInTable(<SkeletonRows rows={3} cols={4} />);
    expect(container.querySelectorAll('tr')).toHaveLength(3);
    expect(container.querySelectorAll('td')).toHaveLength(12);
  });

  it('defaults to 5 rows', () => {
    const { container } = renderInTable(<SkeletonRows cols={2} />);
    expect(container.querySelectorAll('tr')).toHaveLength(5);
  });

  it('renders decorative (aria-hidden) shimmer placeholders, one per cell', () => {
    const { container } = renderInTable(<SkeletonRows rows={2} cols={3} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });
});
