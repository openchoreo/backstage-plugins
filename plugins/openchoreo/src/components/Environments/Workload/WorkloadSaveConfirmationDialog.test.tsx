import { render, screen } from '@testing-library/react';
import { WorkloadSaveConfirmationDialog } from './WorkloadSaveConfirmationDialog';
import type { WorkloadChanges } from './hooks/useWorkloadChanges';

// ChangesList lives in @openchoreo/backstage-plugin-react which transitively
// loads Backstage's TabbedLayout under jest's isolated module env. Mock the
// package surface to just what the dialog touches.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ChangesList: ({ sections }: { sections: { title: string }[] }) => (
    <div data-testid="changes-list">
      {sections.map(s => (
        <div key={s.title}>{s.title}</div>
      ))}
    </div>
  ),
  deepCompareObjects: () => [],
}));

const emptyChanges: WorkloadChanges = {
  container: [],
  endpoints: [],
  dependencies: [],
  other: [],
  total: 0,
  hasChanges: false,
};

const baseProps = {
  open: true,
  onCancel: () => {},
  onConfirm: () => {},
  changes: emptyChanges,
  saving: false,
};

describe('WorkloadSaveConfirmationDialog', () => {
  it('renders the standard Save & Continue label when autoDeploy is false', () => {
    render(<WorkloadSaveConfirmationDialog {...baseProps} />);
    expect(
      screen.getByRole('button', { name: 'Save & Continue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces the auto-deploy alert and "Save & deploy" label when autoDeploy is true', () => {
    render(
      <WorkloadSaveConfirmationDialog
        {...baseProps}
        autoDeploy
        lowestEnvironmentName="development"
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Auto-deploy is on/);
    expect(alert).toHaveTextContent('development');
    expect(
      screen.getByRole('button', { name: 'Save & deploy' }),
    ).toBeInTheDocument();
  });

  it('shows "Deploying..." on the confirm button while saving with autoDeploy on', () => {
    render(
      <WorkloadSaveConfirmationDialog
        {...baseProps}
        saving
        autoDeploy
        lowestEnvironmentName="development"
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Deploying...' }),
    ).toBeInTheDocument();
  });

  it('falls back to a generic env phrase when lowestEnvironmentName is missing', () => {
    render(<WorkloadSaveConfirmationDialog {...baseProps} autoDeploy />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'the lowest environment',
    );
  });
});
