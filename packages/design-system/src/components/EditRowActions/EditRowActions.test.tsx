import { render, screen, fireEvent } from '@testing-library/react';
import { EditRowActions } from './EditRowActions';

const handlers = () => ({
  onEdit: jest.fn(),
  onApply: jest.fn(),
  onCancel: jest.fn(),
  onRemove: jest.fn(),
});

describe('EditRowActions', () => {
  describe('read-only mode', () => {
    it('shows Edit and Delete, not Save/Cancel', () => {
      render(<EditRowActions isEditing={false} {...handlers()} />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /remove/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /save changes/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /cancel editing/i }),
      ).not.toBeInTheDocument();
    });

    it('fires onEdit and onRemove on click', () => {
      const h = handlers();
      render(<EditRowActions isEditing={false} {...h} />);

      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(h.onEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /remove/i }));
      expect(h.onRemove).toHaveBeenCalledTimes(1);
    });

    it('renders Edit and Delete as labeled inline buttons', () => {
      render(<EditRowActions isEditing={false} {...handlers()} />);

      expect(screen.getByRole('button', { name: /edit/i })).toHaveTextContent(
        'Edit',
      );
      expect(screen.getByRole('button', { name: /remove/i })).toHaveTextContent(
        'Delete',
      );
    });

    it('disables Edit when editDisabled and Delete when deleteDisabled', () => {
      render(
        <EditRowActions
          isEditing={false}
          editDisabled
          deleteDisabled
          {...handlers()}
        />,
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
    });
  });

  describe('edit mode', () => {
    it('shows Save, Cancel and Delete, not Edit', () => {
      render(<EditRowActions isEditing {...handlers()} />);

      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel editing/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /remove/i }),
      ).toBeInTheDocument();
      // The only labels containing "edit" in edit mode are "Cancel editing";
      // there is no bare "Edit"/"Edit <item>" button.
      expect(
        screen.queryByRole('button', { name: /^edit/i }),
      ).not.toBeInTheDocument();
    });

    it('fires onApply, onCancel and onRemove on click', () => {
      const h = handlers();
      render(<EditRowActions isEditing {...h} />);

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      expect(h.onApply).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /cancel editing/i }));
      expect(h.onCancel).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /remove/i }));
      expect(h.onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables only Save when applyDisabled', () => {
      render(<EditRowActions isEditing applyDisabled {...handlers()} />);

      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /cancel editing/i }),
      ).not.toBeDisabled();
    });

    it('hides Cancel when hideCancel is set', () => {
      render(<EditRowActions isEditing hideCancel {...handlers()} />);

      expect(
        screen.queryByRole('button', { name: /cancel editing/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
    });
  });

  it('disables all actions when disabled', () => {
    render(<EditRowActions isEditing disabled {...handlers()} />);

    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /cancel editing/i }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
  });

  it('builds accessible labels from itemLabel', () => {
    render(
      <EditRowActions isEditing={false} itemLabel="endpoint" {...handlers()} />,
    );

    expect(
      screen.getByRole('button', { name: 'Edit endpoint' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove endpoint' }),
    ).toBeInTheDocument();
  });

  it('hides Delete when hideDelete is set', () => {
    render(<EditRowActions isEditing={false} hideDelete {...handlers()} />);

    expect(
      screen.queryByRole('button', { name: /remove/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders a custom edit label and its accessible name', () => {
    render(
      <EditRowActions
        isEditing={false}
        itemLabel="environment variable"
        editLabel="Override"
        {...handlers()}
      />,
    );

    const btn = screen.getByRole('button', {
      name: 'Override environment variable',
    });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Override');
    expect(
      screen.queryByRole('button', { name: /^edit/i }),
    ).not.toBeInTheDocument();
  });
});
