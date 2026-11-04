import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  check,
  mockDynamicChecksApi,
  renderWithApis,
  repoSchema,
} from '../../__testUtils__/testApis';
import { CheckPolicyTable } from './CheckPolicyTable';

const readme = check();
const owner = check({
  id: 'owner',
  name: 'Has an owner',
  description: 'Someone owns it.',
  metadata: { rank: 3, category: 'Ownership' },
  status: 'published',
  problems: [{ code: 'unknown-fact', message: 'ownerFact is not collected.' }],
});

function apiWith(...checks: ReturnType<typeof check>[]) {
  const api = mockDynamicChecksApi();
  api.listChecks.mockResolvedValue(checks);
  return api;
}

describe('CheckPolicyTable', () => {
  it('lists checks by tier with their category and status', async () => {
    await renderWithApis(<CheckPolicyTable />, { api: apiWith(owner, readme) });

    const rows = await screen.findAllByRole('row');
    expect(
      rows.slice(1).map(row => within(row).getAllByRole('cell')[1]),
    ).toEqual([
      expect.objectContaining({ textContent: 'Has a README' }),
      expect.objectContaining({
        textContent: 'Has an ownerSomeone owns it.',
      }),
    ]);
    expect(within(rows[1]).getByText('Bronze')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Draft')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Published')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Problems with check Has an owner'),
    ).toBeInTheDocument();
  });

  it('says when there are no checks yet', async () => {
    await renderWithApis(<CheckPolicyTable />);
    expect(
      await screen.findByText('No checks yet. Create one with "New check".'),
    ).toBeInTheDocument();
  });

  it('filters checks by name', async () => {
    await renderWithApis(<CheckPolicyTable />, { api: apiWith(owner, readme) });
    await screen.findByText('Has a README');

    await userEvent.type(screen.getByLabelText('Search checks'), 'owner');
    expect(screen.queryByText('Has a README')).not.toBeInTheDocument();
    expect(screen.getByText('Has an owner')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search checks'), 'zzz');
    expect(
      screen.getByText('No checks match the current filters.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Has a README')).toBeInTheDocument();
  });

  it('publishes a draft and unpublishes a published check', async () => {
    const onChecksChanged = jest.fn();
    const { api, toastApi } = await renderWithApis(
      <CheckPolicyTable onChecksChanged={onChecksChanged} />,
      { api: apiWith(owner, readme) },
    );

    await userEvent.click(
      await screen.findByLabelText('Publish check Has a README'),
    );
    await waitFor(() =>
      expect(api.publishCheck).toHaveBeenCalledWith('readme'),
    );
    expect(toastApi.post).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Published "Has a README". It now counts towards scores.',
      }),
    );

    await userEvent.click(
      screen.getByLabelText('Unpublish check Has an owner'),
    );
    await waitFor(() =>
      expect(api.unpublishCheck).toHaveBeenCalledWith('owner'),
    );
    expect(onChecksChanged).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(api.listChecks).toHaveBeenCalledTimes(3));
  });

  it('shows why an action failed', async () => {
    const api = apiWith(readme);
    api.publishCheck.mockRejectedValue(new Error('The check has problems.'));
    await renderWithApis(<CheckPolicyTable />, { api });

    await userEvent.click(
      await screen.findByLabelText('Publish check Has a README'),
    );
    expect(
      await screen.findByText('The check has problems.'),
    ).toBeInTheDocument();
  });

  it('deletes a check once confirmed', async () => {
    const { api, toastApi } = await renderWithApis(<CheckPolicyTable />, {
      api: apiWith(readme),
    });

    await userEvent.click(
      await screen.findByLabelText('Delete check Has a README'),
    );
    api.listChecks.mockResolvedValue([]);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(api.deleteCheck).toHaveBeenCalledWith('readme'));
    expect(toastApi.post).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deleted "Has a README".' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Has a README')).not.toBeInTheDocument(),
    );
  });

  it('hands new and edited checks to the host', async () => {
    const onNewCheck = jest.fn();
    const onEditCheck = jest.fn();
    await renderWithApis(
      <CheckPolicyTable onNewCheck={onNewCheck} onEditCheck={onEditCheck} />,
      { api: apiWith(owner, readme) },
    );

    await userEvent.click(await screen.findByText('Has a README'));
    expect(onEditCheck).toHaveBeenCalledWith(
      readme,
      [repoSchema],
      ['Documentation', 'Ownership'],
    );

    await userEvent.click(screen.getByLabelText('Edit check Has an owner'));
    expect(onEditCheck).toHaveBeenLastCalledWith(
      owner,
      [repoSchema],
      ['Documentation', 'Ownership'],
    );

    await userEvent.click(screen.getByRole('button', { name: 'New check' }));
    expect(onNewCheck).toHaveBeenCalledWith(
      [repoSchema],
      ['Documentation', 'Ownership'],
    );
  });

  it('hands a new check the fact schemas once they have loaded', async () => {
    const onNewCheck = jest.fn();
    const api = apiWith(readme);
    let loadSchemas: (schemas: (typeof repoSchema)[]) => void = () => {};
    api.listFactSchemas.mockReturnValue(
      new Promise(resolve => {
        loadSchemas = resolve;
      }),
    );
    await renderWithApis(<CheckPolicyTable onNewCheck={onNewCheck} />, {
      api,
    });

    const newCheck = screen.getByRole('button', { name: 'New check' });
    expect(newCheck).toBeDisabled();
    loadSchemas([repoSchema]);
    await waitFor(() => expect(newCheck).toBeEnabled());
    await userEvent.click(newCheck);
    expect(onNewCheck).toHaveBeenCalledWith([repoSchema], ['Documentation']);
  });

  it('opens its own editor when the host has none', async () => {
    await renderWithApis(<CheckPolicyTable />, { api: apiWith(readme) });

    await userEvent.click(
      await screen.findByLabelText('Edit check Has a README'),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit: Has a README')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Close'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('disables changes without the manage permission', async () => {
    const onEditCheck = jest.fn();
    await renderWithApis(<CheckPolicyTable onEditCheck={onEditCheck} />, {
      api: apiWith(readme),
      canManage: false,
    });

    await userEvent.click(await screen.findByText('Has a README'));
    expect(onEditCheck).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'New check' })).toBeDisabled();
    expect(screen.getByLabelText('Publish check Has a README')).toBeDisabled();
    expect(screen.getByLabelText('Edit check Has a README')).toBeDisabled();
    expect(screen.getByLabelText('Delete check Has a README')).toBeDisabled();
  });

  it('shows the error when checks fail to load', async () => {
    const api = mockDynamicChecksApi();
    api.listChecks.mockRejectedValue(new Error('Backend unavailable'));
    await renderWithApis(<CheckPolicyTable />, { api });
    expect(
      await screen.findByText('Error: Backend unavailable', { selector: 'h6' }),
    ).toBeInTheDocument();
  });

  it('pages long lists', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      check({ id: `c${i}`, name: `Check ${String(i).padStart(2, '0')}` }),
    );
    await renderWithApis(<CheckPolicyTable />, { api: apiWith(...many) });

    expect(await screen.findByText('Check 00')).toBeInTheDocument();
    expect(screen.queryByText('Check 10')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Check 10')).toBeInTheDocument();
  });
});
