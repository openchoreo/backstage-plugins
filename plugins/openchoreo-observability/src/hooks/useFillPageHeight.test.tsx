import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { useFillPageHeight } from './useFillPageHeight';

const Probe = ({ withPage = true }: { withPage?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const height = useFillPageHeight(ref, { minHeight: 320, fallback: 'fb' });
  const table = (
    <article data-testid="content">
      <div data-testid="above" />
      <div data-testid="table" ref={ref} />
      <div data-testid="below" />
    </article>
  );
  return (
    <>
      <span data-testid="height">{String(height)}</span>
      {withPage ? (
        <main data-testid="page" data-backstage-core-page="">
          {table}
        </main>
      ) : (
        table
      )}
    </>
  );
};

function layout(pageHeight: number, tableTop: number, belowHeight: number) {
  const rect = (top: number) => ({ top } as DOMRect);
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function rectOf(this: HTMLElement) {
      return rect(this.dataset.testid === 'table' ? tableTop : 0);
    });
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockImplementation(function clientHeightOf(this: HTMLElement) {
      return this.dataset.testid === 'page' ? pageHeight : 0;
    });
  jest
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(function offsetHeightOf(this: HTMLElement) {
      return this.dataset.testid === 'below' ? belowHeight : 0;
    });
}

describe('useFillPageHeight', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fills the page from the element down, leaving room for what follows', () => {
    layout(900, 250, 30);

    render(<Probe />);

    expect(screen.getByTestId('height')).toHaveTextContent('620');
  });

  it('follows the window when it is resized', () => {
    layout(900, 250, 0);
    render(<Probe />);

    layout(700, 250, 0);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('height')).toHaveTextContent('450');
  });

  it('grows back when a block above goes away, without a window resize', async () => {
    layout(900, 370, 0);
    render(<Probe />);
    expect(screen.getByTestId('height')).toHaveTextContent('530');

    // A notice above the table unmounts: the content area keeps its size, so
    // only the block watch can notice.
    layout(900, 250, 0);
    await act(async () => {
      screen.getByTestId('above').remove();
    });

    expect(screen.getByTestId('height')).toHaveTextContent('650');
  });

  it('stops shrinking at the minimum on a short screen', () => {
    layout(500, 250, 0);

    render(<Probe />);

    expect(screen.getByTestId('height')).toHaveTextContent('320');
  });

  it('keeps the fallback outside a Backstage page', () => {
    layout(900, 250, 0);

    render(<Probe withPage={false} />);

    expect(screen.getByTestId('height')).toHaveTextContent('fb');
  });
});
