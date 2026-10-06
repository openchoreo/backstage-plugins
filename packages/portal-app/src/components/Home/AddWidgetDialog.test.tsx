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
  component: <div data-testid={`preview-${name}`}>{title} preview</div>,
});

const widgets: Widget[] = [
  makeWidget('Projects', 'My Projects', 'Project and component counts'),
  makeWidget('Deployments', 'Recent Deployments', 'Latest releases'),
  makeWidget('Visited', 'Recently Visited', 'Pages you visited recently'),
];

const renderDialog = (items: Widget[] = widgets, handleAdd = jest.fn()) =>
  renderInTestApp(<AddWidgetDialog widgets={items} handleAdd={handleAdd} />);

describe('AddWidgetDialog', () => {
  it('shows every available widget with its title and description', async () => {
    await renderDialog();

    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText('Recent Deployments')).toBeInTheDocument();
    expect(screen.getByText('Latest releases')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(widgets.length);
  });

  it('filters widgets by title as the user types', async () => {
    await renderDialog();

    await userEvent.type(screen.getByPlaceholderText('Search widgets'), 'proj');

    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.queryByText('Recent Deployments')).not.toBeInTheDocument();
    expect(screen.queryByText('Recently Visited')).not.toBeInTheDocument();
  });

  it('also matches on description, ignoring case', async () => {
    await renderDialog();

    await userEvent.type(
      screen.getByPlaceholderText('Search widgets'),
      'LATEST',
    );

    expect(screen.getByText('Recent Deployments')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
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
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
  });

  it('calls handleAdd with the widget when its card is clicked', async () => {
    const handleAdd = jest.fn();
    await renderDialog(widgets, handleAdd);

    await userEvent.click(screen.getByText('Recent Deployments'));

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

  it('hides live previews from assistive tech and the tab order', async () => {
    await renderDialog();

    const preview = screen.getByTestId('preview-Projects').parentElement;
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    expect(preview).toHaveAttribute('inert');
  });
});
