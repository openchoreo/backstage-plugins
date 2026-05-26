import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeployedEnvBadges } from './DeployedEnvBadges';

describe('DeployedEnvBadges', () => {
  it('renders nothing when envs is empty', () => {
    const { container } = render(<DeployedEnvBadges envs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single primary chip and no overflow when one env', () => {
    render(<DeployedEnvBadges envs={['Development']} />);
    expect(screen.getByText('Deployed to:')).toBeInTheDocument();
    expect(screen.getByText('Development')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });

  it('promotes the matching primaryEnv to the front and collapses the rest into "+N more"', async () => {
    const user = userEvent.setup();
    render(
      <DeployedEnvBadges
        envs={[
          'staging-eu',
          'staging-us',
          'Development',
          'production-eu',
          'production-us',
        ]}
        primaryEnv="development"
      />,
    );

    // Primary chip is the case-insensitive match for primaryEnv, in original casing.
    expect(screen.getByText('Development')).toBeInTheDocument();

    // The four remaining envs collapse into one overflow chip.
    const more = screen.getByText('+4 more');
    expect(more).toBeInTheDocument();

    // Hidden envs are not visible until hover.
    expect(screen.queryByText('staging-eu')).not.toBeInTheDocument();

    await user.hover(more);
    expect(await screen.findByText('staging-eu')).toBeInTheDocument();
    expect(screen.getByText('staging-us')).toBeInTheDocument();
    expect(screen.getByText('production-eu')).toBeInTheDocument();
    expect(screen.getByText('production-us')).toBeInTheDocument();
  });

  it('falls back to the first env when primaryEnv does not match', () => {
    render(
      <DeployedEnvBadges
        envs={['staging-eu', 'production-eu']}
        primaryEnv="development"
      />,
    );
    expect(screen.getByText('staging-eu')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });
});
