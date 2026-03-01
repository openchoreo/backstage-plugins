import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import type { ComponentResponse } from '@openchoreo/backstage-plugin-common';
import { Config } from '@backstage/config';
import { z } from 'zod';
import {
  buildComponentResource,
  buildWorkloadResource,
  type WorkflowParameterMapping,
} from './componentResourceBuilder';
import { CatalogClient } from '@backstage/catalog-client';
import {
  CHOREO_ANNOTATIONS,
  ComponentTypeUtils,
  parseWorkflowParametersAnnotation,
} from '@openchoreo/backstage-plugin-common';
import {
  type ImmediateCatalogService,
  type AnnotationStore,
  translateComponentToEntity,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import type { DiscoveryService } from '@backstage/backend-plugin-api';

/**
 * Maps CI platform identifier to the corresponding annotation key
 */
function getCIAnnotationKey(platform: string): string | undefined {
  switch (platform) {
    case 'jenkins':
      return 'jenkins.io/job-full-name';
    case 'github-actions':
      return 'github.com/project-slug';
    case 'gitlab-ci':
      return 'gitlab.com/project-id';
    default:
      return undefined;
  }
}

type ModelsComponent = ComponentResponse;

// Kubernetes DNS subdomain name validation
const K8S_NAME_PATTERN =
  /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const MAX_NAME_LENGTH = 253;

export const createComponentAction = (
  config: Config,
  discovery: DiscoveryService,
  immediateCatalog: ImmediateCatalogService,
  annotationStore: AnnotationStore,
) => {
  return createTemplateAction({
    id: 'openchoreo:component:create',
    description: 'Create OpenChoreo Component',
    schema: {
      input: (zImpl: typeof z) =>
        zImpl
          .object({
            // Keep existing validation for required fields
            namespaceName: zImpl
              .string()
              .describe(
                'The name of the namespace where the component will be created',
              ),
            projectName: zImpl
              .string()
              .describe(
                'The name of the project where the component will be created',
              ),
            componentName: zImpl
              .string()
              .max(
                MAX_NAME_LENGTH,
                `Component name must not exceed ${MAX_NAME_LENGTH} characters`,
              )
              .regex(
                K8S_NAME_PATTERN,
                'Component name must be a valid Kubernetes name: lowercase letters, numbers, hyphens, or dots only. Must start and end with an alphanumeric character.',
              )
              .describe('The name of the component to create'),
            displayName: zImpl
              .string()
              .optional()
              .describe('The display name of the component'),
            description: zImpl
              .string()
              .optional()
              .describe('The description of the component'),
            componentType: zImpl.string().describe('The type of the component'),
            component_type_kind: zImpl
              .enum(['ComponentType', 'ClusterComponentType'])
              .optional()
              .describe(
                'The kind of component type (ComponentType or ClusterComponentType)',
              ),

            // Deployment source and optional fields
            deploymentSource: zImpl
              .enum(['build-from-source', 'deploy-from-image', 'external-ci'])
              .optional()
              .describe(
                'How the component will be built and deployed (build-from-source, deploy-from-image, or external-ci)',
              ),
            autoDeploy: zImpl.boolean().optional(),
            containerImage: zImpl
              .string()
              .optional()
              .describe('Container image for deploy-from-image deployment'),
            ciPlatform: zImpl
              .enum(['none', 'jenkins', 'github-actions', 'gitlab-ci'])
              .optional()
              .describe('CI platform for external-ci deployment'),
            ciIdentifier: zImpl
              .string()
              .optional()
              .describe(
                'CI job/project identifier (e.g., Jenkins job path, GitHub repo slug)',
              ),
          })
          .passthrough(), // Allow any additional fields (CTD params, workflow params, traits, etc.)
      output: (zImpl: typeof z) =>
        zImpl.object({
          componentName: zImpl
            .string()
            .describe('The name of the created component'),
          projectName: zImpl
            .string()
            .describe('The project where the component was created'),
          namespaceName: zImpl
            .string()
            .describe('The namespace where the component was created'),
        }),
    },
    async handler(ctx) {
      ctx.logger.info(
        `Creating component with parameters: ${JSON.stringify(ctx.input)}`,
      );

      // Extract namespace name from domain format (e.g., "domain:default/default-ns" -> "default-ns")
      const extractNamespaceName = (fullNamespaceName: string): string => {
        const parts = fullNamespaceName.split('/');
        return parts[parts.length - 1];
      };

      // Extract project name from system format (e.g., "system:default/project-name" -> "project-name")
      const extractProjectName = (fullProjectName: string): string => {
        const parts = fullProjectName.split('/');
        return parts[parts.length - 1];
      };

      let namespaceName = extractNamespaceName(ctx.input.namespaceName);
      const projectName = extractProjectName(ctx.input.projectName);

      ctx.logger.info(
        `Extracted namespace name: ${namespaceName} from ${ctx.input.namespaceName}`,
      );
      ctx.logger.info(
        `Extracted project name: ${projectName} from ${ctx.input.projectName}`,
      );

      const catalogApi = new CatalogClient({
        discoveryApi: discovery,
      });

      // Resolve namespace from project entity to prevent cross-namespace mismatch
      try {
        const projectRef = ctx.input.projectName.includes(':')
          ? ctx.input.projectName
          : `system:${namespaceName}/${projectName}`;
        const projectEntity = await catalogApi.getEntityByRef(projectRef);
        if (projectEntity) {
          const projectNs =
            projectEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
          if (projectNs && projectNs !== namespaceName) {
            ctx.logger.warn(
              `Namespace mismatch: selected "${namespaceName}" but project "${projectName}" belongs to "${projectNs}". Using project namespace.`,
            );
            namespaceName = projectNs;
          }
        }
      } catch (err) {
        ctx.logger.warn(`Failed to resolve project namespace: ${err}`);
      }

      // Check if component with the same name already exists in this namespace
      // Note: This requires catalog-backend to be accessible
      try {
        // Get all components from catalog
        const { items } = await catalogApi.getEntities({
          filter: {
            kind: 'Component',
          },
        });

        // Filter components by namespace annotation and check if name exists
        const existsInNamespace = items.some(
          component =>
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ===
              namespaceName &&
            component.metadata.name === ctx.input.componentName,
        );

        if (existsInNamespace) {
          throw new Error(
            `A component named "${ctx.input.componentName}" already exists in namespace "${namespaceName}". Please choose a different name.`,
          );
        }

        ctx.logger.debug(
          `Component name "${ctx.input.componentName}" is available in namespace "${namespaceName}"`,
        );
      } catch (error) {
        // If it's our duplicate error, rethrow it
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          throw error;
        }
        // For other catalog API errors, log warning but continue
        ctx.logger.warn(
          `Failed to check for duplicate component name: ${error}. Proceeding with creation.`,
        );
      }

      try {
        // Extract workloadDetails if present (new nested structure from WorkloadDetailsField)
        const workloadDetails = (ctx.input as any).workloadDetails;

        // Filter out UI-specific fields from traits (id, schema)
        // Traits may come from workloadDetails or top-level (backward compat)
        const rawTraits = workloadDetails?.traits ?? (ctx.input as any).traits;
        const cleanedTraits = rawTraits?.map((trait: any) => ({
          ...(trait.kind !== undefined && { kind: trait.kind }),
          name: trait.name,
          instanceName: trait.instanceName,
          config: trait.config,
        }));

        // Extract workload data from workloadDetails
        const workloadEndpoints = workloadDetails?.endpoints;
        const workloadEnvVars = workloadDetails?.envVars;
        const workloadFileMounts = workloadDetails?.fileMounts;

        // Extract CI/CD setup data
        const deploymentSource =
          (ctx.input as any).deploymentSource || 'build-from-source';
        const isFromImage = deploymentSource === 'deploy-from-image';
        const isExternalCI = deploymentSource === 'external-ci';
        const isBuildFromSource = deploymentSource === 'build-from-source';

        // Only use workflow-related fields if deploying from source
        const autoDeploy = ctx.input.autoDeploy ?? false;
        const workflowName = isBuildFromSource
          ? (ctx.input as any).workflow_name
          : undefined;
        const workflowParametersData = isBuildFromSource
          ? (ctx.input as any).workflow_parameters
          : undefined;
        // Extract parameters from the new structure (workflow_parameters.parameters)
        const workflowParameters =
          workflowParametersData?.parameters || workflowParametersData;

        // Extract CTD-specific parameters
        // If workloadDetails exists, CTD parameters come from workloadDetails.ctdParameters
        // Otherwise, filter out known scaffolder fields (backward compat)
        let ctdParameters: Record<string, any> = {};
        if (workloadDetails?.ctdParameters) {
          ctdParameters = workloadDetails.ctdParameters;
        } else {
          const knownScaffolderFields = new Set([
            'namespaceName',
            'projectName',
            'componentName',
            'displayName',
            'description',
            'componentType',
            'deploymentSource',
            'containerImage',
            'autoDeploy',
            'workflow_name',
            'workflow_parameters',
            'traits',
            'repo_url',
            'branch',
            'component_path',
            'component_type_workload_type',
            'component_type_kind',
            'ciPlatform',
            'ciIdentifier',
            'external_ci_info',
            'gitSecretRef',
            'workloadDetails',
          ]);

          for (const [key, value] of Object.entries(ctx.input)) {
            if (!knownScaffolderFields.has(key)) {
              ctdParameters[key] = value;
            }
          }
        }

        ctx.logger.debug(
          `Extracted CTD parameters: ${JSON.stringify(ctdParameters)}`,
        );

        // Fetch WORKFLOW_PARAMETERS annotation from the Workflow entity in catalog.
        // This tells us where git source fields and implicit fields (projectName,
        // componentName) should be placed in the workflow parameters structure.
        let workflowParameterMapping: WorkflowParameterMapping | undefined;
        if (workflowName) {
          try {
            const workflowEntities = await catalogApi.getEntities({
              filter: {
                kind: 'Workflow',
                'metadata.name': workflowName,
                ...(namespaceName && {
                  'metadata.namespace': namespaceName,
                }),
              },
            });
            const workflowEntity = workflowEntities.items[0];
            const annotation =
              workflowEntity?.metadata?.annotations?.[
                CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS
              ];
            if (annotation) {
              workflowParameterMapping = parseWorkflowParametersAnnotation(
                annotation,
              ) as WorkflowParameterMapping;
              ctx.logger.debug(
                `Parsed WORKFLOW_PARAMETERS annotation: ${JSON.stringify(
                  workflowParameterMapping,
                )}`,
              );
            }
          } catch (err) {
            ctx.logger.warn(
              `Failed to fetch Workflow entity for annotation lookup: ${err}`,
            );
          }
        }

        // Build the ComponentResource from form input
        const componentTypeKind =
          (ctx.input as any).component_type_kind || 'ComponentType';

        const componentResource = buildComponentResource({
          componentName: ctx.input.componentName,
          displayName: ctx.input.displayName,
          description: ctx.input.description,
          namespaceName: namespaceName,
          projectName: projectName,
          componentType: ctx.input.componentType,
          componentTypeWorkloadType:
            (ctx.input as any).component_type_workload_type || 'deployment',
          componentTypeKind: componentTypeKind,
          ctdParameters: ctdParameters,
          deploymentSource: deploymentSource,
          autoDeploy: autoDeploy,
          repoUrl: (ctx.input as any).repo_url,
          branch: (ctx.input as any).branch,
          componentPath: (ctx.input as any).component_path,
          workflowName: workflowName,
          workflowParameters: workflowParameters,
          containerImage: (ctx.input as any).containerImage,
          gitSecretRef: (ctx.input as any).gitSecretRef,
          workflowParameterMapping: workflowParameterMapping,
          traits: cleanedTraits,
        });

        // Create the API client using the auto-generated client
        const baseUrl = config.getString('openchoreo.baseUrl');

        // Check if authorization is enabled (defaults to true)
        const authzEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        // Get user token from secrets (injected by form decorator) when authz is enabled
        const token = authzEnabled
          ? ctx.secrets?.OPENCHOREO_USER_TOKEN
          : undefined;

        if (authzEnabled && !token) {
          throw new Error(
            'User authentication token not available. Please ensure you are logged in.',
          );
        }

        if (token) {
          ctx.logger.debug('Using user token from secrets for OpenChoreo API');
        } else {
          ctx.logger.debug(
            'Authorization disabled - calling OpenChoreo API without auth',
          );
        }

        const client = createOpenChoreoApiClient({
          baseUrl,
          token,
          logger: ctx.logger,
        });

        ctx.logger.debug(
          `Creating component: ${componentResource.metadata.name}`,
        );

        // Call the API to create the component
        const { error: applyError, response: applyResponse } =
          await client.POST('/api/v1/namespaces/{namespaceName}/components', {
            params: {
              path: { namespaceName },
            },
            body: componentResource as any,
          });

        if (applyError || !applyResponse.ok) {
          throw new Error(
            `Failed to create component: ${applyResponse.status} ${
              applyResponse.statusText
            }. Error: ${JSON.stringify(applyError)}`,
          );
        }

        // Create Workload CR when there's workload data or when deploying from image.
        //
        // The Workload CRD requires `image` (Required, MinLength=1) on Container,
        // so env vars and file mounts can only be included when there's an image.
        // Endpoints live at the spec level and don't require a container.
        const containerImage = (ctx.input as any).containerImage;
        const hasEndpoints =
          workloadEndpoints && Object.keys(workloadEndpoints).length > 0;
        const hasEnvVars = workloadEnvVars && workloadEnvVars.length > 0;
        const hasFileMounts =
          workloadFileMounts && workloadFileMounts.length > 0;
        const hasWorkloadData = hasEndpoints || hasEnvVars || hasFileMounts;

        if ((isFromImage && containerImage) || hasWorkloadData) {
          // Extract port from CTD parameters if available (legacy fallback)
          const port = ctdParameters.port as number | undefined;

          // For non-image deployments, only pass env vars and file mounts if
          // there's also an image, since the CRD requires image on Container.
          const effectiveContainerImage = isFromImage
            ? containerImage
            : undefined;
          const workloadResource = buildWorkloadResource({
            componentName: ctx.input.componentName,
            namespaceName: namespaceName,
            projectName: projectName,
            containerImage: effectiveContainerImage,
            port: port,
            endpoints: workloadEndpoints,
            envVars: effectiveContainerImage ? workloadEnvVars : undefined,
            fileMounts: effectiveContainerImage
              ? workloadFileMounts
              : undefined,
          });

          ctx.logger.debug(
            `Creating Workload resource: ${JSON.stringify(workloadResource)}`,
          );

          const {
            data: workloadData,
            error: workloadError,
            response: workloadResponse,
          } = await client.POST(
            '/api/v1/namespaces/{namespaceName}/workloads',
            {
              params: {
                path: { namespaceName },
              },
              body: workloadResource as any,
            },
          );

          if (workloadError || !workloadResponse.ok) {
            ctx.logger.error(
              `Failed to create Workload: ${workloadResponse.status} ${workloadResponse.statusText}. ` +
                `Error: ${JSON.stringify(workloadError)}. ` +
                `Component was created but workload setup may need manual configuration.`,
            );
          } else {
            ctx.logger.info(
              `Workload created successfully: ${JSON.stringify(workloadData)}`,
            );
          }
        } else if (isExternalCI) {
          ctx.logger.info(
            `External CI flow: Component created without workload. ` +
              `External CI pipeline will create workloads via OpenChoreo API.`,
          );
        }

        // Store CI annotation in Backstage DB if provided (for external-ci flow)
        const ciPlatform = (ctx.input as any).ciPlatform;
        const ciIdentifier = (ctx.input as any).ciIdentifier;

        if (ciPlatform && ciPlatform !== 'none' && ciIdentifier) {
          const annotationKey = getCIAnnotationKey(ciPlatform);
          if (annotationKey) {
            try {
              // Build entity ref in standard format: component:namespace/name
              const entityRef = `component:${namespaceName}/${ctx.input.componentName}`;

              ctx.logger.info(
                `Storing CI annotation for ${entityRef}: ${annotationKey}=${ciIdentifier}`,
              );

              await annotationStore.setAnnotations(entityRef, {
                [annotationKey]: ciIdentifier,
              });

              ctx.logger.info(
                `CI annotation stored successfully. Build visibility will be available after catalog sync.`,
              );
            } catch (annotationError) {
              // Don't fail the whole operation - annotation can be added later via editor
              ctx.logger.warn(
                `Failed to store CI annotation: ${annotationError}. ` +
                  `You can add the annotation later via the annotation editor.`,
              );
            }
          }
        }

        // Immediately insert the component into the catalog
        try {
          ctx.logger.info(
            `Inserting component '${ctx.input.componentName}' into catalog immediately...`,
          );

          // Build the full component type in OpenChoreo format: {workloadType}/{componentType}
          const workloadType =
            (ctx.input as any).component_type_workload_type || 'deployment';
          const fullComponentType = `${workloadType}/${ctx.input.componentType}`;

          ctx.logger.debug(
            `Component type for catalog: ${fullComponentType} (workloadType: ${workloadType}, componentType: ${ctx.input.componentType})`,
          );

          // Build ModelsComponent object matching OpenChoreo API response structure
          const component: ModelsComponent = {
            uid: `temp-${ctx.input.componentName}`, // Temporary UID
            name: ctx.input.componentName,
            displayName: ctx.input.displayName,
            description: ctx.input.description,
            type: fullComponentType, // Use full type format: deployment/service
            componentType: {
              kind: componentTypeKind,
              name: fullComponentType,
            },
            projectName: projectName,
            namespaceName: namespaceName,
            status: 'Active', // New components are active by default
            createdAt: new Date().toISOString(),
            autoDeploy: autoDeploy,
            // Build componentWorkflow in the BFF shape expected by the catalog entity translator.
            // The BFF type uses systemParameters.repository whereas the component resource
            // stores everything in parameters. Extract repository info for the catalog entity.
            componentWorkflow: componentResource.spec.workflow
              ? {
                  name: componentResource.spec.workflow.name,
                  systemParameters: {
                    repository: {
                      url: (ctx.input as any).repo_url || '',
                      revision: {
                        branch: (ctx.input as any).branch || 'main',
                      },
                      appPath: (ctx.input as any).component_path || '.',
                    },
                  },
                  parameters: componentResource.spec.workflow.parameters,
                }
              : undefined,
          };

          // Get configuration values
          const defaultOwner =
            config.getOptionalString('openchoreo.defaultOwner') || 'guests';
          const componentTypeUtils = ComponentTypeUtils.fromConfig(config);

          // Use the shared translation utility for consistency with scheduled sync
          const entity = translateComponentToEntity(
            component,
            namespaceName,
            projectName,
            {
              defaultOwner,
              componentTypeUtils,
              locationKey: 'provider:OpenChoreoEntityProvider',
            },
          );

          ctx.logger.debug(
            `Entity to insert: ${JSON.stringify(entity, null, 2)}`,
          );

          // Insert into catalog immediately
          await immediateCatalog.insertEntity(entity);

          ctx.logger.info(
            `Component '${ctx.input.componentName}' successfully added to catalog`,
          );
        } catch (catalogError) {
          // Log error but don't fail the scaffolder action
          // The component was created successfully, catalog sync will pick it up eventually
          ctx.logger.error(
            `Failed to immediately add component to catalog: ${catalogError}. ` +
              `Component will be visible after the next scheduled catalog sync.`,
          );
        }

        // Set outputs for the scaffolder
        ctx.output('componentName', ctx.input.componentName);
        ctx.output('projectName', projectName);
        ctx.output('namespaceName', namespaceName);

        ctx.logger.info(
          `Component '${ctx.input.componentName}' created successfully in project '${projectName}'`,
        );
      } catch (error) {
        ctx.logger.error(`Error creating component: ${error}`);
        throw new Error(`Failed to create component: ${error}`);
      }
    },
  });
};
