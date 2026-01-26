import { Entity } from '@backstage/catalog-model';
import { JsonValue } from '@backstage/types';

/**
 * Target environment reference within a promotion path
 *
 * @public
 */
export interface TargetEnvironmentRef {
  /**
   * Name/reference to the target environment
   */
  name: string;
  /**
   * Whether promotion to this environment requires approval
   */
  requiresApproval?: boolean;
  /**
   * Whether manual approval is required (as opposed to automated approval)
   */
  isManualApprovalRequired?: boolean;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Promotion path defining how releases flow between environments
 *
 * @public
 */
export interface PromotionPath {
  /**
   * Reference to the source environment
   */
  sourceEnvironment: string;
  /**
   * List of target environments that can be promoted to from the source
   */
  targetEnvironments: TargetEnvironmentRef[];
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Backstage catalog DeploymentPipeline kind Entity.
 * Represents an OpenChoreo deployment pipeline that defines promotion paths between environments.
 *
 * @public
 */
export interface DeploymentPipelineEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the DeploymentPipeline.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'DeploymentPipeline';
  /**
   * The specification of the DeploymentPipeline Entity
   */
  spec: {
    /**
     * The type of deployment pipeline (e.g., 'promotion-pipeline')
     */
    type: string;
    /**
     * Reference to the parent project/system
     */
    projectRef?: string;
    /**
     * The organization this pipeline belongs to
     */
    organization?: string;
    /**
     * Promotion paths defining how releases flow between environments
     */
    promotionPaths?: PromotionPath[];
    /**
     * Index signature for JSON compatibility
     */
    [key: string]: JsonValue | undefined;
  };
}
