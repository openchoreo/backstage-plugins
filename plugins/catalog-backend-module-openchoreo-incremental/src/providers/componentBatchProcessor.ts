// Optimized batch processing for component API calls
// This file contains helper methods to be integrated into OpenChoreoIncrementalEntityProvider

import { Entity } from '@backstage/catalog-model';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { EntityTranslator } from './entityTranslator';

interface OpenChoreoContext {
  config: Config;
  logger: LoggerService;
}

/**
 * Processes components in batches to reduce N+1 API calls
 * Fetches service components with limited concurrency to avoid overwhelming the API
 */
export class ComponentBatchProcessor {
  private readonly translator: EntityTranslator;

  constructor(providerName: string) {
    this.translator = new EntityTranslator(providerName);
  }

  /**
   * Processes components in batches to reduce API calls
   * @param client - API client for fetching component details
   * @param components - Array of components to process
   * @param orgName - Organization name for context
   * @param projectName - Project name for context
   * @param context - Provider context for logging
   * @returns Array of translated entities
   */
  async translateComponentsWithApisBatch(
    client: any,
    components: any[],
    orgName: string,
    projectName: string,
    context: OpenChoreoContext,
  ): Promise<Entity[]> {
    const entities: Entity[] = [];
    const serviceComponents = components.filter(c => c.type === 'Service');
    const nonServiceComponents = components.filter(c => c.type !== 'Service');
    
    // Process non-service components normally (no additional API calls needed)
    for (const component of nonServiceComponents) {
      const basic = this.translator.translateComponentToEntity(
        component,
        orgName,
        projectName,
      );
      entities.push(basic);
    }
    
    // Batch fetch service components with controlled concurrency
    if (serviceComponents.length > 0) {
      const startTime = Date.now();
      context.logger.info(
        `Processing ${serviceComponents.length} service components for ${orgName}/${projectName} with batch API calls`
      );
      
      try {
        const MAX_CONCURRENT = 5; // Limit concurrent API calls
        const BATCH_DELAY = 100; // 100ms delay between batches
        
        for (let i = 0; i < serviceComponents.length; i += MAX_CONCURRENT) {
          const batch = serviceComponents.slice(i, i + MAX_CONCURRENT);
          
          // Create promises for batch with error handling
          const promises = batch.map(async (component: any, index: number) => {
            try {
              const completeComponent = await client.getComponent(
                orgName,
                projectName,
                component.name,
              );
              return { 
                component, 
                result: completeComponent, 
                success: true,
                index 
              };
            } catch (error) {
              context.logger.warn(
                `Failed to fetch complete component details for ${component.name}: ${error}`,
              );
              return { 
                component, 
                error, 
                success: false,
                index 
              };
            }
          });
          
          // Execute batch with timeout
          const batchResults = await Promise.allSettled(promises);
          
          // Process results
          batchResults.forEach((result, batchIndex) => {
            if (result.status === 'fulfilled') {
              const { component, result: completeResult, success } = result.value;
              
              if (success && completeResult) {
                try {
                  const { componentEntity, apiEntities } =
                    this.translator.processServiceComponentWithCursor(
                      completeResult,
                      orgName,
                      projectName,
                    );
                  entities.push(componentEntity, ...apiEntities);
                } catch (translationError) {
                  context.logger.warn(
                    `Failed to translate service component ${component.name}: ${translationError}`,
                  );
                  // Fallback to basic translation
                  const fallback = this.translator.translateComponentToEntity(
                    component,
                    orgName,
                    projectName,
                  );
                  entities.push(fallback);
                }
              } else {
                // Fallback to basic translation for failed API calls
                const fallback = this.translator.translateComponentToEntity(
                  component,
                  orgName,
                  projectName,
                );
                entities.push(fallback);
              }
            } else {
              // Handle promise rejection
              const component = batch[batchIndex];
              context.logger.error(
                `Promise rejected for component ${component.name}: ${result.reason}`,
              );
              // Fallback to basic translation
              const fallback = this.translator.translateComponentToEntity(
                component,
                orgName,
                projectName,
              );
              entities.push(fallback);
            }
          });
          
          // Add delay between batches to avoid API rate limiting
          if (i + MAX_CONCURRENT < serviceComponents.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
        
        const duration = Date.now() - startTime;
        context.logger.info(
          `Batch processed ${serviceComponents.length} service components in ${duration}ms (${Math.round(duration/serviceComponents.length)}ms per component)`
        );
        
      } catch (error) {
        context.logger.warn(
          `Batch service component processing failed, falling back to individual processing: ${error}`,
        );
        
        // Fallback to processing individually (original behavior)
        for (const component of serviceComponents) {
          try {
            const completeComponent = await client.getComponent(
              orgName,
              projectName,
              component.name,
            );
            const { componentEntity, apiEntities } =
              this.translator.processServiceComponentWithCursor(
                completeComponent,
                orgName,
                projectName,
              );
            entities.push(componentEntity, ...apiEntities);
          } catch (individualError) {
            context.logger.warn(
              `Failed to fetch complete component details for ${component.name}: ${individualError}`,
            );
            const fallback = this.translator.translateComponentToEntity(
              component,
              orgName,
              projectName,
            );
            entities.push(fallback);
          }
        }
      }
    }

    return entities;
  }
}