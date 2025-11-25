import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { EnvironmentInfoService } from './services/EnvironmentService/EnvironmentInfoService';
import { BuildTemplateInfoService } from './services/BuildTemplateService/BuildTemplateInfoService';
import {
  BuildInfoService,
  ObservabilityNotConfiguredError as BuildObservabilityNotConfiguredError,
} from './services/BuildService/BuildInfoService';
import { CellDiagramService, WorkloadService, SecretReferencesService } from './types';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import {
  RuntimeLogsInfoService,
  ObservabilityNotConfiguredError as RuntimeObservabilityNotConfiguredError,
} from './services/RuntimeLogsService/RuntimeLogsService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { TraitInfoService } from './services/TraitService/TraitInfoService';
import { WorkflowSchemaService } from './services/WorkflowService/WorkflowSchemaService';

export async function createRouter({
  environmentInfoService,
  cellDiagramInfoService,
  buildTemplateInfoService,
  buildInfoService,
  componentInfoService,
  projectInfoService,
  runtimeLogsInfoService,
  workloadInfoService,
  dashboardInfoService,
  traitInfoService,
  workflowSchemaService,
  secretReferencesInfoService,
}: {
  environmentInfoService: EnvironmentInfoService;
  cellDiagramInfoService: CellDiagramService;
  buildTemplateInfoService: BuildTemplateInfoService;
  buildInfoService: BuildInfoService;
  componentInfoService: ComponentInfoService;
  projectInfoService: ProjectInfoService;
  runtimeLogsInfoService: RuntimeLogsInfoService;
  workloadInfoService: WorkloadService;
  dashboardInfoService: DashboardInfoService;
  traitInfoService: TraitInfoService;
  workflowSchemaService: WorkflowSchemaService;
  secretReferencesInfoService: SecretReferencesService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.get('/deploy', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await environmentInfoService.fetchDeploymentInfo({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string, // TODO: Get from request or config
      }),
    );
  });

  router.post('/promote-deployment', async (req, res) => {
    const { sourceEnv, targetEnv, componentName, projectName, orgName } =
      req.body;

    if (
      !sourceEnv ||
      !targetEnv ||
      !componentName ||
      !projectName ||
      !orgName
    ) {
      throw new InputError(
        'sourceEnv, targetEnv, componentName, projectName and orgName are required in request body',
      );
    }

    res.json(
      await environmentInfoService.promoteComponent({
        sourceEnvironment: sourceEnv,
        targetEnvironment: targetEnv,
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: orgName as string,
      }),
    );
  });

  router.delete('/delete-release-binding', async (req, res) => {
    const { componentName, projectName, orgName, environment } = req.body;

    if (!componentName || !projectName || !orgName || !environment) {
      throw new InputError(
        'componentName, projectName, orgName and environment are required in request body',
      );
    }

    res.json(
      await environmentInfoService.deleteReleaseBinding({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: orgName as string,
        environment: environment as string,
      }),
    );
  });

  router.patch('/update-binding', async (req, res) => {
    const { componentName, projectName, orgName, bindingName, releaseState } =
      req.body;

    if (
      !componentName ||
      !projectName ||
      !orgName ||
      !bindingName ||
      !releaseState
    ) {
      throw new InputError(
        'componentName, projectName, orgName, bindingName and releaseState are required in request body',
      );
    }

    if (!['Active', 'Suspend', 'Undeploy'].includes(releaseState)) {
      throw new InputError(
        'releaseState must be one of: Active, Suspend, Undeploy',
      );
    }

    res.json(
      await environmentInfoService.updateComponentBinding({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: orgName as string,
        bindingName: bindingName as string,
        releaseState: releaseState as 'Active' | 'Suspend' | 'Undeploy',
      }),
    );
  });

  router.get(
    '/cell-diagram',
    async (req: express.Request, res: express.Response) => {
      const { projectName, organizationName } = req.query;

      if (!projectName || !organizationName) {
        throw new InputError(
          'projectName and organizationName are required query parameters',
        );
      }
      res.json(
        await cellDiagramInfoService.fetchProjectInfo({
          projectName: projectName as string,
          orgName: organizationName as string,
        }),
      );
    },
  );

  router.get('/build-templates', async (req, res) => {
    const { organizationName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    res.json(
      await buildTemplateInfoService.fetchBuildTemplates(
        organizationName as string,
      ),
    );
  });

  // Endpoint for listing traits
  router.get('/traits', async (req, res) => {
    const { organizationName, page, pageSize } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    res.json(
      await traitInfoService.fetchTraits(
        organizationName as string,
        page ? parseInt(page as string, 10) : undefined,
        pageSize ? parseInt(pageSize as string, 10) : undefined,
      ),
    );
  });

  // Endpoint for fetching addon schema
  router.get('/trait-schema', async (req, res) => {
    const { organizationName, traitName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    if (!traitName) {
      throw new InputError('traitName is a required query parameter');
    }

    res.json(
      await traitInfoService.fetchTraitSchema(
        organizationName as string,
        traitName as string,
      ),
    );
  });

  // Endpoint for listing workflows
  router.get('/workflows', async (req, res) => {
    const { organizationName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    res.json(
      await workflowSchemaService.fetchWorkflows(organizationName as string),
    );
  });

  // Endpoint for fetching workflow schema
  router.get('/workflow-schema', async (req, res) => {
    const { organizationName, workflowName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    if (!workflowName) {
      throw new InputError('workflowName is a required query parameter');
    }

    res.json(
      await workflowSchemaService.fetchWorkflowSchema(
        organizationName as string,
        workflowName as string,
      ),
    );
  });

  // Endpoint for updating component workflow schema
  router.patch('/component-workflow-schema', async (req, res) => {
    const { organizationName, projectName, componentName } = req.query;
    const { schema } = req.body;

    if (!organizationName || !projectName || !componentName) {
      throw new InputError(
        'organizationName, projectName and componentName are required query parameters',
      );
    }

    if (!schema) {
      throw new InputError('schema is required in request body');
    }

    res.json(
      await workflowSchemaService.updateComponentWorkflowSchema(
        organizationName as string,
        projectName as string,
        componentName as string,
        schema,
      ),
    );
  });

  router.get('/builds', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await buildInfoService.fetchBuilds(
        organizationName as string,
        projectName as string,
        componentName as string,
      ),
    );
  });

  router.post('/builds', async (req, res) => {
    const { componentName, projectName, organizationName, commit } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required in request body',
      );
    }

    res.json(
      await buildInfoService.triggerBuild(
        organizationName as string,
        projectName as string,
        componentName as string,
        commit as string | undefined,
      ),
    );
  });

  router.get('/component', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await componentInfoService.fetchComponentDetails(
        organizationName as string,
        projectName as string,
        componentName as string,
      ),
    );
  });

  router.get('/project', async (req, res) => {
    const { projectName, organizationName } = req.query;

    if (!projectName || !organizationName) {
      throw new InputError(
        'projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await projectInfoService.fetchProjectDetails(
        organizationName as string,
        projectName as string,
      ),
    );
  });
  router.get('/build-logs', async (req, res) => {
    const { componentName, buildId, buildUuid, projectName, orgName } =
      req.query;

    if (!componentName || !buildId || !buildUuid) {
      throw new InputError(
        'componentName, buildId and buildUuid are required query parameters',
      );
    }

    try {
      const result = await buildInfoService.fetchBuildLogs(
        orgName as string,
        projectName as string,
        componentName as string,
        buildId as string,
      );
      return res.json(result);
    } catch (error: unknown) {
      if (error instanceof BuildObservabilityNotConfiguredError) {
        return res.status(200).json({
          message: "Observability hasn't been configured",
        });
      }
      throw error;
    }
  });

  // Runtime logs
  router.post(
    '/logs/component/:componentName',
    async (req: express.Request, res: express.Response) => {
      const { componentName } = req.params;
      const { orgName, projectName } = req.query;
      const {
        componentId,
        environmentName,
        environmentId,
        logLevels,
        startTime,
        endTime,
        limit,
      } = req.body;

      if (
        !componentName ||
        !componentId ||
        !environmentName ||
        !environmentId
      ) {
        return res.status(422).json({
          error: 'Missing Parameter',
          message:
            'Component Name, Component ID or Environment Name or Environment ID is missing from request',
        });
      }

      try {
        const result = await runtimeLogsInfoService.fetchRuntimeLogs(
          {
            componentId,
            componentName,
            environmentId,
            environmentName,
            logLevels,
            startTime,
            endTime,
            limit,
          },
          orgName as string,
          projectName as string,
        );

        return res.json(result);
      } catch (error: unknown) {
        if (error instanceof RuntimeObservabilityNotConfiguredError) {
          return res.status(200).json({
            message: 'observability is disabled',
          });
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        // Check if it's a fetch error with status code info
        if (errorMessage.includes('Failed to fetch runtime logs: ')) {
          const statusMatch = errorMessage.match(
            /Failed to fetch runtime logs: (\d+)/,
          );
          if (statusMatch) {
            const statusCode = parseInt(statusMatch[1], 10);
            return res
              .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
              .json({
                error: 'Failed to fetch runtime logs',
                message: errorMessage,
              });
          }
        }

        // Default to 500 for other errors
        return res.status(500).json({
          error: 'Internal server error',
          message: errorMessage,
        });
      }
    },
  );

  router.get('/workload', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    try {
      const result = await workloadInfoService.fetchWorkloadInfo({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
        },
      });
    }
  });

  router.post('/workload', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const workloadSpec = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    if (!workloadSpec) {
      throw new InputError(
        'Workload specification is required in request body',
      );
    }

    try {
      const result = await workloadInfoService.applyWorkload({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
        workloadSpec,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
        },
      });
    }
  });

  router.post('/dashboard/bindings-count', async (req, res) => {
    const { components } = req.body;

    if (!components || !Array.isArray(components)) {
      throw new InputError('components array is required in request body');
    }

    try {
      const totalBindings =
        await dashboardInfoService.fetchComponentsBindingsCount(components);

      res.json({ totalBindings });
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
        },
      });
    }
  });

  router.post('/create-release', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await environmentInfoService.createComponentRelease({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
        releaseName: releaseName as string | undefined,
      }),
    );
  });

  router.post('/deploy-release', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    if (!releaseName) {
      throw new InputError('releaseName is required in request body');
    }

    res.json(
      await environmentInfoService.deployRelease({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
        releaseName: releaseName as string,
      }),
    );
  });

  router.get('/component-release-schema', async (req, res) => {
    const { componentName, projectName, organizationName, releaseName } =
      req.query;

    if (!componentName || !projectName || !organizationName || !releaseName) {
      throw new InputError(
        'componentName, projectName, organizationName and releaseName are required query parameters',
      );
    }

    res.json(
      await environmentInfoService.fetchComponentReleaseSchema({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
        releaseName: releaseName as string,
      }),
    );
  });

  router.get('/release-bindings', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    res.json(
      await environmentInfoService.fetchReleaseBindings({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
      }),
    );
  });

  router.patch('/patch-release-binding', async (req, res) => {
    const {
      componentName,
      projectName,
      orgName,
      environment,
      componentTypeEnvOverrides,
      traitOverrides,
    } = req.body;

    if (!componentName || !projectName || !orgName || !environment) {
      throw new InputError(
        'componentName, projectName, orgName and environment are required in request body',
      );
    }

    res.json(
      await environmentInfoService.patchReleaseBindingOverrides({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: orgName as string,
        environment: environment as string,
        componentTypeEnvOverrides: componentTypeEnvOverrides,
        traitOverrides: traitOverrides,
      }),
    );
  });

  router.get('/environment-release', async (req, res) => {
    const { componentName, projectName, organizationName, environmentName } =
      req.query;

    if (
      !componentName ||
      !projectName ||
      !organizationName ||
      !environmentName
    ) {
      throw new InputError(
        'componentName, projectName, organizationName and environmentName are required query parameters',
      );
    }

    res.json(
      await environmentInfoService.fetchEnvironmentRelease({
        componentName: componentName as string,
        projectName: projectName as string,
        organizationName: organizationName as string,
        environmentName: environmentName as string,
      }),
    );
  });

  // Endpoint for listing secret references
  router.get('/secret-references', async (req, res) => {
    const { organizationName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    res.json(
      await secretReferencesInfoService.fetchSecretReferences(
        organizationName as string,
      ),
    );
  });

  return router;
}
