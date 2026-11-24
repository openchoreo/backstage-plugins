import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  ConfirmationRequired,
  ConfirmResult,
} from '../../api/PortalAssistantApi';
import {
  ConfirmCard,
  ConfirmCardSkipTest,
  ConfirmCardTestPicker,
} from './ConfirmCard';

// Hoisted spy — see InvestigateLogButton.test.tsx for the rationale.
const holder: { confirmChange: jest.Mock } = { confirmChange: jest.fn() };

jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  useApi: () => ({
    confirmChange: (...args: unknown[]) => holder.confirmChange(...args),
  }),
}));

const newRule = {
  all: [
    { fact: 'githubDefaultBranchProtected', operator: 'equal', value: true },
    {
      fact: 'githubRequiredApprovingReviewCount',
      operator: 'greaterThanInclusive',
      value: 2,
    },
  ],
};

const edit: ConfirmationRequired = {
  type: 'confirmation_required',
  token: 'signed-token',
  kind: 'update',
  check_id: 'c1',
  check_name: 'Default branch protection',
  status: 'draft',
  current_rule: JSON.stringify(
    {
      all: [
        {
          fact: 'githubDefaultBranchProtected',
          operator: 'equal',
          value: true,
        },
      ],
    },
    null,
    2,
  ),
  new_rule: JSON.stringify(newRule, null, 2),
  text_changes: [
    {
      field: 'name',
      label: 'Name',
      old: 'Default branch protection',
      new: 'At least 2 approvals',
    },
  ],
  valid: true,
  problems: [],
};

const newCheck: ConfirmationRequired = {
  type: 'confirmation_required',
  token: 'signed-token',
  kind: 'create',
  check_name: 'Repo not archived',
  description: 'Fails if the repository is archived',
  fact_ids: ['githubRepositoryFactRetriever'],
  category: 'Reliability',
  tier: 'Bronze',
  new_rule: JSON.stringify({
    all: [{ fact: 'githubIsArchived', operator: 'equal', value: false }],
  }),
  valid: true,
  problems: [],
};

const saved = (overrides: Partial<ConfirmResult> = {}): ConfirmResult => ({
  check_id: 'c1',
  status: 'published',
  message: 'Saved and published.',
  ...overrides,
});

const actionButtons = () =>
  screen
    .getAllByRole('button')
    .map(button =>
      // An option row is named by its label; its description isn't part of it.
      button.hasAttribute('aria-pressed')
        ? button.getAttribute('aria-label')
        : button.textContent,
    )
    .filter(text => text);

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

beforeEach(() => {
  holder.confirmChange = jest.fn().mockResolvedValue(saved());
});

describe('ConfirmCard', () => {
  it('shows an edit compactly: name, status, rule, text changes', () => {
    render(<ConfirmCard card={edit} />);

    expect(screen.getByText('Default branch protection')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    // Conditions read as lines, not raw JSON.
    expect(screen.getByText('All of:')).toBeInTheDocument();
    expect(
      screen.getByText('githubRequiredApprovingReviewCount ≥ 2'),
    ).toBeInTheDocument();
    // A rename shows only the new name: the header has the current one.
    expect(screen.getByText('At least 2 approvals')).toBeInTheDocument();
    expect(screen.getAllByText('Default branch protection')).toHaveLength(1);
    expect(screen.getByText('Rule is valid')).toBeInTheDocument();
    expect(actionButtons()).toEqual(['Save as draft', 'Save and publish']);
    // Each option says what it does.
    expect(
      screen.getByText("Every entity's score includes it at once"),
    ).toBeInTheDocument();
  });

  it('saves with the chosen status and the suggested texts', async () => {
    const onSaved = jest.fn();
    render(<ConfirmCard card={edit} onSaved={onSaved} />);

    await click('Save and publish');

    expect(holder.confirmChange).toHaveBeenCalledWith(
      'signed-token',
      'published',
      true,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved and published.',
    );
    // With the check as saved, renamed since the suggested text was applied.
    expect(onSaved).toHaveBeenCalledWith(saved(), {
      checkId: 'c1',
      kind: 'update',
      name: 'At least 2 approvals',
      description: undefined,
      rule: edit.new_rule,
      factIds: undefined,
      appliesTo: undefined,
      status: 'published',
      wasPublished: false,
    });
    // One save per card: the option picked stays, ticked; none can be clicked.
    expect(
      screen.getByRole('button', { name: 'Save and publish' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Save and publish' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Save as draft' }),
    ).toBeDisabled();
  });

  it('passes on a new check as saved, keeping its name when no text is applied', async () => {
    holder.confirmChange = jest
      .fn()
      .mockResolvedValue(saved({ check_id: 'new-1', status: 'draft' }));
    const onSaved = jest.fn();
    render(<ConfirmCard card={newCheck} onSaved={onSaved} />);

    await click('Save as draft');

    expect(onSaved.mock.calls[0][1]).toMatchObject({
      checkId: 'new-1',
      kind: 'create',
      name: 'Repo not archived',
      description: 'Fails if the repository is archived',
      factIds: ['githubRepositoryFactRetriever'],
      status: 'draft',
      wasPublished: false,
    });
  });

  it('offers a test on a component while it can be saved', async () => {
    const picker = jest.fn(() => <div>component picker</div>);
    render(
      <ConfirmCardTestPicker.Provider value={picker}>
        <ConfirmCard card={newCheck} />
      </ConfirmCardTestPicker.Provider>,
    );

    expect(
      screen.getByText(
        "Not sure it's right? Test it on a component before you save.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('component picker')).toBeInTheDocument();
    expect(picker).toHaveBeenCalledWith(newCheck);

    await click('Save as draft');

    expect(screen.queryByText('component picker')).toBeNull();
  });

  it('offers no test without a picker, or for a rule that is not valid', () => {
    const { rerender } = render(<ConfirmCard card={newCheck} />);
    expect(screen.queryByText(/Test it on a component/)).toBeNull();

    rerender(
      <ConfirmCardTestPicker.Provider value={() => <div>component picker</div>}>
        <ConfirmCard card={{ ...newCheck, valid: false }} />
      </ConfirmCardTestPicker.Provider>,
    );
    expect(screen.queryByText('component picker')).toBeNull();
  });

  it('offers only the test first, with no Skip or Cancel', () => {
    render(
      <ConfirmCardTestPicker.Provider value={() => <div>component picker</div>}>
        <ConfirmCardSkipTest.Provider value={jest.fn()}>
          <ConfirmCard card={newCheck} />
        </ConfirmCardSkipTest.Provider>
      </ConfirmCardTestPicker.Provider>,
    );

    expect(screen.getByText('component picker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip the test' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(
      screen.getByText(
        'Save as draft and Save and publish come after the test.',
      ),
    ).toBeInTheDocument();
  });

  it('offers only to save once the test was skipped', () => {
    render(
      <ConfirmCardTestPicker.Provider value={() => <div>component picker</div>}>
        <ConfirmCardSkipTest.Provider value={jest.fn()}>
          <ConfirmCard card={{ ...newCheck, test_skipped: true }} />
        </ConfirmCardSkipTest.Provider>
      </ConfirmCardTestPicker.Provider>,
    );

    expect(screen.queryByText('component picker')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Save as draft' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the test' })).toBeNull();
  });

  it('offers only to save once the check was tested', () => {
    render(
      <ConfirmCardTestPicker.Provider value={() => <div>component picker</div>}>
        <ConfirmCard card={{ ...newCheck, tested: true }} />
      </ConfirmCardTestPicker.Provider>,
    );

    expect(screen.queryByText(/Test it on a component/)).toBeNull();
    expect(screen.queryByText('component picker')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Save as draft' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save and publish' }),
    ).toBeInTheDocument();
  });

  it('can not be saved once a newer card replaced it', () => {
    render(
      <ConfirmCardTestPicker.Provider value={() => <div>component picker</div>}>
        <ConfirmCard card={newCheck} superseded />
      </ConfirmCardTestPicker.Provider>,
    );

    expect(
      screen.getByText('A newer version of this check is below.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByText('component picker')).toBeNull();
  });

  it('leaves the texts as they are when the box is unticked', async () => {
    render(<ConfirmCard card={edit} />);

    fireEvent.click(screen.getByRole('checkbox'));
    await click('Save as draft');

    expect(holder.confirmChange).toHaveBeenCalledWith(
      'signed-token',
      'draft',
      false,
    );
  });

  it('offers keep-published or unpublish for a published check', () => {
    render(<ConfirmCard card={{ ...edit, status: 'published' }} />);

    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(actionButtons()).toEqual([
      'Save and keep published',
      'Save as draft (unpublish)',
    ]);
    expect(
      screen.getByText('Stops scoring until you publish it again'),
    ).toBeInTheDocument();
  });

  it('shows the kinds a new check applies to', () => {
    render(<ConfirmCard card={{ ...newCheck, applies_to: ['component'] }} />);

    expect(screen.getByText('Applies to: Component')).toBeInTheDocument();
  });

  it('shows a new check with its description, retriever, category and tier', () => {
    render(<ConfirmCard card={newCheck} />);

    expect(screen.getByText('Repo not archived')).toBeInTheDocument();
    expect(screen.getByText('New check')).toBeInTheDocument();
    expect(
      screen.getByText('Fails if the repository is archived'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'githubRepositoryFactRetriever · Reliability · Bronze tier',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('githubIsArchived = false')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(actionButtons()).toEqual(['Save as draft', 'Save and publish']);
  });

  it('shows a nested rule as JSON', () => {
    const nested = JSON.stringify({
      all: [{ any: [{ fact: 'a', operator: 'equal', value: 1 }] }],
    });
    render(<ConfirmCard card={{ ...newCheck, new_rule: nested }} />);

    expect(screen.getByText(nested)).toBeInTheDocument();
  });

  it('copies the rule in the form the Rule field takes', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<ConfirmCard card={edit} />);

    await click('Copy rule');

    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({
      conditions: newRule,
    });
  });

  it('shows the problems and no save buttons for an invalid rule', () => {
    render(
      <ConfirmCard
        card={{
          ...edit,
          valid: false,
          problems: ['No registered fact retriever provides a fact named x.'],
        }}
      />,
    );

    expect(screen.getByText(/can't be saved yet/)).toBeInTheDocument();
    expect(
      screen.getByText(/No registered fact retriever provides a fact named x/),
    ).toBeInTheDocument();
    expect(actionButtons()).toEqual(['Dismiss']);
  });

  it('says plainly when the save worked but publishing did not', async () => {
    holder.confirmChange.mockResolvedValue(
      saved({
        status: 'draft',
        message: 'Saved as a draft, but publishing failed: not allowed.',
      }),
    );
    render(<ConfirmCard card={edit} />);

    await click('Save and publish');

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved as a draft, but publishing failed: not allowed.',
    );
  });

  it('shows the reason when nothing was saved', async () => {
    holder.confirmChange.mockRejectedValue(
      new Error('This confirmation expired. Ask the assistant again.'),
    );
    render(<ConfirmCard card={edit} />);

    await click('Save as draft');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This confirmation expired. Ask the assistant again.',
    );
  });

  it('locks the buttons while saving', async () => {
    holder.confirmChange.mockReturnValue(new Promise(() => {}));
    render(<ConfirmCard card={edit} />);

    await click('Save as draft');

    expect(screen.getByText('Saving…')).toBeInTheDocument();
    for (const name of ['Save as draft', 'Save and publish']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('shows number warnings above the buttons without blocking them', async () => {
    const warning = 'The rule uses 1, but the suggested Name says 2.';
    render(<ConfirmCard card={{ ...edit, warnings: [warning] }} />);

    expect(
      screen.getByRole('note', { name: 'Check before saving' }),
    ).toHaveTextContent(warning);
    await click('Save as draft');
    expect(holder.confirmChange).toHaveBeenCalled();
  });

  it('shows no warning block when there are none', () => {
    render(<ConfirmCard card={edit} />);

    expect(screen.queryByRole('note')).toBeNull();
  });

  it('has no Cancel; a rule that cannot be saved can be dismissed', async () => {
    const { rerender } = render(<ConfirmCard card={edit} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    rerender(<ConfirmCard card={{ ...edit, valid: false }} />);
    await click('Dismiss');

    expect(holder.confirmChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Not saved/)).toBeInTheDocument();
  });
});
