import {
  render,
  screen,
  within,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeploymentFailureBanner } from './DeploymentFailureBanner';

// A controller message longer than the truncation threshold (120 chars).
const LONG_MESSAGE =
  'Failed to render resources: trait observability-alert-rule/observability-alert-rule-1 validation failed: rule[0] evaluated to false: A notification channel is mandatory for alert rules.';

describe('DeploymentFailureBanner', () => {
  it('renders a short controller message and reason inline (no View details)', () => {
    render(
      <DeploymentFailureBanner
        message="Invalid trait configuration for 'auth'"
        reason="RenderingFailed"
      />,
    );
    expect(
      screen.getByText(/Invalid trait configuration for 'auth'/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Reason: RenderingFailed/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view details/i })).toBeNull();
  });

  it('falls back to a generic headline when only a reason is given', () => {
    render(<DeploymentFailureBanner reason="AutoDeployFailed" />);
    expect(
      screen.getByText(/could not roll out this release/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Reason: AutoDeployFailed/)).toBeInTheDocument();
  });

  it('renders nothing when neither message nor reason is provided', () => {
    const { container } = render(<DeploymentFailureBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('clamps a long message and offers a View details button', () => {
    render(
      <DeploymentFailureBanner
        message={LONG_MESSAGE}
        reason="RenderingFailed"
      />,
    );
    // The (clamped) message preview is still in the DOM.
    expect(screen.getByText(/Failed to render resources/)).toBeInTheDocument();
    // The inline "Reason:" line is replaced by the View details affordance.
    expect(screen.queryByText(/Reason: RenderingFailed/)).toBeNull();
    expect(
      screen.getByRole('button', { name: /view details/i }),
    ).toBeInTheDocument();
  });

  it('opens the full error dialog (message + reason) on View details', async () => {
    const user = userEvent.setup();
    render(
      <DeploymentFailureBanner
        message={LONG_MESSAGE}
        reason="RenderingFailed"
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /view details/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Reason (chip) + full message live inside the dialog (the banner preview is
    // clamped but, being CSS-only, also contains the text — scope to the dialog).
    expect(within(dialog).getByText('RenderingFailed')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/A notification channel is mandatory/),
    ).toBeInTheDocument();
    // And it closes (MUI Dialog unmounts after its transition).
    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
  });

  it('prepends the plain-language lead line when the failure is the project not being deployed', () => {
    render(
      <DeploymentFailureBanner
        message='namespaces "dp-x" not found'
        reason="ResourceApplyFailed"
        projectNotDeployed
        envName="Development"
        envResourceName="development"
      />,
    );
    expect(
      screen.getByText(/The project isn't deployed to this environment/i),
    ).toBeInTheDocument();
  });
});
