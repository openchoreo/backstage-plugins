import { componentTypeFacts } from './componentTypeFacts';

const deployment = (podSpec: Record<string, unknown>) => ({
  id: 'deployment',
  template: { kind: 'Deployment', spec: { template: { spec: podSpec } } },
});

describe('componentTypeFacts', () => {
  it('reads allowed traits, workflows and validations', () => {
    expect(
      componentTypeFacts({
        workloadType: 'deployment',
        allowedTraits: [{ name: 'health-probes' }],
        traits: [{ name: 'observability-alert-rule' }],
        allowedWorkflows: [{ name: 'dockerfile-builder' }],
        validations: [{}, {}],
        resources: [],
      }),
    ).toEqual({
      openchoreoComponentTypeResolved: true,
      openchoreoWorkloadType: 'deployment',
      openchoreoAllowedTraits: ['health-probes'],
      openchoreoEmbeddedTraits: ['observability-alert-rule'],
      openchoreoAllowedWorkflows: ['dockerfile-builder'],
      openchoreoValidationRuleCount: 2,
      openchoreoTemplatesSetResourceLimits: false,
      openchoreoTemplatesRunAsNonRoot: false,
      openchoreoTemplatesAllowPrivileged: false,
    });
  });

  it('treats templated limits as set and a missing securityContext as root', () => {
    const facts = componentTypeFacts({
      resources: [
        deployment({
          containers: [
            {
              name: 'main',
              resources: {
                limits: {
                  cpu: '${environmentConfigs.resources.limits.cpu}',
                  memory: '${environmentConfigs.resources.limits.memory}',
                },
              },
            },
          ],
        }),
        { id: 'service', template: { kind: 'Service', spec: {} } },
      ],
    });
    expect(facts.openchoreoTemplatesSetResourceLimits).toBe(true);
    expect(facts.openchoreoTemplatesRunAsNonRoot).toBe(false);
    expect(facts.openchoreoTemplatesAllowPrivileged).toBe(false);
  });

  it('takes runAsNonRoot from the pod unless a container overrides it', () => {
    const podLevel = componentTypeFacts({
      resources: [
        deployment({
          securityContext: { runAsNonRoot: true },
          containers: [{ name: 'main' }, { name: 'sidecar' }],
        }),
      ],
    });
    expect(podLevel.openchoreoTemplatesRunAsNonRoot).toBe(true);

    const overridden = componentTypeFacts({
      resources: [
        deployment({
          securityContext: { runAsNonRoot: true },
          containers: [
            { name: 'main' },
            { name: 'sidecar', securityContext: { runAsNonRoot: false } },
          ],
        }),
      ],
    });
    expect(overridden.openchoreoTemplatesRunAsNonRoot).toBe(false);
  });

  it('accepts a non-zero runAsUser but not an expression', () => {
    expect(
      componentTypeFacts({
        resources: [
          deployment({
            containers: [
              { name: 'main', securityContext: { runAsUser: 1000 } },
            ],
          }),
        ],
      }).openchoreoTemplatesRunAsNonRoot,
    ).toBe(true);
    expect(
      componentTypeFacts({
        resources: [
          deployment({
            containers: [
              {
                name: 'main',
                securityContext: { runAsNonRoot: '${parameters.nonRoot}' },
              },
            ],
          }),
        ],
      }).openchoreoTemplatesRunAsNonRoot,
    ).toBe(false);
  });

  it('reads CronJob pod templates and counts a templated privileged flag as allowed', () => {
    const facts = componentTypeFacts({
      workloadType: 'cronjob',
      resources: [
        {
          id: 'cronjob',
          template: {
            kind: 'CronJob',
            spec: {
              jobTemplate: {
                spec: {
                  template: {
                    spec: {
                      containers: [
                        {
                          name: 'main',
                          securityContext: {
                            privileged: '${parameters.privileged}',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ],
    });
    expect(facts.openchoreoTemplatesAllowPrivileged).toBe(true);
  });

  it('ignores templates rendered to the observability plane', () => {
    expect(
      componentTypeFacts({
        resources: [
          {
            targetPlane: 'observabilityplane',
            template: {
              kind: 'Deployment',
              spec: {
                template: {
                  spec: {
                    containers: [
                      { name: 'x', securityContext: { privileged: true } },
                    ],
                  },
                },
              },
            },
          },
        ],
      }).openchoreoTemplatesAllowPrivileged,
    ).toBe(false);
  });
});
