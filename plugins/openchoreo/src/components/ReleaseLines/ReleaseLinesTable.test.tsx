import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import type { Entity } from '@backstage/catalog-model';
import type { ReleaseLineSummary } from '@openchoreo/backstage-plugin-common';
import { ReleaseLinesTable } from './ReleaseLinesTable';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@backstage/plugin-permission-react', () => ({
  ...jest.requireActual('@backstage/plugin-permission-react'),
  usePermission: () => ({ allowed: true, loading: false }),
}));

jest.mock('@backstage/core-components', () => ({
  ...jest.requireActual('@backstage/core-components'),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

const defaultLines: ReleaseLineSummary[] = [
  { name: 'default', isDefault: true, environments: [] },
  {
    name: 'next',
    description: 'Builds the next branch',
    latestRelease: 'hello-next-fc84488f9',
    environments: [
      {
        environment: 'development',
        releaseBinding: 'hello-next-development',
        ready: true,
      },
    ],
    parameterOverrides: ['logLevel'],
    traitOverrides: ['health'],
    workflowOverride: true,
  },
];

const component: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'hello',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'default',
      'openchoreo.io/project': 'default',
      'openchoreo.io/component': 'hello',
    },
  },
  spec: { type: 'service' },
};

const mockOnDelete = jest.fn();

async function renderTable(releaseLines: ReleaseLineSummary[] = defaultLines) {
  await renderInTestApp(
    <ReleaseLinesTable
      component={component}
      releaseLines={releaseLines}
      onDelete={mockOnDelete}
    />,
  );
}

function rowOf(name: string) {
  return screen.getByRole('link', { name }).closest('tr') as HTMLElement;
}

describe('ReleaseLinesTable', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockOnDelete.mockClear();
  });

  it('lists each line with its description and deployments', async () => {
    await renderTable();

    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(
      ['Name', 'Description', 'Deployment', ''],
    );

    const mainRow = rowOf('default');
    expect(
      within(mainRow).getByRole('link', { name: 'default' }),
    ).toHaveAttribute('href', '/catalog/default/component/hello/environments');
    expect(
      within(mainRow).getByText("The component's own workload and bindings"),
    ).toBeInTheDocument();
    // Not deployed, and the default line can't be deleted.
    expect(within(mainRow).getAllByText('—')).toHaveLength(1);
    expect(within(mainRow).queryByRole('button')).toBeNull();

    const nextRow = rowOf('next');
    expect(
      within(nextRow).getByText('Builds the next branch'),
    ).toBeInTheDocument();
    expect(within(nextRow).getByText('development')).toBeInTheDocument();
    expect(
      within(nextRow).queryByText('hello-next-fc84488f9'),
    ).not.toBeInTheDocument();
    expect(within(nextRow).queryByText('parameter: logLevel')).toBeNull();
  });

  it('opens the line when its row is clicked anywhere', async () => {
    await renderTable();

    fireEvent.click(within(rowOf('next')).getByText('Builds the next branch'));

    // material-table delays single clicks to tell them from double clicks.
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/catalog/default/releaseline/next',
      ),
    );
  });

  it("opens default's deploy tab on its component when its row is clicked", async () => {
    await renderTable();

    fireEvent.click(
      within(rowOf('default')).getByText(
        "The component's own workload and bindings",
      ),
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/catalog/default/component/hello/environments',
      ),
    );
  });

  it('leaves modified clicks to the browser', async () => {
    await renderTable();

    fireEvent.click(within(rowOf('next')).getByText('Builds the next branch'), {
      metaKey: true,
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('pages through the lines like the project contents table', async () => {
    await renderTable(
      Array.from({ length: 12 }, (_, i) => ({
        name: `line-${String(i).padStart(2, '0')}`,
        environments: [],
      })),
    );

    expect(screen.getByText('1–10 of 12')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'line-10' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('11–12 of 12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'line-10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('deletes a line from its row without opening it', async () => {
    await renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Delete hello:next' }));

    expect(mockOnDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ReleaseLine',
        metadata: expect.objectContaining({
          name: 'next',
          annotations: expect.objectContaining({
            'openchoreo.io/component': 'hello',
            'openchoreo.io/release-line': 'next',
          }),
        }),
      }),
    );
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
