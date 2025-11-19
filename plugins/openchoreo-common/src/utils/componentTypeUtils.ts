import { Config } from '@backstage/config';

export type PageVariant = 'service' | 'website' | 'scheduled-task' | 'default';

export interface ComponentTypeMapping {
  pattern: string; // regex pattern
  pageVariant: PageVariant;
}

/**
 * Utilities for handling OpenChoreo component types and their mapping to Backstage page variants.
 *
 * Component types follow the format: {workloadType}/{componentTypeName}
 * Examples: deployment/service, deployment/web-application, cronjob/scheduled-task
 *
 * This class maps component types to page variants which determine the UI features shown.
 */
export class ComponentTypeUtils {
  private mappings: ComponentTypeMapping[];

  private constructor(mappings: ComponentTypeMapping[]) {
    this.mappings = mappings;
  }

  /**
   * Creates ComponentTypeUtils from Backstage configuration.
   * Reads optional custom mappings from openchoreo.componentTypes.mappings
   * and combines them with default mappings (custom mappings take precedence).
   */
  static fromConfig(config: Config): ComponentTypeUtils {
    const ctConfig = config.getOptionalConfig('openchoreo.componentTypes');
    const customMappings = ctConfig?.getOptionalConfigArray('mappings') || [];

    const mappings: ComponentTypeMapping[] = [
      // Custom mappings from config (evaluated first)
      ...customMappings.map(m => ({
        pattern: m.getString('pattern'),
        pageVariant: m.getString('pageVariant') as PageVariant,
      })),
      // Default mappings (fallback)
      ...this.getDefaultMappings(),
    ];

    return new ComponentTypeUtils(mappings);
  }

  /**
   * Creates ComponentTypeUtils with default mappings only.
   * Useful for frontend routing where config might not be easily accessible.
   */
  static createDefault(): ComponentTypeUtils {
    return new ComponentTypeUtils(this.getDefaultMappings());
  }

  /**
   * Default mappings for component types to page variants.
   * These patterns are evaluated in order until a match is found.
   */
  private static getDefaultMappings(): ComponentTypeMapping[] {
    return [
      // Web applications (no API tab)
      { pattern: '^deployment/.*web-app.*', pageVariant: 'website' },
      { pattern: '^deployment/.*webapp.*', pageVariant: 'website' },
      { pattern: '^deployment/.*web-application.*', pageVariant: 'website' },
      { pattern: '^deployment/.*frontend.*', pageVariant: 'website' },

      // Scheduled tasks / jobs (future: different UI with executions, schedules)
      { pattern: '^cronjob/.*', pageVariant: 'scheduled-task' },
      { pattern: '^job/.*', pageVariant: 'scheduled-task' },

      // Services (shows API tab, builds, deploy, metrics, etc.)
      { pattern: '^deployment/.*', pageVariant: 'service' },
      { pattern: '^statefulset/.*', pageVariant: 'service' },
    ];
  }

  /**
   * Determines the page variant for a given component type.
   * The first matching pattern in the mappings list determines the variant.
   *
   * @param componentType - OpenChoreo component type (e.g., "deployment/service")
   * @returns Page variant ('service', 'website', 'scheduled-task', or 'default')
   */
  getPageVariant(componentType: string): PageVariant {
    for (const mapping of this.mappings) {
      if (new RegExp(mapping.pattern).test(componentType)) {
        return mapping.pageVariant;
      }
    }
    // No pattern matched - use default page
    return 'default';
  }

  /**
   * Parses OpenChoreo component type format into workload type and type name.
   *
   * @param componentType - Format: "workloadType/componentTypeName"
   * @returns Object with workloadType and typeName
   *
   * @example
   * parseComponentType("deployment/service")
   * // Returns: { workloadType: "deployment", typeName: "service" }
   */
  parseComponentType(componentType: string): {
    workloadType: string;
    typeName: string;
  } {
    const match = componentType.match(
      /^(deployment|statefulset|cronjob|job)\/(.+)$/,
    );
    if (!match) {
      return { workloadType: 'unknown', typeName: componentType };
    }
    return { workloadType: match[1], typeName: match[2] };
  }

  /**
   * Generates Backstage tags for a component type.
   * Tags include: openchoreo, component, workload type, type name, and full type.
   *
   * @param componentType - OpenChoreo component type
   * @returns Array of tags for the component
   *
   * @example
   * generateTags("deployment/service")
   * // Returns: ["openchoreo", "component", "deployment", "service", "deployment-service"]
   */
  generateTags(componentType: string): string[] {
    const { workloadType, typeName } = this.parseComponentType(componentType);
    return [
      'openchoreo',
      'component',
      workloadType !== 'unknown' ? workloadType : undefined,
      typeName !== componentType ? typeName : undefined,
      componentType.replace('/', '-'),
    ].filter(Boolean) as string[];
  }
}
