import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import {
  checkAuthoringAssistantApiRef,
  type CheckAuthoringAssistantApi,
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
  assistant?: CheckAuthoringAssistantApi,
  onNewCheck?: () => void,
) {
  const apis: any[] = [
    [dynamicChecksApiRef, dynamicChecksApi],
    [toastApiRef, { post: jest.fn() }],
    [configApiRef, mockApis.config()],
  ];
  if (assistant) apis.push([checkAuthoringAssistantApiRef, assistant]);
  return renderInTestApp(
    <TestApiProvider apis={apis as any}>
      <CheckPolicyTable onNewCheck={onNewCheck} />
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
