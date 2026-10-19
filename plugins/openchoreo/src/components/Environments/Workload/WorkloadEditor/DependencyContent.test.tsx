import { useState } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef, EntityProvider } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  type Dependency,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import { DependencyContent } from './DependencyContent';

jest.mock('../WorkloadContext', () => ({
  useWorkloadContext: () => ({ setEditingSection: jest.fn() }),
}));

const NS = 'test-ns';
const PROJECT = 'shop';

function component(name: string, annotations: Record<string, string> = {}) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'default',
      labels: { 'openchoreo.io/managed': 'true' },
      annotations: {
        [CHOREO_ANNOTATIONS.NAMESPACE]: NS,
        [CHOREO_ANNOTATIONS.PROJECT]: PROJECT,
        ...annotations,
      },
    },
  } as Entity;
}

function releaseLine(componentName: string, line: string) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ReleaseLine',
    metadata: {
      name: line,
      namespace: 'default',
      annotations: {
        [CHOREO_ANNOTATIONS.NAMESPACE]: NS,
        [CHOREO_ANNOTATIONS.PROJECT]: PROJECT,
        [CHOREO_ANNOTATIONS.COMPONENT]: componentName,
        [CHOREO_ANNOTATIONS.RELEASE_LINE]: line,
      },
    },
  } as Entity;
}

const consumer = component('frontend');
const entities = [
  consumer,
  component('orders', { [CHOREO_ANNOTATIONS.RELEASE_LINES_ENABLED]: 'true' }),
  component('payments'),
  releaseLine('orders', 'v1'),
  releaseLine('orders', 'v2'),
  releaseLine('payments-legacy', 'v9'),
];

const Harness = ({ onReplace }: { onReplace: jest.Mock }) => {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  return (
    <DependencyContent
      dependencies={dependencies}
      onAddDependency={() => {
        setDependencies(prev => [
          ...prev,
          { component: '', name: '', visibility: 'project' },
        ]);
        return dependencies.length;
      }}
      onDependencyReplace={(index, dependency) => {
        onReplace(dependency);
        setDependencies(prev =>
          prev.map((d, i) => (i === index ? dependency : d)),
        );
      }}
      onRemoveDependency={index =>
        setDependencies(prev => prev.filter((_, i) => i !== index))
      }
      disabled={false}
    />
  );
};

const httpEndpoint = { type: 'HTTP', port: 80, visibility: ['project'] };

async function renderContent() {
  const onReplace = jest.fn();
  const fetchWorkloadInfo = jest.fn(async (_entity: Entity, line?: string) => ({
    spec: {
      endpoints:
        line === 'v2'
          ? { http: httpEndpoint, grpc: { ...httpEndpoint, type: 'gRPC' } }
          : { http: httpEndpoint },
    },
  }));
  const client = { fetchWorkloadInfo, fetchResourceTypeOutputs: jest.fn() };
  await renderInTestApp(
    <TestApiProvider
      apis={[
        [catalogApiRef, { getEntities: async () => ({ items: entities }) }],
        [openChoreoClientApiRef, client as any],
      ]}
    >
      <EntityProvider entity={consumer}>
        <Harness onReplace={onReplace} />
      </EntityProvider>
    </TestApiProvider>,
  );
  return { onReplace, fetchWorkloadInfo };
}

function pick(label: RegExp, option: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(within(screen.getByRole('listbox')).getByText(option));
}

const enabled = (label: RegExp) =>
  waitFor(() =>
    expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-disabled'),
  );

const saveButton = () => screen.getByRole('button', { name: 'Save changes' });

async function selectComponent(target: string) {
  fireEvent.click(
    screen.getByRole('button', { name: /Add Component Dependency/ }),
  );
  await enabled(/^Component/);
  pick(/^Component/, target);
}

async function selectEndpoint(endpoint: string) {
  await enabled(/^Endpoint/);
  pick(/^Endpoint/, endpoint);
  await enabled(/^Visibility/);
  pick(/^Visibility/, 'Project');
}

describe('DependencyContent release lines', () => {
  it("requires a release line and lists that line's endpoints", async () => {
    const { onReplace, fetchWorkloadInfo } = await renderContent();
    await selectComponent('orders');

    expect(screen.getByLabelText(/^Endpoint/)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(saveButton()).toBeDisabled();

    fireEvent.mouseDown(screen.getByLabelText(/Release line/));
    const options = within(screen.getByRole('listbox'));
    expect(options.getByText('v1')).toBeInTheDocument();
    expect(options.queryByText('v9')).not.toBeInTheDocument();
    fireEvent.click(options.getByText('v2'));

    await selectEndpoint('grpc');
    expect(fetchWorkloadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ name: 'orders' }),
      }),
      'v2',
    );

    fireEvent.click(saveButton());
    expect(onReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'orders',
        releaseLine: 'v2',
        name: 'grpc',
      }),
    );
    expect(screen.getByText('Release line: v2')).toBeInTheDocument();
  });

  it('leaves dependencies on other components unchanged', async () => {
    const { onReplace, fetchWorkloadInfo } = await renderContent();
    await selectComponent('payments');

    expect(screen.queryByLabelText(/Release line/)).not.toBeInTheDocument();
    await selectEndpoint('http');
    fireEvent.click(saveButton());

    expect(fetchWorkloadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ name: 'payments' }),
      }),
      undefined,
    );
    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onReplace.mock.calls[0][0]).not.toHaveProperty('releaseLine');
  });
});
