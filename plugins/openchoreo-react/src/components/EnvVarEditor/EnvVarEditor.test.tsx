import { render, screen, fireEvent } from '@testing-library/react';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import { EnvVarEditor } from './EnvVarEditor';

function renderEditor(
  overrides: Partial<{
    envVar: EnvVar;
    mode: 'plain' | 'secret';
    isEditing: boolean;
    editButtonLabel: string;
    hideDelete: boolean;
    applyDisabled: boolean;
    baseValue: EnvVar;
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
    <EnvVarEditor
      envVar={overrides.envVar ?? { key: 'PORT', value: '8080' }}
      secrets={[]}
      mode={overrides.mode ?? 'plain'}
      isEditing={overrides.isEditing ?? false}
      editButtonLabel={overrides.editButtonLabel}
      hideDelete={overrides.hideDelete}
      applyDisabled={overrides.applyDisabled}
      baseValue={overrides.baseValue}
      {...handlers}
    />,
  );
  return handlers;
}

describe('EnvVarEditor', () => {
  describe('read-only mode', () => {
    it('renders key/value with Edit and Delete actions', () => {
      renderEditor({ envVar: { key: 'PORT', value: '8080' } });

      expect(screen.getByText('PORT')).toBeInTheDocument();
      expect(screen.getByText(/8080/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(
        screen.getByLabelText('Remove environment variable'),
      ).toBeInTheDocument();
    });

    it('invokes onEdit and onRemove from the footer', () => {
      const { onEdit, onRemove } = renderEditor();

      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Remove environment variable'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('masks sensitive values', () => {
      renderEditor({ envVar: { key: 'API_SECRET', value: 'supersecret' } });
      expect(screen.getByText(/••••••••/)).toBeInTheDocument();
    });

    it('renders an inline diff when a baseValue is provided', () => {
      renderEditor({
        envVar: { key: 'PORT', value: '9090' },
        baseValue: { key: 'PORT', value: '8080' },
      });
      expect(screen.getByText('8080')).toBeInTheDocument();
    });

    it('shows an "Override" button and hides Delete for inherited rows', () => {
      renderEditor({ editButtonLabel: 'Override', hideDelete: true });

      expect(
        screen.getByRole('button', { name: /override/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText('Remove environment variable'),
      ).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('renders Name/Value fields with Save, Cancel and Delete', () => {
      renderEditor({ isEditing: true });

      expect(screen.getByDisplayValue('PORT')).toBeInTheDocument();
      expect(screen.getByDisplayValue('8080')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel editing/i }),
      ).toBeInTheDocument();
    });

    it('emits onChange when the value field changes', () => {
      const { onChange } = renderEditor({ isEditing: true });
      fireEvent.change(screen.getByDisplayValue('8080'), {
        target: { value: '9090' },
      });
      expect(onChange).toHaveBeenCalledWith('value', '9090');
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

    it('renders the secret selector in secret mode', () => {
      renderEditor({
        isEditing: true,
        mode: 'secret',
        envVar: {
          key: 'TOKEN',
          valueFrom: { secretKeyRef: { name: 's', key: 'k' } },
        },
      });
      expect(screen.getByDisplayValue('TOKEN')).toBeInTheDocument();
    });
  });
});
