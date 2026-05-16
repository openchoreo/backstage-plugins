import { render, screen, fireEvent } from '@testing-library/react';
import { UndeployConfirmDialog } from './UndeployConfirmDialog';

describe('UndeployConfirmDialog', () => {
  it('renders the env name in the title', () => {
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/undeploy from dev/i)).toBeInTheDocument();
  });

  it('warns that DP-side state persists when retainPolicy=Retain', () => {
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        retainPolicy="Retain"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/Retain/)).toBeInTheDocument();
    expect(
      screen.getByText(/data-plane state persists/i),
    ).toBeInTheDocument();
  });

  it('says the controller will cascade when retainPolicy=Delete', () => {
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        retainPolicy="Delete"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByText(/cascade-delete the data-plane state/i),
    ).toBeInTheDocument();
  });

  it('fires onConfirm when the Undeploy button is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /undeploy/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('fires onCancel when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        onCancel={onCancel}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons while busy', () => {
    render(
      <UndeployConfirmDialog
        open
        envName="dev"
        busy
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /undeploy/i })).toBeDisabled();
  });
});
