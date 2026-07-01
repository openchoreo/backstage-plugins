import { Fragment } from 'react';
import { Button, Box, Typography, Divider } from '@material-ui/core';
import { StructuredMetadataTable } from '@backstage/core-components';
import {
  ReviewState,
  type ReviewStateProps,
} from '@backstage/plugin-scaffolder-react/alpha';
import { type ReviewStepProps } from '@backstage/plugin-scaffolder-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';
import { useStyles } from './styles';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Extract the readable name from a Backstage entity ref.
 * "domain:default/team-beta" → "team-beta"
 * "system:default/my-project" → "my-project"
 *
 * Arbitrary strings — file paths like "./Dockerfile", URLs like
 * "https://example.com", build args, etc. — pass through unchanged so
 * flattenToMetadata doesn't mangle user-typed workflow parameter values.
 *
 * Implementation: only strings with a "kind:" prefix are even considered,
 * and the canonical `parseEntityRef` is the source of truth for whether
 * a string is a valid ref. Any parse failure falls back to the original.
 */
function extractName(ref: string): string {
  if (!ref || typeof ref !== 'string') return String(ref ?? '');
  // Without a `:`, it can't be a `kind:...` ref — skip parsing.
  if (!ref.includes(':')) return ref;
  try {
    return parseEntityRef(ref).name;
  } catch {
    return ref;
  }
}

/**
 * Recursively flatten any value into a Record<string, string> for StructuredMetadataTable.
 * - Primitives → single entry under `prefix`
 * - Objects → recurse with "Prefix > Key" labels
 * - Arrays of objects → recurse with "Prefix #1", "Prefix #2" labels
 * - Arrays of primitives → join as comma-separated string
 * - Skip keys in `skip` set, apply extractName to strings
 */
function flattenToMetadata(
  data: unknown,
  prefix: string,
  result: Record<string, string>,
  skip?: Set<string>,
): void {
  if (data === undefined || data === null || data === '') return;

  if (typeof data === 'boolean') {
    result[prefix] = data ? 'Yes' : 'No';
  } else if (typeof data === 'string') {
    result[prefix] = extractName(data);
  } else if (typeof data === 'number') {
    result[prefix] = String(data);
  } else if (Array.isArray(data)) {
    if (data.length === 0) return;
    if (typeof data[0] === 'object' && data[0] !== null) {
      // Detect key-value pair arrays: [{name/key: "x", value: "y"}, ...]
      const firstObj = data[0] as Record<string, unknown>;
      let nameKey: 'name' | 'key' | undefined;
      if ('name' in firstObj) nameKey = 'name';
      else if ('key' in firstObj) nameKey = 'key';
      if (nameKey && 'value' in firstObj && Object.keys(firstObj).length <= 2) {
        for (const item of data) {
          const obj = item as Record<string, unknown>;
          const itemName = String(obj[nameKey] ?? '');
          const label = prefix ? `${prefix} > ${itemName}` : itemName;
          result[label] =
            obj.value !== null && obj.value !== undefined
              ? String(obj.value)
              : '';
        }
      } else {
        data.forEach((item, i) => {
          flattenToMetadata(item, `${prefix} #${i + 1}`, result, skip);
        });
      }
    } else {
      result[prefix] = data
        .map(v => (typeof v === 'string' ? extractName(v) : String(v)))
        .join(', ');
    }
  } else if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (
      'name' in obj &&
      typeof obj.name === 'string' &&
      Object.keys(obj).length <= 2
    ) {
      result[prefix] = obj.name;
      return;
    }
    for (const [key, val] of Object.entries(obj)) {
      if (skip?.has(key)) continue;
      const label = prefix
        ? `${prefix} > ${sanitizeLabel(key)}`
        : sanitizeLabel(key);
      flattenToMetadata(val, label, result, skip);
    }
  }
}

// ---------------------------------------------------------------------------
// DeploymentPipelineReview
// ---------------------------------------------------------------------------

function DeploymentPipelineReview({ data }: { data: Record<string, unknown> }) {
  const classes = useStyles();
  const config = (data.deploymentPipelineConfig ?? data) as Record<
    string,
    unknown
  >;
  const promotionPaths = config.promotionPaths as
    | Array<{
        sourceEnvironmentRef?: { name: string };
        targetEnvironmentRefs?: Array<{ name: string }>;
      }>
    | undefined;

  const metadata: Record<string, string> = {};
  flattenToMetadata(config, '', metadata, new Set(['promotionPaths']));

  return (
    <>
      <Typography className={classes.sectionTitle}>Pipeline Details</Typography>
      <StructuredMetadataTable metadata={metadata} />

      {promotionPaths && promotionPaths.length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Promotion Paths
          </Typography>
          {promotionPaths.map((path, idx) => {
            const source = path.sourceEnvironmentRef?.name ?? 'unknown';
            const targets = (path.targetEnvironmentRefs ?? []).map(t => t.name);
            const envChain = [source, ...targets];
            return (
              <Box key={idx} className={classes.promotionPathRow}>
                {envChain.map((env, i) => (
                  <Fragment key={i}>
                    <Box className={classes.envBox}>{env}</Box>
                    {i < envChain.length - 1 && (
                      <Typography className={classes.arrow}>&rarr;</Typography>
                    )}
                  </Fragment>
                ))}
              </Box>
            );
          })}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// EnvironmentReview
// ---------------------------------------------------------------------------

function EnvironmentReview({ data }: { data: Record<string, unknown> }) {
  const classes = useStyles();
  const config = (data.environmentConfig ?? data) as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  flattenToMetadata(config, '', metadata);

  return (
    <>
      <Typography className={classes.sectionTitle}>
        Environment Details
      </Typography>
      <StructuredMetadataTable metadata={metadata} />
    </>
  );
}

// ---------------------------------------------------------------------------
// NotificationChannelReview
// ---------------------------------------------------------------------------

function NotificationChannelReview({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const classes = useStyles();
  const config = (data.channelConfig ?? data) as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  flattenToMetadata(config, '', metadata);

  return (
    <>
      <Typography className={classes.sectionTitle}>
        Notification Channel Details
      </Typography>
      <StructuredMetadataTable metadata={metadata} />
    </>
  );
}

// ---------------------------------------------------------------------------
// ComponentReview
// ---------------------------------------------------------------------------

const COMPONENT_INTERNAL_FIELDS = new Set([
  'isEditing',
  'schema',
  'uiSchema',
  'id',
]);

/** Set a key on a metadata record — avoids ESLint dot-notation false positives. */
function setMeta(record: Record<string, string>, label: string, value: string) {
  // eslint-disable-next-line no-param-reassign
  record[label] = value;
}

function ComponentReview({ data }: { data: Record<string, unknown> }) {
  const classes = useStyles();

  // Section: Component Metadata
  const projectNs = data.project_namespace as
    | { project_name?: string; namespace_name?: string }
    | undefined;
  const componentMeta: Record<string, string> = {};
  if (projectNs?.project_name) {
    setMeta(componentMeta, 'Project', extractName(projectNs.project_name));
  }
  if (projectNs?.namespace_name) {
    setMeta(componentMeta, 'Namespace', extractName(projectNs.namespace_name));
  }
  if (data.component_name) {
    setMeta(componentMeta, 'Component Name', String(data.component_name));
  }
  if (data.displayName) {
    setMeta(componentMeta, 'Display Name', String(data.displayName));
  }
  if (data.description) {
    setMeta(componentMeta, 'Description', String(data.description));
  }

  // Section: Build & Deploy — values live under data.buildAndDeploy after the
  // BuildAndDeployField composite restructure.
  const buildAndDeploy = (data.buildAndDeploy ?? {}) as Record<string, unknown>;
  const buildMeta: Record<string, string> = {};
  if (buildAndDeploy.deploymentSource) {
    setMeta(
      buildMeta,
      'Deployment Source',
      sanitizeLabel(String(buildAndDeploy.deploymentSource)),
    );
  }

  const workflow = buildAndDeploy.workflow_name as
    | { kind?: string; name?: string }
    | undefined;
  if (workflow?.name) {
    setMeta(buildMeta, 'Workflow', workflow.name);
    if (workflow.kind) {
      setMeta(buildMeta, 'Workflow Kind', workflow.kind);
    }
  }

  const gitSource = buildAndDeploy.git_source as
    | Record<string, unknown>
    | undefined;
  if (gitSource) {
    if (gitSource.repo_url)
      setMeta(buildMeta, 'Repository URL', String(gitSource.repo_url));
    if (gitSource.branch)
      setMeta(buildMeta, 'Branch', String(gitSource.branch));
    if (gitSource.component_path)
      setMeta(buildMeta, 'Component Path', String(gitSource.component_path));
    if (gitSource.git_secret_ref)
      setMeta(buildMeta, 'Git Secret', String(gitSource.git_secret_ref));
  }

  if (buildAndDeploy.containerImage) {
    setMeta(
      buildMeta,
      'Container Image',
      String(buildAndDeploy.containerImage),
    );
  }
  if (buildAndDeploy.autoDeploy !== undefined) {
    setMeta(buildMeta, 'Auto Deploy', buildAndDeploy.autoDeploy ? 'Yes' : 'No');
  }
  if (buildAndDeploy.ciPlatform) {
    setMeta(buildMeta, 'CI Platform', String(buildAndDeploy.ciPlatform));
  }
  if (buildAndDeploy.ciIdentifier) {
    setMeta(buildMeta, 'CI Identifier', String(buildAndDeploy.ciIdentifier));
  }

  // Section: Workflow Parameters — split key-value arrays into own sub-sections
  const workflowParams = buildAndDeploy.workflow_parameters as
    | { parameters?: Record<string, unknown>; schema?: unknown }
    | undefined;
  let workflowScalarMeta: Record<string, string> | undefined;
  let workflowKvSections:
    | Array<{ label: string; meta: Record<string, string> }>
    | undefined;

  if (
    workflowParams?.parameters &&
    Object.keys(workflowParams.parameters).length > 0
  ) {
    for (const [paramKey, paramVal] of Object.entries(
      workflowParams.parameters,
    )) {
      if (paramKey === 'schema') continue;

      // Detect key-value pair arrays: [{name/key: "x", value: "y"}, ...]
      if (
        Array.isArray(paramVal) &&
        paramVal.length > 0 &&
        typeof paramVal[0] === 'object' &&
        paramVal[0] !== null
      ) {
        const firstObj = paramVal[0] as Record<string, unknown>;
        let nameField: 'name' | 'key' | undefined;
        if ('name' in firstObj) nameField = 'name';
        else if ('key' in firstObj) nameField = 'key';
        if (
          nameField &&
          'value' in firstObj &&
          Object.keys(firstObj).length <= 2
        ) {
          const meta: Record<string, string> = {};
          for (const item of paramVal) {
            const obj = item as Record<string, unknown>;
            const itemName = String(obj[nameField] ?? '');
            meta[itemName] =
              obj.value !== null && obj.value !== undefined
                ? String(obj.value)
                : '';
          }
          if (Object.keys(meta).length > 0) {
            if (!workflowKvSections) workflowKvSections = [];
            workflowKvSections.push({
              label: sanitizeLabel(paramKey),
              meta,
            });
          }
          continue;
        }
      }

      // Everything else → general workflow params
      if (!workflowScalarMeta) workflowScalarMeta = {};
      flattenToMetadata(
        paramVal,
        sanitizeLabel(paramKey),
        workflowScalarMeta,
        new Set(['schema']),
      );
    }
  }

  // Section: Workload Details
  const workload = data.workloadDetails as
    | {
        ctdParameters?: Record<string, unknown>;
        endpoints?: Record<string, unknown>;
        envVars?: Array<{ key: string; value?: string }>;
        fileMounts?: Array<{ key: string; mountPath: string }>;
        traits?: Array<Record<string, unknown>>;
        isEditing?: boolean;
      }
    | undefined;

  // CTD parameters
  let ctdParamsMeta: Record<string, string> | undefined;
  if (
    workload?.ctdParameters &&
    Object.keys(workload.ctdParameters).length > 0
  ) {
    ctdParamsMeta = {};
    flattenToMetadata(
      workload.ctdParameters,
      '',
      ctdParamsMeta,
      COMPONENT_INTERNAL_FIELDS,
    );
  }

  // Endpoints
  let endpointsMeta: Record<string, string> | undefined;
  if (workload?.endpoints && Object.keys(workload.endpoints).length > 0) {
    endpointsMeta = {};
    for (const [name, ep] of Object.entries(workload.endpoints)) {
      const endpoint = ep as {
        type?: string;
        port?: number;
        visibility?: string[];
      };
      const parts = [endpoint.type, endpoint.port && `port ${endpoint.port}`]
        .filter(Boolean)
        .join(', ');
      const vis = endpoint.visibility?.join(', ');
      endpointsMeta[name] = vis ? `${parts} (${vis})` : parts;
    }
  }

  // Environment variables
  let envVarsMeta: Record<string, string> | undefined;
  if (workload?.envVars && workload.envVars.length > 0) {
    envVarsMeta = {};
    for (const ev of workload.envVars) {
      envVarsMeta[ev.key] = ev.value ?? '(from secret)';
    }
  }

  // File mounts
  let fileMountsMeta: Record<string, string> | undefined;
  if (workload?.fileMounts && workload.fileMounts.length > 0) {
    fileMountsMeta = {};
    for (const fm of workload.fileMounts) {
      fileMountsMeta[fm.key] = fm.mountPath;
    }
  }

  // Traits
  let traitsMeta: Record<string, string> | undefined;
  if (workload?.traits && workload.traits.length > 0) {
    traitsMeta = {};
    for (const trait of workload.traits) {
      const name = String(trait.instanceName ?? trait.name ?? 'trait');
      const traitType = String(trait.name ?? '');
      const traitConfig = trait.config as Record<string, unknown> | undefined;
      let configSummary = traitType;
      if (traitConfig && Object.keys(traitConfig).length > 0) {
        const configMeta: Record<string, string> = {};
        flattenToMetadata(
          traitConfig,
          '',
          configMeta,
          COMPONENT_INTERNAL_FIELDS,
        );
        if (Object.keys(configMeta).length > 0) {
          const parts = Object.entries(configMeta).map(
            ([k, v]) => `${k}: ${v}`,
          );
          configSummary = `${traitType} (${parts.join(', ')})`;
        }
      }
      traitsMeta[name] = configSummary;
    }
  }

  return (
    <>
      {Object.keys(componentMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Component Metadata
          </Typography>
          <StructuredMetadataTable metadata={componentMeta} />
        </>
      )}

      {Object.keys(buildMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Build &amp; Deploy
          </Typography>
          <StructuredMetadataTable metadata={buildMeta} />
        </>
      )}

      {workflowScalarMeta && Object.keys(workflowScalarMeta).length > 0 && (
        <>
          <Typography className={classes.subsectionTitle}>
            Workflow Parameters
          </Typography>
          <StructuredMetadataTable metadata={workflowScalarMeta} />
        </>
      )}
      {workflowKvSections?.map(({ label, meta }) => (
        <Fragment key={label}>
          <Typography className={classes.subsectionTitle}>{label}</Typography>
          <StructuredMetadataTable metadata={meta} />
        </Fragment>
      ))}

      {(ctdParamsMeta ||
        endpointsMeta ||
        envVarsMeta ||
        fileMountsMeta ||
        traitsMeta) && (
        <>
          <Typography className={classes.sectionTitle}>
            Workload Details
          </Typography>

          {ctdParamsMeta && Object.keys(ctdParamsMeta).length > 0 && (
            <>
              <Typography className={classes.subsectionTitle}>
                Parameters
              </Typography>
              <StructuredMetadataTable metadata={ctdParamsMeta} />
            </>
          )}

          {endpointsMeta && Object.keys(endpointsMeta).length > 0 && (
            <>
              <Typography className={classes.subsectionTitle}>
                Endpoints
              </Typography>
              <StructuredMetadataTable metadata={endpointsMeta} />
            </>
          )}

          {envVarsMeta && Object.keys(envVarsMeta).length > 0 && (
            <>
              <Typography className={classes.subsectionTitle}>
                Environment Variables
              </Typography>
              <StructuredMetadataTable metadata={envVarsMeta} />
            </>
          )}

          {fileMountsMeta && Object.keys(fileMountsMeta).length > 0 && (
            <>
              <Typography className={classes.subsectionTitle}>
                File Mounts
              </Typography>
              <StructuredMetadataTable metadata={fileMountsMeta} />
            </>
          )}

          {traitsMeta && Object.keys(traitsMeta).length > 0 && (
            <>
              <Typography className={classes.subsectionTitle}>
                Traits
              </Typography>
              <StructuredMetadataTable metadata={traitsMeta} />
            </>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ResourceReview
// ---------------------------------------------------------------------------

function ResourceReview({ data }: { data: Record<string, unknown> }) {
  const classes = useStyles();

  // Section: Resource Metadata
  const projectNs = data.project_namespace as
    | { project_name?: string; namespace_name?: string }
    | undefined;
  const resourceMeta: Record<string, string> = {};
  if (projectNs?.project_name) {
    setMeta(resourceMeta, 'Project', extractName(projectNs.project_name));
  }
  if (projectNs?.namespace_name) {
    setMeta(resourceMeta, 'Namespace', extractName(projectNs.namespace_name));
  }
  if (data.resource_name) {
    setMeta(resourceMeta, 'Resource Name', String(data.resource_name));
  }
  if (data.displayName) {
    setMeta(resourceMeta, 'Display Name', String(data.displayName));
  }
  if (data.description) {
    setMeta(resourceMeta, 'Description', String(data.description));
  }

  // Section: Parameters — the per-type schema-driven form values flattened
  // to label/value rows. Empty/missing fields are dropped by flattenToMetadata.
  let parametersMeta: Record<string, string> | undefined;
  const parameters = data.parameters as Record<string, unknown> | undefined;
  if (parameters && Object.keys(parameters).length > 0) {
    parametersMeta = {};
    flattenToMetadata(parameters, '', parametersMeta);
  }

  return (
    <>
      {Object.keys(resourceMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Resource Metadata
          </Typography>
          <StructuredMetadataTable metadata={resourceMeta} />
        </>
      )}

      {parametersMeta && Object.keys(parametersMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>Parameters</Typography>
          <StructuredMetadataTable metadata={parametersMeta} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ProjectReview
// ---------------------------------------------------------------------------

function ProjectReview({ data }: { data: Record<string, unknown> }) {
  const classes = useStyles();

  // Section: Project Metadata
  const projectMeta: Record<string, string> = {};
  if (data.namespace_name) {
    setMeta(projectMeta, 'Namespace', extractName(String(data.namespace_name)));
  }
  if (data.project_name) {
    setMeta(projectMeta, 'Project Name', String(data.project_name));
  }
  if (data.displayName) {
    setMeta(projectMeta, 'Display Name', String(data.displayName));
  }
  if (data.description) {
    setMeta(projectMeta, 'Description', String(data.description));
  }
  if (data.deployment_pipeline) {
    setMeta(
      projectMeta,
      'Deployment Pipeline',
      String(data.deployment_pipeline),
    );
  }

  // Section: Parameters — the per-type schema-driven form values flattened
  // to label/value rows. Empty/missing fields are dropped by flattenToMetadata.
  let parametersMeta: Record<string, string> | undefined;
  const parameters = data.parameters as Record<string, unknown> | undefined;
  if (parameters && Object.keys(parameters).length > 0) {
    parametersMeta = {};
    flattenToMetadata(parameters, '', parametersMeta);
  }

  return (
    <>
      {Object.keys(projectMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>
            Project Metadata
          </Typography>
          <StructuredMetadataTable metadata={projectMeta} />
        </>
      )}

      {parametersMeta && Object.keys(parametersMeta).length > 0 && (
        <>
          <Typography className={classes.sectionTitle}>Parameters</Typography>
          <StructuredMetadataTable metadata={parametersMeta} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DefaultReview (fallback using Backstage ReviewState)
// ---------------------------------------------------------------------------

function DefaultReview({
  formData,
  steps,
}: {
  formData: Record<string, unknown>;
  steps: ReviewStepProps['steps'];
}) {
  const schemas = steps.map(step => ({
    uiSchema: step.uiSchema,
    mergedSchema: step.mergedSchema,
    schema: step.schema,
  }));

  return (
    <ReviewState
      schemas={schemas as ReviewStateProps['schemas']}
      formState={formData as ReviewStateProps['formState']}
    />
  );
}

// ---------------------------------------------------------------------------
// Template type detection
// ---------------------------------------------------------------------------

function detectTemplateType(
  formData: Record<string, unknown>,
):
  | 'deployment-pipeline'
  | 'environment'
  | 'notification-channel'
  | 'component'
  | 'resource'
  | 'project'
  | 'default' {
  if ('deploymentPipelineConfig' in formData) return 'deployment-pipeline';
  if ('environmentConfig' in formData) return 'environment';
  if ('channelConfig' in formData) return 'notification-channel';
  if ('workloadDetails' in formData) return 'component';
  // Per-type Resource templates emit `resource_name` at the top level
  // (vs Component's `component_name` which is paired with `workloadDetails`).
  if ('resource_name' in formData) return 'resource';
  // Per-type Project templates emit `project_name` at the top level.
  if ('project_name' in formData) return 'project';
  return 'default';
}

// ---------------------------------------------------------------------------
// CustomReviewStep (main export)
// ---------------------------------------------------------------------------

export const CustomReviewStep = ({
  formData,
  steps,
  handleBack,
  handleCreate,
  disableButtons,
}: ReviewStepProps) => {
  const classes = useStyles();
  const templateType = detectTemplateType(formData);

  return (
    <>
      <Box className={classes.reviewContent}>
        {templateType === 'deployment-pipeline' && (
          <DeploymentPipelineReview data={formData} />
        )}
        {templateType === 'environment' && (
          <EnvironmentReview data={formData} />
        )}
        {templateType === 'notification-channel' && (
          <NotificationChannelReview data={formData} />
        )}
        {templateType === 'component' && <ComponentReview data={formData} />}
        {templateType === 'resource' && <ResourceReview data={formData} />}
        {templateType === 'project' && <ProjectReview data={formData} />}
        {templateType === 'default' && (
          <DefaultReview formData={formData} steps={steps} />
        )}
      </Box>

      <Divider style={{ marginTop: 16 }} />

      <Box className={classes.footer}>
        <Button onClick={handleBack} disabled={disableButtons}>
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreate}
          disabled={disableButtons}
        >
          Create
        </Button>
      </Box>
    </>
  );
};
