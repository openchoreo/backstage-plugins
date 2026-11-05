import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { ConfigReader } from '@backstage/config';
import { configApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { openChoreoFetchApiRef } from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { GitSourceField } from './GitSourceField';

// GitSecretDialog's TextFields don't pass an explicit `id`, so MUI v4 never
// wires the `<label>`'s `htmlFor` to the input's `id` — `getByLabelText`
// can't associate them. Walk from the label text to its FormControl instead.
function getFieldByLabel(label: string): HTMLElement {
  const labelEl = Array.from(document.querySelectorAll('label')).find(el =>
    el.textContent?.includes(label),
  );
  if (!labelEl) {
    throw new Error(`Could not find a label containing: ${label}`);
  }
  const field = labelEl
    .closest('.MuiFormControl-root')
    ?.querySelector('input, textarea');
  if (!field) {
    throw new Error(`Could not find an input/textarea for label: ${label}`);
  }
  return field as HTMLElement;
}

const getEntities = jest.fn();
const getBaseUrl = jest.fn();
const fetchMock = jest.fn();

const workflowEntity = {
  metadata: {
    name: 'build-workflow',
    annotations: {
      [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF]: 'wp-default',
      [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND]: 'WorkflowPlane',
    },
  },
};

function renderField(onChange = jest.fn()) {
  return renderInTestApp(
    <TestApiProvider
      apis={[
        [
          configApiRef,
          new ConfigReader({
            openchoreo: { features: { secretManagement: { enabled: true } } },
          }),
        ],
        [discoveryApiRef, { getBaseUrl }],
        [catalogApiRef, { getEntities }],
        [openChoreoFetchApiRef, { fetch: fetchMock }],
      ]}
    >
      <GitSourceField
        onChange={onChange}
        formData={{
          repo_url: '',
          branch: 'main',
          component_path: '.',
          git_secret_ref: '',
        }}
        formContext={{
          formData: {
            buildAndDeploy: {
              workflow_name: { kind: 'Workflow', name: 'build-workflow' },
            },
            namespace_name: 'ns1',
          },
        }}
        uiSchema={{}}
        rawErrors={[]}
        schema={{}}
        required={false}
        idSchema={{ $id: 'root' }}
        name="git_source"
        onBlur={jest.fn()}
        onFocus={jest.fn()}
        disabled={false}
        readonly={false}
        registry={{} as any}
      />
    </TestApiProvider>,
  );
}

describe('GitSourceField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getBaseUrl.mockResolvedValue('http://localhost/api/openchoreo');
    getEntities.mockResolvedValue({ items: [workflowEntity] });
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (!init || init.method === undefined) {
        return { ok: true, json: async () => ({ items: [] }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ name: 'new-secret' }),
      } as Response;
    });
  });

  it('submits a github-app secret as an Opaque secret through the generic secrets endpoint', async () => {
    renderField();

    const secretInput = await screen.findByLabelText('Git Secret');
    await userEvent.click(secretInput);
    const createOption = await screen.findByText('Create New Git Secret');
    await userEvent.click(createOption);

    await screen.findByText('Create Git Secret');
    await userEvent.type(getFieldByLabel('Secret Name'), 'app-secret');
    await userEvent.click(screen.getByLabelText('GitHub App'));

    await userEvent.type(getFieldByLabel('App ID'), '123456');
    await userEvent.type(getFieldByLabel('Installation ID'), '987654');
    await userEvent.type(
      getFieldByLabel('Private Key'),
      '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        call => call[1]?.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string);
      expect(body.secretType).toBe('Opaque');
      expect(body.data).toEqual({
        'app-id': '123456',
        'installation-id': '987654',
        'private-key':
          '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
      });
      expect(body.targetPlane).toEqual({
        kind: 'WorkflowPlane',
        name: 'wp-default',
      });
    });
  });
});
