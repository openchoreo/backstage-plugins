import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsCell } from './RowActionsCell';
import { type ProjectContentItem } from '../hooks';

// isMarkedForDeletion is annotation-driven; mock it so each test controls it.
const mockIsMarkedForDeletion = jest.fn();
jest.mock('../../DeleteEntity', () => ({
  isMarkedForDeletion: (...args: any[]) => mockIsMarkedForDeletion(...args),
}));

function makeItem(
  kind: 'component' | 'resource',
  name: string,
): ProjectContentItem {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: kind === 'component' ? 'Component' : 'Resource',
      metadata: { name, namespace: 'default' },
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMarkedForDeletion.mockReturnValue(false);
  });

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

  it('calls onDelete with the item when the delete button is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const item = makeItem('component', 'svc');

    render(<RowActionsCell item={item} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /delete svc/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(item));
  });

  it('renders nothing for a resource row', () => {
    const { container } = render(
      <RowActionsCell item={makeItem('resource', 'db')} onDelete={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a component already marked for deletion', () => {
    mockIsMarkedForDeletion.mockReturnValue(true);
    const { container } = render(
      <RowActionsCell
        item={makeItem('component', 'svc')}
        onDelete={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
