import { render, screen, fireEvent } from '@testing-library/react';
import type { WorkloadEndpoint } from '@openchoreo/backstage-plugin-common';
import { EndpointEditor } from './EndpointEditor';

function renderEditor(
  overrides: Partial<{
    endpointName: string;
    endpoint: WorkloadEndpoint;
    isEditing: boolean;
    editDisabled: boolean;
    deleteDisabled: boolean;
    applyDisabled: boolean;
  }> = {},
) {
  const handlers = {
    onEdit: jest.fn(),
    onApply: jest.fn(),
    onCancel: jest.fn(),
    onRemove: jest.fn(),
    onChange: jest.fn(),
    onNameChange: jest.fn(),
  };
  render(
    <EndpointEditor
      endpointName={overrides.endpointName ?? 'http'}
      endpoint={
        overrides.endpoint ?? {
          type: 'HTTP',
          port: 8080,
          visibility: ['project', 'external'],
        }
      }
      isEditing={overrides.isEditing ?? false}
      editDisabled={overrides.editDisabled}
      deleteDisabled={overrides.deleteDisabled}
      applyDisabled={overrides.applyDisabled}
      {...handlers}
    />,
  );
  return handlers;
}

describe('EndpointEditor', () => {
  describe('read-only mode', () => {
    it('renders the endpoint summary with Edit and Delete', () => {
      renderEditor();

      expect(screen.getByText('http')).toBeInTheDocument();
      expect(screen.getByText(/HTTP/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /edit endpoint/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Remove endpoint')).toBeInTheDocument();
    });

    it('invokes onEdit and onRemove from the footer', () => {
      const { onEdit, onRemove } = renderEditor();

      fireEvent.click(screen.getByRole('button', { name: /edit endpoint/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Remove endpoint'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables Edit and Delete when the row is locked', () => {
      renderEditor({ editDisabled: true, deleteDisabled: true });

      expect(
        screen.getByRole('button', { name: /edit endpoint/i }),
      ).toBeDisabled();
      expect(screen.getByLabelText('Remove endpoint')).toBeDisabled();
    });
  });

  describe('edit mode', () => {
    it('renders the name field and Save / Cancel / Delete footer', () => {
      renderEditor({ isEditing: true });

      expect(screen.getByDisplayValue('http')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel editing/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Remove endpoint')).toBeInTheDocument();
    });

    it('emits onNameChange when the name field changes', () => {
      const { onNameChange } = renderEditor({ isEditing: true });
      fireEvent.change(screen.getByDisplayValue('http'), {
        target: { value: 'https' },
      });
      expect(onNameChange).toHaveBeenCalledWith('https');
    });

    it('fires onApply / onCancel from the footer', () => {
      const { onApply, onCancel } = renderEditor({ isEditing: true });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel editing/i }));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables Save when applyDisabled is set', () => {
      renderEditor({ isEditing: true, applyDisabled: true });
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeDisabled();
    });
  });
});
