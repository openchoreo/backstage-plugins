import { PipelineCanvas } from './PipelineDAG';

/**
 * Entry point for the Deploy tab on the Component entity. Renders the
 * minimap canvas + detail-panel split view; the canvas handles
 * environments with and without promotion paths uniformly via the
 * synthetic setup root in `buildEnvPipelineNodes`.
 */
export const EnvironmentsList = () => <PipelineCanvas />;
