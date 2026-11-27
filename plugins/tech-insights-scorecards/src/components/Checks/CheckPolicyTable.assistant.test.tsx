import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { mockCatalogApi } from '../../__testUtils__/testApis';
import {
  checkAuthoringAssistantsApiRef,
  type CheckAuthoringAssistant,
} from '../../api/CheckAuthoringAssistantApi';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DynamicCheck } from '../../api/types';
import { useCheckPermissions } from '../../hooks/useCheckPermissions';
import { CheckPolicyTable } from './CheckPolicyTable';

jest.mock('../../hooks/useCheckPermissions', () => ({
  ...jest.requireActual('../../hooks/useCheckPermissions'),
  useCheckPermissions: jest.fn(),
}));
const useCheckPermissionsMock = useCheckPermissions as jest.MockedFunction<
  typeof useCheckPermissions
>;

const check: DynamicCheck = {
  id: 'c1',
  type: 'json-rules-engine',
  name: 'Default branch protection with pull requests',
  description: "Fails if the repository's default branch is not protected.",
  factIds: ['githubRepositoryFactRetriever'],
  metadata: { category: 'Metadata', rank: 1 },
  rule: { conditions: { all: [] } },
  status: 'published',
};

const dynamicChecksApi = {
  listChecks: jest.fn(async () => [check]),
  listFactSchemas: jest.fn(async () => []),
};

function renderTable(
  assistant?: CheckAuthoringAssistant,
  onNewCheck?: () => void,
  onChecksChanged?: () => void,
) {
  const apis: any[] = [
    [dynamicChecksApiRef, dynamicChecksApi],
    [toastApiRef, { post: jest.fn() }],
    [configApiRef, mockApis.config()],
    // The edit dialog's form lists the catalog's kinds.
    [catalogApiRef, mockCatalogApi()],
  ];
  if (assistant) apis.push([checkAuthoringAssistantsApiRef, { assistant }]);
  return renderInTestApp(
    <TestApiProvider apis={apis as any}>
      <CheckPolicyTable
        onNewCheck={onNewCheck}
        onChecksChanged={onChecksChanged}
      />
    </TestApiProvider>,
  );
}

describe('CheckPolicyTable create check action', () => {
  const createCheck = () =>
    screen.findByRole('button', { name: 'Create check' });

  beforeEach(() => {
    useCheckPermissionsMock.mockReturnValue({
      loading: false,
      canRead: true,
      canManage: true,
    });
  });

  it('opens the form directly without an assistant', async () => {
    const onNewCheck = jest.fn();
    await renderTable(undefined, onNewCheck);

    await userEvent.click(await createCheck());

    expect(onNewCheck).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the form directly when the assistant is turned off', async () => {
    const onNewCheck = jest.fn();
    await renderTable(
      {
        LaunchButton: () => null,
        NewCheckLauncher: ({ children }) => <>{children(undefined)}</>,
      },
      onNewCheck,
    );

    await userEvent.click(await createCheck());

    expect(onNewCheck).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers the form and the assistant when the assistant is on', async () => {
    const onNewCheck = jest.fn();
    const openAssistant = jest.fn();
    await renderTable(
      {
        LaunchButton: () => null,
        NewCheckLauncher: ({ children }) => <>{children(openAssistant)}</>,
      },
      onNewCheck,
    );

    await userEvent.click(await createCheck());
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Generate with AI' }),
    );
    expect(openAssistant).toHaveBeenCalledTimes(1);
    expect(onNewCheck).not.toHaveBeenCalled();

    await userEvent.click(await createCheck());
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Create manually' }),
    );
    expect(onNewCheck).toHaveBeenCalledTimes(1);
  });

  it('tells the page and reloads the list after the assistant saves a check', async () => {
    const onChecksChanged = jest.fn();
    await renderTable(
      {
        LaunchButton: () => null,
        NewCheckLauncher: ({ children, onChecksChanged: saved }) => (
          <>
            {children(jest.fn())}
            <button onClick={saved}>Assistant saved</button>
          </>
        ),
      },
      undefined,
      onChecksChanged,
    );
    await createCheck();
    dynamicChecksApi.listChecks.mockClear();

    await userEvent.click(
      screen.getByRole('button', { name: 'Assistant saved' }),
    );

    expect(onChecksChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(dynamicChecksApi.listChecks).toHaveBeenCalled());
  });

  it('keeps the edit dialog open and shows the check the assistant saved', async () => {
    const onChecksChanged = jest.fn();
    await renderTable(
      {
        LaunchButton: ({ onChecksChanged: saved }) => (
          <button onClick={saved}>Assistant saved</button>
        ),
      },
      undefined,
      onChecksChanged,
    );
    await userEvent.click(
      await screen.findByLabelText(`Edit check ${check.name}`),
    );
    const dialog = await screen.findByRole('dialog');
    const saved = { ...check, name: 'Saved by the assistant' };
    dynamicChecksApi.listChecks.mockImplementation(async () => [saved]);

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Assistant saved' }),
    );

    expect(onChecksChanged).toHaveBeenCalledTimes(1);
    // The form is rebuilt from the saved check, so a later Save keeps it.
    expect(
      await within(dialog).findByDisplayValue('Saved by the assistant'),
    ).toBeInTheDocument();
    // Longer than the dialog's closing transition: it must still be open.
    await expect(
      waitFor(
        () => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        { timeout: 600 },
      ),
    ).rejects.toThrow();
    dynamicChecksApi.listChecks.mockImplementation(async () => [check]);
  });

  it('is disabled for a user who may not manage checks', async () => {
    useCheckPermissionsMock.mockReturnValue({
      loading: false,
      canRead: true,
      canManage: false,
    });
    await renderTable({
      LaunchButton: () => null,
      NewCheckLauncher: ({ children }) => <>{children(jest.fn())}</>,
    });

    expect(await createCheck()).toBeDisabled();
  });
});

describe('CheckPolicyTable row actions', () => {
  it('offers publish, edit and delete, with no separate AI action', async () => {
    useCheckPermissionsMock.mockReturnValue({
      loading: false,
      canRead: true,
      canManage: true,
    });
    await renderTable({ LaunchButton: () => null });
    await screen.findByRole('button', { name: `Edit check ${check.name}` });

    const rowButtons = screen
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
      .filter(label => label?.includes(check.name));
    expect(rowButtons).toEqual([
      `Unpublish check ${check.name}`,
      `Edit check ${check.name}`,
      `Delete check ${check.name}`,
    ]);
  });
});
