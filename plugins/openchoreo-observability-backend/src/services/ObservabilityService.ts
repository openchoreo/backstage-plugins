import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Expand } from '@backstage/types';

export class ObservabilityService {
  private readonly logger: LoggerService;

  static create(options: {
    logger: LoggerService;
  }) {
    return new ObservabilityService(options.logger);
  }

  private constructor(logger: LoggerService) {
    this.logger = logger;
  }

  async getMetrics(): Promise<any> {
    this.logger.info('Getting metrics');
    return {};
  }
}

export const observabilityServiceRef = createServiceRef<Expand<ObservabilityService>>({
  id: 'openchoreo.observability',
  defaultFactory: async service =>
    createServiceFactory({
      service,
      deps: {
        logger: coreServices.logger,
      },
      async factory(deps) {
        return ObservabilityService.create(deps);
      },
    }),
});
