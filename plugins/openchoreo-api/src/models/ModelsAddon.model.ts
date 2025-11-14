import { JSONSchema7 } from 'json-schema';

/**
 * Addon list item - minimal metadata returned from list endpoint
 * @public
 */
export interface AddonListItem {
  /**
   * Unique identifier for the addon
   */
  name: string;
  /**
   * Creation timestamp (ISO format)
   */
  createdAt: string;
}

/**
 * Response from the Addon list API
 * GET /api/v1/orgs/{orgName}/traits
 * @public
 */
export interface AddonListResponse {
  /**
   * Success status
   */
  success: boolean;
  /**
   * Response data
   */
  data: {
    /**
     * Array of addon list items
     */
    items: AddonListItem[];
    /**
     * Total count of addons (for pagination)
     */
    totalCount: number;
    /**
     * Current page number
     */
    page: number;
    /**
     * Number of items per page
     */
    pageSize: number;
  };
}

/**
 * Response from the Addon schema API
 * GET /api/v1/orgs/{orgName}/traits/{addonName}/schema
 * @public
 */
export interface AddonSchemaResponse {
  /**
   * Success status
   */
  success: boolean;
  /**
   * JSONSchema7 for the addon's configuration parameters
   */
  data: JSONSchema7;
}

/**
 * Request parameters for listing addons
 * @public
 */
export interface AddonsGetRequest {
  orgName: string;
  page?: number;
  pageSize?: number;
}

/**
 * Request parameters for getting addon schema
 * @public
 */
export interface AddonSchemaGetRequest {
  orgName: string;
  addonName: string;
}
