import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RowActionsCell } from './RowActionsCell';
import { type ProjectContentItem } from '../hooks';

function makeItem(
  kind: 'component' | 'resource',
  name: string,
  options?: { markedForDeletion?: boolean },
): ProjectContentItem {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: kind === 'component' ? 'Component' : 'Resource',
      metadata: {
        name,
        namespace: 'default',
        annotations: options?.markedForDeletion
          ? { [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: '2026-01-01T00:00:00Z' }
          : {},
      },
      spec: {},
    },
    kind,
    name,
    displayName: name,
    type: 'deployment/service',
    description: '',
    deploymentStatus: {},
    deploymentLoaded: true,
  };
}

describe('RowActionsCell', () => {
  it('renders a delete button for a component row', () => {
    render(
      <RowActionsCell
        item={makeItem('component', 'svc')}
        onDelete={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /delete svc/i }),
    ).toBeInTheDocument();
  });

  it('renders a delete button for a resource row', () => {
    render(
      <RowActionsCell item={makeItem('resource', 'db')} onDelete={jest.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /delete db/i }),
    ).toBeInTheDocument();
  });

  it('calls onDelete with the item when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const item = makeItem('component', 'svc');

    render(<RowActionsCell item={item} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete svc/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(item));
  });

  it('renders nothing for a row already marked for deletion', () => {
    const { container } = render(
      <RowActionsCell
        item={makeItem('component', 'svc', { markedForDeletion: true })}
        onDelete={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
