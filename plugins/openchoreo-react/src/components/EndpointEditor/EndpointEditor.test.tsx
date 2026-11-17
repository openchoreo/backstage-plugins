import type { ReactNode } from 'react';
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
    details: ReactNode;
    visibilityDisabledReason: string;
    visibilityError: string;
    header: ReactNode;
    protocolOptions: string[];
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
      details={overrides.details}
      visibilityDisabledReason={overrides.visibilityDisabledReason}
      visibilityError={overrides.visibilityError}
      header={overrides.header}
      protocolOptions={overrides.protocolOptions}
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
  describe('details', () => {
    it('shows the details under the read-only summary', () => {
      renderEditor({ details: <span>exposed via http-route</span> });
      expect(screen.getByText('exposed via http-route')).toBeInTheDocument();
      expect(screen.getByText('http')).toBeInTheDocument();
    });

    it('shows the details in the edit form too', () => {
      renderEditor({
        isEditing: true,
        details: <span>exposed via http-route</span>,
      });
      expect(screen.getByText('exposed via http-route')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i }),
      ).toBeInTheDocument();
    });
  });

  describe('visibilityDisabledReason', () => {
    it('blocks adding visibility beyond project but allows clearing it', () => {
      renderEditor({
        isEditing: true,
        endpoint: { type: 'TCP', port: 9000, visibility: ['external'] },
        visibilityDisabledReason: 'No endpoint type is allowed for TCP.',
      });

      expect(
        screen.getByText('No endpoint type is allowed for TCP.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'Namespace' }),
      ).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'Internal' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'External' })).toBeEnabled();
    });
  });

  describe('header', () => {
    it('shows the header above the name while editing only', () => {
      renderEditor({ isEditing: true, header: <span>exposed as</span> });
      const header = screen.getByText('exposed as');
      const name = screen.getByDisplayValue('http');
      expect(
        // eslint-disable-next-line no-bitwise
        header.compareDocumentPosition(name) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('leaves the header out of the read-only summary', () => {
      renderEditor({ header: <span>exposed as</span> });
      expect(screen.queryByText('exposed as')).toBeNull();
    });
  });

  describe('protocolOptions', () => {
    it('offers only the given protocols', async () => {
      renderEditor({
        isEditing: true,
        endpoint: { type: 'HTTP', port: 8080 },
        protocolOptions: ['HTTP', 'GraphQL'],
      });
      fireEvent.mouseDown(screen.getByRole('button', { name: /HTTP/ }));
      const options = await screen.findAllByRole('option');
      expect(options.map(o => o.textContent)).toEqual(['HTTP', 'GraphQL']);
    });

    it('fixes the protocol when only one is allowed', () => {
      renderEditor({
        isEditing: true,
        endpoint: { type: 'gRPC', port: 9090 },
        protocolOptions: ['gRPC'],
      });
      expect(screen.getByRole('button', { name: /gRPC/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });

  describe('visibilityError', () => {
    it('shows the error under the visibility field', () => {
      renderEditor({
        isEditing: true,
        visibilityError: 'Select a visibility beyond Project.',
      });
      expect(
        screen.getByText('Select a visibility beyond Project.'),
      ).toBeInTheDocument();
    });
  });
});
