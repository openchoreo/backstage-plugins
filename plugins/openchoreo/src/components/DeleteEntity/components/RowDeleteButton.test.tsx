import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import type { Entity } from '@backstage/catalog-model';
import { RowDeleteButton } from './RowDeleteButton';

function makeEntity(
  kind: string,
  name: string,
  options?: { markedForDeletion?: boolean },
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: {
      name,
      namespace: 'default',
      annotations: options?.markedForDeletion
        ? { [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: '2026-01-01T00:00:00Z' }
        : {},
    },
    spec: {},
  };
}

describe('RowDeleteButton', () => {
  it.each([
    ['Component', 'my-service'],
    ['System', 'my-project'],
    ['Domain', 'my-namespace'],
    ['Resource', 'my-db'],
    ['Environment', 'dev'],
    ['ClusterComponentType', 'service'],
  ])('renders a delete button for %s entities', (kind, name) => {
    render(
      <RowDeleteButton entity={makeEntity(kind, name)} onDelete={jest.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: new RegExp(`delete ${name}`, 'i') }),
    ).toBeInTheDocument();
  });

  it.each([['API'], ['User'], ['Group'], ['Template'], ['Location']])(
    'renders nothing for non-deletable kind %s',
    kind => {
      const { container } = render(
        <RowDeleteButton entity={makeEntity(kind, 'x')} onDelete={jest.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it('renders nothing for an entity already marked for deletion', () => {
    const { container } = render(
      <RowDeleteButton
        entity={makeEntity('Component', 'svc', { markedForDeletion: true })}
        onDelete={jest.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onDelete with the entity and stops click propagation', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    const onRowClick = jest.fn();
    const entity = makeEntity('Component', 'svc');

    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onRowClick}>
        <RowDeleteButton entity={entity} onDelete={onDelete} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /delete svc/i }));

    expect(onDelete).toHaveBeenCalledWith(entity);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
