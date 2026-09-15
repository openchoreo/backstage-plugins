import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditQueryBar, parseDraft, resolveFilterPath } from './AuditQueryBar';

const mockUseAuditFilterValues = jest.fn();

jest.mock('../../hooks/useAuditFilterValues', () => ({
  useAuditFilterValues: (...args: any[]) => mockUseAuditFilterValues(...args),
  AUDIT_MAX_PICKER_VALUES: 100,
}));

const auditWindow = {
  startTime: '2026-09-01T00:00:00.000Z',
  endTime: '2026-09-08T00:00:00.000Z',
  clamped: false,
};

const noValues = {
  values: [],
  resolvedFilter: undefined,
  totalValues: 0,
  loading: false,
  error: null,
  unsupported: false,
};

describe('resolveFilterPath', () => {
  it('accepts a full filter path', () => {
    expect(resolveFilterPath('actor.id')).toBe('actor.id');
  });

  it('accepts an unambiguous last segment', () => {
    expect(resolveFilterPath('project')).toBe('resource.project');
    expect(resolveFilterPath('resource')).toBe('resource.resource');
    expect(resolveFilterPath('session_id')).toBe('actor.session_id');
  });

  it('refuses an ambiguous segment rather than guessing a field', () => {
    // Both actor and resource have a `type`, and filtering the wrong one
    // silently returns the wrong records.
    expect(resolveFilterPath('type')).toBeNull();
  });

  it('refuses a field the API has no filter for', () => {
    expect(resolveFilterPath('uid')).toBeNull();
    expect(resolveFilterPath('schema_version')).toBeNull();
  });
});

describe('parseDraft', () => {
  it('splits a field from the text typed against it', () => {
    expect(parseDraft('actor.id:ali')).toEqual({
      path: 'actor.id',
      query: 'ali',
    });
  });

  it('keeps a value containing colons whole', () => {
    expect(parseDraft('actor.issuer:https://idp/token')).toEqual({
      path: 'actor.issuer',
      query: 'https://idp/token',
    });
  });

  it('treats an unknown prefix as free text', () => {
    expect(parseDraft('nonsense:value')).toEqual({
      path: null,
      query: 'nonsense:value',
    });
  });
});

describe('AuditQueryBar', () => {
  const defaults = {
    tokens: [],
    window: auditWindow,
    onToggleToken: jest.fn(),
    onRemoveToken: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuditFilterValues.mockReturnValue(noValues);
  });

  it('asks for nothing until a picker is open', () => {
    render(<AuditQueryBar {...defaults} />);

    expect(mockUseAuditFilterValues).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('offers the filter vocabulary when focused', async () => {
    render(<AuditQueryBar {...defaults} />);

    await userEvent.click(screen.getByLabelText('Filter audit records'));

    expect(screen.getByText('actor.id')).toBeInTheDocument();
    expect(screen.getByText('resource.namespace')).toBeInTheDocument();
    // Not a filter the API accepts, so not on offer.
    expect(screen.queryByText('resource.uid')).not.toBeInTheDocument();
  });

  it('requests the values of the field being typed', async () => {
    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'result:',
    );

    await waitFor(() =>
      expect(mockUseAuditFilterValues).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: 'result', enabled: true }),
      ),
    );
  });

  it('adds the picked value as a filter', async () => {
    const onToggleToken = jest.fn();
    mockUseAuditFilterValues.mockReturnValue({
      ...noValues,
      values: [{ value: 'denied', count: 9 }],
      resolvedFilter: 'result',
      totalValues: 1,
    });

    render(<AuditQueryBar {...defaults} onToggleToken={onToggleToken} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'result:',
    );
    await userEvent.click(screen.getByText('denied'));

    expect(onToggleToken).toHaveBeenCalledWith('result', 'denied');
  });

  it('leaves out a closed filter value the request body cannot carry', async () => {
    mockUseAuditFilterValues.mockReturnValue({
      ...noValues,
      // The trail holds a surface this client's schema predates.
      values: [
        { value: 'rest', count: 40 },
        { value: 'grpc', count: 2 },
      ],
      resolvedFilter: 'surface',
      totalValues: 2,
    });

    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'surface:',
    );

    expect(screen.getByText('rest')).toBeInTheDocument();
    expect(screen.queryByText('grpc')).not.toBeInTheDocument();
  });

  it('refuses a typed value a closed filter has no room for', async () => {
    const onToggleToken = jest.fn();
    render(<AuditQueryBar {...defaults} onToggleToken={onToggleToken} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'surface:grpc',
    );

    expect(screen.queryByText('grpc')).not.toBeInTheDocument();
    expect(screen.getByText(/does not take "grpc"/)).toBeInTheDocument();
  });

  it('offers a typed value the list does not carry', async () => {
    const onToggleToken = jest.fn();
    render(<AuditQueryBar {...defaults} onToggleToken={onToggleToken} />);

    // request_id has no pick list — it is filtered by an exact value in hand.
    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'request_id:abc-123',
    );
    await userEvent.click(screen.getByText('abc-123'));

    expect(onToggleToken).toHaveBeenCalledWith('request_id', 'abc-123');
  });

  it('says an exact-value field has no list rather than showing an empty one', async () => {
    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'event_id:',
    );

    expect(
      screen.getByText(/no list to pick from/, { exact: false }),
    ).toBeInTheDocument();
    expect(mockUseAuditFilterValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('falls back to free-text entry when the adapter cannot aggregate', async () => {
    mockUseAuditFilterValues.mockReturnValue({
      ...noValues,
      unsupported: true,
    });

    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'actor.id:',
    );

    expect(
      screen.getByText(/cannot list values for actor.id/),
    ).toBeInTheDocument();
  });

  it('sends text with no field as a free-text match', async () => {
    const onToggleToken = jest.fn();
    render(<AuditQueryBar {...defaults} onToggleToken={onToggleToken} />);

    await userEvent.type(screen.getByLabelText('Filter audit records'), 'occ');
    await userEvent.click(screen.getByText(/Match “occ” anywhere/));

    expect(onToggleToken).toHaveBeenCalledWith(null, 'occ');
  });

  it('renders a chip per selection and removes the one deleted', async () => {
    const onRemoveToken = jest.fn();
    const { container } = render(
      <AuditQueryBar
        {...defaults}
        tokens={[{ path: 'result', value: 'denied' }]}
        onRemoveToken={onRemoveToken}
      />,
    );

    expect(screen.getByText('denied')).toBeInTheDocument();
    const deleteIcon = container.querySelector('.MuiChip-deleteIcon');
    expect(deleteIcon).not.toBeNull();
    await userEvent.click(deleteIcon as Element);

    expect(onRemoveToken).toHaveBeenCalledWith('result', 'denied');
  });

  it('says how many values were withheld so a picker does not end silently', async () => {
    mockUseAuditFilterValues.mockReturnValue({
      ...noValues,
      values: [{ value: 'alice@example.com', count: 3 }],
      resolvedFilter: 'actor.id',
      totalValues: 413,
    });

    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'actor.id:',
    );

    expect(screen.getByText(/Showing 1 of 413 values/)).toBeInTheDocument();
  });

  it('never shows another filter’s values while this one is still loading', async () => {
    // The outcome tiles keep `result` warm in the shared cache, and
    // keepPreviousData holds the last list across a switch — so the hook can
    // hand back `result` values while actor.id is in flight.
    mockUseAuditFilterValues.mockReturnValue({
      ...noValues,
      values: [
        { value: 'denied', count: 9 },
        { value: 'success', count: 40 },
      ],
      resolvedFilter: 'result',
      totalValues: 2,
      loading: true,
    });

    render(<AuditQueryBar {...defaults} />);

    await userEvent.type(
      screen.getByLabelText('Filter audit records'),
      'actor.id:',
    );

    expect(screen.queryByText('denied')).not.toBeInTheDocument();
    expect(screen.queryByText('success')).not.toBeInTheDocument();
    expect(screen.getByText('Looking up values…')).toBeInTheDocument();
  });

  it('leaves the rest of the page clickable while the list is open', async () => {
    const onElsewhere = jest.fn();
    render(
      <div>
        <button type="button" onClick={onElsewhere}>
          elsewhere
        </button>
        <AuditQueryBar {...defaults} />
      </div>,
    );

    await userEvent.click(screen.getByLabelText('Filter audit records'));
    expect(screen.getByText('actor.id')).toBeInTheDocument();

    await userEvent.click(screen.getByText('elsewhere'));

    // The defect this covers: a Popover is a Modal, and its backdrop swallowed
    // the click, so nothing else on the page could be operated until the list
    // was dismissed. The button must actually receive it.
    expect(onElsewhere).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText('actor.id')).not.toBeInTheDocument(),
    );
  });

  it('leaves the caret in the field after picking a filter name', async () => {
    render(<AuditQueryBar {...defaults} />);

    const input = screen.getByLabelText('Filter audit records');
    await userEvent.click(input);
    await userEvent.click(screen.getByText('resource.namespace'));

    // The value half is still to be typed, so focus must come back.
    expect(input).toHaveFocus();
    expect(input).toHaveValue('resource.namespace:');
  });
});
