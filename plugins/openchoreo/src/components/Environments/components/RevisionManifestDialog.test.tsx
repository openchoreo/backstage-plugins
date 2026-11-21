import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BindingRevision } from '@openchoreo/backstage-plugin-common';
import { RevisionManifestDialog } from './RevisionManifestDialog';

jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

const revision = {
  metadata: { name: 'frontend-development-r30', managedFields: [{}] },
  spec: {
    revision: 30,
    cause: 'Override',
    componentReleaseName: 'myapp',
    bindingSpec: { releaseName: 'myapp' },
  },
  status: { health: 'Healthy', active: true },
} as unknown as BindingRevision;

describe('RevisionManifestDialog', () => {
  it('renders the revision as YAML without server bookkeeping', () => {
    render(
      <RevisionManifestDialog
        open
        onClose={jest.fn()}
        revision={revision}
        environmentName="Development"
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Revision manifest — Development' }),
    ).toBeInTheDocument();
    const yaml = screen.getByTestId('yaml-viewer');
    expect(yaml).toHaveTextContent('kind: ReleaseBindingRevision');
    expect(yaml).toHaveTextContent('name: frontend-development-r30');
    expect(yaml).not.toHaveTextContent('managedFields');
  });

  it('says so when the environment has no revision, and disables Copy', () => {
    render(
      <RevisionManifestDialog
        open
        onClose={jest.fn()}
        environmentName="Development"
      />,
    );
    expect(
      screen.getByText('No revision on this environment yet.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  it('copies the YAML', async () => {
    const user = userEvent.setup();
    render(
      <RevisionManifestDialog
        open
        onClose={jest.fn()}
        revision={revision}
        environmentName="Development"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toContain(
      'name: frontend-development-r30',
    );
  });

  it('closes itself before opening the Revision Browser', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <RevisionManifestDialog
        open
        onClose={() => calls.push('close')}
        revision={revision}
        environmentName="Development"
        onOpenRevisionBrowser={() => calls.push('browser')}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open Revision Browser' }),
    );
    expect(calls).toEqual(['close', 'browser']);
  });

  it('offers no browser button without onOpenRevisionBrowser', () => {
    render(
      <RevisionManifestDialog
        open
        onClose={jest.fn()}
        revision={revision}
        environmentName="Development"
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Open Revision Browser' }),
    ).toBeNull();
  });

  it('closes on Close', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <RevisionManifestDialog
        open
        onClose={onClose}
        revision={revision}
        environmentName="Development"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
