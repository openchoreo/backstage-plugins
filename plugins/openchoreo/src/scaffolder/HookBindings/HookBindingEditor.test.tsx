import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { HookBindingEditor } from './HookBindingEditor';
import {
  validateHookSet,
  type HookOption,
  type HookSetFormData,
} from './hookBindingValidation';

const trivy: HookOption = {
  kind: 'ClusterHook',
  name: 'trivy-image-scan',
  parameters: [
    { name: 'image', from: '${deployment.workload.containers.main.image}' },
    { name: 'severity', default: 'CRITICAL' },
    { name: 'ticket', required: true },
  ],
  enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
};

const notify: HookOption = {
  kind: 'Hook',
  name: 'slack-notify',
  namespace: 'default',
  parameters: [],
  enabledTo: [],
};

const subjectTypes = [
  { kind: 'ClusterComponentType' as const, name: 'service' },
  { kind: 'ClusterComponentType' as const, name: 'worker' },
];

let latest: HookSetFormData | undefined;

const HOOK_OPTIONS = [trivy, notify];

function Harness({
  initial,
  showErrors,
}: {
  initial?: HookSetFormData;
  showErrors?: boolean;
}) {
  const [set, setSet] = useState<HookSetFormData | undefined>(initial);
  return (
    <HookBindingEditor
      environmentName="production"
      hookSet={set}
      hooks={HOOK_OPTIONS}
      subjectTypes={subjectTypes}
      showErrors={showErrors}
      onChange={next => {
        latest = next;
        setSet(next);
      }}
    />
  );
}

function openSelect(testId: string) {
  const trigger = screen.getByTestId(testId).querySelector('[role="button"]');
  fireEvent.mouseDown(trigger as HTMLElement);
}

beforeEach(() => {
  latest = undefined;
});

describe('HookBindingEditor', () => {
  // Hooks are a first-class part of an environment: both phases are shown and
  // can be added to without first expanding anything.
  it('shows both phases up front, empty, with no toggle', () => {
    render(<Harness />);
    // The section heading outranks the phase titles under it.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Deployment hooks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'Before deploy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 4, name: 'After deploy' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-hook-preDeploy')).toBeInTheDocument();
    expect(screen.getByTestId('add-hook-postDeploy')).toBeInTheDocument();
    expect(screen.getByText('No pre-deploy hooks.')).toBeInTheDocument();
    expect(screen.getByText('No post-deploy hooks.')).toBeInTheDocument();
    expect(
      screen.queryByTestId('hooks-toggle-production'),
    ).not.toBeInTheDocument();
  });

  it('adds a pre-deploy binding seeded from the first hook', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));

    expect(latest?.preDeploy).toHaveLength(1);
    const b = latest!.preDeploy[0];
    expect(b.name).toBe('trivy-image-scan');
    expect(b.hookRef).toEqual({
      kind: 'ClusterHook',
      name: 'trivy-image-scan',
    });
    expect(b.onFailure).toBe('Block');
    // Defaults are prefilled; required ones are left for the engineer.
    expect(b.parameters).toEqual({ severity: 'CRITICAL' });
  });

  // A newly added hook must not open covered in errors for fields the user
  // has not filled in yet: errors wait for a submit attempt.
  it('hides errors until the user tries to submit', () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));
    expect(screen.queryByTestId('hook-binding-errors')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('hook-param-ticket').closest('.MuiFormControl-root'),
    ).not.toHaveTextContent('the binding must supply a value');

    rerender(<Harness showErrors />);
    expect(screen.getByTestId('hook-binding-errors').textContent).toContain(
      '"ticket" is required',
    );
    expect(
      screen.getByTestId('hook-param-ticket').closest('.MuiFormControl-root'),
    ).toHaveTextContent('the binding must supply a value');
  });

  it('flags a missing required parameter after a submit attempt and exposes only bindable rows', () => {
    render(<Harness showErrors />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));

    expect(screen.getByTestId('hook-binding-errors').textContent).toContain(
      '"ticket" is required',
    );
    expect(screen.getByTestId('hook-param-image')).toBeDisabled();
    expect(screen.getByTestId('hook-param-severity')).not.toBeDisabled();

    fireEvent.change(screen.getByTestId('hook-param-ticket'), {
      target: { value: 'CHG-1' },
    });
    expect(latest!.preDeploy[0].parameters.ticket).toBe('CHG-1');
    expect(screen.queryByTestId('hook-binding-errors')).not.toBeInTheDocument();
  });

  it('switching to Async removes onFailure, timeout and retries from the data', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-postDeploy'));
    expect(latest!.postDeploy[0].onFailure).toBe('Ignore');

    openSelect('hook-mode-select');
    fireEvent.click(screen.getByRole('option', { name: 'Async' }));

    const b = latest!.postDeploy[0];
    expect(b.mode).toBe('Async');
    expect(b.onFailure).toBeUndefined();
    expect(b.timeout).toBeUndefined();
    expect(b.retries).toBeUndefined();
    expect(screen.queryByTestId('hook-timeout')).not.toBeInTheDocument();
  });

  it('post-deploy offers Ignore and Alert, never Block', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-postDeploy'));

    openSelect('hook-onfailure-select');
    const listbox = screen.getByRole('listbox');
    expect(
      within(listbox)
        .getAllByRole('option')
        .map(o => o.textContent),
    ).toEqual(['Ignore', 'Alert']);
  });

  it('restricts appliesTo to the hook enabledTo and shows the enabledTo chips', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));

    expect(
      screen.getByText('ClusterComponentType/service'),
    ).toBeInTheDocument();

    openSelect('hook-appliesto-select');
    const options = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .map(o => o.textContent);
    expect(options).toEqual(['ClusterComponentType/service']);
  });

  // A multi-select must show what is picked; a checkbox per option does.
  it('ticks the checkbox of each component type the binding applies to', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));
    openSelect('hook-appliesto-select');
    const option = within(screen.getByRole('listbox')).getByRole('option', {
      name: 'ClusterComponentType/service',
    });
    const box = within(option).getByRole('checkbox');
    expect(box).not.toBeChecked();

    fireEvent.click(option);

    expect(latest?.preDeploy[0].appliesTo).toEqual([
      { kind: 'ClusterComponentType', name: 'service' },
    ]);
    expect(
      within(
        within(screen.getByRole('listbox')).getByRole('option', {
          name: 'ClusterComponentType/service',
        }),
      ).getByRole('checkbox'),
    ).toBeChecked();
  });

  it('flags a pre-existing appliesTo outside enabledTo (for example from pasted YAML)', () => {
    render(
      <Harness
        initial={{
          preDeploy: [
            {
              name: 'scan',
              hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
              mode: 'Sync',
              onFailure: 'Block',
              appliesTo: [{ kind: 'ClusterComponentType', name: 'worker' }],
              parameters: { ticket: 'x' },
            },
          ],
          postDeploy: [],
        }}
        showErrors
      />,
    );
    expect(screen.getByText(/Not enabled by the hook/)).toBeInTheDocument();
    expect(screen.getByTestId('hook-binding-errors').textContent).toContain(
      'not in the hook',
    );
  });

  // Submit-time validation has no catalog access, so the binding must carry
  // its hook's spec; otherwise a missing required parameter would slip past
  // Next and only fail at the webhook.
  it('attaches the selected hook spec so submit validation can check parameters', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));
    expect(latest!.preDeploy[0].hookSpec).toBe(trivy);
    expect(validateHookSet(latest, [])).toEqual(
      expect.arrayContaining([expect.stringContaining('"ticket" is required')]),
    );
  });

  it('attaches the spec to bindings loaded from YAML once the hooks arrive', () => {
    render(
      <Harness
        initial={{
          preDeploy: [
            {
              name: 'scan',
              hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
              mode: 'Sync',
              onFailure: 'Block',
              appliesTo: [],
              parameters: {},
            },
          ],
          postDeploy: [],
        }}
      />,
    );
    expect(latest!.preDeploy[0].hookSpec).toBe(trivy);
  });

  it('re-selecting a hook re-derives the auto name and reseeds parameters', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));

    openSelect('hook-select');
    fireEvent.click(screen.getByRole('option', { name: 'slack-notify' }));

    const b = latest!.preDeploy[0];
    expect(b.hookRef).toEqual({ kind: 'Hook', name: 'slack-notify' });
    expect(b.name).toBe('slack-notify');
    expect(b.parameters).toEqual({});
  });

  it('removing the last binding clears the hooks block so the YAML omits it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('add-hook-preDeploy'));
    fireEvent.click(screen.getByLabelText('Remove hook binding'));
    expect(latest).toBeUndefined();
  });
});
