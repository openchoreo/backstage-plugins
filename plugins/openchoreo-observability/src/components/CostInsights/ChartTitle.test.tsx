import { render, screen, fireEvent } from '@testing-library/react';
import { ChartTitle } from './ChartTitle';

describe('ChartTitle', () => {
  it('renders the title and reveals the info on hover', async () => {
    const { container } = render(
      <ChartTitle title="Cost over time" info="what this shows" />,
    );
    expect(screen.getByText('Cost over time')).toBeInTheDocument();
    const icon = container.querySelector('svg')!;
    fireEvent.mouseOver(icon);
    expect(await screen.findByText('what this shows')).toBeInTheDocument();
  });
});
