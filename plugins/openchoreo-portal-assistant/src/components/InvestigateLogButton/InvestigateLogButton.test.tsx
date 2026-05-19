import { fireEvent, render, screen } from '@testing-library/react';
import {
  InvestigateLogButton,
  type LogRowForInvestigation,
} from './InvestigateLogButton';
import type { ChatScope } from '../../api/PerchAgentApi';
import type { PrefetchableLogRow } from '../../utils/scope';

// Hoisted shared spies — Jest hoists jest.mock above imports, so the
// factories below cannot close over outer variables. We dereference the
// holder at call time instead.
const holder: {
  enabled: boolean;
  entity: { kind: string; metadata: { name: string; namespace?: string } };
  openDrawer: jest.Mock;
  warmup: jest.Mock;
  searchParams: URLSearchParams;
} = {
  enabled: true,
  entity: { kind: 'Component', metadata: { name: 'cart', namespace: 'shop' } },
  openDrawer: jest.fn(),
  warmup: jest.fn().mockResolvedValue(undefined),
  searchParams: new URLSearchParams(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  // PerchAgentApi.ts calls createApiRef at module load — keep a real-ish
  // stub so the import doesn't blow up during test setup.
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  useApi: () => ({ warmup: (...args: unknown[]) => holder.warmup(...args) }),
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: holder.entity }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => holder.enabled,
}));

jest.mock('react-router-dom', () => ({
  useSearchParams: () => [holder.searchParams],
}));

jest.mock('../AssistantContext/AssistantDrawerContext', () => ({
  useAssistantDrawer: () => ({
    openDrawer: (...args: unknown[]) => holder.openDrawer(...args),
  }),
}));

function makeLog(
  overrides: Partial<LogRowForInvestigation> = {},
): LogRowForInvestigation {
  return {
    timestamp: '2026-05-15T10:00:00Z',
    log: 'GET /api/notes status=500',
    level: 'ERROR',
    metadata: { namespaceName: 'shop' },
    ...overrides,
  };
}

beforeEach(() => {
  holder.enabled = true;
  holder.entity = { kind: 'Component', metadata: { name: 'cart' } };
  holder.openDrawer = jest.fn();
  holder.warmup = jest.fn().mockResolvedValue(undefined);
  holder.searchParams = new URLSearchParams();
});

describe('InvestigateLogButton', () => {
  it('renders nothing when the assistant feature is disabled', () => {
    holder.enabled = false;
    const { container } = render(<InvestigateLogButton log={makeLog()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the icon button with an accessible label when enabled', () => {
    render(<InvestigateLogButton log={makeLog()} />);
    expect(
      screen.getByRole('button', {
        name: /investigate this log line with portal assistant/i,
      }),
    ).toBeInTheDocument();
  });

  it('opens the drawer with runtime_debug scope overrides on click', () => {
    holder.searchParams = new URLSearchParams({
      env: 'production',
      timeRange: '30m',
      logLevel: 'ERROR,WARN',
    });
    const log = makeLog({
      timestamp: '2026-05-15T10:00:00Z',
      log: 'boom',
      metadata: { namespaceName: 'shop' },
    });

    render(<InvestigateLogButton log={log} />);
    fireEvent.click(screen.getByRole('button'));

    expect(holder.openDrawer).toHaveBeenCalledTimes(1);
    const call = holder.openDrawer.mock.calls[0][0] as {
      scopeOverrides: Partial<ChatScope>;
      conversationKey: string;
    };
    expect(call.scopeOverrides).toMatchObject({
      caseType: 'runtime_debug',
      runtimeAnchor: 'log',
      namespace: 'shop',
      component: 'cart',
      environment: 'production',
      logLevels: ['ERROR', 'WARN'],
      pinnedLogTimestamp: '2026-05-15T10:00:00Z',
      pinnedLogMessage: 'boom',
    });
    expect(call.scopeOverrides.pinnedLogTraceId).toBeUndefined();
    expect(call.conversationKey).toContain('runtime_debug:log:shop');
    expect(call.conversationKey).toContain(':t:2026-05-15T10:00:00Z');
  });

  it('extracts a W3C traceparent trace id and pins it', () => {
    const log = makeLog({
      log: 'request traceparent=00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01 failed',
    });

    render(<InvestigateLogButton log={log} />);
    fireEvent.click(screen.getByRole('button'));

    const call = holder.openDrawer.mock.calls[0][0] as {
      scopeOverrides: Partial<ChatScope>;
      conversationKey: string;
    };
    expect(call.scopeOverrides.pinnedLogTraceId).toBe(
      '0af7651916cd43dd8448eb211c80319c',
    );
    expect(call.conversationKey).toContain(
      ':tr:0af7651916cd43dd8448eb211c80319c',
    );
  });

  it('extracts an ad-hoc trace_id=<hex> token and pins it', () => {
    const log = makeLog({ log: 'trace_id=abc123def4567890 boom' });
    render(<InvestigateLogButton log={log} />);
    fireEvent.click(screen.getByRole('button'));
    expect(
      (holder.openDrawer.mock.calls[0][0] as any).scopeOverrides
        .pinnedLogTraceId,
    ).toBe('abc123def4567890');
  });

  it('defaults logLevels to all four when no URL param is set', () => {
    render(<InvestigateLogButton log={makeLog()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(
      (holder.openDrawer.mock.calls[0][0] as any).scopeOverrides.logLevels,
    ).toEqual(['ERROR', 'WARN', 'INFO', 'DEBUG']);
  });

  it('falls back to the entity name as project when the entity is not a Component', () => {
    holder.entity = { kind: 'System', metadata: { name: 'checkout' } };
    const log = makeLog({ metadata: { namespaceName: 'shop' } });

    render(<InvestigateLogButton log={log} />);
    fireEvent.click(screen.getByRole('button'));

    const scope = (holder.openDrawer.mock.calls[0][0] as any).scopeOverrides;
    expect(scope.project).toBe('checkout');
    expect(scope.component).toBeUndefined();
  });

  it('forwards getLogsSnapshot() result as prefetchedLogs, called at click time', () => {
    const snapshot: PrefetchableLogRow[] = [
      {
        timestamp: '2026-05-15T10:00:00Z',
        log: 'boom',
        level: 'ERROR',
        metadata: { componentName: 'cart' },
      },
    ];
    const getSnapshot = jest.fn(() => snapshot);

    render(
      <InvestigateLogButton log={makeLog()} getLogsSnapshot={getSnapshot} />,
    );
    expect(getSnapshot).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button'));
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    const scope = (holder.openDrawer.mock.calls[0][0] as any).scopeOverrides;
    expect(Array.isArray(scope.prefetchedLogs)).toBe(true);
    expect(scope.prefetchedLogs.length).toBeGreaterThan(0);
  });

  it('warms the MCP cache on hover and throttles repeat warmups', () => {
    render(<InvestigateLogButton log={makeLog()} />);
    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);
    fireEvent.mouseEnter(button);
    fireEvent.focus(button);

    // All three events happen within the 30s throttle, so warmup fires once.
    expect(holder.warmup).toHaveBeenCalledTimes(1);
  });

  it('stops click propagation so the parent row does not toggle', () => {
    const onRowClick = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onRowClick}>
        <InvestigateLogButton log={makeLog()} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(holder.openDrawer).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
