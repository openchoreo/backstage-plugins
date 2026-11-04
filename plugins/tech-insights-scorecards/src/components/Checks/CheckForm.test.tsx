import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiSchema,
  check,
  mockDynamicChecksApi,
  renderWithApis,
  repoSchema,
} from '../../__testUtils__/testApis';
import type { DynamicCheck } from '../../api/types';
import { CheckForm } from './CheckForm';

// Opening the MUI menus and autocompletes takes several seconds per test
// when CI runs every package's tests in parallel.
jest.setTimeout(20_000);

async function renderForm(
  existing: DynamicCheck | null,
  options: Parameters<typeof renderWithApis>[1] = {},
) {
  const onSaved = jest.fn();
  const onPublished = jest.fn();
  const onCancel = jest.fn();
  const rendered = await renderWithApis(
    <CheckForm
      check={existing}
      factSchemas={[repoSchema, apiSchema]}
      existingCategories={['Compliance']}
      onSaved={onSaved}
      onPublished={onPublished}
      onCancel={onCancel}
    />,
    options,
  );
  return { ...rendered, onSaved, onPublished, onCancel };
}

async function pasteInto(label: string, text: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.paste(text);
}

async function fillNewCheck() {
  await pasteInto('Name', 'Has a README');
  await pasteInto('Category', 'Security');
  await userEvent.click(screen.getByLabelText('Fact retrievers'));
  await userEvent.click(
    await screen.findByRole('option', { name: /repoFacts/ }),
  );
  await userEvent.click(screen.getByRole('button', { name: /Maturity tier/ }));
  await userEvent.click(await screen.findByRole('option', { name: 'Gold' }));
}

async function enabledButton(name: string) {
  const button = screen.getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

const draft = check({
  description: 'The repository has a README.',
  metadata: {
    rank: 2,
    category: 'Documentation',
    solution: 'Add a README.md.',
    owner: 'platform',
  },
  links: [{ title: 'Guide', url: 'https://example.com/readme' }],
});

describe('CheckForm', () => {
  it('saves an edited draft, keeping metadata it does not edit', async () => {
    const { api, onSaved } = await renderForm(draft);

    await userEvent.click(await enabledButton('Save draft'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.createCheck).not.toHaveBeenCalled();
    expect(api.updateCheck).toHaveBeenCalledWith('readme', {
      name: 'Has a README',
      description: 'The repository has a README.',
      factIds: ['repoFacts'],
      metadata: {
        owner: 'platform',
        rank: 2,
        category: 'Documentation',
        solution: 'Add a README.md.',
      },
      filter: { kind: 'Component' },
      rule: { conditions: { all: [] } },
      links: [{ title: 'Guide', url: 'https://example.com/readme' }],
      successMetadata: undefined,
      failureMetadata: undefined,
    });
  });

  it('changes the category to one picked from the list', async () => {
    const { api } = await renderForm(draft);

    expect(screen.getByLabelText('Category')).toHaveValue('Documentation');
    await userEvent.clear(screen.getByLabelText('Category'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Compliance' }),
    );
    await userEvent.click(await enabledButton('Save draft'));

    await waitFor(() =>
      expect(api.updateCheck).toHaveBeenCalledWith(
        'readme',
        expect.objectContaining({
          metadata: expect.objectContaining({ category: 'Compliance' }),
        }),
      ),
    );
  });

  it.each([
    ['no categories of its own when none are configured', {}, ['Compliance']],
    [
      'the configured categories',
      { techInsights: { scorecards: { categories: ['Quality'] } } },
      ['Compliance', 'Quality'],
    ],
  ])('suggests %s, and those already in use', async (_name, config, names) => {
    await renderForm(null, { config });

    await userEvent.click(screen.getByLabelText('Category'));
    const options = await screen.findAllByRole('option');
    expect(options.map(option => option.textContent)).toEqual(names);
  });

  it('publishes a draft after saving it', async () => {
    const { api, onPublished } = await renderForm(draft);

    await userEvent.click(await enabledButton('Publish'));

    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(api.updateCheck).toHaveBeenCalled();
    expect(api.publishCheck).toHaveBeenCalledWith('readme');
  });

  it('offers only Save changes on a published check', async () => {
    await renderForm(check({ status: 'published' }));
    expect(
      screen.getByText('Published: saved changes apply to scores immediately.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Publish' }),
    ).not.toBeInTheDocument();
  });

  it('shows why saving failed', async () => {
    const api = mockDynamicChecksApi();
    api.updateCheck.mockRejectedValue(new Error('Name already taken.'));
    await renderForm(draft, { api });

    await userEvent.click(await enabledButton('Save draft'));
    expect(await screen.findByText('Name already taken.')).toBeInTheDocument();
  });

  it('asks for the required fields before saving a new check', async () => {
    const { api } = await renderForm(null);

    await userEvent.click(await enabledButton('Publish'));

    expect(
      screen.getByText(
        'Fix the highlighted fields first: Name, Fact retrievers, Maturity tier.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Give the check a name.')).toBeInTheDocument();
    expect(api.createCheck).not.toHaveBeenCalled();
  });

  it('creates a new check from the filled-in form', async () => {
    const { api, onSaved } = await renderForm(null);

    await fillNewCheck();
    await userEvent.click(await enabledButton('Save as draft'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.createCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Has a README',
        factIds: ['repoFacts'],
        metadata: { rank: 3, category: 'Security' },
        filter: { kind: 'Component' },
        rule: {
          conditions: { all: [{ fact: '', operator: 'equal', value: true }] },
        },
      }),
    );
  });

  it('retries a failed publish on the check it already created', async () => {
    const { api, onPublished } = await renderForm(null);
    api.publishCheck.mockRejectedValueOnce(new Error('Publish failed.'));

    await fillNewCheck();
    await userEvent.click(await enabledButton('Publish'));
    expect(await screen.findByText('Publish failed.')).toBeInTheDocument();

    await userEvent.click(await enabledButton('Publish'));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
    expect(api.createCheck).toHaveBeenCalledTimes(1);
    expect(api.updateCheck).toHaveBeenCalledWith(
      'created',
      expect.objectContaining({ name: 'Has a README' }),
    );
    expect(api.publishCheck).toHaveBeenNthCalledWith(2, 'created');
  });

  it('needs a title and URL on each reference link', async () => {
    const { api } = await renderForm(draft);

    await userEvent.click(screen.getByRole('button', { name: 'Add link' }));
    const titles = screen.getAllByLabelText('Title');
    await userEvent.click(titles[titles.length - 1]);
    await userEvent.paste('Half a link');
    await userEvent.click(await enabledButton('Save draft'));

    expect(
      screen.getByText('Each reference link needs a title and a URL.'),
    ).toBeInTheDocument();
    expect(api.updateCheck).not.toHaveBeenCalled();

    const removes = screen.getAllByLabelText('Remove link');
    await userEvent.click(removes[removes.length - 1]);
    expect(
      screen.queryByText('Each reference link needs a title and a URL.'),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.updateCheck).toHaveBeenCalled());
  });

  it('asks which entity to dry-run against', async () => {
    const { api } = await renderForm(draft);

    await userEvent.click(await enabledButton('Dry run'));

    expect(
      screen.getByText('Pick an entity to dry-run against.'),
    ).toBeInTheDocument();
    expect(api.dryRun).not.toHaveBeenCalled();
  });

  it('dry-runs the check against an entity and shows the result', async () => {
    const api = mockDynamicChecksApi();
    api.dryRun.mockResolvedValue({
      status: 'failed',
      entityRef: 'component:default/api',
      reasons: [],
      collectedAt: {},
    });
    await renderForm(draft, { api });

    await pasteInto('Entity to dry-run against', 'component:default/api');
    await userEvent.click(await enabledButton('Dry run'));

    expect(
      await screen.findByText('Failed for component:default/api'),
    ).toBeInTheDocument();
    expect(api.dryRun).toHaveBeenCalledWith(
      'component:default/api',
      expect.objectContaining({ name: 'Has a README' }),
    );

    await pasteInto('Entity to dry-run against', '-v2');
    expect(
      screen.queryByText('Failed for component:default/api'),
    ).not.toBeInTheDocument();
  });

  it('drops a dry run whose inputs changed while it ran', async () => {
    const api = mockDynamicChecksApi();
    let finish!: () => void;
    api.dryRun.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () =>
            resolve({
              status: 'failed',
              entityRef: 'component:default/api',
              reasons: [],
              collectedAt: {},
            });
        }),
    );
    await renderForm(draft, { api });

    await pasteInto('Entity to dry-run against', 'component:default/api');
    await userEvent.click(await enabledButton('Dry run'));
    await pasteInto('Entity to dry-run against', '-v2');
    finish();

    await enabledButton('Dry run');
    expect(
      screen.queryByText('Failed for component:default/api'),
    ).not.toBeInTheDocument();
  });

  it('shows why a dry run failed', async () => {
    const api = mockDynamicChecksApi();
    api.dryRun.mockRejectedValue(new Error('Entity not found.'));
    await renderForm(draft, { api });

    await pasteInto('Entity to dry-run against', 'component:default/missing');
    await userEvent.click(await enabledButton('Dry run'));
    expect(await screen.findByText('Entity not found.')).toBeInTheDocument();
  });

  it.each([
    ['an array of filters', [{ kind: 'Component' }, { kind: 'API' }]],
    ['an empty kind list', { kind: [] }],
  ])('edits %s as JSON and saves it unchanged', async (_name, filter) => {
    const { api } = await renderForm(check({ filter }));
    expect(
      screen.getByText(/This check's filter uses a form the kind picker/),
    ).toBeInTheDocument();
    expect(screen.getByText('Filter (JSON)')).toBeInTheDocument();

    await userEvent.click(await enabledButton('Save draft'));
    await waitFor(() =>
      expect(api.updateCheck).toHaveBeenCalledWith(
        'readme',
        expect.objectContaining({ filter }),
      ),
    );
  });

  it('refuses a kind key in the criteria, whatever its case', async () => {
    const { api } = await renderForm(check({ filter: { Kind: 'API' } }));

    await userEvent.click(await enabledButton('Save draft'));
    expect(
      (
        await screen.findAllByText(
          'Set kinds with the "Kinds" field, not in these criteria.',
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(api.updateCheck).not.toHaveBeenCalled();
  });

  it('warns about a retriever that does not cover the chosen kinds', async () => {
    await renderForm(check({ factIds: ['apiFacts'] }));
    expect(
      screen.getByText(/apiFacts doesn't collect facts for Component/),
    ).toBeInTheDocument();
  });

  it('judges retriever coverage on the kinds of a raw filter', async () => {
    await renderForm(
      check({
        filter: [{ kind: 'API' }, { kind: 'API', 'spec.type': 'openapi' }],
      }),
    );
    expect(screen.getByText('Filter (JSON)')).toBeInTheDocument();
    expect(
      screen.getByText(/repoFacts doesn't collect facts for API/),
    ).toBeInTheDocument();
  });

  it('saves a check whose stored category is not text', async () => {
    const { api } = await renderForm(
      check({ metadata: { rank: 1, category: 7 } }),
    );

    expect(screen.getByLabelText('Category')).toHaveValue('');
    await userEvent.click(await enabledButton('Save draft'));
    await waitFor(() =>
      expect(api.updateCheck).toHaveBeenCalledWith(
        'readme',
        expect.objectContaining({ metadata: { rank: 1 } }),
      ),
    );
  });

  it('disables saving and dry runs without the manage permission', async () => {
    const { onCancel } = await renderForm(draft, { canManage: false });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dry run' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
