import { fireEvent, render, screen } from '@testing-library/react';
import { EnvironmentHookSection } from './EnvironmentHookSection';
import { deriveEnvironmentHooks } from '../hooks/hookModel';

const hooks = deriveEnvironmentHooks(
  {
    preDeploy: [
      { name: 'image-scan', hookRef: { kind: 'ClusterHook', name: 'trivy' } },
    ],
    postDeploy: [{ name: 'notify', hookRef: { name: 'print' }, mode: 'Async' }],
  },
  {
    preDeploy: [
      {
        name: 'image-scan',
        phase: 'Failed',
        workflowRunRef: 'run-1',
        message: 'CVE-2025-68121 found',
      },
    ],
  },
);

describe('EnvironmentHookSection', () => {
  it('shows each phase with its hooks and what happened to them', () => {
    render(<EnvironmentHookSection hooks={hooks} onOpenHook={jest.fn()} />);
    expect(screen.getByText('Before deploy')).toBeInTheDocument();
    expect(screen.getByText('After deploy')).toBeInTheDocument();
    expect(
      screen.getByTestId('env-hook-preDeploy-image-scan'),
    ).toHaveTextContent('blocked');
    expect(screen.getByTestId('env-hook-postDeploy-notify')).toHaveTextContent(
      'waiting',
    );
  });

  // The card body selects the environment; clicking a hook must open its run
  // instead of (also) selecting the card.
  it('opens the hook run without selecting the card', () => {
    const onOpenHook = jest.fn();
    const onCardClick = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onCardClick}>
        <EnvironmentHookSection hooks={hooks} onOpenHook={onOpenHook} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('env-hook-preDeploy-image-scan'));
    expect(onOpenHook).toHaveBeenCalledWith('preDeploy', 'image-scan');
    expect(onCardClick).not.toHaveBeenCalled();
  });

  // Hovering a row answers "why is this blocked?" without leaving the card.
  it('shows what happened, the policy and the failure on hover', async () => {
    render(<EnvironmentHookSection hooks={hooks} onOpenHook={jest.fn()} />);
    fireEvent.mouseOver(screen.getByTestId('env-hook-preDeploy-image-scan'));
    expect(
      await screen.findByText('Sync · on failure: Block'),
    ).toBeInTheDocument();
    expect(screen.getByText('CVE-2025-68121 found')).toBeInTheDocument();
    expect(
      screen.getByText('Click to open logs, events and details'),
    ).toBeInTheDocument();
  });
});
