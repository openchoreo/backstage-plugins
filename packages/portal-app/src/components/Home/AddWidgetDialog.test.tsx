import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { AddWidgetDialog } from './AddWidgetDialog';
import type { Widget } from './types';

const makeWidget = (
  name: string,
  title: string,
  description: string,
): Widget => ({
  name,
  title,
  description,
  // The real widget. The dialog must never render it.
  component: <div data-testid={`real-${name}`}>{title} (real widget)</div>,
});

const widgets: Widget[] = [
  makeWidget('Projects', 'My Projects', 'Project and component counts'),
  makeWidget('Deployments', 'Recent Deployments', 'Latest releases'),
  makeWidget('Visited', 'Recently Visited', 'Pages you visited recently'),
];

const ProjectsPreview = () => <div data-testid="sample-Projects">sample</div>;
const DeploymentsPreview = () => (
  <div data-testid="sample-Deployments">sample</div>
);

// Visited has no preview on purpose, to cover the fallback.
const previews = {
  Projects: ProjectsPreview,
  Deployments: DeploymentsPreview,
};

const renderDialog = (items: Widget[] = widgets, handleAdd = jest.fn()) =>
  renderInTestApp(
    <AddWidgetDialog
      widgets={items}
      handleAdd={handleAdd}
      previews={previews}
    />,
  );

describe('AddWidgetDialog', () => {
  it('shows every available widget with its title and description', async () => {
    await renderDialog();

    expect(
      screen.getByRole('button', { name: /My Projects/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Recent Deployments/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Latest releases')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(widgets.length);
  });

  it('filters widgets by title as the user types', async () => {
    await renderDialog();

    await userEvent.type(screen.getByPlaceholderText('Search widgets'), 'proj');

    expect(
      screen.getByRole('button', { name: /My Projects/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Recent Deployments/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Recently Visited/ }),
    ).not.toBeInTheDocument();
  });

  it('also matches on description, ignoring case', async () => {
    await renderDialog();

    await userEvent.type(
      screen.getByPlaceholderText('Search widgets'),
      'LATEST',
    );

    expect(
      screen.getByRole('button', { name: /Recent Deployments/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /My Projects/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a message when nothing matches the search', async () => {
    await renderDialog();

    await userEvent.type(
      screen.getByPlaceholderText('Search widgets'),
      'xyz123',
    );

    expect(
      screen.getByText('No widgets match your search.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /My Projects/ }),
    ).not.toBeInTheDocument();
  });

  it('calls handleAdd with the widget when its card is clicked', async () => {
    const handleAdd = jest.fn();
    await renderDialog(widgets, handleAdd);

    await userEvent.click(
      screen.getByRole('button', { name: /Recent Deployments/ }),
    );

    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith(widgets[1]);
  });

  it('shows the empty message and no search box when no widgets are left', async () => {
    await renderDialog([]);

    expect(
      screen.getByText(
        'All available widgets have been added to the dashboard.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Search widgets'),
    ).not.toBeInTheDocument();
  });

  it('shows the sample preview and never renders the real widget', async () => {
    await renderDialog();

    expect(screen.getByTestId('sample-Projects')).toBeInTheDocument();
    expect(screen.getByTestId('sample-Deployments')).toBeInTheDocument();
    expect(screen.queryByTestId('real-Projects')).not.toBeInTheDocument();
    expect(screen.queryByTestId('real-Deployments')).not.toBeInTheDocument();
    expect(screen.queryByTestId('real-Visited')).not.toBeInTheDocument();
  });

  it('shows "No Preview Available" for a widget without a preview', async () => {
    await renderDialog();

    expect(screen.getAllByText('No Preview Available')).toHaveLength(1);
  });

  it('hides the previews from assistive tech and the tab order', async () => {
    await renderDialog();

    const hidden = screen
      .getByTestId('sample-Projects')
      .closest('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    expect(hidden).toHaveAttribute('inert');
  });
});
