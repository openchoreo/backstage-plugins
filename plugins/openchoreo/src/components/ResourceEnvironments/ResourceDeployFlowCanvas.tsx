import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { PipelineDeployCanvas } from '../PipelineDeployCanvas';
import { ResourceMiniEnvironmentNode } from './ResourceMiniEnvironmentNode';
import { ResourceSetupCard } from './ResourceSetupCard';

interface ResourceDeployFlowCanvasProps {
  environments: ResourceEnvironment[];
  selectedEnvName: string | null;
  selectedSetup: boolean;
  onSelectEnv: (envName: string | null) => void;
  onSelectSetup: () => void;
  onClearSelection: () => void;
}

/** Pipeline DAG for a Resource's environments. */
export const ResourceDeployFlowCanvas = (
  props: ResourceDeployFlowCanvasProps,
) => (
  <PipelineDeployCanvas
    {...props}
    testId="resource-deploy-flow-canvas"
    renderSetup={selected => <ResourceSetupCard selected={selected} />}
    renderEnvironment={(env, selected, onSelect) => (
      <ResourceMiniEnvironmentNode
        env={env}
        selected={selected}
        onSelect={onSelect}
      />
    )}
  />
);
