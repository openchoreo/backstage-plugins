import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef, entityRouteRef } from '@backstage/plugin-catalog-react';
import { PlatformOverviewPage } from './PlatformOverviewPage';

// ---- Captured props from mocked graph view ----

let capturedGraphViewProps: Record<string, any> = {};

jest.mock('@openchoreo/backstage-plugin-react', () => {
  const actual = jest.requireActual('@openchoreo/backstage-plugin-react');
  return {
    ...actual,
    // PlatformOverviewGraphView uses d3-zoom, MutationObserver, SVG — needs real DOM
    PlatformOverviewGraphView: (props: Record<string, any>) => {
      capturedGraphViewProps = props;
      return <div data-testid="graph-view" />;
    },
    // GraphKindFilter renders for real — it's standard MUI, works in jsdom
    useProjects: (namespaces: string[] | undefined) => {
      if (!namespaces || namespaces.length === 0) return [];
      return [
        { name: 'project-a', namespace: 'default' },
        { name: 'project-b', namespace: 'default' },
      ];
    },
  };
});

// ---- Mock catalog API ----

const mockCatalogApi = {
  getEntities: jest.fn(),
  getEntitiesByRefs: jest.fn(),
};

// ---- Helpers ----

async function renderPage() {
  await renderInTestApp(
    <TestApiProvider apis={[[catalogApiRef, mockCatalogApi as any]]}>
      <PlatformOverviewPage />
    </TestApiProvider>,
    {
      mountedRoutes: {
        '/catalog/:namespace/:kind/:name': entityRouteRef,
      },
    },
  );
}

// ---- Tests ----

describe('PlatformOverviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedGraphViewProps = {};

    // Default: return two namespaces from Domain entities
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        { kind: 'Domain', metadata: { name: 'default' } },
        { kind: 'Domain', metadata: { name: 'staging' } },
      ],
    });
  });

  it('renders page header and graph view', async () => {
    await renderPage();

    expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
  });

  it('fetches namespaces from Domain entities on mount', async () => {
    await renderPage();

    expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: 'Domain' },
        fields: ['metadata.name'],
      }),
    );
  });

  it('displays scope and kind filter buttons', async () => {
    await renderPage();

    expect(
      screen.getByRole('button', { name: /Scope:/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    ).toBeInTheDocument();
  });

  it('opens scope popover and shows Cluster and namespaces', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Scope:/i }));

    expect(screen.getByText('Cluster')).toBeInTheDocument();
    expect(screen.getByText('Namespaces')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
  });

  it('defaults kind filter to Developer Resources', async () => {
    await renderPage();

    expect(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    ).toBeInTheDocument();
  });

  it('opens kind filter popover with presets and individual kinds', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    );

    // Presets
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Developer Resources')).toBeInTheDocument();
    expect(screen.getByText('Platform Resources')).toBeInTheDocument();

    // Individual kinds
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('changes kind selection via kind filter', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Click to open kind filter
    await user.click(
      screen.getByRole('button', { name: /Kind: Developer Resources/i }),
    );

    // Select "Platform Resources" preset and close popover
    await user.click(screen.getByText('Platform Resources'));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Kind: Platform Resources/i }),
      ).toBeInTheDocument();
    });

    // Graph view should receive updated kinds
    expect(capturedGraphViewProps.view.kinds).toBeDefined();
  });

  it('shows project filter when system kind selected and projects exist', async () => {
    await renderPage();

    // Default kinds include 'system', mock useProjects returns 2 projects
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });
  });

  it('opens project popover with All and individual projects', async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Project: All/i }));

    expect(screen.getByText('project-a')).toBeInTheDocument();
    expect(screen.getByText('project-b')).toBeInTheDocument();
  });

  it('toggles individual project exclusion', async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Project: All/i }));
    await user.click(screen.getByText('project-b'));
    // Close popover so aria-hidden is removed from background
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: 1 of 2/i }),
      ).toBeInTheDocument();
    });
  });

  it('deselects all projects via All toggle', async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Project: All/i }));
    await user.click(screen.getByText('All'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: 0 of 2/i }),
      ).toBeInTheDocument();
    });
  });

  it('selects all projects via All toggle when some excluded', async () => {
    const user = userEvent.setup();
    await renderPage();

    // First exclude one
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Project: All/i }));
    await user.click(screen.getByText('project-a'));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: 1 of 2/i }),
      ).toBeInTheDocument();
    });

    // Now select all — "All" click closes the popover automatically
    await user.click(screen.getByRole('button', { name: /Project: 1 of 2/i }));
    await user.click(screen.getByText('All'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Project: All/i }),
      ).toBeInTheDocument();
    });
  });

  it('passes effective view to graph view', async () => {
    await renderPage();

    expect(capturedGraphViewProps.view).toBeDefined();
    expect(capturedGraphViewProps.view.kinds).toBeDefined();
    expect(capturedGraphViewProps.view.relations.length).toBeGreaterThan(0);
  });

  it('passes namespaces to graph view', async () => {
    await renderPage();

    expect(capturedGraphViewProps.namespaces).toBeDefined();
  });

  it('handles empty namespace list gracefully', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });

    await renderPage();

    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
  });

  it('handles namespace fetch failure gracefully', async () => {
    mockCatalogApi.getEntities.mockRejectedValue(new Error('fail'));

    await renderPage();

    expect(screen.getByTestId('graph-view')).toBeInTheDocument();
  });

  it('toggles namespace in scope selector', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Scope:/i }));
    await user.click(screen.getByText('staging'));
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Scope:.*2 namespaces/i }),
      ).toBeInTheDocument();
    });
  });
});
