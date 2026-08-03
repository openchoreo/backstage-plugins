import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaterfallView } from './WaterfallView';
import { Span, SpanDetails } from '../../types';

// ---- Helpers ----

const errorSpan: Span = {
  spanId: 'span-1',
  spanName: 'root-span',
  spanKind: 'SERVER',
  startTime: '2024-06-01T10:00:00.000000000Z',
  endTime: '2024-06-01T10:00:01.500000000Z',
  durationNs: 1500000000,
  status: { code: 'error', message: 'boom' },
};

const okSpan: Span = {
  ...errorSpan,
  status: { code: 'ok' },
};

const detailsFor = (span: Span): SpanDetails => ({
  ...span,
  attributes: { 'http.method': 'GET' },
  resourceAttributes: { 'service.name': 'svc' },
});

function renderWaterfall(
  spans: Span[],
  getDetails: () => SpanDetails | undefined = () => undefined,
) {
  const spanDetails = {
    fetchSpanDetails: jest.fn(),
    getDetails: jest.fn(getDetails),
    isLoading: jest.fn().mockReturnValue(false),
    getError: jest.fn().mockReturnValue(undefined),
  };
  render(
    <WaterfallView traceId="trace-1" spans={spans} spanDetails={spanDetails} />,
  );
  return spanDetails;
}

// ---- Tests ----

describe('WaterfallView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('colors error spans red', () => {
    renderWaterfall([errorSpan]);
    expect(screen.getByText('1.500s')).toHaveStyle('background-color: #FCA5A5');
  });

  it('does not apply the error color to ok spans', () => {
    renderWaterfall([okSpan]);
    expect(screen.getByText('1.500s')).not.toHaveStyle(
      'background-color: #FCA5A5',
    );
  });

  it('renders the object status as a Status Code in the tooltip without crashing', async () => {
    const user = userEvent.setup();
    renderWaterfall([errorSpan]);

    await user.hover(screen.getByText('1.500s'));

    expect(await screen.findByText('Status Code:')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    // The old string-status label is gone.
    expect(screen.queryByText('Status:')).not.toBeInTheDocument();
  });

  it('shows a dedicated Status section in the span details panel', async () => {
    const user = userEvent.setup();
    const spanDetails = renderWaterfall([errorSpan], () =>
      detailsFor(errorSpan),
    );

    await user.click(screen.getByText('1.500s'));

    expect(spanDetails.fetchSpanDetails).toHaveBeenCalledWith(
      'trace-1',
      'span-1',
    );
    // Status section renders the flattened OTel status fields. (The status code
    // also appears in the hover tooltip that the click opens, hence getAllByText.)
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getAllByText('error').length).toBeGreaterThan(0);
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
