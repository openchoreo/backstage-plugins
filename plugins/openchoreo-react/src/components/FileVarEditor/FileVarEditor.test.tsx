import { render, screen, fireEvent } from '@testing-library/react';
import type { FileVar } from '@openchoreo/backstage-plugin-common';
import { FileVarEditor } from './FileVarEditor';

function renderEditor(
  overrides: Partial<{
    fileVar: FileVar;
    mode: 'plain' | 'secret';
    isEditing: boolean;
    editButtonLabel: string;
    hideDelete: boolean;
    applyDisabled: boolean;
  }> = {},
) {
  const handlers = {
    onEdit: jest.fn(),
    onApply: jest.fn(),
    onCancel: jest.fn(),
    onRemove: jest.fn(),
    onChange: jest.fn(),
    onModeChange: jest.fn(),
  };
  render(
    <FileVarEditor
      fileVar={
        overrides.fileVar ?? { key: 'config.yaml', mountPath: '/etc/app' }
      }
      id="fv-1"
      secrets={[]}
      mode={overrides.mode ?? 'plain'}
      isEditing={overrides.isEditing ?? false}
      editButtonLabel={overrides.editButtonLabel}
      hideDelete={overrides.hideDelete}
      applyDisabled={overrides.applyDisabled}
      {...handlers}
    />,
  );
  return handlers;
}

describe('FileVarEditor', () => {
  describe('read-only mode', () => {
    it('renders filename → mount path with Edit and Delete', () => {
      renderEditor({
        fileVar: { key: 'config.yaml', mountPath: '/etc/app' },
      });

      expect(screen.getByText('config.yaml')).toBeInTheDocument();
      expect(screen.getByText(/\/etc\/app/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Remove file mount')).toBeInTheDocument();
    });

    it('invokes onEdit and onRemove from the footer', () => {
      const { onEdit, onRemove } = renderEditor();

      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Remove file mount'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('shows an "Override" button and hides Delete for inherited rows', () => {
      renderEditor({ editButtonLabel: 'Override', hideDelete: true });

      expect(
        screen.getByRole('button', { name: /override/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText('Remove file mount'),
      ).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renders File Name / Mount Path fields with Save, Cancel and Delete', () => {
      renderEditor({ isEditing: true });

      expect(screen.getByDisplayValue('config.yaml')).toBeInTheDocument();
      expect(screen.getByDisplayValue('/etc/app')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel editing/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Remove file mount')).toBeInTheDocument();
    });

    it('emits onChange when the mount path changes', () => {
      const { onChange } = renderEditor({ isEditing: true });
      fireEvent.change(screen.getByDisplayValue('/etc/app'), {
        target: { value: '/etc/other' },
      });
      expect(onChange).toHaveBeenCalledWith('mountPath', '/etc/other');
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

    it('toggles to secret mode via the mode button', () => {
      const { onModeChange } = renderEditor({ isEditing: true, mode: 'plain' });
      fireEvent.click(
        screen.getByRole('button', { name: /switch to secret reference/i }),
      );
      expect(onModeChange).toHaveBeenCalledWith('secret');
    });
  });
});
