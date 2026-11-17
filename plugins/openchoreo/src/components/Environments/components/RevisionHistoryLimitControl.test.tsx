import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import type { BindingRevisionHistoryLimit } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  historyLimitLabel,
  inheritedLimitText,
  parseHistoryLimit,
  resetWarning,
  RevisionHistoryLimitControl,
  type RevisionHistoryLimitControlProps,
} from './RevisionHistoryLimitControl';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'frontend', namespace: 'default' },
};
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const limit = (
  bindingLimit: number | null,
  environmentLimit: number | null = null,
): BindingRevisionHistoryLimit => ({ bindingLimit, environmentLimit });

function setup(
  current: BindingRevisionHistoryLimit | Error,
  props: Partial<RevisionHistoryLimitControlProps> = {},
) {
  const client = {
    getBindingRevisionHistoryLimit:
      current instanceof Error
        ? jest.fn().mockRejectedValue(current)
        : jest.fn().mockResolvedValue(current),
    setBindingRevisionHistoryLimit: jest.fn(
      async (_e: unknown, _k: string, _b: string, next: number | null) =>
        limit(next, current instanceof Error ? null : current.environmentLimit),
    ),
  };
  const onChanged = jest.fn();
  render(
    <TestApiProvider apis={[[openChoreoClientApiRef, client]]}>
      <RevisionHistoryLimitControl
        kind="component"
        bindingName="frontend-development"
        environmentName="Development"
        oldRevisionCount={5}
        canUpdate
        deniedTooltip=""
        onChanged={onChanged}
        {...props}
      />
    </TestApiProvider>,
  );
  return { client, onChanged };
}

const button = () => screen.getByTestId('revision-history-limit-button');
const openPopover = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(button());
  return screen.findByRole('dialog', { name: 'Revision history limit' });
};
const field = (popover: HTMLElement) =>
  within(popover).getByRole('spinbutton', { name: 'Revision history limit' });

describe('parseHistoryLimit', () => {
  it('accepts whole numbers from 0 to the maximum', () => {
    expect(parseHistoryLimit('0')).toBe(0);
    expect(parseHistoryLimit(' 10 ')).toBe(10);
    expect(parseHistoryLimit('1000')).toBe(1000);
  });

  it('rejects everything else', () => {
    for (const text of ['', ' ', '-1', '1.5', '1e2', 'ten', '1001']) {
      expect(parseHistoryLimit(text)).toBeNull();
    }
  });
});

describe('historyLimitLabel', () => {
  it('names the limit in effect and where it comes from', () => {
    expect(historyLimitLabel(null)).toBe('History limit');
    expect(historyLimitLabel(limit(5, 10))).toBe('History limit: 5');
    expect(historyLimitLabel(limit(0, 10))).toBe('History limit: 0');
    expect(historyLimitLabel(limit(null, 10))).toBe(
      'History limit: 10 (environment)',
    );
    expect(historyLimitLabel(limit(null))).toBe('History limit: default');
  });

  it('does not call an unreadable environment limit the default', () => {
    const unreadable = {
      ...limit(null),
      environmentLimitUnreadable: true,
    };
    expect(historyLimitLabel(unreadable)).toBe('History limit: unknown');
    expect(inheritedLimitText(unreadable)).toBe(
      "the environment's limit, which could not be read",
    );
    expect(inheritedLimitText(limit(null))).toBe('the platform default');
    expect(historyLimitLabel({ ...unreadable, bindingLimit: 4 })).toBe(
      'History limit: 4',
    );
  });
});

describe('resetWarning', () => {
  it('warns from the limit the binding inherits once its own is cleared', () => {
    expect(resetWarning(limit(10, 2), 5, 'Development')).toBe(
      'Reset deletes up to 3 of the oldest revisions. They cannot be restored.',
    );
    expect(resetWarning(limit(10, 0), 5, 'Development')).toContain(
      'Development cannot be rolled back',
    );
    expect(resetWarning(limit(2, 10), 5, 'Development')).toBeNull();
    expect(resetWarning(limit(10), 5, 'Development')).toContain(
      'Reset uses the platform default',
    );
    expect(resetWarning(limit(10), 0, 'Development')).toBeNull();
    expect(
      resetWarning(
        { ...limit(10), environmentLimitUnreadable: true },
        0,
        'Development',
      ),
    ).toContain('could not be read');
  });
});

describe('RevisionHistoryLimitControl', () => {
  it("shows the binding's own limit on the button", async () => {
    const { client } = setup(limit(5, 10));
    await waitFor(() => expect(button()).toHaveTextContent('History limit: 5'));
    expect(client.getBindingRevisionHistoryLimit).toHaveBeenCalledWith(
      entity,
      'component',
      'frontend-development',
    );
  });

  it('shows the inherited limit when the binding sets none', async () => {
    setup(limit(null, 10));
    await waitFor(() =>
      expect(button()).toHaveTextContent('History limit: 10 (environment)'),
    );

    const user = userEvent.setup();
    const popover = await openPopover(user);
    expect(field(popover)).toHaveValue(null);
    expect(popover).toHaveTextContent(
      "Not set for this binding: it uses the environment's limit of 10.",
    );
    expect(
      within(popover).queryByRole('button', { name: 'Reset' }),
    ).not.toBeInTheDocument();
    expect(
      within(popover).getByRole('button', { name: 'Save' }),
    ).toBeDisabled();
  });

  it('saves a new limit and reports it', async () => {
    const { client, onChanged } = setup(limit(null, 10));
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() => expect(field(popover)).toBeEnabled());

    await user.type(field(popover), '8');
    await user.click(within(popover).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(client.setBindingRevisionHistoryLimit).toHaveBeenCalledWith(
        entity,
        'component',
        'frontend-development',
        8,
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(limit(8, 10)));
    await waitFor(() => expect(button()).toHaveTextContent('History limit: 8'));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Revision history limit' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('warns before a lower limit deletes revisions', async () => {
    setup(limit(10), { oldRevisionCount: 5 });
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() => expect(field(popover)).toHaveValue(10));
    expect(
      within(popover).queryByTestId('history-limit-warning'),
    ).not.toBeInTheDocument();

    await user.clear(field(popover));
    await user.type(field(popover), '2');
    expect(
      within(popover).getByTestId('history-limit-warning'),
    ).toHaveTextContent('Saving deletes up to 3 of the oldest revisions.');

    await user.clear(field(popover));
    await user.type(field(popover), '0');
    expect(
      within(popover).getByTestId('history-limit-warning'),
    ).toHaveTextContent('Development cannot be rolled back');
  });

  it('warns what Reset deletes before it is clicked, whatever is typed', async () => {
    setup(limit(10, 2), { oldRevisionCount: 5 });
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() => expect(field(popover)).toHaveValue(10));

    expect(
      within(popover).getByTestId('history-limit-reset-warning'),
    ).toHaveTextContent('Reset deletes up to 3 of the oldest revisions.');
    await user.clear(field(popover));
    await user.type(field(popover), '20');
    expect(
      within(popover).getByTestId('history-limit-reset-warning'),
    ).toHaveTextContent('Reset deletes up to 3 of the oldest revisions.');
  });

  it('resets a binding limit so the inherited one applies', async () => {
    const { client, onChanged } = setup(limit(3, 10));
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await user.click(
      await within(popover).findByRole('button', { name: 'Reset' }),
    );

    await waitFor(() =>
      expect(client.setBindingRevisionHistoryLimit).toHaveBeenCalledWith(
        entity,
        'component',
        'frontend-development',
        null,
      ),
    );
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith(limit(null, 10)),
    );
    await waitFor(() =>
      expect(button()).toHaveTextContent('History limit: 10 (environment)'),
    );
  });

  it('rejects a value that is not a whole number in range', async () => {
    const { client } = setup(limit(null));
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() => expect(field(popover)).toBeEnabled());

    await user.type(field(popover), '1001');
    expect(popover).toHaveTextContent('Enter a whole number from 0 to 1000.');
    expect(
      within(popover).getByRole('button', { name: 'Save' }),
    ).toBeDisabled();
    expect(client.setBindingRevisionHistoryLimit).not.toHaveBeenCalled();
  });

  it('keeps the popover open and shows why a save failed', async () => {
    const { client, onChanged } = setup(limit(4));
    client.setBindingRevisionHistoryLimit.mockRejectedValueOnce(
      new Error('the binding changed'),
    );
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() => expect(field(popover)).toHaveValue(4));

    await user.clear(field(popover));
    await user.type(field(popover), '6');
    await user.click(within(popover).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(popover).toHaveTextContent(
        'Could not save the limit: the binding changed',
      ),
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent('History limit: 4');
  });

  it('shows why the limit could not be loaded', async () => {
    setup(new Error('forbidden'));
    const user = userEvent.setup();
    const popover = await openPopover(user);
    await waitFor(() =>
      expect(popover).toHaveTextContent('Could not load the limit: forbidden'),
    );
    expect(
      within(popover).getByRole('button', { name: 'Save' }),
    ).toBeDisabled();
  });

  it('is disabled for a user who may not change the binding', async () => {
    setup(limit(5), { canUpdate: false, deniedTooltip: 'No permission' });
    await waitFor(() => expect(button()).toHaveTextContent('History limit: 5'));
    expect(button()).toBeDisabled();
  });

  it('reads and writes a resource binding through the resource kind', async () => {
    const { client } = setup(limit(null), {
      kind: 'resource',
      bindingName: 'db-development',
    });
    await waitFor(() =>
      expect(client.getBindingRevisionHistoryLimit).toHaveBeenCalledWith(
        entity,
        'resource',
        'db-development',
      ),
    );
  });
});
