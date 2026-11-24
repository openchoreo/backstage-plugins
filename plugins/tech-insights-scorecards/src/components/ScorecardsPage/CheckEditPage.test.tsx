import { act, screen } from '@testing-library/react';
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
import { CheckEditPage } from './CheckEditPage';

// Shows the check the form was built from; mounts counts rebuilds.
const mounts = jest.fn();
jest.mock('../Checks/CheckForm', () => {
  const { useState } = jest.requireActual('react');
  return {
    CheckForm: (props: { check: { description?: string } | null }) => {
      const [description] = useState(() => {
        mounts();
        return props.check?.description;
      });
      return <div data-testid="form">{description}</div>;
    },
  };
});

const check: DynamicCheck = {
  id: 'c1',
  type: 'json-rules-engine',
  name: 'Repo is active',
  description: 'Before the assistant',
  factIds: [],
  metadata: {},
  rule: { conditions: { all: [] } },
};

const LaunchButton = jest.fn((_props: { onChecksChanged?: () => void }) => (
  <button type="button">Edit with AI</button>
));

const listChecks = jest.fn();
const toastPost = jest.fn();

function renderPage(
  pageCheck: DynamicCheck | null,
  onChecksChanged?: () => void,
) {
  const assistant = { LaunchButton } as unknown as CheckAuthoringAssistantApi;
  return renderInTestApp(
    <TestApiProvider
      apis={
        [
          [dynamicChecksApiRef, { listChecks }],
          [toastApiRef, { post: toastPost }],
          [configApiRef, mockApis.config()],
          [checkAuthoringAssistantApiRef, assistant],
        ] as any
      }
    >
      <CheckEditPage
        check={pageCheck}
        factSchemas={[]}
        existingCategories={[]}
        onBack={jest.fn()}
        onSaved={jest.fn()}
        onPublished={jest.fn()}
        onChecksChanged={onChecksChanged}
      />
    </TestApiProvider>,
  );
}

const assistantSaved = () =>
  act(async () => {
    await LaunchButton.mock.calls[0][0].onChecksChanged?.();
  });

describe('CheckEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the assistant button in the header, above the form', async () => {
    await renderPage(check);

    const button = screen.getByRole('button', { name: 'Edit with AI' });
    expect(
      button.compareDocumentPosition(screen.getByTestId('form')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(button.parentElement?.previousElementSibling).toHaveTextContent(
      'Edit check: Repo is active',
    );
  });

  it('shows no assistant button for a new check', async () => {
    await renderPage(null);

    expect(
      screen.queryByRole('button', { name: 'Edit with AI' }),
    ).not.toBeInTheDocument();
  });

  it('rebuilds the form with what the assistant saved', async () => {
    listChecks.mockResolvedValue([
      { ...check, description: 'After the assistant' },
    ]);
    const onChecksChanged = jest.fn();
    await renderPage(check, onChecksChanged);
    expect(screen.getByTestId('form')).toHaveTextContent(
      'Before the assistant',
    );

    await assistantSaved();

    expect(screen.getByTestId('form')).toHaveTextContent('After the assistant');
    expect(mounts).toHaveBeenCalledTimes(2);
    expect(onChecksChanged).toHaveBeenCalledTimes(1);
  });

  it('warns when the saved check could not be reloaded', async () => {
    listChecks.mockRejectedValue(new Error('offline'));
    await renderPage(check);

    await assistantSaved();

    expect(toastPost).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'danger',
        title: expect.stringContaining('offline'),
      }),
    );
    expect(screen.getByTestId('form')).toHaveTextContent(
      'Before the assistant',
    );
  });
});
