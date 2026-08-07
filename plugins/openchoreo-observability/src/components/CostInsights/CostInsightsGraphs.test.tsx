import { render, screen, fireEvent } from '@testing-library/react';
import { CostInsightsGraphs } from './CostInsightsGraphs';
import type { CostInsightsData } from './types';

// The individual charts are covered by their own suites; stub them so this
// suite focuses on the container's layout and the granularity control.
jest.mock('./ForecastDivergenceChart', () => ({
  ForecastDivergenceChart: () => <div data-testid="forecast" />,
}));
jest.mock('./CostEfficiencyScatter', () => ({
  CostEfficiencyScatter: () => <div data-testid="scatter" />,
}));
jest.mock('./CostLineChart', () => ({
  CostLineChart: () => <div data-testid="line" />,
}));
jest.mock('./CostInsightsGraph', () => ({
  CostInsightsGraph: ({ recommendationOverlay }: any) => (
    <div
      data-testid="bar"
      data-overlay={recommendationOverlay ? 'yes' : 'no'}
    />
  ),
}));

const data = (over: Partial<CostInsightsData> = {}): CostInsightsData => ({
  level: 'namespace',
  summary: {
    totalCost: 100,
    deltaPct: null,
    forecastThisMonth: 200,
    efficiency: 0.5,
    totalSaving: 0,
  },
  rows: [],
  series: [{ timestamp: '2026-07-01T00:00:00.000Z', gcp: 10 }],
  seriesKeys: ['gcp'],
  forecast: null,
  ...over,
});

describe('CostInsightsGraphs', () => {
  it('renders all four charts and the granularity selector', () => {
    render(
      <CostInsightsGraphs
        data={data()}
        granularity="1d"
        onGranularityChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('forecast')).toBeInTheDocument();
    expect(screen.getByTestId('scatter')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByLabelText('Time Granularity')).toBeInTheDocument();
  });

  it('emits granularity changes', () => {
    const onGranularityChange = jest.fn();
    render(
      <CostInsightsGraphs
        data={data()}
        granularity="1d"
        onGranularityChange={onGranularityChange}
      />,
    );
    fireEvent.mouseDown(screen.getByLabelText('Time Granularity'));
    const option = screen.getAllByRole('option')[0];
    fireEvent.click(option);
    expect(onGranularityChange).toHaveBeenCalled();
  });

  it('passes a recommendation overlay only at the component level with saving', () => {
    const { rerender } = render(
      <CostInsightsGraphs
        data={data()}
        granularity="1d"
        onGranularityChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('bar').getAttribute('data-overlay')).toBe('no');

    rerender(
      <CostInsightsGraphs
        data={data({
          level: 'component',
          summary: {
            totalCost: 100,
            deltaPct: null,
            forecastThisMonth: 200,
            efficiency: 0.5,
            totalSaving: 40,
          },
        })}
        granularity="1d"
        onGranularityChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('bar').getAttribute('data-overlay')).toBe('yes');
  });
});
