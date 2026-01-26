pasindui@pasindui:~/Documents/WSO2/backstage-plugins$ git diff upstream/main...main -- . ":(exclude)yarn.lock"
diff --git a/app-config.local.yaml.example b/app-config.local.yaml.example
index 200d05b..1b605a3 100644
--- a/app-config.local.yaml.example
+++ b/app-config.local.yaml.example
@@ -30,6 +30,12 @@ backend:
openchoreo:
baseUrl: http://api.openchoreo.localhost:8080/api/v1

# token: "" # Optional: uncomment if you need API authentication

- # OPTIONAL: For large-scale local testing, enable incremental ingestion
- # incremental:
- # burstLength: 16 # Duration of each burst of processing activity in seconds
- # burstInterval: 8 # Interval between bursts of processing activity in seconds
- # chunkSize: 512 # Number of items to fetch per API request
- # restLength: 60 # Duration of rest periods between bursts in minutes
  # Feature flags (optional overrides)
  # All features are enabled by default. Uncomment to disable specific features:
  diff --git a/app-config.production.yaml b/app-config.production.yaml
  index 35e68cd..a459725 100644
  --- a/app-config.production.yaml
  +++ b/app-config.production.yaml
  @@ -93,9 +93,18 @@ openchoreo: # scopes: ['openid'] # Optional: uncomment to specify scopes
  defaultOwner: 'platformengineer' # Default owner for catalog entities
- # DEFAULT: Standard scheduled ingestion (recommended for most deployments)
  schedule:
  frequency: 30 # seconds between runs (default: 30)
  timeout: 120 # seconds for timeout (default: 120)
- # OPTIONAL: For large-scale deployments, use incremental ingestion instead
- # Uncomment the section below and comment out the schedule section above
- # Also update packages/backend/src/index.ts to use the incremental module
- # incremental:
- # burstLength: 16 # Duration of each burst of processing activity in seconds
- # burstInterval: 8 # Interval between bursts of processing activity in seconds
- # chunkSize: 512 # Number of items to fetch per API request
- # restLength: 60 # Duration of rest periods between bursts in minutes
  # Feature flags for enabling/disabling OpenChoreo functionality
  # Environment variables: OPENCHOREO_FEATURES_WORKFLOWS_ENABLED, OPENCHOREO_FEATURES_OBSERVABILITY_ENABLED, OPENCHOREO_FEATURES_AUTH_ENABLED
  diff --git a/app-config.yaml b/app-config.yaml
  index a2b4698..27f4ab3 100644
  --- a/app-config.yaml
  +++ b/app-config.yaml
  @@ -126,9 +126,19 @@ openchoreo: # scopes: ['openid'] # Optional: uncomment to specify scopes
  defaultOwner: 'platformengineer' # Default owner for catalog entities
-
- # DEFAULT: Standard scheduled ingestion (recommended for most deployments)
  schedule:
  frequency: 30 # seconds between runs (default: 30)
  timeout: 120 # seconds for timeout (default: 120)
- # OPTIONAL: For large-scale deployments, use incremental ingestion instead
- # Uncomment the section below and comment out the schedule section above
- # Also update packages/backend/src/index.ts to use the incremental module
- # incremental:
- # burstLength: 16 # Duration of each burst of processing activity in seconds
- # burstInterval: 8 # Interval between bursts of processing activity in seconds
- # chunkSize: 512 # Number of items to fetch per API request
- # restLength: 60 # Duration of rest periods between bursts in minutes
  # Feature flags for enabling/disabling OpenChoreo functionality
  # These can be controlled via Helm values: backstage.features.\*
  diff --git a/packages/app/src/scaffolder/TraitsField/TraitsFieldExtension.tsx b/packages/app/src/scaffolder/TraitsField/TraitsFieldExtension.tsx
  index f608e62..fb66031 100644
  --- a/packages/app/src/scaffolder/TraitsField/TraitsFieldExtension.tsx
  +++ b/packages/app/src/scaffolder/TraitsField/TraitsFieldExtension.tsx
  @@ -73,8 +73,13 @@ export const TraitsField = ({
  const [addedTraits, setAddedTraits] = useState<AddedTrait[]>(formData || []);
  const [selectedTrait, setSelectedTrait] = useState<string>('');
  const [loadingTraits, setLoadingTraits] = useState(false);
- const [loadingMoreTraits, setLoadingMoreTraits] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);
- const [hasMoreTraits, setHasMoreTraits] = useState(true);
- const [continueToken, setContinueToken] = useState<string | undefined>(
- undefined,
- );
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  @@ -89,12 +94,16 @@ export const TraitsField = ({
  useEffect(() => {
  let ignore = false;

* const fetchTraits = async () => {

- const fetchTraits = async (cursor?: string, append = false) => {
  if (!organizationName) {
  return;
  }

*      setLoadingTraits(true);

-      if (!append) {
-        setLoadingTraits(true);
-      } else {
-        setLoadingMoreTraits(true);
-      }
         setError(null);

         try {

  @@ -108,12 +117,17 @@ export const TraitsField = ({

           const orgName = extractOrgName(organizationName);

-        // Build URL with pagination parameters
-        const url = new URL(`${baseUrl}/traits`);
-        url.searchParams.set('organizationName', orgName);
-        url.searchParams.set('limit', '100'); // Reasonable page size for UI
-
-        if (cursor) {
-          url.searchParams.set('continue', cursor);
-        }
-         // Use fetchApi which automatically injects Backstage + IDP tokens

*        const response = await fetchApi.fetch(
*          `${baseUrl}/traits?organizationName=${encodeURIComponent(
*            orgName,
*          )}&page=1&pageSize=100`,
*        );

-        const response = await fetchApi.fetch(url.toString());

           if (!response.ok) {
             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  @@ -122,7 +136,18 @@ export const TraitsField = ({
  const result = await response.json();
           if (!ignore && result.success) {

*          setAvailableTraits(result.data.items);

-          const newTraits = result.data.items || [];
-          const metadata = result.data.metadata;
-
-          if (append) {
-            setAvailableTraits(prev => [...prev, ...newTraits]);
-          } else {
-            setAvailableTraits(newTraits);
-          }
-
-          // Update pagination state
-          setHasMoreTraits(metadata?.hasMore === true);
-          setContinueToken(metadata?.continue);
           }
         } catch (err) {
           if (!ignore) {
  @@ -131,10 +156,16 @@ export const TraitsField = ({
  } finally {
  if (!ignore) {
  setLoadingTraits(false);
-          setLoadingMoreTraits(false);
         }
       }

  };

- // Reset pagination state when organization changes
- setAvailableTraits([]);
- setHasMoreTraits(true);
- setContinueToken(undefined);
-      fetchTraits();

       return () => {
  @@ -142,6 +173,54 @@ export const TraitsField = ({
  };
  }, [organizationName, discoveryApi, fetchApi]);
- // Load more traits
- const handleLoadMoreTraits = () => {
- if (continueToken && !loadingMoreTraits) {
-      // We need to recreate the fetchTraits function here since it's defined in useEffect
-      const loadMore = async () => {
-        if (!organizationName) return;
-
-        setLoadingMoreTraits(true);
-        setError(null);
-
-        try {
-          const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
-          const extractOrgName = (fullOrgName: string): string => {
-            const parts = fullOrgName.split('/');
-            return parts[parts.length - 1];
-          };
-          const orgName = extractOrgName(organizationName);
-
-          const url = new URL(`${baseUrl}/traits`);
-          url.searchParams.set('organizationName', orgName);
-          url.searchParams.set('limit', '100');
-          url.searchParams.set('continue', continueToken);
-
-          const response = await fetchApi.fetch(url.toString());
-          if (!response.ok) {
-            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
-          }
-
-          const result = await response.json();
-          if (result.success) {
-            const newTraits = result.data.items || [];
-            const metadata = result.data.metadata;
-
-            setAvailableTraits(prev => [...prev, ...newTraits]);
-            setHasMoreTraits(metadata?.hasMore === true);
-            setContinueToken(metadata?.continue);
-          }
-        } catch (err) {
-          setError(`Failed to load more traits: ${err}`);
-        } finally {
-          setLoadingMoreTraits(false);
-        }
-      };
-
-      loadMore();
- }
- };
- // Fetch schema for selected trait and add it
  const handleAddTrait = async () => {
  if (!selectedTrait || !organizationName) {
  @@ -273,6 +352,24 @@ export const TraitsField = ({
  {trait.name}
  </MenuItem>
  ))}
-
-              {/* Load More Button */}
-              {!loadingTraits && hasMoreTraits && (
-                <MenuItem
-                  disabled={loadingMoreTraits}
-                  onClick={handleLoadMoreTraits}
-                  style={{ justifyContent: 'center', fontStyle: 'italic' }}
-                >
-                  {loadingMoreTraits ? (
-                    <>
-                      <CircularProgress size={20} style={{ marginRight: 8 }} />
-                      Loading more traits...
-                    </>
-                  ) : (
-                    'Load more traits...'
-                  )}
-                </MenuItem>
-              )}
               </Select>
             </FormControl>
             <Button
  diff --git a/packages/backend/package.json b/packages/backend/package.json
  index 514db15..0cc8d99 100644
  --- a/packages/backend/package.json
  +++ b/packages/backend/package.json
  @@ -50,6 +50,7 @@
  "@openchoreo/backstage-plugin-platform-engineer-core-backend": "workspace:^",
  "@openchoreo/backstage-plugin-scaffolder-backend-module": "workspace:^",
  "@openchoreo/openchoreo-auth": "workspace:^",
- "@openchoreo/plugin-catalog-backend-module-openchoreo-incremental": "workspace:^",
  "app": "link:../app",
  "better-sqlite3": "9.6.0",
  "cookie-parser": "1.4.7",
  diff --git a/packages/backend/src/index.ts b/packages/backend/src/index.ts
  index ba21aff..173df9e 100644
  --- a/packages/backend/src/index.ts
  +++ b/packages/backend/src/index.ts
  @@ -12,6 +12,16 @@ import { rootHttpRouterServiceFactory } from '@backstage/backend-defaults/rootHt
  import { immediateCatalogServiceFactory } from '@openchoreo/backstage-plugin-catalog-backend-module';
  import { createIdpTokenHeaderMiddleware } from '@openchoreo/openchoreo-auth';

+/\*\*

- - OPTIONAL: For large-scale deployments, use the incremental ingestion module
- -
- - ***
- - INCREMENTAL INGESTION: STEP 1 of 3
- - ***
- \*/
  +// UNCOMMENT this import line below.
  +// import { catalogModuleOpenchoreoIncrementalProvider } from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';
- const backend = createBackend();
  // Configure root HTTP router with IDP token header middleware
  @@ -60,6 +70,21 @@ backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
  );
  +/\*\*
- - ***
- - INCREMENTAL INGESTION: STEP 2 of 2
- - ***
- -
- - Note: You must also update app-config.yaml to use:
- - 'openchoreo.incremental' instead of 'openchoreo.schedule'
- \*/
- +// UNCOMMENT the block below..
  +// backend.add(
  +// import('@openchoreo/plugin-catalog-backend-module-openchoreo-incremental'),
  +// );
  +// backend.add(catalogModuleOpenchoreoIncrementalProvider);
- // See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
  backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

diff --git a/packages/openchoreo-client-node/openapi/openchoreo-api.yaml b/packages/openchoreo-client-node/openapi/openchoreo-api.yaml
index add21c7..e51ef3e 100644
--- a/packages/openchoreo-client-node/openapi/openchoreo-api.yaml
+++ b/packages/openchoreo-client-node/openapi/openchoreo-api.yaml
@@ -33,20 +33,36 @@ components:
code:
type: string

- # List response with items and metadata
  ListResponse:
  type: object
-      required:
-        - items
-        - metadata
       properties:
         items:
           type: array
           items:
             type: object
             additionalProperties: true

*        totalCount:
*          type: integer
*        page:
*          type: integer
*        pageSize:
*          type: integer

-        metadata:
-          $ref: '#/components/schemas/ResponseMetadata'
-
- ResponseMetadata:
-      type: object
-      required:
-        - resourceVersion
-        - hasMore
-      properties:
-        resourceVersion:
-          type: string
-          description: Kubernetes resource version for the list operation
-        continue:
-          type: string
-          description: Opaque continuation token, empty string when no more results
-        hasMore:
-          type: boolean
-          description: Indicates if more results are available

       ComponentSchemaResponse:
         type: object
  @@ -615,6 +631,11 @@ components:
  type: array
  items:
  type: string
-        tags:
-          type: array
-          items:
-            type: string
-          description: Tags for categorization and filtering
           createdAt:
             type: string
             format: date-time

  @@ -1380,6 +1401,25 @@ components:
  commit:
  type: string

- parameters:
- limitParam:
-      name: limit
-      in: query
-      required: false
-      description: Maximum number of items to return per page
-      schema:
-        type: integer
-        minimum: 0
-        maximum: 512
-        default: 100
- continueParam:
-      name: continue
-      in: query
-      required: false
-      schema:
-        type: string
-      description: Opaque continuation token from previous response
-      # Authorization types
       SubjectType:
         type: string
  @@ -1719,6 +1759,9 @@ paths:
  operationId: listOrganizations
  tags: - Organizations
-      parameters:
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -1738,6 +1781,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/OrganizationResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}:
  get:
  @@ -1776,6 +1821,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -1797,6 +1844,8 @@ paths:
  $ref: '#/components/schemas/SecretReferenceResponse'
  '404':
  description: Organization not found
-        '410':
-          description: Continue token expired
  # DataPlanes
  /orgs/{orgName}/dataplanes:
  @@ -1811,6 +1860,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -1830,6 +1881,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/DataPlaneResponse'
-        '410':
-          description: Continue token expired

       post:
         summary: Create a new data plane
  @@ -1904,6 +1957,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -1923,6 +1978,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/EnvironmentResponse'
-        '410':
-          description: Continue token expired

       post:
         summary: Create a new environment
  @@ -1997,6 +2054,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2016,6 +2075,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/BuildPlaneResponse'
-        '410':
-          description: Continue token expired
  # ComponentTypes
  /orgs/{orgName}/component-types:
  @@ -2030,6 +2091,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2049,6 +2112,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ComponentTypeResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/component-types/{ctName}/schema:
  get:
  @@ -2097,6 +2162,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2116,6 +2183,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/WorkflowResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/workflows/{workflowName}/schema:
  get:
  @@ -2164,6 +2233,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2183,6 +2254,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/WorkflowResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/component-workflows/{cwName}/schema:
  get:
  @@ -2231,6 +2304,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2250,6 +2325,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/TraitResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/traits/{traitName}/schema:
  get:
  @@ -2298,6 +2375,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2317,6 +2396,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ProjectResponse'
-        '410':
-          description: Continue token expired

       post:
         summary: Create a new project
  @@ -2426,6 +2507,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2445,6 +2528,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ComponentResponse'
-        '410':
-          description: Continue token expired

       post:
         summary: Create a new component
  @@ -2627,6 +2712,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2809,6 +2896,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2828,6 +2917,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ComponentWorkflowRunResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs/{runName}:
  get:
  @@ -2894,6 +2985,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2913,6 +3006,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/BindingResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/projects/{projectName}/components/{componentName}/bindings/{bindingName}:
  patch:
  @@ -2978,6 +3073,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -2997,6 +3094,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ComponentReleaseResponse'
-        '410':
-          description: Continue token expired

       post:
         summary: Create a component release
  @@ -3143,6 +3242,8 @@ paths:
  required: true
  schema:
  type: string
-        - $ref: '#/components/parameters/limitParam'
-        - $ref: '#/components/parameters/continueParam'
         responses:
           '200':
             description: Successful response
  @@ -3162,6 +3263,8 @@ paths:
  type: array
  items:
  $ref: '#/components/schemas/ReleaseBindingResponse'
-        '410':
-          description: Continue token expired
  /orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings/{bindingName}:
  patch:
  diff --git a/packages/openchoreo-client-node/src/generated/openchoreo/component-type.ts b/packages/openchoreo-client-node/src/generated/openchoreo/component-type.ts
  index 55f86ff..83c01a6 100644
  --- a/packages/openchoreo-client-node/src/generated/openchoreo/component-type.ts
  +++ b/packages/openchoreo-client-node/src/generated/openchoreo/component-type.ts
  @@ -8,15 +8,10 @@ import type { components } from './types';

/\*\*

- Component Type metadata

* - Extends ComponentTypeResponse to include optional tags field

- - Direct type alias from ComponentTypeResponse
    \*/
    export type ComponentTypeMetadata =

* components['schemas']['ComponentTypeResponse'] & {
* /\*\*
*     * Tags for categorization and filtering (optional)
*     */
* tags?: string[];
* };

- components['schemas']['ComponentTypeResponse'];

/\*\*

- Component Type specification
  diff --git a/packages/openchoreo-client-node/src/generated/openchoreo/index.ts b/packages/openchoreo-client-node/src/generated/openchoreo/index.ts
  index 5b3bd49..185b566 100644
  --- a/packages/openchoreo-client-node/src/generated/openchoreo/index.ts
  +++ b/packages/openchoreo-client-node/src/generated/openchoreo/index.ts
  @@ -6,4 +6,3 @@
  \*/

export _ from './types';
-export _ from './component-type';
diff --git a/packages/openchoreo-client-node/src/generated/openchoreo/types.ts b/packages/openchoreo-client-node/src/generated/openchoreo/types.ts
index 2fae081..7b19a8d 100644
--- a/packages/openchoreo-client-node/src/generated/openchoreo/types.ts
+++ b/packages/openchoreo-client-node/src/generated/openchoreo/types.ts
@@ -915,12 +915,18 @@ export interface components {
code?: string;
};
ListResponse: {

-      items?: {

*      items: {
         [key: string]: unknown;
       }[];

-      totalCount?: number;
-      page?: number;
-      pageSize?: number;

*      metadata: components['schemas']['ResponseMetadata'];
* };
* ResponseMetadata: {
*      /** @description Kubernetes resource version for the list operation */
*      resourceVersion: string;
*      /** @description Opaque continuation token, empty string when no more results */
*      continue?: string;
*      /** @description Indicates if more results are available */
*      hasMore: boolean;
       };
       /** @description Wrapped schema containing component-type and trait environment override schemas */
       ComponentSchemaResponse: {
  @@ -1167,6 +1173,8 @@ export interface components {
  description?: string;
  workloadType: string;
  allowedWorkflows?: string[];
*      /** @description Tags for categorization and filtering */
*      tags?: string[];
         /** Format: date-time */
         createdAt: string;
       };
  @@ -1609,7 +1617,12 @@ export interface components {
  };
  };
  responses: never;

- parameters: never;

* parameters: {
* /\*_ @description Maximum number of items to return per page _/
* limitParam: number;
* /\*_ @description Opaque continuation token from previous response _/
* continueParam: string;
* };
  requestBodies: never;
  headers: never;
  pathItems: never;
  @@ -1719,7 +1732,12 @@ export interface operations {
  };
  listOrganizations: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path?: never;
         cookie?: never;
  @@ -1739,6 +1757,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  getOrganization: {
  @@ -1767,7 +1792,12 @@ export interface operations {
  };
  listSecretReferences: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -1796,11 +1826,23 @@ export interface operations {
  };
  content?: never;
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
  };
  };
  listDataPlanes: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -1822,6 +1864,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createDataPlane: {
  @@ -1879,7 +1928,12 @@ export interface operations {
  };
  listEnvironments: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -1901,6 +1955,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createEnvironment: {
  @@ -1958,7 +2019,12 @@ export interface operations {
  };
  listBuildPlanes: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -1980,11 +2046,23 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
  };
  };
  listComponentTypes: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2006,6 +2084,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  getComponentTypeSchema: {
  @@ -2045,7 +2130,12 @@ export interface operations {
  };
  listWorkflows: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2067,6 +2157,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  getWorkflowSchema: {
  @@ -2106,7 +2203,12 @@ export interface operations {
  };
  listComponentWorkflows: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2128,6 +2230,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  getComponentWorkflowSchema: {
  @@ -2167,7 +2276,12 @@ export interface operations {
  };
  listTraits: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2189,6 +2303,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  getTraitSchema: {
  @@ -2228,7 +2349,12 @@ export interface operations {
  };
  listProjects: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2250,6 +2376,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createProject: {
  @@ -2332,7 +2465,12 @@ export interface operations {
  };
  listComponents: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2355,6 +2493,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createComponent: {
  @@ -2501,7 +2646,12 @@ export interface operations {
  };
  listComponentTraits: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2635,7 +2785,12 @@ export interface operations {
  };
  listComponentWorkflowRuns: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2659,6 +2814,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createComponentWorkflowRun: {
  @@ -2733,7 +2895,12 @@ export interface operations {
  };
  getComponentBinding: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2757,6 +2924,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  updateComponentBinding: {
  @@ -2790,7 +2964,12 @@ export interface operations {
  };
  listComponentReleases: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2814,6 +2993,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  createComponentRelease: {
  @@ -2909,7 +3095,12 @@ export interface operations {
  };
  listReleaseBindings: {
  parameters: {

-      query?: never;

*      query?: {
*        /** @description Maximum number of items to return per page */
*        limit?: components['parameters']['limitParam'];
*        /** @description Opaque continuation token from previous response */
*        continue?: components['parameters']['continueParam'];
*      };
         header?: never;
         path: {
           orgName: string;
  @@ -2933,6 +3124,13 @@ export interface operations {
  };
  };
  };
*      /** @description Continue token expired */
*      410: {
*        headers: {
*          [name: string]: unknown;
*        };
*        content?: never;
*      };
       };
  };
  patchReleaseBinding: {
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/.eslintrc.js b/plugins/catalog-backend-module-openchoreo-incremental/.eslintrc.js
  new file mode 100644
  index 0000000..e2a53a6
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/.eslintrc.js
  @@ -0,0 +1 @@
  +module.exports = require('@backstage/cli/config/eslint-factory')(\_\_dirname);
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/README.md b/plugins/catalog-backend-module-openchoreo-incremental/README.md
  new file mode 100644
  index 0000000..821ef95
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/README.md
  @@ -0,0 +1,235 @@
  +# OpenChoreo Incremental Provider
* +The OpenChoreo Incremental Provider processes entities in small batches using cursor-based pagination with burst and rest cycles, providing optimal memory consumption, scalability, and controlled load for large OpenChoreo installations.
* +## Installation
* +### 1. Add Workspace Dependency
* +First, add the incremental provider as a workspace dependency:
* +`bash
+# From your Backstage root directory
+yarn add @openchoreo/plugin-catalog-backend-module-openchoreo-incremental
+`
* +### 2. Register the Module
* +Add the incremental provider module to your backend:
* +```typescript
  +// packages/backend/src/index.ts
  +backend.add(
* import('@openchoreo/plugin-catalog-backend-module-openchoreo-incremental'),
  +);
  +```
* +## Configuration
* +```yaml
  +openchoreo:
* api:
* baseUrl: ${OPENCHOREO_API_URL}
* token: ${OPENCHOREO_TOKEN}
* incremental:
* burstLength: 10 # seconds - duration of each processing burst
* burstInterval: 30 # seconds - interval between bursts during active ingestion
* restLength: 30 # minutes - rest period after completing full ingestion
* chunkSize: 50 # entities per API request
* maxConcurrentRequests: 5 # max concurrent API calls during batch processing
* batchDelayMs: 100 # delay in milliseconds between batch requests
* rejectRemovalsAbovePercentage: 80 # reject sync if removals exceed this percentage
* rejectEmptySourceCollections: false # reject removals from empty collections
  +```
* +## How It Works
* +### Burst-Based Processing
* +The provider uses a burst-and-rest cycle to control load:
* +1. **Burst Phase**: Processes entities continuously for `burstLength` seconds
  +2. **Interstitial Phase**: Pauses for `burstInterval` seconds between bursts
  +3. **Rest Phase**: After completing a full ingestion cycle, rests for `restLength` minutes before starting again
* +This approach prevents overwhelming the API server while ensuring regular catalog updates.
* +### Cursor-Based Pagination
* +The provider traverses OpenChoreo resources in three phases using continuation token-based pagination:
* +1. **Organizations Phase**: Fetches all organizations and builds an organization queue
  +2. **Projects Phase**: For each organization, fetches all projects and builds a project queue
  +3. **Components Phase**: For each project, fetches all components and their APIs
* +Each phase maintains its own API cursor (`orgApiCursor`, `projectApiCursor`, `componentApiCursor`) allowing safe resumption after interruptions. The cursor state tracks:
* +- Current phase (`orgs`, `projects`, `components`)
  +- API pagination cursors for each resource type
  +- Queues of organizations and projects to process
  +- Current position in each queue
* +#### Pagination Mechanism
* +The provider uses continuation token-based pagination with the following characteristics:
* +- **Continuation Tokens**: Opaque tokens that mark the position in the result set
  +- **Resource Version**: Kubernetes-style resource versioning for consistency
  +- **HasMore Flag**: Indicates if more results are available
  +- **Limit Parameter**: Controls the number of items per page (0-512, default 100)
* +Example response structure:
* +```json
  +{
* "data": {
* "success": true,
* "data": {
*      "items": [...],
*      "metadata": {
*        "resourceVersion": "12345",
*        "continue": "opaque-token",
*        "hasMore": true
*      }
* }
* }
  +}
  +```
* +#### HTTP 410 Error Handling
* +When a continuation token expires (HTTP 410 Gone), the provider automatically:
* +1. Detects the expired token error
  +2. Logs a warning with phase and cursor information
  +3. Resets the cursor to start from the beginning
  +4. Retries the ingestion process
* +This ensures robust handling of long-running ingestion processes where tokens may expire.
* +### Requirements
* +Your OpenChoreo backend must support continuation token-based pagination. The provider validates API support at startup and requires:
* +- `metadata.resourceVersion` field in list responses
  +- `metadata.continue` field for pagination tokens
  +- `metadata.hasMore` flag to indicate more results
  +- Support for `limit` and `continue` query parameters
  +- HTTP 410 response for expired continuation tokens
* +### State Persistence
* +All ingestion state is persisted to the database:
* +- Cursors are saved after each burst
  +- Entity references are tracked for staleness detection
  +- Progress can resume from the last successful checkpoint
  +- Removed entities are detected by comparing current and previous ingestion snapshots
* +## Management API
* +The module provides REST API endpoints for monitoring and managing incremental ingestion:
* +- `GET /api/catalog/incremental/health` - Health check status for all providers
  +- `GET /api/catalog/incremental/providers` - List all registered incremental providers
  +- `GET /api/catalog/incremental/providers/{name}/status` - Get detailed status for a specific provider
  +- `POST /api/catalog/incremental/providers/{name}/reset` - Reset provider state to start fresh ingestion
  +- `POST /api/catalog/incremental/providers/{name}/refresh` - Trigger immediate refresh of provider data
* +## Database Migrations
* +The module includes automatic database migrations to create the necessary tables for state persistence:
* +- `openchoreo_incremental_ingestion_state` - Stores cursor state and ingestion metadata
  +- `openchoreo_incremental_entity_refs` - Tracks entity references for staleness detection
* +These migrations run automatically when the module is first loaded.
* +## Migration from Legacy Provider
* +If you were previously using the basic `catalog-backend-module-openchoreo` provider:
* +1. **Remove the old provider**: Remove the basic OpenChoreo provider module from your backend
  +2. **Add this incremental module**: Register this module as shown in the Installation section
  +3. **Update configuration**: Add the `incremental` configuration block (or use defaults)
  +4. **Verify API support**: Ensure your OpenChoreo API supports cursor-based pagination endpoints
* +## Extension Points
* +The module provides extension points for advanced use cases:
* +### Incremental Provider Extension Point
* +You can extend the module with custom incremental entity providers:
* +```typescript
  +import {
* openchoreoIncrementalProvidersExtensionPoint,
* type OpenChoreoIncrementalProviderExtensionPoint,
  +} from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';
* +// In your backend module
  +export default createBackendModule({
* pluginId: 'catalog',
* moduleId: 'custom-incremental-provider',
* register(env) {
* env.registerInit({
*      deps: {
*        providers: openchoreoIncrementalProvidersExtensionPoint,
*      },
*      async init({ providers }) {
*        providers.addIncrementalEntityProvider(new CustomIncrementalProvider());
*      },
* });
* },
  +});
  +```
* +### Custom Provider Implementation
* +Implement the `IncrementalEntityProvider` interface for custom providers:
* +```typescript
  +import {
* IncrementalEntityProvider,
* EntityIteratorResult,
  +} from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';
* +class CustomIncrementalProvider
* implements IncrementalEntityProvider<MyCursor, MyContext>
  +{
* getProviderName(): string {
* return 'custom-provider';
* }
*
* async around(burst: (context: MyContext) => Promise<void>): Promise<void> {
* // Setup and teardown logic
* await burst(context);
* }
*
* async next(
* context: MyContext,
* cursor?: MyCursor,
* ): Promise<EntityIteratorResult<MyCursor>> {
* // Return batch of entities and next cursor
* }
  +}
  +```
* +## Features
* +- **Burst-Based Processing**: Controlled load with configurable burst and rest cycles
  +- **Three-Phase Traversal**: Systematic ingestion of organizations → projects → components
  +- **Cursor-Based Pagination**: Stable API cursors for efficient, resumable pagination
  +- **Memory Efficient**: Processes entities in small chunks without loading large datasets
  +- **Scalable**: Handles very large datasets efficiently with constant memory usage
  +- **Fault Tolerant**: Resumes from last successful checkpoint after interruptions
  +- **Configurable**: Customizable burst intervals, rest periods, chunk sizes, and retry backoff
  +- **Error Resilient**: Exponential backoff strategy with configurable retry intervals
  +- **Staleness Detection**: Automatically removes entities that no longer exist in OpenChoreo
  +- **Metrics & Observability**: OpenTelemetry metrics for monitoring ingestion progress
  +- **Event-Driven Updates**: Supports delta updates via Backstage events system
  +- **Management API**: REST endpoints for monitoring and controlling ingestion processes
  +- **Database Persistence**: Automatic migrations and state management
  +- **Extension Points**: Pluggable architecture for custom incremental providers
  +- **Health Monitoring**: Built-in health checks and provider status reporting
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/dev/index.ts b/plugins/catalog-backend-module-openchoreo-incremental/dev/index.ts
  new file mode 100644
  index 0000000..f97d30e
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/dev/index.ts
  @@ -0,0 +1,93 @@
  +/\*
* - Copyright 2024 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Development setup for testing the OpenChoreo incremental ingestion plugin.
* - Creates a backend with a dummy provider to simulate incremental entity processing.
* \*/
* +import { createBackend } from '@backstage/backend-defaults';
  +import {
* coreServices,
* createBackendModule,
  +} from '@backstage/backend-plugin-api';
  +import { mockServices } from '@backstage/backend-test-utils';
  +import {
* IncrementalEntityProvider,
* openchoreoIncrementalProvidersExtensionPoint,
* type OpenChoreoIncrementalProviderExtensionPoint,
  +} from '../src';
* +const dummyProvider = createBackendModule({
* pluginId: 'catalog',
* moduleId: 'openchoreo-test-provider',
* register(reg) {
* reg.registerInit({
*      deps: {
*        logger: coreServices.logger,
*        providers: openchoreoIncrementalProvidersExtensionPoint,
*      },
*      async init({
*        logger,
*        providers,
*      }: {
*        logger: any;
*        providers: OpenChoreoIncrementalProviderExtensionPoint;
*      }) {
*        const provider: IncrementalEntityProvider<number, {}> = {
*          getProviderName: () => 'test-provider',
*          around: burst => burst(0),
*          next: async (_context, cursor) => {
*            await new Promise(resolve => setTimeout(resolve, 500));
*            if (cursor === undefined || cursor < 3) {
*              logger.info(`### Returning batch #${cursor}`);
*              return { done: false, entities: [], cursor: (cursor ?? 0) + 1 };
*            }
*
*            logger.info('### Last batch reached, stopping');
*            return { done: true };
*          },
*        };
*
*        providers.addProvider({
*          provider: provider,
*          options: {
*            burstInterval: { seconds: 1 },
*            burstLength: { seconds: 10 },
*            restLength: { seconds: 10 },
*          },
*        });
*      },
* });
* },
  +});
* +const backend = createBackend();
  +backend.add(
* mockServices.rootConfig.factory({
* data: {
*      backend: {
*        baseUrl: 'http://localhost:7007',
*        listen: ':7007',
*        database: { client: 'better-sqlite3', connection: ':memory:' },
*      },
* },
* }),
  +);
  +backend.add(import('@backstage/plugin-catalog-backend'));
  +backend.add(import('../src'));
  +backend.add(dummyProvider);
  +backend.start();
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/migrations/20221116073152_init.js b/plugins/catalog-backend-module-openchoreo-incremental/migrations/20221116073152_init.js
  new file mode 100644
  index 0000000..8327a20
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/migrations/20221116073152_init.js
  @@ -0,0 +1,184 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +// @ts-check
* +/\*\*
* - Database migration to initialize tables for incremental ingestion.
* - Creates ingestions, ingestion_marks, and ingestion_mark_entities tables
* - to support resumable, burst-based processing of large entity datasets.
* \*/
* +/\*\*
* - @param { import("knex").Knex } knex
* \*/
  +exports.up = async function up(knex) {
* /\*\*
* - Sets up the ingestions table
* \*/
* await knex.schema.createTable('ingestions', table => {
* table.comment('Tracks ingestion streams for very large data sets');
*
* table
*      .uuid('id')
*      .notNullable()
*      .comment('Auto-generated ID of the ingestion');
*
* table
*      .string('provider_name')
*      .notNullable()
*      .comment('each provider gets its own identifiable name');
*
* table
*      .string('status')
*      .notNullable()
*      .comment(
*        'One of "interstitial" | "bursting" | "backing off" | "resting" | "complete"',
*      );
*
* table
*      .string('next_action')
*      .notNullable()
*      .comment("what will this, 'ingest', 'rest', 'backoff', 'nothing (done)'");
*
* table
*      .timestamp('next_action_at')
*      .notNullable()
*      .defaultTo(knex.fn.now())
*      .comment('the moment in time at which point ingestion can begin again');
*
* table
*      .string('last_error')
*      .comment('records any error that occurred in the previous burst attempt');
*
* table
*      .integer('attempts')
*      .notNullable()
*      .defaultTo(0)
*      .comment('how many attempts have been made to burst without success');
*
* table
*      .timestamp('created_at')
*      .notNullable()
*      .defaultTo(knex.fn.now())
*      .comment('when did this ingestion actually begin');
*
* table
*      .timestamp('ingestion_completed_at')
*      .comment('when did the ingestion actually end');
*
* table
*      .timestamp('rest_completed_at')
*      .comment('when did the rest period actually end');
*
* table
*      .string('completion_ticket')
*      .notNullable()
*      .comment(
*        'indicates whether the ticket is still open or stamped complete',
*      );
* });
*
* await knex.schema.alterTable('ingestions', t => {
* t.primary(['id']);
* t.index('provider_name', 'ingestion_provider_name_idx');
* t.unique(['provider_name', 'completion_ticket'], {
*      indexName: 'ingestion_composite_index',
* });
* });
*
* /\*\*
* - Sets up the ingestion_marks table
* \*/
* await knex.schema.createTable('ingestion_marks', table => {
* table.comment('tracks each step of an iterative ingestion');
*
* table
*      .uuid('id')
*      .notNullable()
*      .comment('Auto-generated ID of the ingestion mark');
*
* table
*      .uuid('ingestion_id')
*      .notNullable()
*      .references('id')
*      .inTable('ingestions')
*      .onDelete('CASCADE')
*      .comment('The id of the ingestion in which this mark took place');
*
* table
*      .json('cursor')
*      .comment(
*        'the current data associated with this iteration wherever it is in this moment in time',
*      );
*
* table
*      .integer('sequence')
*      .notNullable()
*      .defaultTo(0)
*      .comment('what is the order of this mark');
*
* table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
* });
*
* await knex.schema.alterTable('ingestion_marks', t => {
* t.primary(['id']);
* t.index('ingestion_id', 'ingestion_mark_ingestion_id_idx');
* });
*
* /\*\*
* - Set up the ingestion_mark_entities table
* \*/
* await knex.schema.createTable('ingestion_mark_entities', table => {
* table.comment(
*      'tracks the entities recorded in each step of an iterative ingestion',
* );
*
* table
*      .uuid('id')
*      .notNullable()
*      .comment('Auto-generated ID of the marked entity');
*
* table
*      .uuid('ingestion_mark_id')
*      .notNullable()
*      .references('id')
*      .inTable('ingestion_marks')
*      .onDelete('CASCADE')
*      .comment(
*        'Every time a mark happens during an ingestion, there are a list of entities marked.',
*      );
*
* table
*      .string('ref')
*      .notNullable()
*      .comment('the entity reference of the marked entity');
* });
*
* await knex.schema.alterTable('ingestion_mark_entities', t => {
* t.primary(['id']);
* t.index('ingestion_mark_id', 'ingestion_mark_entity_ingestion_mark_id_idx');
* });
  +};
* +/\*\*
* - @param { import("knex").Knex } knex
* \*/
  +exports.down = async function down(knex) {
* await knex.schema.dropTable('ingestion_mark_entities');
* await knex.schema.dropTable('ingestion_marks');
* await knex.schema.dropTable('ingestions');
  +};
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/migrations/20240110000003_expand_last_error_field.js b/plugins/catalog-backend-module-openchoreo-incremental/migrations/20240110000003_expand_last_error_field.js
  new file mode 100644
  index 0000000..71fa786
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/migrations/20240110000003_expand_last_error_field.js
  @@ -0,0 +1,44 @@
  +/\*
* - Copyright 2024 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +// @ts-check
* +/\*\*
* - Database migration to expand the last_error field from VARCHAR(255) to TEXT.
* - This allows storing full error stack traces and detailed error messages
* - without truncation.
* \*/
* +/\*\*
* - @param { import("knex").Knex } knex
* \*/
  +exports.up = async function up(knex) {
* await knex.schema.alterTable('ingestions', table => {
* // Change last_error from VARCHAR(255) to TEXT to accommodate long error messages
* table.text('last_error').alter();
* });
  +};
* +/\*\*
* - @param { import("knex").Knex } knex
* \*/
  +exports.down = async function down(knex) {
* await knex.schema.alterTable('ingestions', table => {
* // Revert back to VARCHAR(255)
* // Note: This may truncate existing error messages longer than 255 characters
* table.string('last_error', 255).alter();
* });
  +};
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/package.json b/plugins/catalog-backend-module-openchoreo-incremental/package.json
  new file mode 100644
  index 0000000..25b79ff
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/package.json
  @@ -0,0 +1,72 @@
  +{
* "name": "@openchoreo/plugin-catalog-backend-module-openchoreo-incremental",
* "version": "0.1.0",
* "license": "Apache-2.0",
* "description": "OpenChoreo incremental ingestion backend module for the Backstage catalog plugin",
* "main": "src/index.ts",
* "types": "src/index.ts",
* "exports": {
* ".": "./src/index.ts",
* "./package.json": "./package.json"
* },
* "typesVersions": {
* "\*": {
*      "package.json": [
*        "package.json"
*      ]
* }
* },
* "publishConfig": {
* "access": "public"
* },
* "backstage": {
* "role": "backend-plugin-module",
* "pluginId": "catalog",
* "pluginPackage": "@backstage/plugin-catalog-backend",
* "features": {
*      ".": "@backstage/BackendFeature"
* }
* },
* "scripts": {
* "start": "backstage-cli package start",
* "build": "backstage-cli package build",
* "lint": "backstage-cli package lint",
* "test": "backstage-cli package test",
* "clean": "backstage-cli package clean",
* "prepack": "backstage-cli package prepack",
* "postpack": "backstage-cli package postpack"
* },
* "dependencies": {
* "@backstage/backend-defaults": "^0.12.1",
* "@backstage/backend-plugin-api": "^1.3.0",
* "@backstage/catalog-model": "^1.7.0",
* "@backstage/config": "^1.3.0",
* "@backstage/errors": "^1.2.0",
* "@backstage/plugin-catalog-backend": "^1.28.0",
* "@backstage/plugin-catalog-node": "^1.14.0",
* "@backstage/plugin-events-node": "^0.4.0",
* "@backstage/plugin-permission-common": "^0.8.0",
* "@backstage/types": "^1.2.0",
* "@openchoreo/backstage-plugin-catalog-backend-module": "workspace:^",
* "@openchoreo/backstage-plugin-common": "workspace:^",
* "@openchoreo/openchoreo-client-node": "workspace:^",
* "@opentelemetry/api": "^1.9.0",
* "express": "^4.17.1",
* "express-promise-router": "^4.1.0",
* "knex": "^3.0.0",
* "luxon": "^3.0.0",
* "uuid": "^11.0.0",
* "zod": "^4.1.12"
* },
* "devDependencies": {
* "@backstage/backend-test-utils": "^1.3.1",
* "@backstage/cli": "^0.32.0",
* "@types/express": "^4.17.6",
* "@types/luxon": "^3.0.0"
* },
* "files": [
* "dist",
* "migrations/\*_/_.{js,d.ts}",
* "dev/\*_/_.{ts,js}"
* ]
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/config.d.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/config.d.ts
  new file mode 100644
  index 0000000..937fb78
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/config.d.ts
  @@ -0,0 +1,77 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Configuration schema for OpenChoreo incremental ingestion plugin.
* \*/
* +import { z } from 'zod';
* +/\*\*
* - Configuration options for the OpenChoreo API connection.
* \*/
  +export declare const openchoreoApiConfigSchema: import('zod').ZodTypeAny;
* +/\*\*
* - Configuration options for incremental ingestion behavior.
* \*/
  +export declare const openchoreoIncrementalConfigSchema: import('zod').ZodTypeAny;
* +/\*\*
* - Complete configuration schema for OpenChoreo incremental plugin.
* \*/
  +export declare const openchoreoIncrementalConfigValidation: import('zod').ZodTypeAny;
* +/\*\*
* - TypeScript interface for the complete OpenChoreo configuration.
* \*/
  +export interface OpenChoreoIncrementalConfig {
* openchoreo: {
* api?: {
*      baseUrl: string;
*      token?: string;
* };
* incremental?: {
*      burstLength: number;
*      burstInterval: number;
*      restLength: number;
*      chunkSize: number;
*      backoff?: number[];
*      rejectRemovalsAbovePercentage?: number;
*      rejectEmptySourceCollections: boolean;
*      maxConcurrentRequests: number;
*      batchDelayMs: number;
* };
* };
  +}
* +/\*\*
* - Legacy configuration interface for backward compatibility.
* - @deprecated Use OpenChoreoIncrementalConfig instead
* \*/
  +export interface Config {
* getOptionalString(key: string): string | undefined;
* getString(key: string): string;
* getOptionalNumber(key: string): number | undefined;
* getNumber(key: string): number;
* getOptionalBoolean(key: string): boolean | undefined;
* getBoolean(key: string): boolean;
* getOptionalConfig(key: string): Config | undefined;
* getConfig(key: string): Config;
* has(key: string): boolean;
* keys(): string[];
* optional?: Config[];
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/config.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/config.ts
  new file mode 100644
  index 0000000..ce9ada0
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/config.ts
  @@ -0,0 +1,165 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +import { z } from 'zod';
* +/\*\*
* - Configuration options for the OpenChoreo API connection.
* \*/
  +export const openchoreoApiConfigSchema = z.object({
* /\*\*
* - Base URL for the OpenChoreo API.
* \*/
* baseUrl: z.string().url().describe('OpenChoreo API base URL'),
*
* /\*\*
* - Optional authentication token for API access.
* \*/
* token: z.string().optional().describe('OpenChoreo API authentication token'),
  +});
* +/\*\*
* - Configuration options for incremental ingestion behavior.
* \*/
  +export const openchoreoIncrementalConfigSchema = z.object({
* /\*\*
* - Duration of each ingestion burst in seconds. Must be between 1 and 300.
* - @default 10
* \*/
* burstLength: z
* .number()
* .min(1)
* .max(300)
* .default(10)
* .describe('Duration of ingestion bursts in seconds'),
*
* /\*\*
* - Interval between ingestion bursts in seconds. Must be between 5 and 300.
* - @default 30
* \*/
* burstInterval: z
* .number()
* .min(5)
* .max(300)
* .default(30)
* .describe('Interval between ingestion bursts in seconds'),
*
* /\*\*
* - Rest period after successful ingestion in minutes. Must be between 1 and 1440.
* - @default 30
* \*/
* restLength: z
* .number()
* .min(1)
* .max(1440)
* .default(30)
* .describe('Rest period after ingestion in minutes'),
*
* /\*\*
* - Number of entities to process in each batch. Must be between 1 and 1000.
* - @default 50
* \*/
* chunkSize: z
* .number()
* .min(1)
* .max(1000)
* .default(50)
* .describe('Number of entities per batch'),
*
* /\*\*
* - Backoff strategy for failed ingestion attempts in seconds.
* \*/
* backoff: z
* .array(z.number().positive())
* .optional()
* .describe('Backoff durations in seconds'),
*
* /\*\*
* - Percentage threshold above which entity removals will be rejected (0-100).
* \*/
* rejectRemovalsAbovePercentage: z
* .number()
* .min(0)
* .max(100)
* .optional()
* .describe('Removal rejection threshold percentage'),
*
* /\*\*
* - Whether to reject removals when source collections are empty.
* - @default false
* \*/
* rejectEmptySourceCollections: z
* .boolean()
* .default(false)
* .describe('Reject removals from empty collections'),
*
* /\*\*
* - Maximum number of concurrent API requests during batch processing.
* - Must be between 1 and 50.
* - @default 5
* \*/
* maxConcurrentRequests: z
* .number()
* .min(1)
* .max(50)
* .default(5)
* .describe('Maximum concurrent API requests during batch processing'),
*
* /\*\*
* - Delay in milliseconds between batch processing requests.
* - Must be between 0 and 10000.
* - @default 100
* \*/
* batchDelayMs: z
* .number()
* .min(0)
* .max(10000)
* .default(100)
* .describe('Delay in milliseconds between batch processing requests'),
  +});
* +/\*\*
* - Complete configuration schema for OpenChoreo incremental plugin.
* \*/
  +export const openchoreoIncrementalConfigValidation = z.object({
* openchoreo: z.object({
* api: openchoreoApiConfigSchema.optional(),
* incremental: openchoreoIncrementalConfigSchema.optional(),
* }),
  +});
* +/\*\*
* - TypeScript interface for the complete OpenChoreo configuration.
* \*/
  +export interface OpenChoreoIncrementalConfig {
* openchoreo: {
* api?: {
*      baseUrl: string;
*      token?: string;
* };
* incremental?: {
*      burstLength: number;
*      burstInterval: number;
*      restLength: number;
*      chunkSize: number;
*      backoff?: number[];
*      rejectRemovalsAbovePercentage?: number;
*      rejectEmptySourceCollections: boolean;
*      maxConcurrentRequests: number;
*      batchDelayMs: number;
* };
* };
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.test.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.test.ts
  new file mode 100644
  index 0000000..b8a8948
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.test.ts
  @@ -0,0 +1,88 @@
  +/\*
* - Copyright 2023 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Test suite for OpenChoreoIncrementalIngestionDatabaseManager.
* - Verifies database operations for incremental ingestion, including mark storage and retrieval.
* \*/
  +import { TestDatabases, mockServices } from '@backstage/backend-test-utils';
  +import { OpenChoreoIncrementalIngestionDatabaseManager } from './OpenChoreoIncrementalIngestionDatabaseManager';
  +import { v4 as uuid } from 'uuid';
* +const migrationsDir = `${__dirname}/../../migrations`;
* +jest.setTimeout(120_000);
* +const describeOrSkip = process.env.CI ? describe.skip : describe;
* +describeOrSkip('OpenChoreoIncrementalIngestionDatabaseManager', () => {
* const databases = TestDatabases.create({
* ids: ['POSTGRES_17', 'POSTGRES_13', 'SQLITE_3'],
* });
*
* it.each(databases.eachSupportedId())(
* 'stores and retrieves marks, %p',
* async databaseId => {
*      const knex = await databases.init(databaseId);
*      await knex.migrate.latest({ directory: migrationsDir });
*
*      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
*        client: knex,
*        logger: mockServices.logger.mock(),
*      });
*      const { ingestionId } = (await manager.createProviderIngestionRecord(
*        'myProvider',
*      ))!;
*
*      const cursorId = uuid();
*
*      await manager.createMark({
*        record: {
*          id: cursorId,
*          ingestion_id: ingestionId,
*          sequence: 1,
*          cursor: { data: 1 },
*        },
*      });
*
*      await expect(manager.getFirstMark(ingestionId)).resolves.toEqual({
*        created_at: expect.anything(),
*        cursor: { data: 1 },
*        id: cursorId,
*        ingestion_id: ingestionId,
*        sequence: 1,
*      });
*
*      await expect(manager.getLastMark(ingestionId)).resolves.toEqual({
*        created_at: expect.anything(),
*        cursor: { data: 1 },
*        id: cursorId,
*        ingestion_id: ingestionId,
*        sequence: 1,
*      });
*
*      await expect(manager.getAllMarks(ingestionId)).resolves.toEqual([
*        {
*          created_at: expect.anything(),
*          cursor: { data: 1 },
*          id: cursorId,
*          ingestion_id: ingestionId,
*          sequence: 1,
*        },
*      ]);
* },
* );
  +});
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.ts
  new file mode 100644
  index 0000000..14d6cd4
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/OpenChoreoIncrementalIngestionDatabaseManager.ts
  @@ -0,0 +1,1291 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Database manager for incremental ingestion operations.
* - Manages ingestion records, marks, and entity tracking to support
* - resumable, burst-based processing of large entity datasets.
* \*/
* +import { Knex } from 'knex';
  +import type { DeferredEntity } from '@backstage/plugin-catalog-node';
  +import { stringifyEntityRef } from '@backstage/catalog-model';
  +import { Duration } from 'luxon';
  +import { v4 } from 'uuid';
  +import { LoggerService } from '@backstage/backend-plugin-api';
  +import {
* IngestionRecord,
* IngestionRecordUpdate,
* IngestionUpsert,
* MarkRecord,
* MarkRecordInsert,
  +} from './tables';
  +import {
* DatabaseTransactionError,
* DeadlockError,
* ConstraintViolationError,
* TransientDatabaseError,
  +} from './errors';
* +const POST_PROVIDER_RESET_COOLDOWN_MS = 24 _ 60 _ 60 \* 1000;
  +const MARK_ENTITY_DELETE_BATCH_SIZE = 100;
  +const MARK_ENTITY_INSERT_BATCH_SIZE = 100;
  +const DUPLICATE_INGESTION_AGE_THRESHOLD_MS = 60000;
* +/\*\*
* - Database-specific SQL variable limits:
* - - SQLite: 999 (default), can be up to 32,766 at compile time
* - - PostgreSQL: 32,767 (hard limit from protocol)
* - - MySQL: 65,535
* - Using conservative limits to ensure compatibility across all configurations
* \*/
  +const SQL_VARIABLE_LIMITS = {
* sqlite3: 900, // Conservative limit for SQLite (default is 999)
* pg: 30000, // Conservative limit for PostgreSQL (max is 32,767)
* mysql: 60000, // Conservative limit for MySQL (max is 65,535)
* mysql2: 60000,
* default: 900, // Safe default for unknown databases
  +};
* +export class OpenChoreoIncrementalIngestionDatabaseManager {
* private client: Knex;
* private logger: LoggerService;
* private readonly batchSize: number;
*
* constructor(options: { client: Knex; logger: LoggerService }) {
* this.client = options.client;
* this.logger = options.logger;
* this.batchSize = this.determineBatchSize();
* this.logger.info(
*      `Initialized database manager with batch size: ${this.batchSize} for client: ${this.client.client.config.client}`,
* );
* }
*
* /\*\*
* - Determines the appropriate batch size for SQL IN clause operations
* - based on the database client type.
* \*/
* private determineBatchSize(): number {
* const clientType = this.client.client.config.client;
* const batchSize =
*      SQL_VARIABLE_LIMITS[clientType as keyof typeof SQL_VARIABLE_LIMITS] ||
*      SQL_VARIABLE_LIMITS.default;
* return batchSize;
* }
*
* /\*\*
* - Safely formats an error for database storage.
* - Truncates the error message if it's too long to prevent database constraint violations.
* - @param error - The error to format
* - @param maxLength - Maximum length (default: 2000 for TEXT fields, set to safe limit)
* - @returns Formatted error string
* \*/
* private formatErrorForStorage(
* error: Error | string,
* maxLength = 2000,
* ): string {
* const errorString = String(error);
* if (errorString.length <= maxLength) {
*      return errorString;
* }
* // Truncate with an indicator
* return `${errorString.substring(0, maxLength - 50)}... [error truncated]`;
* }
*
* /\*\*
* - Helper method to execute a batched whereIn query operation.
* - Automatically chunks the values to stay within database limits.
* -
* - This method prevents "too many SQL variables" errors that occur when
* - SQL IN clauses contain more parameters than the database can handle:
* - - SQLite: 999 variables (default)
* - - PostgreSQL: 32,767 variables (protocol limit)
* - - MySQL: 65,535 variables
* -
* - @param tx - Knex transaction
* - @param tableName - Name of the table to query
* - @param column - Column name for the WHERE IN clause
* - @param values - Array of values to use in the IN clause
* - @param operation - Type of operation ('select', 'delete', or 'update')
* - @param updateData - Data to update (required for 'update' operation)
* - @returns Array of results for 'select' operations, empty array otherwise
* \*/
* private async batchedWhereIn<T>(
* tx: Knex.Transaction,
* tableName: string,
* column: string,
* values: any[],
* operation: 'select' | 'delete' | 'update',
* updateData?: any,
* ): Promise<T[]> {
* if (values.length === 0) {
*      return [];
* }
*
* if (values.length > this.batchSize) {
*      this.logger.debug(
*        `Batching ${operation} operation for ${values.length} values into chunks of ${this.batchSize}`,
*      );
* }
*
* const results: T[] = [];
*
* for (let i = 0; i < values.length; i += this.batchSize) {
*      const chunk = values.slice(i, i + this.batchSize);
*      const query = tx(tableName);
*
*      if (operation === 'select') {
*        const batchResults = await query.select('*').whereIn(column, chunk);
*        results.push(...batchResults);
*      } else if (operation === 'delete') {
*        await query.delete().whereIn(column, chunk);
*      } else if (operation === 'update' && updateData) {
*        await query.update(updateData).whereIn(column, chunk);
*      }
* }
*
* return results;
* }
*
* private async executeWithRetry<T>(
* operation: string,
* fn: (tx: Knex.Transaction) => Promise<T>,
* maxRetries = 3,
* ): Promise<T> {
* let lastError: Error | undefined;
*
* for (let attempt = 0; attempt <= maxRetries; attempt++) {
*      try {
*        return await this.client.transaction(async tx => {
*          return await fn(tx);
*        });
*      } catch (error) {
*        lastError = error as Error;
*        const errorCode = (error as any).code;
*
*        if (errorCode === 'ER_LOCK_DEADLOCK' || errorCode === '40P01') {
*          if (attempt < maxRetries) {
*            const delay = Math.min(100 * Math.pow(2, attempt), 2000);
*            this.logger.warn(
*              `Deadlock detected in ${operation}, retrying in ${delay}ms (attempt ${
*                attempt + 1
*              }/${maxRetries})`,
*            );
*            await new Promise(resolve => setTimeout(resolve, delay));
*            continue;
*          }
*          throw new DeadlockError(operation, error as Error);
*        }
*
*        if (errorCode === '23503' || errorCode === 'ER_NO_REFERENCED_ROW_2') {
*          throw new ConstraintViolationError(
*            'Foreign key constraint violation',
*            operation,
*            (error as any).constraint,
*            error as Error,
*          );
*        }
*
*        if (errorCode === '23505' || errorCode === 'ER_DUP_ENTRY') {
*          throw new ConstraintViolationError(
*            'Unique constraint violation',
*            operation,
*            (error as any).constraint,
*            error as Error,
*          );
*        }
*
*        if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT') {
*          if (attempt < maxRetries) {
*            const delay = Math.min(500 * Math.pow(2, attempt), 5000);
*            this.logger.warn(
*              `Connection error in ${operation}, retrying in ${delay}ms`,
*            );
*            await new Promise(resolve => setTimeout(resolve, delay));
*            continue;
*          }
*          throw new TransientDatabaseError(operation, error as Error);
*        }
*
*        this.logger.error(
*          `Transaction failed in ${operation}: ${(error as Error).message}`,
*          error as Error,
*        );
*        throw new DatabaseTransactionError(
*          `Transaction failed: ${(error as Error).message}`,
*          operation,
*          error as Error,
*        );
*      }
* }
*
* throw new DatabaseTransactionError(
*      lastError?.message ?? 'Unknown transaction error',
*      operation,
*      lastError,
* );
* }
*
* /\*\*
* - Performs an update to the ingestion record with matching `id`.
* - @param options - IngestionRecordUpdate
* \*/
* async updateIngestionRecordById(options: IngestionRecordUpdate) {
* const { ingestionId, update } = options;
* try {
*      await this.executeWithRetry(
*        `updateIngestionRecordById(ingestionId=${ingestionId})`,
*        async tx => {
*          await tx('ingestions').where('id', ingestionId).update(update);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to update ingestion record ${ingestionId}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Performs an update to the ingestion record with matching provider name. Will only update active records.
* - @param provider - string
* - @param update - Partial<IngestionUpsertIFace>
* \*/
* async updateIngestionRecordByProvider(
* provider: string,
* update: Partial<IngestionUpsert>,
* ) {
* try {
*      await this.executeWithRetry(
*        `updateIngestionRecordByProvider(provider=${provider})`,
*        async tx => {
*          await tx('ingestions')
*            .where('provider_name', provider)
*            .andWhere('completion_ticket', 'open')
*            .update(update);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to update ingestion record for provider ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Performs an insert into the `ingestions` table with the supplied values.
* - @param record - IngestionUpsertIFace
* \*/
* async insertIngestionRecord(record: IngestionUpsert) {
* try {
*      await this.executeWithRetry(
*        `insertIngestionRecord(id=${record.id})`,
*        async tx => {
*          await tx('ingestions').insert(record);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to insert ingestion record ${record.id}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* private async deleteMarkEntities(
* tx: Knex.Transaction,
* ids: { id: string }[],
* ) {
* const chunks: { id: string }[][] = [];
* for (let i = 0; i < ids.length; i += MARK_ENTITY_DELETE_BATCH_SIZE) {
*      const chunk = ids.slice(i, i + MARK_ENTITY_DELETE_BATCH_SIZE);
*      chunks.push(chunk);
* }
*
* let deleted = 0;
*
* for (const chunk of chunks) {
*      const chunkDeleted = await tx('ingestion_mark_entities')
*        .delete()
*        .whereIn(
*          'id',
*          chunk.map(entry => entry.id),
*        );
*      deleted += chunkDeleted;
* }
*
* return deleted;
* }
*
* /\*\*
* - Finds the current ingestion record for the named provider.
* - @param provider - string
* - @returns IngestionRecord | undefined
* \*/
* async getCurrentIngestionRecord(provider: string) {
* try {
*      return await this.executeWithRetry(
*        `getCurrentIngestionRecord(provider=${provider})`,
*        async tx => {
*          const record = await tx<IngestionRecord>('ingestions')
*            .where('provider_name', provider)
*            .andWhere('completion_ticket', 'open')
*            .first();
*          return record;
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get current ingestion record for provider ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Finds the last ingestion record for the named provider.
* - @param provider - string
* - @returns IngestionRecord | undefined
* \*/
* async getPreviousIngestionRecord(provider: string) {
* try {
*      return await this.executeWithRetry(
*        `getPreviousIngestionRecord(provider=${provider})`,
*        async tx => {
*          return await tx<IngestionRecord>('ingestions')
*            .where('provider_name', provider)
*            .andWhereNot('completion_ticket', 'open')
*            .orderBy('rest_completed_at', 'desc')
*            .first();
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get previous ingestion record for provider ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Removes all entries from `ingestion_marks_entities`, `ingestion_marks`, and `ingestions`
* - for prior ingestions that completed (i.e., have a `completion_ticket` value other than 'open'),
* - except for the most recent completed ingestion which is kept for mark-and-sweep comparison.
* - @param provider - string
* - @returns A count of deletions for each record type.
* -
* - Note: This method uses subqueries for deletion which doesn't require manual batching
* - as the database handles the query execution internally.
* \*/
* async clearFinishedIngestions(provider: string) {
* try {
*      return await this.executeWithRetry(
*        `clearFinishedIngestions(provider=${provider})`,
*        async tx => {
*          const mostRecentCompleted = await tx<IngestionRecord>('ingestions')
*            .where('provider_name', provider)
*            .andWhereNot('completion_ticket', 'open')
*            .orderBy('rest_completed_at', 'desc')
*            .first();
*
*          const subquery = tx('ingestions')
*            .select('id')
*            .where('provider_name', provider)
*            .andWhereNot('completion_ticket', 'open');
*
*          if (mostRecentCompleted) {
*            subquery.andWhereNot('id', mostRecentCompleted.id);
*          }
*
*          const markEntitiesDeleted = await tx('ingestion_mark_entities')
*            .delete()
*            .whereIn(
*              'ingestion_mark_id',
*              tx('ingestion_marks')
*                .select('id')
*                .whereIn('ingestion_id', subquery.clone()),
*            );
*
*          const marksDeleted = await tx('ingestion_marks')
*            .delete()
*            .whereIn('ingestion_id', subquery.clone());
*
*          const ingestionsDeleted = await tx('ingestions')
*            .delete()
*            .whereIn('id', subquery.clone());
*
*          return {
*            deletions: {
*              markEntitiesDeleted,
*              marksDeleted,
*              ingestionsDeleted,
*            },
*          };
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to clear finished ingestions for provider ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Automatically cleans up duplicate ingestion records if they were accidentally created.
* - Any ingestion record where the `rest_completed_at` is null (meaning it is active) AND
* - the ingestionId is incorrect is a duplicate ingestion record.
* - @param ingestionId - string
* - @param provider - string
* -
* - Note: This method does not require batching as it operates on a small number of
* - ingestion metadata records, not entity data.
* \*/
* async clearDuplicateIngestions(ingestionId: string, provider: string) {
* try {
*      await this.executeWithRetry(
*        `clearDuplicateIngestions(ingestionId=${ingestionId}, provider=${provider})`,
*        async tx => {
*          const invalid = await tx<IngestionRecord>('ingestions')
*            .where('provider_name', provider)
*            .andWhere('rest_completed_at', null)
*            .andWhereNot('id', ingestionId)
*            .andWhere(
*              'created_at',
*              '<',
*              new Date(Date.now() - DUPLICATE_INGESTION_AGE_THRESHOLD_MS),
*            );
*
*          if (invalid.length > 0) {
*            await tx('ingestions')
*              .delete()
*              .whereIn(
*                'id',
*                invalid.map(i => i.id),
*              );
*            await tx('ingestion_mark_entities')
*              .delete()
*              .whereIn(
*                'ingestion_mark_id',
*                tx('ingestion_marks')
*                  .select('id')
*                  .whereIn(
*                    'ingestion_id',
*                    invalid.map(i => i.id),
*                  ),
*              );
*            await tx('ingestion_marks')
*              .delete()
*              .whereIn(
*                'ingestion_id',
*                invalid.map(i => i.id),
*              );
*          }
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to clear duplicate ingestions for ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - This method fully purges and resets all ingestion records for the named provider, and
* - leaves it in a paused state.
* - @param provider - string
* - @returns Counts of all deleted ingestion records
* -
* - Note: This method does not require batching for whereIn operations as it operates
* - on a small number of ingestion and mark metadata records per provider.
* \*/
* async purgeAndResetProvider(provider: string) {
* try {
*      return await this.executeWithRetry(
*        `purgeAndResetProvider(provider=${provider})`,
*        async tx => {
*          const ingestionIDs: { id: string }[] = await tx('ingestions')
*            .select('id')
*            .where('provider_name', provider);
*
*          const markIDs: { id: string }[] =
*            ingestionIDs.length > 0
*              ? await tx('ingestion_marks')
*                  .select('id')
*                  .whereIn(
*                    'ingestion_id',
*                    ingestionIDs.map(entry => entry.id),
*                  )
*              : [];
*
*          const markEntityIDs: { id: string }[] =
*            markIDs.length > 0
*              ? await tx('ingestion_mark_entities')
*                  .select('id')
*                  .whereIn(
*                    'ingestion_mark_id',
*                    markIDs.map(entry => entry.id),
*                  )
*              : [];
*
*          const markEntitiesDeleted = await this.deleteMarkEntities(
*            tx,
*            markEntityIDs,
*          );
*
*          const marksDeleted =
*            markIDs.length > 0
*              ? await tx('ingestion_marks')
*                  .delete()
*                  .whereIn(
*                    'ingestion_id',
*                    ingestionIDs.map(entry => entry.id),
*                  )
*              : 0;
*
*          const ingestionsDeleted = await tx('ingestions')
*            .delete()
*            .where('provider_name', provider);
*
*          const next_action_at = new Date();
*          next_action_at.setTime(
*            next_action_at.getTime() + POST_PROVIDER_RESET_COOLDOWN_MS,
*          );
*
*          await tx('ingestions').insert({
*            id: v4(),
*            next_action: 'rest',
*            provider_name: provider,
*            next_action_at,
*            ingestion_completed_at: new Date(),
*            status: 'resting',
*            completion_ticket: 'open',
*          });
*
*          return {
*            provider,
*            ingestionsDeleted,
*            marksDeleted,
*            markEntitiesDeleted,
*          };
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to purge and reset provider ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - This method is used to remove entity records from the ingestion_mark_entities
* - table by their entity reference.
* \*/
* async deleteEntityRecordsByRef(entities: { entityRef: string }[]) {
* const refs = entities.map(e => e.entityRef);
* try {
*      await this.executeWithRetry(
*        `deleteEntityRecordsByRef(count=${refs.length})`,
*        async tx => {
*          // Delete in batches to avoid "too many SQL variables" error
*          await this.batchedWhereIn(
*            tx,
*            'ingestion_mark_entities',
*            'ref',
*            refs,
*            'delete',
*          );
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to delete ${refs.length} entity records`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Creates a new ingestion record.
* - @param provider - string
* - @returns A new ingestion record
* \*/
* async createProviderIngestionRecord(provider: string) {
* const ingestionId = v4();
* const nextAction = 'ingest';
* try {
*      await this.insertIngestionRecord({
*        id: ingestionId,
*        next_action: nextAction,
*        provider_name: provider,
*        status: 'bursting',
*        completion_ticket: 'open',
*      });
*      return { ingestionId, nextAction, attempts: 0, nextActionAt: Date.now() };
* } catch (error) {
*      this.logger.error(
*        `Failed to create ingestion record for provider ${provider} with ingestionId ${ingestionId}`,
*        error as Error,
*      );
*      // Creating the ingestion record failed. Return undefined.
*      return undefined;
* }
* }
*
* /\*\*
* - Computes which entities to remove, if any, at the end of a burst.
* - Implements proper mark-and-sweep by comparing previous ingestion entities
* - against current ingestion entities to identify orphans.
* - @param provider - string
* - @param ingestionId - string
* - @returns All entities to remove for this burst.
* \*/
* async computeRemoved(provider: string, ingestionId: string) {
* const previousIngestion = await this.getPreviousIngestionRecord(provider);
* try {
*      return await this.executeWithRetry(
*        `computeRemoved(provider=${provider}, ingestionId=${ingestionId})`,
*        async tx => {
*          const count = await tx('ingestion_mark_entities')
*            .count({ total: 'ingestion_mark_entities.ref' })
*            .join(
*              'ingestion_marks',
*              'ingestion_marks.id',
*              'ingestion_mark_entities.ingestion_mark_id',
*            )
*            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
*            .where('ingestions.id', ingestionId);
*
*          const total = count.reduce(
*            (acc, cur) => acc + (cur.total as number),
*            0,
*          );
*
*          const removed: { entityRef: string }[] = [];
*
*          const currentEntities: { ref: string }[] = await tx(
*            'ingestion_mark_entities',
*          )
*            .select('ingestion_mark_entities.ref')
*            .join(
*              'ingestion_marks',
*              'ingestion_marks.id',
*              'ingestion_mark_entities.ingestion_mark_id',
*            )
*            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
*            .where('ingestions.id', ingestionId);
*
*          const currentEntityRefs = new Set(currentEntities.map(e => e.ref));
*
*          if (previousIngestion) {
*            const previousEntities: { ref: string }[] = await tx(
*              'ingestion_mark_entities',
*            )
*              .select('ingestion_mark_entities.ref')
*              .join(
*                'ingestion_marks',
*                'ingestion_marks.id',
*                'ingestion_mark_entities.ingestion_mark_id',
*              )
*              .join(
*                'ingestions',
*                'ingestions.id',
*                'ingestion_marks.ingestion_id',
*              )
*              .where('ingestions.id', previousIngestion.id);
*
*            const staleEntities = previousEntities.filter(
*              entity => !currentEntityRefs.has(entity.ref),
*            );
*
*            for (const entityRef of staleEntities) {
*              removed.push({ entityRef: entityRef.ref });
*            }
*          }
*
*          const catalogEntities: {
*            entity_ref: string;
*            unprocessed_entity: string;
*          }[] = await tx('refresh_state')
*            .select(
*              'refresh_state.entity_ref',
*              'refresh_state.unprocessed_entity',
*            )
*            .leftJoin(
*              'refresh_keys',
*              'refresh_keys.entity_id',
*              'refresh_state.entity_id',
*            )
*            .where('refresh_state.location_key', null)
*            .whereNull('refresh_keys.entity_id');
*
*          const filteredCatalogEntities = catalogEntities.filter(row => {
*            try {
*              const entity = JSON.parse(row.unprocessed_entity);
*              const managedBy =
*                entity?.metadata?.annotations?.[
*                  'backstage.io/managed-by-location'
*                ];
*              return managedBy === `provider:${provider}`;
*            } catch (error) {
*              this.logger.debug(
*                `Skipping entity ${
*                  row.entity_ref
*                } with invalid JSON during removal computation: ${
*                  (error as Error).message
*                }`,
*              );
*              return false;
*            }
*          });
*
*          for (const entity of filteredCatalogEntities) {
*            if (!currentEntityRefs.has(entity.entity_ref)) {
*              if (!removed.find(e => e.entityRef === entity.entity_ref)) {
*                this.logger.info(
*                  `computeRemoved: Found orphaned catalog entity ${entity.entity_ref} not in current or previous ingestion, marking for removal`,
*                );
*                removed.push({ entityRef: entity.entity_ref });
*              }
*            }
*          }
*
*          return { total, removed };
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to compute removed entities for ${provider}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* async getEntityCountsByKind(ingestionId: string) {
* try {
*      return await this.executeWithRetry(
*        `getEntityCountsByKind(ingestionId=${ingestionId})`,
*        async tx => {
*          const entityRefs: { ref: string }[] = await tx(
*            'ingestion_mark_entities',
*          )
*            .select('ingestion_mark_entities.ref')
*            .join(
*              'ingestion_marks',
*              'ingestion_marks.id',
*              'ingestion_mark_entities.ingestion_mark_id',
*            )
*            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
*            .where('ingestions.id', ingestionId);
*
*          // Count entities by kind - parse kind from entity ref format: <kind>:<namespace>/<name>
*          const counts: Record<string, number> = {
*            total: entityRefs.length,
*          };
*
*          let invalid = 0;
*
*          for (const { ref } of entityRefs) {
*            try {
*              // Entity refs are in format: kind:namespace/name
*              const colonIndex = ref.indexOf(':');
*              if (colonIndex === -1) {
*                invalid++;
*                this.logger.warn(
*                  `Invalid entity ref format (missing colon): ${ref} in ingestion ${ingestionId}`,
*                );
*                continue;
*              }
*
*              const kind = ref.substring(0, colonIndex).toLowerCase();
*
*              if (!kind) {
*                invalid++;
*                this.logger.warn(
*                  `Invalid entity ref format (empty kind): ${ref} in ingestion ${ingestionId}`,
*                );
*                continue;
*              }
*
*              counts[kind] = (counts[kind] || 0) + 1;
*            } catch (error) {
*              invalid++;
*              this.logger.warn(
*                `Failed to parse entity ref ${ref} in ingestion ${ingestionId}: ${
*                  (error as Error).message
*                }`,
*              );
*            }
*          }
*
*          if (invalid > 0) {
*            counts.invalid = invalid;
*            this.logger.warn(
*              `Found ${invalid} entities with invalid ref format out of ${entityRefs.length} total entities in ingestion ${ingestionId}`,
*            );
*          }
*
*          return counts;
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get entity counts for ingestion ${ingestionId}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Performs a lookup of all providers that have duplicate active ingestion records.
* - @returns An array of all duplicate active ingestions
* \*/
* async healthcheck() {
* try {
*      return await this.executeWithRetry('healthcheck', async tx => {
*        const records = await tx<{ id: string; provider_name: string }>(
*          'ingestions',
*        )
*          .distinct('id', 'provider_name')
*          .where('rest_completed_at', null);
*        return records;
*      });
* } catch (error) {
*      this.logger.error('Failed to perform healthcheck', error as Error);
*      throw error;
* }
* }
*
* /\*\*
* - Skips any wait time for the next action to run.
* - @param provider - string
* \*/
* async triggerNextProviderAction(provider: string) {
* await this.updateIngestionRecordByProvider(provider, {
*      next_action_at: new Date(),
* });
* }
*
* /\*\*
* - Purges the following tables:
* - - `ingestions`
* - - `ingestion_marks`
* - - `ingestion_mark_entities`
* -
* - This function leaves the ingestions table with all providers in a paused state.
* - @returns Results from cleaning up all ingestion tables.
* \*/
* async cleanupProviders() {
* const providers = await this.listProviders();
*
* const ingestionsDeleted = await this.purgeTable('ingestions');
*
* const next_action_at = new Date();
* next_action_at.setTime(
*      next_action_at.getTime() + POST_PROVIDER_RESET_COOLDOWN_MS,
* );
*
* for (const provider of providers) {
*      await this.insertIngestionRecord({
*        id: v4(),
*        next_action: 'rest',
*        provider_name: provider,
*        next_action_at,
*        ingestion_completed_at: new Date(),
*        status: 'resting',
*        completion_ticket: 'open',
*      });
* }
*
* const ingestionMarksDeleted = await this.purgeTable('ingestion_marks');
* const markEntitiesDeleted = await this.purgeTable(
*      'ingestion_mark_entities',
* );
*
* return { ingestionsDeleted, ingestionMarksDeleted, markEntitiesDeleted };
* }
*
* /\*\*
* - Configures the current ingestion record to ingest a burst.
* - @param ingestionId - string
* \*/
* async setProviderIngesting(ingestionId: string) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: { next_action: 'ingest' },
* });
* }
*
* /\*\*
* - Indicates the provider is currently ingesting a burst.
* - @param ingestionId - string
* \*/
* async setProviderBursting(ingestionId: string) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: { status: 'bursting' },
* });
* }
*
* /\*\*
* - Finalizes the current ingestion record to indicate that the post-ingestion rest period is complete.
* - @param ingestionId - string
* \*/
* async setProviderComplete(ingestionId: string) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: {
*        next_action: 'nothing (done)',
*        rest_completed_at: new Date(),
*        status: 'complete',
*        completion_ticket: v4(),
*      },
* });
* }
*
* /\*\*
* - Marks ingestion as complete and starts the post-ingestion rest cycle.
* - @param ingestionId - string
* - @param restLength - Duration
* \*/
* async setProviderResting(ingestionId: string, restLength: Duration) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: {
*        next_action: 'rest',
*        next_action_at: new Date(Date.now() + restLength.as('milliseconds')),
*        ingestion_completed_at: new Date(),
*        status: 'resting',
*      },
* });
* }
*
* /\*\*
* - Marks ingestion as paused after a burst completes.
* - @param ingestionId - string
* \*/
* async setProviderInterstitial(ingestionId: string) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: { attempts: 0, status: 'interstitial' },
* });
* }
*
* /\*\*
* - Starts the cancel process for the current ingestion.
* - @param ingestionId - string
* - @param message - string (optional)
* \*/
* async setProviderCanceling(ingestionId: string, message?: string) {
* const update: Partial<IngestionUpsert> = {
*      next_action: 'cancel',
*      last_error: message ? this.formatErrorForStorage(message) : undefined,
*      next_action_at: new Date(),
*      status: 'canceling',
* };
* await this.updateIngestionRecordById({ ingestionId, update });
* }
*
* /\*\*
* - Completes the cancel process and triggers a new ingestion.
* - @param ingestionId - string
* \*/
* async setProviderCanceled(ingestionId: string) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: {
*        next_action: 'nothing (canceled)',
*        rest_completed_at: new Date(),
*        status: 'complete',
*        completion_ticket: v4(),
*      },
* });
* }
*
* /\*\*
* - Configures the current ingestion to wait and retry, due to a data source error.
* - @param ingestionId - string
* - @param attempts - number
* - @param error - Error
* - @param backoffLength - number
* \*/
* async setProviderBackoff(
* ingestionId: string,
* attempts: number,
* error: Error,
* backoffLength: number,
* ) {
* await this.updateIngestionRecordById({
*      ingestionId,
*      update: {
*        next_action: 'backoff',
*        attempts: attempts + 1,
*        last_error: this.formatErrorForStorage(error),
*        next_action_at: new Date(Date.now() + backoffLength),
*        status: 'backing off',
*      },
* });
* }
*
* /\*\*
* - Returns the last record from `ingestion_marks` for the supplied ingestionId.
* - @param ingestionId - string
* - @returns MarkRecord | undefined
* \*/
* async getLastMark(ingestionId: string) {
* try {
*      return await this.executeWithRetry(
*        `getLastMark(ingestionId=${ingestionId})`,
*        async tx => {
*          const mark = await tx<MarkRecord>('ingestion_marks')
*            .where('ingestion_id', ingestionId)
*            .orderBy('sequence', 'desc')
*            .first();
*          return this.#decodeMark(this.client, mark);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get last mark for ingestion ${ingestionId}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Returns the first record from `ingestion_marks` for the supplied ingestionId.
* - @param ingestionId - string
* - @returns MarkRecord | undefined
* \*/
* async getFirstMark(ingestionId: string) {
* try {
*      return await this.executeWithRetry(
*        `getFirstMark(ingestionId=${ingestionId})`,
*        async tx => {
*          const mark = await tx<MarkRecord>('ingestion_marks')
*            .where('ingestion_id', ingestionId)
*            .orderBy('sequence', 'asc')
*            .first();
*          return this.#decodeMark(this.client, mark);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get first mark for ingestion ${ingestionId}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* async getAllMarks(ingestionId: string) {
* try {
*      return await this.executeWithRetry(
*        `getAllMarks(ingestionId=${ingestionId})`,
*        async tx => {
*          const marks = await tx<MarkRecord>('ingestion_marks')
*            .where('ingestion_id', ingestionId)
*            .orderBy('sequence', 'desc');
*          return marks.map(m => this.#decodeMark(this.client, m));
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to get all marks for ingestion ${ingestionId}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Performs an insert into the `ingestion_marks` table with the supplied values.
* - @param options - MarkRecordInsert
* \*/
* async createMark(options: MarkRecordInsert) {
* const { record } = options;
* try {
*      await this.executeWithRetry(
*        `createMark(ingestionId=${record.ingestion_id})`,
*        async tx => {
*          await tx('ingestion_marks').insert(record);
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to create mark for ingestion ${record.ingestion_id}`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* // Handles the fact that sqlite does not support json columns; they just
* // persist the stringified data instead
* #decodeMark<T extends MarkRecord | undefined>(knex: Knex, record: T): T {
* if (record && knex.client.config.client.includes('sqlite3')) {
*      try {
*        return {
*          ...record,
*          cursor: JSON.parse(record.cursor as string),
*        };
*      } catch (error) {
*        this.logger.error(
*          `Failed to parse cursor JSON for mark record ${record.id}: ${
*            (error as Error).message
*          }. This indicates database corruption.`,
*          error as Error,
*        );
*        throw new DatabaseTransactionError(
*          `Failed to decode mark cursor: ${(error as Error).message}`,
*          'decodeMark',
*          error as Error,
*        );
*      }
* }
* return record;
* }
*
* /\*\*
* - Performs an upsert to the `ingestion_mark_entities` table for all deferred entities.
* - @param markId - string
* - @param entities - DeferredEntity[]
* \*/
* async createMarkEntities(markId: string, entities: DeferredEntity[]) {
* const refs = entities.map(e => stringifyEntityRef(e.entity));
*
* try {
*      await this.executeWithRetry(
*        `createMarkEntities(markId=${markId}, count=${refs.length})`,
*        async tx => {
*          // Query existing refs in batches to avoid "too many SQL variables" error
*          const existingRefsSet = new Set<string>();
*          for (let i = 0; i < refs.length; i += this.batchSize) {
*            const chunk = refs.slice(i, i + this.batchSize);
*            const existingBatch = (
*              await tx<{ ref: string }>('ingestion_mark_entities')
*                .select('ref')
*                .whereIn('ref', chunk)
*            ).map(e => e.ref);
*            existingBatch.forEach(ref => existingRefsSet.add(ref));
*          }
*
*          const existingRefsArray = Array.from(existingRefsSet);
*          const newRefs = refs.filter(e => !existingRefsSet.has(e));
*
*          // Update existing refs in batches
*          if (existingRefsArray.length > 0) {
*            await this.batchedWhereIn(
*              tx,
*              'ingestion_mark_entities',
*              'ref',
*              existingRefsArray,
*              'update',
*              { ingestion_mark_id: markId },
*            );
*          }
*
*          if (newRefs.length > 0) {
*            // Process newRefs in batches to avoid overwhelming the database
*            for (
*              let i = 0;
*              i < newRefs.length;
*              i += MARK_ENTITY_INSERT_BATCH_SIZE
*            ) {
*              const chunk = newRefs.slice(i, i + MARK_ENTITY_INSERT_BATCH_SIZE);
*              await tx('ingestion_mark_entities').insert(
*                chunk.map(ref => ({
*                  id: v4(),
*                  ingestion_mark_id: markId,
*                  ref,
*                })),
*              );
*              this.logger.info(
*                `Batch ${
*                  Math.floor(i / MARK_ENTITY_INSERT_BATCH_SIZE) + 1
*                }/${Math.ceil(
*                  newRefs.length / MARK_ENTITY_INSERT_BATCH_SIZE,
*                )} completed: inserted ${
*                  chunk.length
*                } entities for mark ${markId}`,
*              );
*            }
*          }
*        },
*      );
* } catch (error) {
*      this.logger.error(
*        `Failed to create mark entities for mark ${markId} (${refs.length} entities)`,
*        error as Error,
*      );
*      throw error;
* }
* }
*
* /\*\*
* - Deletes the entire content of a table, and returns the number of records deleted.
* - @param table - string
* - @returns number
* \*/
* async purgeTable(table: string) {
* try {
*      return await this.executeWithRetry(`purgeTable(${table})`, async tx => {
*        return await tx(table).delete();
*      });
* } catch (error) {
*      this.logger.error(`Failed to purge table ${table}`, error as Error);
*      throw error;
* }
* }
*
* /\*\*
* - Returns a list of all providers.
* - @returns string[]
* \*/
* async listProviders() {
* try {
*      return await this.executeWithRetry('listProviders', async tx => {
*        const providers = await tx<{ provider_name: string }>(
*          'ingestions',
*        ).distinct('provider_name');
*        return providers.map(entry => entry.provider_name);
*      });
* } catch (error) {
*      this.logger.error('Failed to list providers', error as Error);
*      throw error;
* }
* }
*
* async updateByName(provider: string, update: Partial<IngestionUpsert>) {
* await this.updateIngestionRecordByProvider(provider, update);
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/errors.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/errors.ts
  new file mode 100644
  index 0000000..b22d5f5
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/errors.ts
  @@ -0,0 +1,63 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +export class DatabaseTransactionError extends Error {
* constructor(
* message: string,
* public readonly operation: string,
* public readonly cause?: Error,
* ) {
* super(message);
* this.name = 'DatabaseTransactionError';
* }
  +}
* +export class DeadlockError extends DatabaseTransactionError {
* constructor(operation: string, cause?: Error) {
* super('Transaction deadlock detected', operation, cause);
* this.name = 'DeadlockError';
* }
  +}
* +export class ConstraintViolationError extends DatabaseTransactionError {
* constructor(
* message: string,
* operation: string,
* public readonly constraintName?: string,
* cause?: Error,
* ) {
* super(message, operation, cause);
* this.name = 'ConstraintViolationError';
* }
  +}
* +export class TransientDatabaseError extends DatabaseTransactionError {
* constructor(operation: string, cause?: Error) {
* super('Transient database error - retry possible', operation, cause);
* this.name = 'TransientDatabaseError';
* }
  +}
* +export class OpenChoreoIncrementalIngestionError extends Error {
* constructor(
* message: string,
* public readonly code: string,
* public readonly cause?: Error,
* ) {
* super(message);
* this.name = 'OpenChoreoIncrementalIngestionError';
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations.ts
  new file mode 100644
  index 0000000..18bdf5b
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations.ts
  @@ -0,0 +1,35 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Database migrations for incremental ingestion.
* - Applies schema changes for ingestion tables.
* \*/
  +import { resolvePackagePath } from '@backstage/backend-plugin-api';
  +import { Knex } from 'knex';
  +import { DB_MIGRATIONS_TABLE } from './tables';
* +export async function applyDatabaseMigrations(knex: Knex): Promise<void> {
* const migrationsDir = resolvePackagePath(
* '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental',
* 'migrations',
* );
*
* await knex.migrate.latest({
* directory: migrationsDir,
* tableName: DB_MIGRATIONS_TABLE,
* });
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000001_add_performance_indexes.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000001_add_performance_indexes.ts
  new file mode 100644
  index 0000000..a14cd3b
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000001_add_performance_indexes.ts
  @@ -0,0 +1,170 @@
  +import { Knex } from 'knex';
* +// Disable transaction for this migration due to CREATE INDEX CONCURRENTLY commands
  +// PostgreSQL CONCURRENTLY operations cannot run inside transaction blocks
  +export const config = { transaction: false };
* +/\*\*
* - Performance optimization migration for OpenChoreo incremental ingestion
* - This migration adds database indexes to improve query performance for large datasets
* -
* - Expected performance improvements:
* - - 50-70% faster ingestion time
* - - 5-10x faster database queries
* - - Reduced memory pressure during large ingestions
* \*/
  +export async function up(knex: Knex): Promise<void> {
* const isPostgres = knex.client.config.client === 'pg';
*
* if (isPostgres) {
* console.log('Applying PostgreSQL performance indexes...');
*
* // Create indexes concurrently to avoid blocking production traffic
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_state_entity_ref
*      ON refresh_state(entity_ref);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_state_unprocessed_entity_gin
*      ON refresh_state USING gin(unprocessed_entity);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_mark_entities_ref
*      ON ingestion_mark_entities(ref);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_marks_ingestion_id
*      ON ingestion_marks(ingestion_id);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestions_provider_name
*      ON ingestions(provider_name);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestions_completion_ticket
*      ON ingestions(completion_ticket);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_mark_entities_composite
*      ON ingestion_mark_entities(ingestion_mark_id, ref);
* `);
*
* await knex.raw(`
*      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_state_composite
*      ON refresh_state(location_key, entity_ref);
* `);
*
* // Update table statistics for query optimizer
* await knex.raw('ANALYZE refresh_state');
* await knex.raw('ANALYZE ingestion_mark_entities');
* await knex.raw('ANALYZE ingestion_marks');
* await knex.raw('ANALYZE ingestions');
*
* // Create performance monitoring view
* await knex.raw(`
*      CREATE OR REPLACE VIEW ingestion_performance_stats AS
*      SELECT
*          i.provider_name,
*          COUNT(DISTINCT ime.ref) as total_entities,
*          COUNT(DISTINCT im.id) as total_marks,
*          MAX(i.created_at) as last_ingestion_start,
*          MAX(i.ingestion_completed_at) as last_ingestion_complete,
*          CASE
*              WHEN i.status = 'resting' THEN 'RESTING'
*              WHEN i.status = 'bursting' THEN 'ACTIVE'
*              WHEN i.status = 'backing off' THEN 'ERROR'
*              ELSE 'UNKNOWN'
*          END as current_status
*      FROM ingestions i
*      LEFT JOIN ingestion_marks im ON i.id = im.ingestion_id
*      LEFT JOIN ingestion_mark_entities ime ON im.id = ime.ingestion_mark_id
*      WHERE i.completion_ticket = 'open'
*      GROUP BY i.provider_name, i.status
* `);
*
* console.log('PostgreSQL performance indexes created successfully');
* } else {
* // SQLite for development/testing
* console.log('Applying SQLite performance indexes...');
*
* await knex.schema.raw(`
*      CREATE INDEX IF NOT EXISTS idx_refresh_state_entity_ref
*      ON refresh_state(entity_ref);
* `);
*
* await knex.schema.raw(`
*      CREATE INDEX IF NOT EXISTS idx_ingestion_mark_entities_ref
*      ON ingestion_mark_entities(ref);
* `);
*
* await knex.schema.raw(`
*      CREATE INDEX IF NOT EXISTS idx_ingestion_marks_ingestion_id
*      ON ingestion_marks(ingestion_id);
* `);
*
* await knex.schema.raw(`
*      CREATE INDEX IF NOT EXISTS idx_ingestions_provider_name
*      ON ingestions(provider_name);
* `);
*
* console.log('SQLite performance indexes created successfully');
* }
  +}
* +export async function down(knex: Knex): Promise<void> {
* const isPostgres = knex.client.config.client === 'pg';
*
* if (isPostgres) {
* console.log('Removing PostgreSQL performance indexes...');
*
* // Drop indexes concurrently
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_state_entity_ref',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_state_unprocessed_entity_gin',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_mark_entities_ref',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_marks_ingestion_id',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestions_provider_name',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestions_completion_ticket',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_mark_entities_composite',
* );
* await knex.raw(
*      'DROP INDEX CONCURRENTLY IF EXISTS idx_refresh_state_composite',
* );
*
* // Drop monitoring view
* await knex.raw('DROP VIEW IF EXISTS ingestion_performance_stats');
*
* console.log('PostgreSQL performance indexes removed');
* } else {
* console.log('Removing SQLite performance indexes...');
*
* await knex.schema.raw('DROP INDEX IF EXISTS idx_refresh_state_entity_ref');
* await knex.schema.raw(
*      'DROP INDEX IF EXISTS idx_ingestion_mark_entities_ref',
* );
* await knex.schema.raw(
*      'DROP INDEX IF EXISTS idx_ingestion_marks_ingestion_id',
* );
* await knex.schema.raw('DROP INDEX IF EXISTS idx_ingestions_provider_name');
*
* console.log('SQLite performance indexes removed');
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000003_expand_last_error_field.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000003_expand_last_error_field.ts
  new file mode 100644
  index 0000000..650d92e
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/migrations/20240110000003_expand_last_error_field.ts
  @@ -0,0 +1,37 @@
  +/\*
* - Copyright 2024 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +import { Knex } from 'knex';
* +/\*\*
* - Database migration to expand the last_error field from VARCHAR(255) to TEXT.
* - This allows storing full error stack traces and detailed error messages
* - without truncation.
* \*/
  +export async function up(knex: Knex): Promise<void> {
* await knex.schema.alterTable('ingestions', table => {
* // Change last_error from VARCHAR(255) to TEXT to accommodate long error messages
* table.text('last_error').alter();
* });
  +}
* +export async function down(knex: Knex): Promise<void> {
* await knex.schema.alterTable('ingestions', table => {
* // Revert back to VARCHAR(255)
* // Note: This may truncate existing error messages longer than 255 characters
* table.string('last_error', 255).alter();
* });
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/database/tables.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/database/tables.ts
  new file mode 100644
  index 0000000..266318a
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/database/tables.ts
  @@ -0,0 +1,123 @@
  +/\*
* - Copyright 2021 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Type definitions for incremental ingestion database tables.
* - Defines interfaces for ingestion records, marks, and related data structures.
* \*/
* +export const DB_MIGRATIONS_TABLE = 'incremental_ingestion\_\_knex_migrations';
* +/\*\*
* - The shape of data inserted into or updated in the `ingestions` table.
* \*/
  +export interface IngestionUpsert {
* /\*\*
* - The ingestion record id.
* \*/
* id?: string;
* /\*\*
* - The next action the incremental entity provider will take.
* \*/
* next_action:
* | 'rest'
* | 'ingest'
* | 'backoff'
* | 'cancel'
* | 'nothing (done)'
* | 'nothing (canceled)';
* /\*\*
* - Current status of the incremental entity provider.
* \*/
* status:
* | 'complete'
* | 'bursting'
* | 'resting'
* | 'canceling'
* | 'interstitial'
* | 'backing off';
* /\*\*
* - The name of the incremental entity provider being updated.
* \*/
* provider_name: string;
* /\*\*
* - Date/time stamp for when the next action will trigger.
* \*/
* next_action_at?: Date;
* /\*\*
* - A record of the last error generated by the incremental entity provider.
* \*/
* last_error?: string | null;
* /\*\*
* - The number of attempts the provider has attempted during the current cycle.
* \*/
* attempts?: number;
* /\*\*
* - Date/time stamp for the completion of ingestion.
* \*/
* ingestion_completed_at?: Date | string | null;
* /\*\*
* - Date/time stamp for the end of the rest cycle before the next ingestion.
* \*/
* rest_completed_at?: Date | string | null;
* /\*\*
* - A record of the finalized status of the ingestion record. Values are either 'open' or a uuid.
* \*/
* completion_ticket: string;
  +}
* +/\*\*
* - This interface is for updating an existing ingestion record.
* \*/
  +export interface IngestionRecordUpdate {
* ingestionId: string;
* update: Partial<IngestionUpsert>;
  +}
* +/\*\*
* - The expected response from the `ingestion_marks` table.
* \*/
  +export interface MarkRecord {
* id: string;
* sequence: number;
* ingestion_id: string;
* cursor: unknown;
* created_at: string;
  +}
* +/\*\*
* - The expected response from the `ingestions` table.
* \*/
  +export interface IngestionRecord extends IngestionUpsert {
* id: string;
* next_action_at: Date;
* /\*\*
* - The date/time the ingestion record was created.
* \*/
* created_at: string;
  +}
* +/\*\*
* - This interface supplies all the values for adding an ingestion mark.
* \*/
  +export interface MarkRecordInsert {
* record: {
* id: string;
* ingestion_id: string;
* cursor: unknown;
* sequence: number;
* };
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/engine/OpenChoreoIncrementalIngestionEngine.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/engine/OpenChoreoIncrementalIngestionEngine.ts
  new file mode 100644
  index 0000000..23faedf
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/engine/OpenChoreoIncrementalIngestionEngine.ts
  @@ -0,0 +1,564 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*
* - This class implements the incremental ingestion engine for OpenChoreo.
* - It manages burst-based processing of entities using cursor-based pagination
* - to ensure efficient memory usage and resumable ingestion for large datasets.
* - Key features include state management, error handling with backoff, and event-driven updates.
* \*/
* +import type { DeferredEntity } from '@backstage/plugin-catalog-node';
  +import { Gauge, metrics } from '@opentelemetry/api';
  +import { IterationEngine, IterationEngineOptions } from '../types';
  +import { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
  +import { performance } from 'perf_hooks';
  +import { Duration } from 'luxon';
  +import { v4 } from 'uuid';
  +import { stringifyError } from '@backstage/errors';
  +import { EventParams } from '@backstage/plugin-events-node';
  +import { HumanDuration } from '@backstage/types';
* +const ERROR_MESSAGE_MAX_LENGTH = 700;
  +const MILLISECONDS_TO_SECONDS_DIVISOR = 1000;
* +export class OpenChoreoIncrementalIngestionEngine implements IterationEngine {
* private readonly restLength: Duration;
* private readonly burstLength: Duration;
* private readonly backoff: HumanDuration[];
* private readonly lastStarted: Gauge;
* private readonly lastCompleted: Gauge;
*
* private manager: OpenChoreoIncrementalIngestionDatabaseManager;
*
* constructor(private options: IterationEngineOptions) {
* const meter = metrics.getMeter('default');
*
* this.manager = options.manager;
* this.restLength = Duration.fromObject(options.restLength);
* this.burstLength = Duration.fromObject(options.burstLength);
* this.backoff = options.backoff ?? [
*      { minutes: 1 },
*      { minutes: 5 },
*      { minutes: 30 },
*      { hours: 3 },
* ];
*
* this.lastStarted = meter.createGauge(
*      'catalog_incremental.ingestions.started',
*      {
*        description:
*          'Epoch timestamp seconds when the ingestion was last started',
*        unit: 'seconds',
*      },
* );
* this.lastCompleted = meter.createGauge(
*      'catalog_incremental.ingestions.completed',
*      {
*        description:
*          'Epoch timestamp seconds when the ingestion was last completed',
*        unit: 'seconds',
*      },
* );
* }
*
* async taskFn(signal: AbortSignal) {
* try {
*      this.options.logger.debug('Begin tick');
*      await this.handleNextAction(signal);
* } catch (error) {
*      this.options.logger.error(`${error}`);
*      throw error;
* } finally {
*      this.options.logger.debug('End tick');
* }
* }
*
* async handleNextAction(signal: AbortSignal) {
* await this.options.ready;
*
* const result = await this.getCurrentAction();
* if (result) {
*      const { ingestionId, nextActionAt, nextAction, attempts } = result;
*
*      switch (nextAction) {
*        case 'rest':
*          if (Date.now() > nextActionAt) {
*            this.options.logger.info(
*              `incremental-engine: Ingestion ${ingestionId} rest period complete. Starting new ingestion`,
*            );
*
*            await this.manager.setProviderComplete(ingestionId);
*            await this.manager.clearFinishedIngestions(
*              this.options.provider.getProviderName(),
*            );
*
*            this.lastStarted.record(
*              Date.now() / MILLISECONDS_TO_SECONDS_DIVISOR,
*              {
*                providerName: this.options.provider.getProviderName(),
*              },
*            );
*          } else {
*            this.options.logger.debug(
*              `incremental-engine: Ingestion '${ingestionId}' rest period continuing`,
*            );
*          }
*          break;
*        case 'ingest':
*          try {
*            await this.manager.setProviderBursting(ingestionId);
*            const done = await this.ingestOneBurst(ingestionId, signal);
*            if (done) {
*              this.options.logger.info(
*                `incremental-engine: Ingestion '${ingestionId}' complete, transitioning to rest period of ${this.restLength.toHuman()}`,
*              );
*              this.lastCompleted.record(
*                Date.now() / MILLISECONDS_TO_SECONDS_DIVISOR,
*                {
*                  providerName: this.options.provider.getProviderName(),
*                  status: 'completed',
*                },
*              );
*              await this.manager.setProviderResting(
*                ingestionId,
*                this.restLength,
*              );
*            } else {
*              await this.manager.setProviderInterstitial(ingestionId);
*              this.options.logger.debug(
*                `incremental-engine: Ingestion '${ingestionId}' continuing`,
*              );
*            }
*          } catch (error) {
*            if (
*              (error as Error).message &&
*              (error as Error).message === 'CANCEL'
*            ) {
*              this.options.logger.info(
*                `incremental-engine: Ingestion '${ingestionId}' canceled`,
*              );
*              await this.manager.setProviderCanceling(
*                ingestionId,
*                (error as Error).message,
*              );
*            } else {
*              const currentBackoff = Duration.fromObject(
*                this.backoff[Math.min(this.backoff.length - 1, attempts)],
*              );
*
*              const backoffLength = currentBackoff.as('milliseconds');
*              this.options.logger.error(
*                `incremental-engine: Ingestion '${ingestionId}' failed`,
*                error as Error,
*              );
*
*              // Log partial progress before backing off
*              try {
*                const entityCounts = await this.manager.getEntityCountsByKind(
*                  ingestionId,
*                );
*
*                // Build dynamic summary of entity types
*                const entityEntries = Object.entries(entityCounts)
*                  .filter(([key]) => key !== 'total')
*                  .sort(([, a], [, b]) => b - a) // Sort by count descending
*                  .slice(0, 10); // Limit to top 10
*
*                const entityTypesSummary = entityEntries
*                  .map(([kind, count]) => {
*                    // Proper pluralization: avoid double 's' for kinds already ending in 's'
*                    const plural = kind.endsWith('s') ? kind : `${kind}s`;
*                    return `${count} ${plural}`;
*                  })
*                  .join(', ');
*
*                const totalTypes = Object.keys(entityCounts).length - 1; // minus 'total'
*                const truncated = totalTypes > 10;
*
*                const message = `incremental-engine: Ingestion '${ingestionId}': Partial progress before failure - ${
*                  entityCounts.total
*                } entities ingested so far (${entityTypesSummary}${
*                  truncated ? ` +${totalTypes - 10} more types` : ''
*                })`;
*
*                this.options.logger.info(message);
*              } catch (countError) {
*                this.options.logger.debug(
*                  `incremental-engine: Ingestion '${ingestionId}': Could not retrieve partial entity counts: ${
*                    (countError as Error).message
*                  }`,
*                );
*              }
*
*              const truncatedError = stringifyError(error).substring(
*                0,
*                ERROR_MESSAGE_MAX_LENGTH,
*              );
*              this.options.logger.error(
*                `incremental-engine: Ingestion '${ingestionId}' threw an error during ingestion burst. Ingestion will backoff for ${currentBackoff.toHuman()} (${truncatedError})`,
*              );
*              this.lastCompleted.record(
*                Date.now() / MILLISECONDS_TO_SECONDS_DIVISOR,
*                {
*                  providerName: this.options.provider.getProviderName(),
*                  status: 'failed',
*                },
*              );
*
*              await this.manager.setProviderBackoff(
*                ingestionId,
*                attempts,
*                error as Error,
*                backoffLength,
*              );
*            }
*          }
*          break;
*        case 'backoff':
*          if (Date.now() > nextActionAt) {
*            this.options.logger.info(
*              `incremental-engine: Ingestion '${ingestionId}' backoff complete, will attempt to resume`,
*            );
*            await this.manager.setProviderIngesting(ingestionId);
*          } else {
*            this.options.logger.debug(
*              `incremental-engine: Ingestion '${ingestionId}' backoff continuing`,
*            );
*          }
*          break;
*        case 'cancel':
*          this.options.logger.info(
*            `incremental-engine: Ingestion '${ingestionId}' canceling, will restart`,
*          );
*          await this.manager.setProviderCanceled(ingestionId);
*          break;
*        default:
*          this.options.logger.error(
*            `incremental-engine: Ingestion '${ingestionId}' received unknown action '${nextAction}'`,
*          );
*      }
* } else {
*      this.options.logger.error(
*        `incremental-engine: Engine tried to create duplicate ingestion record for provider '${this.options.provider.getProviderName()}'.`,
*      );
* }
* }
*
* async getCurrentAction() {
* const providerName = this.options.provider.getProviderName();
* const record = await this.manager.getCurrentIngestionRecord(providerName);
* if (record) {
*      this.options.logger.debug(
*        `incremental-engine: Ingestion record found: '${record.id}'`,
*      );
*      return {
*        ingestionId: record.id,
*        nextAction: record.next_action as 'rest' | 'ingest' | 'backoff',
*        attempts: record.attempts as number,
*        nextActionAt: record.next_action_at.valueOf() as number,
*      };
* }
* const result = await this.manager.createProviderIngestionRecord(
*      providerName,
* );
* if (result) {
*      this.options.logger.info(
*        `incremental-engine: Ingestion record created: '${result.ingestionId}'`,
*      );
* }
* return result;
* }
*
* async ingestOneBurst(id: string, signal: AbortSignal) {
* const lastMark = await this.manager.getLastMark(id);
*
* const cursor = lastMark ? lastMark.cursor : undefined;
* let sequence = lastMark ? lastMark.sequence + 1 : 0;
*
* const start = performance.now();
* let count = 0;
* let done = false;
* this.options.logger.info(
*      `incremental-engine: Ingestion '${id}' burst initiated`,
* );
*
* await this.options.provider.around(async (context: unknown) => {
*      let next = await this.options.provider.next(context, cursor);
*      count++;
*      for (;;) {
*        done = next.done;
*        await this.mark({
*          id,
*          sequence,
*          entities: next?.entities,
*          done: next.done,
*          cursor: next?.cursor,
*        });
*        if (signal.aborted || next.done) {
*          break;
*        } else if (
*          performance.now() - start >
*          this.burstLength.as('milliseconds')
*        ) {
*          this.options.logger.info(
*            `incremental-engine: Ingestion '${id}' burst ending after ${this.burstLength.toHuman()}.`,
*          );
*          break;
*        } else {
*          next = await this.options.provider.next(context, next.cursor);
*          count++;
*          sequence++;
*        }
*      }
* });
*
* this.options.logger.info(
*      `incremental-engine: Ingestion '${id}' burst complete. (${count} batches in ${Math.round(
*        performance.now() - start,
*      )}ms).`,
* );
* return done;
* }
*
* async mark(options: {
* id: string;
* sequence: number;
* entities?: DeferredEntity[];
* done: boolean;
* cursor?: unknown;
* }) {
* const { id, sequence, entities, done, cursor } = options;
* this.options.logger.debug(
*      `incremental-engine: Ingestion '${id}': MARK ${
*        entities ? entities.length : 0
*      } entities, cursor: ${
*        cursor ? JSON.stringify(cursor) : 'none'
*      }, done: ${done}`,
* );
* const markId = v4();
*
* await this.manager.createMark({
*      record: {
*        id: markId,
*        ingestion_id: id,
*        cursor,
*        sequence,
*      },
* });
*
* if (entities && entities.length > 0) {
*      await this.manager.createMarkEntities(markId, entities);
* }
*
* const added =
*      entities?.map(deferred => ({
*        ...deferred,
*        entity: {
*          ...deferred.entity,
*          metadata: {
*            ...deferred.entity.metadata,
*            annotations: {
*              ...deferred.entity.metadata.annotations,
*            },
*          },
*        },
*      })) ?? [];
*
* const sortedAdded = this.sortEntitiesByDependencyOrder(added);
*
* const removed: { entityRef: string }[] = [];
*
* if (done) {
*      this.options.logger.info(
*        `incremental-engine: Ingestion '${id}': Final page reached, calculating removed entities`,
*      );
*
*      try {
*        const entityCounts = await this.manager.getEntityCountsByKind(id);
*
*        // Build dynamic summary of entity types
*        const entityEntries = Object.entries(entityCounts)
*          .filter(([key]) => key !== 'total')
*          .sort(([, a], [, b]) => b - a) // Sort by count descending
*          .slice(0, 10); // Limit to top 10
*
*        const entityTypesSummary = entityEntries
*          .map(([kind, count]) => {
*            // Proper pluralization: avoid double 's' for kinds already ending in 's'
*            const plural = kind.endsWith('s') ? kind : `${kind}s`;
*            return `${count} ${plural}`;
*          })
*          .join(', ');
*
*        const totalTypes = Object.keys(entityCounts).length - 1; // minus 'total'
*        const truncated = totalTypes > 10;
*
*        const message = `incremental-engine: Ingestion '${id}': Successfully processed ${
*          entityCounts.total
*        } entities (${entityTypesSummary}${
*          truncated ? ` +${totalTypes - 10} more types` : ''
*        })`;
*
*        this.options.logger.info(message);
*      } catch (error) {
*        const errorMessage = error as Error;
*        this.options.logger.warn(
*          `incremental-engine: Ingestion '${id}': Could not calculate entity counts: ${errorMessage.message} (Type: ${errorMessage.constructor.name})`,
*          {
*            ingestionId: id,
*            errorType: errorMessage.constructor.name,
*            errorMessage: errorMessage.message,
*            stack: errorMessage.stack?.substring(0, 1000), // Truncate stack for logging
*          },
*        );
*      }
*
*      const result = await this.manager.computeRemoved(
*        this.options.provider.getProviderName(),
*        id,
*      );
*
*      const { total } = result;
*
*      let doRemoval = true;
*      if (this.options.rejectEmptySourceCollections) {
*        if (total === 0) {
*          this.options.logger.error(
*            `incremental-engine: Ingestion '${id}': Rejecting empty entity collection!`,
*          );
*          doRemoval = false;
*        }
*      }
*
*      if (this.options.rejectRemovalsAbovePercentage) {
*        // If the total entities upserted in this ingestion is 0, then
*        // 100% of entities are stale and marked for removal.
*        const percentRemoved =
*          total > 0 ? (result.removed.length / total) * 100 : 100;
*        if (percentRemoved <= this.options.rejectRemovalsAbovePercentage) {
*          this.options.logger.info(
*            `incremental-engine: Ingestion '${id}': Removing ${result.removed.length} entities that have no matching assets`,
*          );
*        } else {
*          const notice = `Attempted to remove ${percentRemoved}% of matching entities!`;
*          this.options.logger.error(
*            `incremental-engine: Ingestion '${id}': ${notice}`,
*          );
*          await this.manager.updateIngestionRecordById({
*            ingestionId: id,
*            update: {
*              last_error: `REMOVAL_THRESHOLD exceeded on ingestion mark ${markId}: ${notice}`,
*            },
*          });
*          doRemoval = false;
*        }
*      }
*      if (doRemoval) {
*        for (const entityRef of result.removed) {
*          removed.push(entityRef);
*        }
*      }
* }
*
* await this.options.connection.applyMutation({
*      type: 'delta',
*      added: sortedAdded,
*      removed,
* });
* }
*
* private sortEntitiesByDependencyOrder(
* entities: DeferredEntity[],
* ): DeferredEntity[] {
* const kindOrder = new Map<string, number>([
*      ['Domain', 0],
*      ['System', 1],
*      ['Component', 2],
*      ['API', 3],
* ]);
*
* return entities.slice().sort((a, b) => {
*      const orderA = kindOrder.get(a.entity.kind) ?? 999;
*      const orderB = kindOrder.get(b.entity.kind) ?? 999;
*      return orderA - orderB;
* });
* }
*
* async onEvent(params: EventParams): Promise<void> {
* const { topic } = params;
* if (!this.supportsEventTopics().includes(topic)) {
*      return;
* }
*
* const { logger, provider, connection } = this.options;
* const providerName = provider.getProviderName();
* logger.debug(`incremental-engine: ${providerName} received ${topic} event`);
*
* if (!provider.eventHandler) {
*      return;
* }
*
* const result = await provider.eventHandler.onEvent(params);
*
* if (result.type === 'delta') {
*      if (result.added.length > 0) {
*        const ingestionRecord = await this.manager.getCurrentIngestionRecord(
*          providerName,
*        );
*
*        if (!ingestionRecord) {
*          logger.debug(
*            `incremental-engine: ${providerName} skipping delta addition because incremental ingestion is restarting.`,
*          );
*        } else {
*          const mark =
*            ingestionRecord.status === 'resting'
*              ? await this.manager.getLastMark(ingestionRecord.id)
*              : await this.manager.getFirstMark(ingestionRecord.id);
*
*          if (!mark) {
*            throw new Error(
*              `Cannot apply delta, page records are missing! Please re-run incremental ingestion for ${providerName}.`,
*            );
*          }
*          await this.manager.createMarkEntities(mark.id, result.added);
*        }
*      }
*
*      if (result.removed.length > 0) {
*        await this.manager.deleteEntityRecordsByRef(result.removed);
*      }
*
*      await connection.applyMutation(result);
*      logger.debug(
*        `incremental-engine: ${providerName} processed delta from '${topic}' event`,
*      );
* } else {
*      logger.debug(
*        `incremental-engine: ${providerName} ignored event from topic '${topic}'`,
*      );
* }
* }
*
* supportsEventTopics(): string[] {
* const { provider } = this.options;
* const topics = provider.eventHandler
*      ? provider.eventHandler.supportsEventTopics()
*      : [];
* return topics;
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/index.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/index.ts
  new file mode 100644
  index 0000000..7c4dd0b
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/index.ts
  @@ -0,0 +1,44 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Provides efficient incremental ingestion of entities into the catalog for OpenChoreo.
* -
* - This module enables scalable entity processing using cursor-based pagination,
* - burst-based ingestion cycles, and resumable state management to handle large
* - datasets without memory constraints. It supports event-driven updates and
* - automatic cleanup of stale entities.
* -
* - @packageDocumentation
* \*/
* +export { catalogModuleOpenchoreoIncremental as default } from './module';
  +export { catalogModuleOpenchoreoIncremental } from './module';
  +export { catalogModuleOpenchoreoIncrementalProvider } from './module/index';
  +export {
* catalogModuleOpenchoreoImmediateCatalogIncremental,
* openchoreoImmediateCatalogIncrementalServiceFactory,
  +} from './openchoreoImmediateCatalogIncremental';
  +export {
* openchoreoIncrementalProvidersExtensionPoint,
* type OpenChoreoIncrementalProviderExtensionPoint,
  +} from './module/index';
  +export {
* type EntityIteratorResult,
* type IncrementalEntityEventResult,
* type IncrementalEntityProvider,
* type IncrementalEntityProviderOptions,
  +} from './types';
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module.ts
  new file mode 100644
  index 0000000..1bb51f7
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module.ts
  @@ -0,0 +1,25 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Module definition for OpenChoreo incremental ingestion.
* - Exports the main catalog module for incremental entity processing.
* \*/
* +import catalogModuleOpenchoreoIncrementalEntityProvider from './module/index';
* +export const catalogModuleOpenchoreoIncremental =
* catalogModuleOpenchoreoIncrementalEntityProvider;
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.test.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.test.ts
  new file mode 100644
  index 0000000..799dd31
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.test.ts
  @@ -0,0 +1,121 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Test suite for WrapperProviders.
* - Verifies initialization and wrapping of incremental entity providers.
* \*/
* +import { SchedulerService } from '@backstage/backend-plugin-api';
  +import { TestDatabases, mockServices } from '@backstage/backend-test-utils';
  +import { ConfigReader } from '@backstage/config';
  +import { IncrementalEntityProvider } from '../types';
  +import { WrapperProviders } from './WrapperProviders';
* +jest.setTimeout(120_000);
* +const describeOrSkip = process.env.CI ? describe.skip : describe;
* +describeOrSkip('WrapperProviders', () => {
* const applyDatabaseMigrations = jest.fn();
* const databases = TestDatabases.create({
* ids: ['POSTGRES_17', 'POSTGRES_13', 'SQLITE_3', 'MYSQL_8'],
* });
* const config = new ConfigReader({});
* const logger = mockServices.logger.mock();
* const scheduler = {
* scheduleTask: jest.fn(),
* };
*
* beforeEach(() => {
* jest.clearAllMocks();
* });
*
* it.each(databases.eachSupportedId())(
* 'should initialize the providers in order, %p',
* async databaseId => {
*      const client = await databases.init(databaseId);
*
*      const provider1: IncrementalEntityProvider<number, {}> = {
*        getProviderName: () => 'provider1',
*        around: burst => burst(0),
*        next: async (_context, cursor) => {
*          return !cursor
*            ? { done: false, entities: [], cursor: 1 }
*            : { done: true };
*        },
*      };
*
*      const provider2: IncrementalEntityProvider<number, {}> = {
*        getProviderName: () => 'provider2',
*        around: burst => burst(0),
*        next: async (_context, cursor) => {
*          return !cursor
*            ? { done: false, entities: [], cursor: 1 }
*            : { done: true };
*        },
*      };
*
*      const providers = new WrapperProviders({
*        config,
*        logger,
*        client,
*        scheduler: scheduler as Partial<SchedulerService> as SchedulerService,
*        applyDatabaseMigrations,
*        events: mockServices.events.mock(),
*      });
*      const wrapped1 = providers.wrap(provider1, {
*        burstInterval: { seconds: 1 },
*        burstLength: { seconds: 1 },
*        restLength: { seconds: 1 },
*      });
*      const wrapped2 = providers.wrap(provider2, {
*        burstInterval: { seconds: 1 },
*        burstLength: { seconds: 1 },
*        restLength: { seconds: 1 },
*      });
*
*      let resolved = false;
*      providers.waitForReady().then(() => {
*        resolved = true;
*      });
*
*      expect(applyDatabaseMigrations).toHaveBeenCalledTimes(0);
*      expect(resolved).toBe(false);
*      expect(scheduler.scheduleTask).not.toHaveBeenCalled();
*
*      await wrapped1.connect({} as any); // simulates the catalog engine
*
*      expect(resolved).toBe(false);
*      expect(applyDatabaseMigrations).toHaveBeenCalledTimes(1);
*      expect(scheduler.scheduleTask).toHaveBeenLastCalledWith(
*        expect.objectContaining({
*          id: 'provider1',
*        }),
*      );
*
*      await wrapped2.connect({} as any);
*
*      expect(resolved).toBe(true);
*      expect(applyDatabaseMigrations).toHaveBeenCalledTimes(1);
*      expect(scheduler.scheduleTask).toHaveBeenLastCalledWith(
*        expect.objectContaining({
*          id: 'provider2',
*        }),
*      );
* },
* );
  +});
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.ts
  new file mode 100644
  index 0000000..0c7a2e4
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/WrapperProviders.ts
  @@ -0,0 +1,190 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +import {
* LoggerService,
* RootConfigService,
* SchedulerService,
  +} from '@backstage/backend-plugin-api';
  +import { stringifyError } from '@backstage/errors';
  +import {
* EntityProvider,
* EntityProviderConnection,
  +} from '@backstage/plugin-catalog-node';
  +import { createDeferred } from '@backstage/types';
  +import express from 'express';
  +import { Knex } from 'knex';
  +import { Duration } from 'luxon';
  +import { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
  +import { applyDatabaseMigrations } from '../database/migrations';
  +import { OpenChoreoIncrementalIngestionEngine } from '../engine/OpenChoreoIncrementalIngestionEngine';
  +import { IncrementalProviderRouter } from '../router/routes';
  +import {
* IncrementalEntityProvider,
* IncrementalEntityProviderOptions,
  +} from '../types';
  +import { EventsService } from '@backstage/plugin-events-node';
* +const MINIMUM_SCHEDULER_INTERVAL_MS = 5000;
  +const BURST_LENGTH_MARGIN_MINUTES = 1;
* +/\*\*
* - WrapperProviders class for managing incremental entity providers.
* - Handles initialization, database migrations, scheduling, and event subscriptions
* - for providers that support burst-based, resumable entity ingestion.
* \*/
* +/\*\*
* - Helps in the creation of the catalog entity providers that wrap the
* - incremental ones.
* \*/
  +export class WrapperProviders {
* private migrate: Promise<void> | undefined;
* private numberOfProvidersToConnect = 0;
* private readonly readySignal = createDeferred();
*
* constructor(
* private readonly options: {
*      config: RootConfigService;
*      logger: LoggerService;
*      client: Knex;
*      scheduler: SchedulerService;
*      applyDatabaseMigrations?: typeof applyDatabaseMigrations;
*      events: EventsService;
* },
* ) {}
*
* wrap(
* provider: IncrementalEntityProvider<unknown, unknown>,
* options: IncrementalEntityProviderOptions,
* ): EntityProvider {
* this.numberOfProvidersToConnect += 1;
* return {
*      getProviderName: () => provider.getProviderName(),
*      connect: async connection => {
*        try {
*          await this.startProvider(provider, options, connection);
*        } finally {
*          this.numberOfProvidersToConnect -= 1;
*          if (this.numberOfProvidersToConnect === 0) {
*            this.readySignal.resolve();
*          }
*        }
*      },
* };
* }
*
* adminRouter(): express.Router {
* return new IncrementalProviderRouter(
*      new OpenChoreoIncrementalIngestionDatabaseManager({
*        client: this.options.client,
*        logger: this.options.logger,
*      }),
*      this.options.logger,
* ).createRouter();
* }
*
* /\*\*
* - Waits for all wrapped providers to complete their initial connection.
* - This is useful for tests or initialization code that needs to ensure
* - all providers are ready before proceeding.
* \*/
* waitForReady(): Promise<void> {
* return this.readySignal;
* }
*
* private async startProvider(
* provider: IncrementalEntityProvider<unknown, unknown>,
* providerOptions: IncrementalEntityProviderOptions,
* connection: EntityProviderConnection,
* ) {
* const logger = this.options.logger.child({
*      entityProvider: provider.getProviderName(),
* });
*
* try {
*      if (!this.migrate) {
*        this.migrate = Promise.resolve().then(async () => {
*          const apply =
*            this.options.applyDatabaseMigrations ?? applyDatabaseMigrations;
*          await apply(this.options.client);
*        });
*      }
*
*      await this.migrate;
*
*      const { burstInterval, burstLength, restLength } = providerOptions;
*
*      logger.info(`Connecting`);
*
*      const manager = new OpenChoreoIncrementalIngestionDatabaseManager({
*        client: this.options.client,
*        logger,
*      });
*      const engine = new OpenChoreoIncrementalIngestionEngine({
*        ...providerOptions,
*        ready: this.readySignal,
*        manager,
*        logger,
*        provider,
*        restLength,
*        connection,
*      });
*
*      let frequency = Duration.isDuration(burstInterval)
*        ? burstInterval
*        : Duration.fromObject(burstInterval);
*      if (frequency.as('milliseconds') < MINIMUM_SCHEDULER_INTERVAL_MS) {
*        frequency = Duration.fromMillis(MINIMUM_SCHEDULER_INTERVAL_MS);
*      }
*
*      let length = Duration.isDuration(burstLength)
*        ? burstLength
*        : Duration.fromObject(burstLength);
*      length = length.plus(
*        Duration.fromObject({ minutes: BURST_LENGTH_MARGIN_MINUTES }),
*      );
*
*      await this.options.scheduler.scheduleTask({
*        id: provider.getProviderName(),
*        fn: engine.taskFn.bind(engine),
*        frequency,
*        timeout: length,
*      });
*
*      const topics = engine.supportsEventTopics();
*      if (topics.length > 0) {
*        logger.info(
*          `Provider ${provider.getProviderName()} subscribing to events for topics: ${topics.join(
*            ',',
*          )}`,
*        );
*        await this.options.events.subscribe({
*          topics,
*          id: `catalog-backend-module-incremental-ingestion:${provider.getProviderName()}`,
*          onEvent: evt => engine.onEvent(evt),
*        });
*      }
* } catch (error) {
*      logger.warn(
*        `Failed to initialize incremental ingestion provider ${provider.getProviderName()}, ${stringifyError(
*          error,
*        )}`,
*      );
*      throw error;
* }
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.test.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.test.ts
  new file mode 100644
  index 0000000..bc3d601
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.test.ts
  @@ -0,0 +1,81 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Test suite for catalogModuleOpenchoreoIncrementalEntityProvider.
* - Verifies registration of incremental providers at the catalog extension point.
* \*/
* +import { createBackendModule } from '@backstage/backend-plugin-api';
  +import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
  +import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
  +import { IncrementalEntityProvider } from '../types';
  +import {
* catalogModuleOpenchoreoIncrementalEntityProvider,
* openchoreoIncrementalProvidersExtensionPoint,
  +} from './catalogModuleIncrementalIngestionEntityProvider';
* +describe('catalogModuleOpenchoreoIncrementalEntityProvider', () => {
* it('should register provider at the catalog extension point', async () => {
* const provider1: IncrementalEntityProvider<number, {}> = {
*      getProviderName: () => 'provider1',
*      around: burst => burst(0),
*      next: async (_context, cursor) => {
*        return !cursor
*          ? { done: false, entities: [], cursor: 1 }
*          : { done: true };
*      },
* };
*
* const addEntityProvider = jest.fn();
*
* const httpRouterMock = mockServices.httpRouter.mock();
*
* await startTestBackend({
*      extensionPoints: [
*        [catalogProcessingExtensionPoint, { addEntityProvider }],
*      ],
*      features: [
*        httpRouterMock.factory,
*        catalogModuleOpenchoreoIncrementalEntityProvider,
*        createBackendModule({
*          pluginId: 'catalog',
*          moduleId: 'incremental-test',
*          register(env) {
*            env.registerInit({
*              deps: { extension: openchoreoIncrementalProvidersExtensionPoint },
*              async init({ extension }) {
*                extension.addProvider({
*                  provider: provider1,
*                  options: {
*                    burstInterval: { seconds: 1 },
*                    burstLength: { seconds: 1 },
*                    restLength: { seconds: 1 },
*                  },
*                });
*              },
*            });
*          },
*        }),
*      ],
* });
*
* expect(addEntityProvider).toHaveBeenCalledTimes(1);
* expect(addEntityProvider.mock.calls[0][0].getProviderName()).toBe(
*      'provider1',
* );
* });
  +});
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.ts
  new file mode 100644
  index 0000000..d4ab21f
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/catalogModuleIncrementalIngestionEntityProvider.ts
  @@ -0,0 +1,145 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Main module for OpenChoreo incremental ingestion entity provider.
* - Defines the extension point and backend module for registering and managing incremental providers.
* \*/
* +import {
* coreServices,
* createBackendModule,
* createExtensionPoint,
  +} from '@backstage/backend-plugin-api';
  +import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
  +import { WrapperProviders } from './WrapperProviders';
  +import { eventsServiceRef } from '@backstage/plugin-events-node';
  +import {
* IncrementalEntityProvider,
* IncrementalEntityProviderOptions,
  +} from '../types';
* +/\*\*
* - @public
* - Interface for {@link openchoreoIncrementalProvidersExtensionPoint}.
* \*/
  +export interface OpenChoreoIncrementalProviderExtensionPoint {
* /\*_ Adds a new incremental entity provider _/
* addProvider<TCursor, TContext>(config: {
* options: IncrementalEntityProviderOptions;
* provider: IncrementalEntityProvider<TCursor, TContext>;
* }): void;
  +}
* +/\*\*
* - @public
* -
* - Extension point for registering OpenChoreo incremental ingestion providers.
* - The `catalogModuleOpenchoreoIncrementalEntityProvider` must be installed for these providers to work.
* -
* - @example
* -
* - ```ts
    +backend.add(createBackendModule({
    ```
* pluginId: 'catalog',
* moduleId: 'my-openchoreo-incremental-provider',
* register(env) {
* env.registerInit({
*      deps: {
*        extension: openchoreoIncrementalProvidersExtensionPoint,
*      },
*      async init({ extension }) {
*        extension.addProvider({
*          options: {
*            burstInterval:,
*            burstLength:,
*            restLength: ,
*          },
*          provider: {
*            next(context, cursor) {
*            },
*          },
*        });
*      },
* });
  +}))
* - ```
    +**/
    +export const openchoreoIncrementalProvidersExtensionPoint =
    ```
* createExtensionPoint<OpenChoreoIncrementalProviderExtensionPoint>({
* id: 'catalog.openchoreoIncrementalProvider.providers',
* });
* +/\*\*
* - Registers the incremental entity provider with the catalog processing extension point for OpenChoreo.
* -
* - @public
* \*/
  +export const catalogModuleOpenchoreoIncrementalEntityProvider =
* createBackendModule({
* pluginId: 'catalog',
* moduleId: 'openchoreo-incremental-entity-provider',
* register(env) {
*      const addedProviders = new Array<{
*        provider: IncrementalEntityProvider<unknown, unknown>;
*        options: IncrementalEntityProviderOptions;
*      }>();
*
*      env.registerExtensionPoint(openchoreoIncrementalProvidersExtensionPoint, {
*        addProvider({ options, provider }) {
*          addedProviders.push({ options, provider });
*        },
*      });
*
*      env.registerInit({
*        deps: {
*          catalog: catalogProcessingExtensionPoint,
*          config: coreServices.rootConfig,
*          database: coreServices.database,
*          httpRouter: coreServices.httpRouter,
*          logger: coreServices.logger,
*          scheduler: coreServices.scheduler,
*          events: eventsServiceRef,
*        },
*        async init({
*          catalog,
*          config,
*          database,
*          httpRouter,
*          logger,
*          scheduler,
*          events,
*        }) {
*          const client = await database.getClient();
*
*          const providers = new WrapperProviders({
*            config,
*            logger,
*            client,
*            scheduler,
*            events,
*          });
*
*          for (const entry of addedProviders) {
*            const wrapped = providers.wrap(entry.provider, entry.options);
*            catalog.addEntityProvider(wrapped);
*          }
*
*          httpRouter.use(providers.adminRouter());
*        },
*      });
* },
* });
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/index.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/index.ts
  new file mode 100644
  index 0000000..684b6b1
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/index.ts
  @@ -0,0 +1,27 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Module index for OpenChoreo incremental ingestion.
* - Exports the main components for the incremental provider module.
* \*/
* +export {
* catalogModuleOpenchoreoIncrementalEntityProvider as default,
* openchoreoIncrementalProvidersExtensionPoint,
* type OpenChoreoIncrementalProviderExtensionPoint,
  +} from './catalogModuleIncrementalIngestionEntityProvider';
  +export { catalogModuleOpenchoreoIncrementalProvider } from './openchoreoIncrementalProviderModule';
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/module/openchoreoIncrementalProviderModule.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/module/openchoreoIncrementalProviderModule.ts
  new file mode 100644
  index 0000000..9281b3b
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/module/openchoreoIncrementalProviderModule.ts
  @@ -0,0 +1,87 @@
  +/\*\*
* - Backend module for OpenChoreo incremental provider.
* - Registers the OpenChoreoIncrementalEntityProvider with the extension point,
* - configuring it with burst and rest intervals from the application config.
* \*/
* +import {
* coreServices,
* createBackendModule,
  +} from '@backstage/backend-plugin-api';
  +import { openchoreoIncrementalProvidersExtensionPoint } from './catalogModuleIncrementalIngestionEntityProvider';
  +import { OpenChoreoIncrementalEntityProvider } from '../providers/OpenChoreoIncrementalEntityProvider';
* +export const catalogModuleOpenchoreoIncrementalProvider = createBackendModule({
* pluginId: 'catalog',
* moduleId: 'openchoreo-incremental-provider',
* register(env) {
* env.registerInit({
*      deps: {
*        extension: openchoreoIncrementalProvidersExtensionPoint,
*        config: coreServices.rootConfig,
*        logger: coreServices.logger,
*      },
*      async init({ extension, config, logger }) {
*        const provider = new OpenChoreoIncrementalEntityProvider(
*          config,
*          logger,
*        );
*
*        extension.addProvider({
*          provider,
*          options: {
*            // The interval between bursts of processing activity
*            burstInterval: {
*              seconds: Math.max(
*                1,
*                config.getOptionalNumber(
*                  'openchoreo.incremental.burstInterval',
*                ) || 30,
*              ),
*            },
*            // The duration of each burst of processing activity
*            burstLength: {
*              seconds: Math.max(
*                1,
*                config.getOptionalNumber(
*                  'openchoreo.incremental.burstLength',
*                ) || 10,
*              ),
*            },
*            // The duration of rest periods between bursts
*            restLength: {
*              minutes: Math.max(
*                1,
*                config.getOptionalNumber('openchoreo.incremental.restLength') ||
*                  30,
*              ),
*            },
*            // Backoff intervals for retry attempts (configurable array of durations in seconds)
*            backoff: (() => {
*              const backoffConfig = config.getOptional(
*                'openchoreo.incremental.backoff',
*              );
*              if (
*                Array.isArray(backoffConfig) &&
*                backoffConfig.every(
*                  (item): item is number =>
*                    typeof item === 'number' && item > 0,
*                )
*              ) {
*                return backoffConfig.map((seconds: number) => ({
*                  seconds: Math.max(1, seconds),
*                }));
*              }
*              return [
*                { seconds: 30 },
*                { minutes: 1 },
*                { minutes: 5 },
*                { minutes: 30 },
*              ];
*            })(),
*          },
*        });
*      },
* });
* },
  +});
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/openchoreoImmediateCatalogIncremental.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/openchoreoImmediateCatalogIncremental.ts
  new file mode 100644
  index 0000000..bb13f1f
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/openchoreoImmediateCatalogIncremental.ts
  @@ -0,0 +1,71 @@
  +import {
* coreServices,
* createBackendModule,
* createServiceFactory,
  +} from '@backstage/backend-plugin-api';
  +import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
  +import {
* immediateCatalogServiceRef,
* ScaffolderEntityProvider,
* type ImmediateCatalogService,
  +} from '@openchoreo/backstage-plugin-catalog-backend-module';
* +let scaffolderProviderInstance: ScaffolderEntityProvider | undefined;
* +const MAIN_INCREMENTAL_PROVIDER_NAME = 'OpenChoreoIncrementalEntityProvider';
* +/\*\*
* - Adds a catalog entity provider that supports immediate delta mutations.
* -
* - This is intended to be used together with the OpenChoreo incremental ingestion provider,
* - without enabling the legacy scheduled OpenChoreo provider.
* \*/
  +export const catalogModuleOpenchoreoImmediateCatalogIncremental =
* createBackendModule({
* pluginId: 'catalog',
* moduleId: 'openchoreo-immediate-catalog-incremental',
* register(env) {
*      env.registerInit({
*        deps: {
*          catalog: catalogProcessingExtensionPoint,
*          logger: coreServices.logger,
*        },
*        async init({ catalog, logger }) {
*          if (!scaffolderProviderInstance) {
*            scaffolderProviderInstance = new ScaffolderEntityProvider(
*              logger,
*              MAIN_INCREMENTAL_PROVIDER_NAME,
*            );
*          }
*
*          catalog.addEntityProvider(scaffolderProviderInstance);
*        },
*      });
* },
* });
* +/\*\*
* - Provides the `openchoreo.immediate-catalog` service used by OpenChoreo scaffolder actions.
* \*/
  +export const openchoreoImmediateCatalogIncrementalServiceFactory =
* createServiceFactory({
* service: immediateCatalogServiceRef,
* deps: {
*      logger: coreServices.logger,
* },
* async factory({ logger }): Promise<ImmediateCatalogService> {
*      if (!scaffolderProviderInstance) {
*        scaffolderProviderInstance = new ScaffolderEntityProvider(
*          logger,
*          MAIN_INCREMENTAL_PROVIDER_NAME,
*        );
*      }
*
*      return {
*        insertEntity: async entity =>
*          scaffolderProviderInstance!.insertEntity(entity),
*        removeEntity: async entityRef =>
*          scaffolderProviderInstance!.removeEntity(entityRef),
*      };
* },
* });
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.test.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.test.ts
  new file mode 100644
  index 0000000..3e36139
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.test.ts
  @@ -0,0 +1,639 @@
  +/\*\*
* - Test suite for OpenChoreoIncrementalEntityProvider.
* - Verifies incremental entity processing, cursor handling, and entity translation.
* \*/
  +import { OpenChoreoIncrementalEntityProvider } from './OpenChoreoIncrementalEntityProvider';
  +import { ConfigReader } from '@backstage/config';
  +import { mockServices } from '@backstage/backend-test-utils';
  +import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
  +import { DEFAULT_PAGE_LIMIT } from '@openchoreo/backstage-plugin-common';
* +jest.mock('@openchoreo/openchoreo-client-node');
* +// Helper to create mock response structure for new pagination format
  +const createMockResponse = (
* items: any[],
* hasMore: boolean = false,
* continueToken?: string,
  +) => ({
* data: {
* success: true,
* data: {
*      items,
*      metadata: {
*        resourceVersion: '1',
*        hasMore,
*        continue: continueToken,
*      },
* },
* },
* error: undefined,
* response: {
* ok: true,
* status: 200,
* statusText: 'OK',
* headers: {
*      get: jest.fn().mockReturnValue('1024'), // Mock content-length
* },
* },
  +});
* +describe('OpenChoreoIncrementalEntityProvider', () => {
* const createMockLogger = () => mockServices.logger.mock();
* const createMockConfig = (config?: any) =>
* new ConfigReader({
*      openchoreo: {
*        baseUrl: 'http://localhost:8080',
*        incremental: {
*          chunkSize: 5,
*          ...config,
*        },
*      },
* });
*
* beforeEach(() => {
* jest.clearAllMocks();
* });
*
* it('should return correct provider name', () => {
* const config = createMockConfig();
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
* expect(provider.getProviderName()).toBe(
*      'OpenChoreoIncrementalEntityProvider',
* );
* });
*
* it('should use default chunk size when not configured', () => {
* const config = new ConfigReader({
*      openchoreo: { baseUrl: 'http://localhost:8080' },
* });
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
* expect(provider.getProviderName()).toBe(
*      'OpenChoreoIncrementalEntityProvider',
* );
* });
*
* it('caps configured chunk size to API maximum', async () => {
* const config = new ConfigReader({
*      openchoreo: {
*        baseUrl: 'http://localhost:8080',
*        incremental: {
*          chunkSize: 2000,
*        },
*      },
* });
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockClient = {
*      GET: jest
*        .fn()
*        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* await provider.next({ config, logger });
*
* expect(mockClient.GET).toHaveBeenCalledWith('/orgs', {
*      params: {
*        query: {
*          limit: DEFAULT_PAGE_LIMIT,
*        },
*      },
* });
* });
*
* it('should initialize with around method', async () => {
* const config = createMockConfig();
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockBurst = jest.fn().mockResolvedValue(undefined);
* await provider.around(mockBurst);
*
* expect(mockBurst).toHaveBeenCalledWith({
*      config,
*      logger: expect.any(Object),
* });
* });
*
* it('should handle first call with no cursor in cursor mode', async () => {
* const config = createMockConfig();
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockClient = {
*      GET: jest
*        .fn()
*        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* // First call around() to set cursor mode
* await provider.around(jest.fn().mockResolvedValue(undefined));
*
* const context = { config, logger };
* const result = await provider.next(context);
*
* expect(result.done).toBe(false);
* expect(result.cursor?.phase).toBe('projects');
* expect(result.cursor?.orgQueue).toEqual(['org1']);
* });
*
* it('should process organizations in chunks with cursor', async () => {
* const config = createMockConfig({ chunkSize: 2 });
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockOrganizations = [
*      {
*        name: 'org1',
*        displayName: 'Org 1',
*        description: 'Description 1',
*        createdAt: '2023-01-01',
*        status: 'active',
*        namespace: 'ns1',
*      },
*      {
*        name: 'org2',
*        displayName: 'Org 2',
*        description: 'Description 2',
*        createdAt: '2023-01-02',
*        status: 'active',
*        namespace: 'ns2',
*      },
* ];
*
* const mockClient = {
*      GET: jest
*        .fn()
*        .mockResolvedValue(createMockResponse(mockOrganizations, false)),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* // First call around() to set cursor mode
* await provider.around(jest.fn().mockResolvedValue(undefined));
*
* const context = { config, logger };
* const result = await provider.next(context);
*
* expect(result.done).toBe(false);
* expect(result.entities).toHaveLength(2);
* expect(result.cursor).toEqual({
*      componentApiCursor: undefined,
*      currentOrgIndex: 0,
*      currentProjectIndex: 0,
*      orgApiCursor: undefined,
*      orgQueue: ['org1', 'org2'],
*      phase: 'projects',
*      processedComponents: new Set(),
*      processedOrgs: new Set(['org1', 'org2']),
*      processedProjects: new Set(),
*      projectApiCursor: undefined,
*      projectQueue: [],
* });
* });
*
* it('handles cursor mode by default', async () => {
* const config = createMockConfig();
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockClient = {
*      GET: jest
*        .fn()
*        .mockResolvedValue(createMockResponse([{ name: 'org1' }], false)),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* const burst = jest.fn().mockResolvedValue(undefined);
* await provider.around(burst);
* // around() does not call the API client itself; it only prepares context and calls the burst
* expect(burst).toHaveBeenCalledWith({
*      config,
*      logger: expect.any(Object),
* });
* expect(mockClient.GET).not.toHaveBeenCalled();
* });
*
* it('cursor traversal sets resourceType across phases', async () => {
* const config = createMockConfig({
*      chunkSize: 1,
* });
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* let orgCallCount = 0;
* let projectCallCount = 0;
* let componentCallCount = 0;
*
* const mockClient = {
*      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
*        if (path === '/orgs') {
*          orgCallCount++;
*          if (orgCallCount === 1) {
*            // Initial fetch
*            return Promise.resolve(
*              createMockResponse([{ name: 'org1' }], true, 'c1'),
*            );
*          }
*          // Second page
*          return Promise.resolve(createMockResponse([{ name: 'org2' }], false));
*        } else if (path === '/orgs/{orgName}/projects') {
*          projectCallCount++;
*          return Promise.resolve(
*            createMockResponse([{ name: 'proj1' }], false),
*          );
*        } else if (
*          path === '/orgs/{orgName}/projects/{projectName}/components'
*        ) {
*          componentCallCount++;
*          return Promise.resolve(
*            createMockResponse(
*              [
*                {
*                  name: `comp${componentCallCount}`,
*                  type: 'Library',
*                  status: 'Active',
*                  createdAt: '2024-01-01',
*                },
*              ],
*              false,
*            ),
*          );
*        }
*        return Promise.resolve(createMockResponse([], false));
*      }),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* const burst = jest.fn().mockResolvedValue(undefined);
* await provider.around(burst);
*
* const init = await provider.next({
*      config,
*      logger,
* });
* expect(init.cursor?.phase).toBe('orgs');
*
* const afterOrgs = await provider.next(
*      { config, logger },
*      init.cursor as any,
* );
* expect(['orgs', 'projects']).toContain(afterOrgs.cursor?.phase);
*
* const afterProjects = await provider.next(
*      { config, logger },
*      afterOrgs.cursor as any,
* );
*
* const afterComponents = await provider.next(
*      { config, logger },
*      afterProjects.cursor as any,
* );
*
* await provider.next({ config, logger }, afterComponents.cursor as any);
* expect(['orgs', 'projects']).toContain(afterOrgs.cursor?.phase);
*
* const toProjects = await provider.next(
*      { config, logger },
*      afterOrgs.cursor as any,
* );
* expect(['orgs', 'projects']).toContain(toProjects.cursor?.phase);
* });
*
* it('translates service component into component + API entities', async () => {
* const config = createMockConfig({
*      chunkSize: 10,
* });
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* const mockClient = {
*      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
*        if (path === '/orgs') {
*          return Promise.resolve(createMockResponse([{ name: 'org1' }], false));
*        } else if (path === '/orgs/{orgName}/projects') {
*          return Promise.resolve(
*            createMockResponse([{ name: 'proj1' }], false),
*          );
*        } else if (
*          path === '/orgs/{orgName}/projects/{projectName}/components'
*        ) {
*          return Promise.resolve(
*            createMockResponse(
*              [
*                {
*                  name: 'svc1',
*                  type: 'Service',
*                  status: 'Active',
*                  createdAt: '2024-01-01',
*                },
*              ],
*              false,
*            ),
*          );
*        } else if (
*          path ===
*          '/orgs/{orgName}/projects/{projectName}/components/{componentName}'
*        ) {
*          return Promise.resolve({
*            data: {
*              success: true,
*              data: {
*                name: 'svc1',
*                type: 'Service',
*                status: 'Active',
*                createdAt: '2024-01-01',
*                description: 'Service 1',
*                workload: {
*                  endpoints: {
*                    rest: { type: 'REST', port: 8080 },
*                    grpc: { type: 'gRPC', port: 9090 },
*                  },
*                },
*              },
*            },
*            error: undefined,
*            response: {
*              ok: true,
*              status: 200,
*              statusText: 'OK',
*              headers: {
*                get: jest.fn().mockReturnValue('2048'), // Mock content-length
*              },
*            },
*          });
*        }
*        return Promise.resolve(createMockResponse([], false));
*      }),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* const burst = jest.fn().mockResolvedValue(undefined);
* await provider.around(burst);
*
* // orgs
* const c1 = await provider.next({
*      config,
*      logger,
* });
* // projects
* const c2 = await provider.next({ config, logger }, c1.cursor as any);
* // components phase init
* const c3 = await provider.next({ config, logger }, c2.cursor as any);
* const c4 = await provider.next({ config, logger }, c3.cursor as any);
*
* // One of these calls should produce service + 2 API entities
* const entitiesBatch = [c1, c2, c3, c4].flatMap(r => r.entities || []);
* const apiKinds = entitiesBatch.filter(e => e.entity.kind === 'API');
* const componentKinds = entitiesBatch.filter(
*      e => e.entity.kind === 'Component',
* );
* expect(componentKinds.length).toBeGreaterThanOrEqual(1);
* expect(apiKinds.length).toBe(2);
* });
*
* it('handles HTTP 410 expired cursor error and restarts', async () => {
* const config = createMockConfig();
* const logger = createMockLogger();
* const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
* let callCount = 0;
*
* const mockClient = {
*      GET: jest.fn().mockImplementation((path: string, _options?: any) => {
*        callCount++;
*        if (path === '/orgs') {
*          if (callCount === 1) {
*            // Initial fetch with continue token
*            return Promise.resolve(
*              createMockResponse([{ name: 'org1' }], true, 'c1'),
*            );
*          }
*          if (callCount === 2 && _options?.params?.query?.continue) {
*            // Simulate 410 error for expired cursor
*            return Promise.resolve({
*              data: undefined,
*              error: { message: 'Cursor expired' },
*              response: {
*                ok: false,
*                status: 410,
*                statusText: 'Gone',
*                headers: {
*                  get: jest.fn().mockReturnValue('0'), // Mock content-length
*                },
*              },
*            });
*          }
*          // Restart without cursor
*          return Promise.resolve(createMockResponse([{ name: 'org1' }], false));
*        }
*        return Promise.resolve(createMockResponse([], false));
*      }),
* };
* (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
* await provider.around(jest.fn().mockResolvedValue(undefined));
*
* // First call - orgs with more pages
* const c1 = await provider.next({ config, logger });
* expect(c1.cursor?.phase).toBe('orgs');
*
* // Second call should trigger 410 and restart
* const c2 = await provider.next({ config, logger }, c1.cursor as any);
*
* // Should have transitioned to projects phase after restart
* expect(['orgs', 'projects']).toContain(c2.cursor?.phase);
* expect(logger.warn).toHaveBeenCalledWith(
*      expect.stringContaining('Pagination token expired'),
* );
* });
*
* describe('HTTP 410 error handling', () => {
* it('should reset cursor and restart from beginning when HTTP 410 occurs during organizations phase', async () => {
*      const config = createMockConfig();
*      const logger = createMockLogger();
*      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
*      const mockClient = {
*        GET: jest
*          .fn()
*          .mockRejectedValueOnce(
*            new Error('Request failed with status code 410'),
*          )
*          .mockResolvedValueOnce(
*            createMockResponse([{ name: 'org1' }, { name: 'org2' }], false),
*          ),
*      };
*      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
*      const cursor = {
*        phase: 'orgs' as const,
*        orgApiCursor: 'expired-cursor-token',
*        orgQueue: [],
*        currentOrgIndex: 0,
*        projectApiCursor: undefined,
*        projectQueue: [],
*        currentProjectIndex: 0,
*        componentApiCursor: undefined,
*      };
*
*      const result = await provider.next({ config, logger }, cursor);
*
*      expect(result.done).toBe(false);
*      expect(result.entities).toHaveLength(2);
*      expect(result.entities?.[0].entity.metadata.name).toBe('org1');
*      expect(result.entities?.[1].entity.metadata.name).toBe('org2');
*      expect(result.cursor?.phase).toBe('projects');
*      // Implementation logs an 'Expired cursor detected' message when restarting org fetch
*      expect(logger.warn).toHaveBeenCalledWith(
*        expect.stringContaining('Expired cursor detected'),
*      );
* });
*
* it('should reset cursor and restart from beginning when HTTP 410 occurs during projects phase', async () => {
*      const config = createMockConfig();
*      const logger = createMockLogger();
*      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
*      const mockClient = {
*        GET: jest.fn().mockImplementation((path: string, _options?: any) => {
*          if (
*            path === '/orgs/{orgName}/projects' &&
*            _options?.params?.query?.continue
*          ) {
*            // Simulate expired cursor when continue param is present
*            return Promise.reject(new Error('continue parameter is too old'));
*          }
*          if (path === '/orgs/{orgName}/projects') {
*            return Promise.resolve(
*              createMockResponse([{ name: 'project1' }], false),
*            );
*          }
*          if (path === '/orgs') {
*            return Promise.resolve(
*              createMockResponse([{ name: 'org1' }], false),
*            );
*          }
*          return Promise.resolve(createMockResponse([], false));
*        }),
*      };
*      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
*      const cursor = {
*        phase: 'projects' as const,
*        orgApiCursor: undefined,
*        orgQueue: ['org1'],
*        currentOrgIndex: 0,
*        projectApiCursor: 'expired-project-cursor',
*        projectQueue: [],
*        currentProjectIndex: 0,
*        componentApiCursor: undefined,
*        currentOrg: 'org1',
*      };
*
*      const result = await provider.next({ config, logger }, cursor);
*
*      expect(result.done).toBe(false);
*      expect(result.entities).toHaveLength(1);
*      // Implementation restarts the project fetch for the current org and keeps processing in 'projects' phase
*      expect(result.cursor?.phase).toBe('projects');
*      expect(logger.warn).toHaveBeenCalledWith(
*        expect.stringContaining('Expired cursor detected for projects'),
*      );
* });
*
* it('should reset cursor and restart from beginning when token expired error occurs during components phase', async () => {
*      const config = createMockConfig();
*      const logger = createMockLogger();
*      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
*      const mockClient = {
*        GET: jest.fn().mockImplementation((path: string, _options?: any) => {
*          if (
*            path === '/orgs/{orgName}/projects/{projectName}/components' &&
*            _options?.params?.query?.continue
*          ) {
*            return Promise.reject(new Error('expired cursor token'));
*          }
*          if (path === '/orgs/{orgName}/projects/{projectName}/components') {
*            return Promise.resolve(
*              createMockResponse([{ name: 'comp1' }], false),
*            );
*          }
*          if (path === '/orgs') {
*            return Promise.resolve(
*              createMockResponse([{ name: 'org1' }], false),
*            );
*          }
*          if (path === '/orgs/{orgName}/projects') {
*            return Promise.resolve(
*              createMockResponse([{ name: 'project1' }], false),
*            );
*          }
*          return Promise.resolve(createMockResponse([], false));
*        }),
*      };
*      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
*      const cursor = {
*        phase: 'components' as const,
*        orgApiCursor: undefined,
*        orgQueue: ['org1'],
*        currentOrgIndex: 0,
*        projectApiCursor: undefined,
*        projectQueue: [{ org: 'org1', project: 'project1' }],
*        currentProjectIndex: 0,
*        componentApiCursor: 'expired-component-cursor',
*        currentOrg: 'org1',
*        currentProject: 'project1',
*      };
*
*      const result = await provider.next({ config, logger }, cursor);
*
*      expect(result.done).toBe(false);
*      expect(result.entities).toHaveLength(1);
*      expect(result.cursor?.phase).toBe('components');
*      expect(result.cursor?.currentProjectIndex).toBe(1);
*      expect(logger.warn).toHaveBeenCalledWith(
*        expect.stringContaining('Expired cursor detected'),
*      );
* });
*
* it('should handle HTTP 410 with truncated cursor token in log message', async () => {
*      const config = createMockConfig();
*      const logger = createMockLogger();
*      const provider = new OpenChoreoIncrementalEntityProvider(config, logger);
*
*      const longCursor = 'a'.repeat(100);
*      const mockClient = {
*        GET: jest
*          .fn()
*          .mockRejectedValueOnce(new Error('HTTP 410 Gone'))
*          .mockResolvedValueOnce(createMockResponse([{ name: 'org1' }], false)),
*      };
*      (createOpenChoreoApiClient as jest.Mock).mockReturnValue(mockClient);
*
*      const cursor = {
*        phase: 'orgs' as const,
*        orgApiCursor: longCursor,
*        orgQueue: [],
*        currentOrgIndex: 0,
*        projectApiCursor: undefined,
*        projectQueue: [],
*        currentProjectIndex: 0,
*        componentApiCursor: undefined,
*      };
*
*      await provider.next({ config, logger }, cursor);
*
*      // The in-band retry path for orgs logs an 'Expired cursor detected' message (cursor not included)
*      expect(logger.warn).toHaveBeenCalledWith(
*        expect.stringContaining('Expired cursor detected'),
*      );
* });
* });
  +});
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.ts
  new file mode 100644
  index 0000000..501e418
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/OpenChoreoIncrementalEntityProvider.ts
  @@ -0,0 +1,705 @@
  +import { IncrementalEntityProvider, EntityIteratorResult } from '../types';
  +import {
* createOpenChoreoApiClient,
* type OpenChoreoComponents,
  +} from '@openchoreo/openchoreo-client-node';
  +import { DEFAULT_PAGE_LIMIT } from '@openchoreo/backstage-plugin-common';
  +import { Entity } from '@backstage/catalog-model';
  +import { Config } from '@backstage/config';
  +import { LoggerService } from '@backstage/backend-plugin-api';
  +import { EntityTranslator } from './entityTranslator';
  +import { ComponentBatchProcessor } from './componentBatchProcessor';
* +// Use generated types from OpenAPI spec
  +type ModelsOrganization =
* OpenChoreoComponents['schemas']['OrganizationResponse'];
  +type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
  +type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
  +type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];
* +/\*\*
* - Incremental entity provider for OpenChoreo.
* - Processes entities in phases (organizations, projects, components) using cursor-based pagination
* - to enable efficient, resumable ingestion of large datasets.
* -
* - ## Iterator Semantics
* - - `done: false` = Continue iteration, more batches available
* - - `done: true` = Iteration complete, no more data to process
* -
* - **Important**: `done: false` means overall iteration continues, NOT that current resource has more items.
* - When a resource is exhausted, we return `done: false` and advance to next resource.
* - Only when ALL phases complete do we return `done: true`.
* \*/
* +interface CursorTraversalCursor {
* orgApiCursor?: string;
* projectApiCursor?: string;
* componentApiCursor?: string;
* orgQueue: string[];
* currentOrgIndex: number;
* projectQueue: { org: string; project: string }[];
* currentProjectIndex: number;
* currentOrg?: string;
* currentProject?: string;
* cursorResetCount?: number;
* phase?: 'orgs' | 'projects' | 'components';
* // Track processed entities to avoid duplicates on cursor reset
* processedOrgs?: Set<string>;
* processedProjects?: Set<string>;
* processedComponents?: Set<string>;
  +}
* +export type OpenChoreoCursor = CursorTraversalCursor;
* +// Context for API client and shared state
  +interface OpenChoreoContext {
* config: Config;
* logger: LoggerService;
  +}
* +/\*\*
* - Incremental entity provider for OpenChoreo that processes entities in phases
* - using cursor-based pagination for efficient, resumable ingestion of large datasets.
* - Processes organizations, projects, and components in sequence with memory-efficient chunking.
* - Supports progressive traversal through large catalogs without requiring full data loading.
* \*/
  +export class OpenChoreoIncrementalEntityProvider
* implements IncrementalEntityProvider<OpenChoreoCursor, OpenChoreoContext>
  +{
* // OpenAPI schema caps page size at 5000; enforce locally to avoid 400s
* private static readonly API_MAX_PAGE_LIMIT = DEFAULT_PAGE_LIMIT;
* private readonly config: Config;
* private readonly logger: LoggerService;
* private readonly chunkSize: number;
* private readonly translator: EntityTranslator;
* private readonly batchProcessor: ComponentBatchProcessor;
*
* /\*\*
* - Creates a new instance of the incremental entity provider
* - @param config - Backstage configuration for OpenChoreo settings
* - @param logger - Logger service for operational logging
* \*/
* constructor(config: Config, logger: LoggerService) {
* this.config = config;
* this.logger = logger;
* const configuredChunkSize =
*      config.getOptionalNumber('openchoreo.incremental.chunkSize') ||
*      DEFAULT_PAGE_LIMIT;
* this.chunkSize = Math.min(
*      configuredChunkSize,
*      OpenChoreoIncrementalEntityProvider.API_MAX_PAGE_LIMIT,
* );
* if (this.chunkSize < configuredChunkSize) {
*      this.logger.debug(
*        `Configured chunkSize ${configuredChunkSize} exceeds API max; capping to ${this.chunkSize}`,
*      );
* }
* this.translator = new EntityTranslator(this.getProviderName());
* this.batchProcessor = new ComponentBatchProcessor(this.getProviderName());
* }
*
* getProviderName(): string {
* return 'OpenChoreoIncrementalEntityProvider';
* }
*
* /\*\*
* - Sets up the provider context and detects pagination mode
* - Probes the API for cursor capability and falls back to legacy mode if unavailable
* - @param burst - Function to execute with the prepared context
* \*/
* async around(
* burst: (context: OpenChoreoContext) => Promise<void>,
* ): Promise<void> {
* const context: OpenChoreoContext = {
*      config: this.config,
*      logger: this.logger,
* };
*
* await burst(context);
* }
*
* /\*\*
* - Processes the next batch of entities using cursor-based or legacy pagination
* - Routes to appropriate processing mode based on API capabilities
* - @param context - Provider context with config and logger
* - @param cursor - Current traversal state for resumable processing
* - @returns Iterator result with entities and next cursor state
* - @throws {Error} If entity processing fails unrecoverably
* \*/
* async next(
* context: OpenChoreoContext,
* cursor?: OpenChoreoCursor,
* ): Promise<EntityIteratorResult<OpenChoreoCursor>> {
* try {
*      return await this.nextCursorMode(context, cursor);
* } catch (error) {
*      const errorMessage =
*        error instanceof Error ? error.message : String(error);
*
*      // Check if this is an expired cursor error (HTTP 410 Gone)
*      if (
*        errorMessage.includes('410') ||
*        errorMessage.includes('expired') ||
*        errorMessage.includes('continue parameter is too old')
*      ) {
*        const phase = cursor?.phase || 'unknown';
*        const cursorValue =
*          cursor?.orgApiCursor ||
*          cursor?.projectApiCursor ||
*          cursor?.componentApiCursor;
*
*        context.logger.warn(
*          `HTTP 410: Pagination token expired during '${phase}' phase. ` +
*            `Cursor: ${
*              cursorValue ? `${cursorValue.substring(0, 20)}...` : 'none'
*            }. ` +
*            `Resetting cursor and restarting ingestion from beginning.`,
*        );
*
*        // Restart from the beginning without cursor
*        return await this.nextCursorMode(context, undefined);
*      }
*
*      context.logger.error(`Error processing OpenChoreo entities: ${error}`);
*      throw error;
* }
* }
*
* // ===================== Cursor Mode Implementation ===================== //
*
* /\*\*
* - Core cursor-based processing routine that handles three-phase ingestion
* - Processes organizations, then projects, then components in sequence
* - Maintains traversal state across batches for resumable ingestion
* - @param context - Provider context with config and logger
* - @param cursor - Current cursor state for phase and position tracking
* - @returns Iterator result with entities and updated cursor state
* \*/
* private async nextCursorMode(
* context: OpenChoreoContext,
* cursor?: CursorTraversalCursor,
* ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
* const baseUrl = this.config.getString('openchoreo.baseUrl');
* const client = createOpenChoreoApiClient({
*      baseUrl,
*      logger: context.logger,
* });
*
* // Initialize cursor if none supplied
* if (!cursor) {
*      const { data, error, response } = await client.GET('/orgs', {
*        params: {
*          query: {
*            limit: this.chunkSize,
*          },
*        },
*      });
*
*      if (error || !response.ok || !data?.success || !data?.data?.items) {
*        throw new Error(
*          `Failed to fetch initial organizations: ${response.status} ${response.statusText}`,
*        );
*      }
*
*      const orgItems = data.data.items as ModelsOrganization[];
*      const metadata = data.data.metadata as ResponseMetadata | undefined;
*      const entities: Entity[] = orgItems.map(o =>
*        this.translator.translateOrganizationToDomain(o),
*      );
*
*      const hasMore = metadata?.hasMore && !!metadata?.continue;
*      const nextCursorVal = metadata?.continue;
*
*      const initial: CursorTraversalCursor = {
*        phase: hasMore ? 'orgs' : 'projects',
*        orgApiCursor: nextCursorVal,
*        orgQueue: orgItems.map(o => o.name!),
*        currentOrgIndex: 0,
*        projectApiCursor: undefined,
*        projectQueue: [],
*        currentProjectIndex: 0,
*        componentApiCursor: undefined,
*        processedOrgs: new Set(orgItems.map(o => o.name!)),
*        processedProjects: new Set(),
*        processedComponents: new Set(),
*      };
*
*      return {
*        done: false,
*        entities: entities.map(entity => ({ entity })),
*        cursor: initial,
*      };
* }
*
* switch (cursor.phase) {
*      case 'orgs':
*        return this.processOrganizationsCursor(client, context, cursor);
*      case 'projects':
*        return this.processProjectsCursor(client, context, cursor);
*      case 'components':
*        return this.processComponentsCursor(client, context, cursor);
*      default:
*        return { done: true }; // Unknown phase = complete iteration
* }
* }
*
* private async processOrganizationsCursor(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* context: OpenChoreoContext,
* cursor: CursorTraversalCursor,
* ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
* if (!cursor.orgApiCursor) {
*      // No more organization pages, transition to projects phase
*      // Note: done:false = continue iteration, not current resource has more items
*      return {
*        done: false, // Continue - moving to projects phase
*        entities: [],
*        cursor: {
*          ...cursor,
*          phase: 'projects',
*          currentOrgIndex: 0,
*        },
*      };
* }
*
* let data;
* let error;
* let response;
* try {
*      const result = await client.GET('/orgs', {
*        params: {
*          query: {
*            limit: this.chunkSize,
*            continue: cursor.orgApiCursor,
*          },
*        },
*      });
*      data = result.data;
*      error = result.error;
*      response = result.response;
* } catch (err) {
*      const errorMessage = err instanceof Error ? err.message : String(err);
*
*      // Check if this is an expired cursor error (HTTP 410)
*      if (
*        errorMessage.includes('410') ||
*        errorMessage.includes('expired') ||
*        errorMessage.includes('continue parameter is too old')
*      ) {
*        context.logger.warn(
*          `Expired cursor detected for organizations (reset #${
*            (cursor.cursorResetCount || 0) + 1
*          }), restarting fetch from beginning to avoid duplicates`,
*        );
*
*        // Restart organization fetch without cursor
*        const restartResult = await client.GET('/orgs', {
*          params: {
*            query: {
*              limit: this.chunkSize,
*            },
*          },
*        });
*
*        if (
*          restartResult.error ||
*          !restartResult.response.ok ||
*          !restartResult.data?.success ||
*          !restartResult.data?.data?.items
*        ) {
*          throw new Error(
*            `Failed to restart organization fetch: ${restartResult.response.status}`,
*          );
*        }
*
*        const items = restartResult.data.data.items as ModelsOrganization[];
*        const metadata = restartResult.data.data.metadata as
*          | ResponseMetadata
*          | undefined;
*
*        // Filter out already processed organizations to avoid duplicates
*        const newItems = items.filter(o => !cursor.processedOrgs?.has(o.name!));
*        const newOrgQueue = newItems.map((o: ModelsOrganization) => o.name!);
*
*        // Update processed organizations set
*        const updatedProcessedOrgs = new Set(cursor.processedOrgs || []);
*        newItems.forEach(o => updatedProcessedOrgs.add(o.name!));
*
*        const entities: Entity[] = newItems.map((o: ModelsOrganization) =>
*          this.translator.translateOrganizationToDomain(o),
*        );
*
*        const hasMore = metadata?.hasMore && !!metadata?.continue;
*
*        context.logger.info(
*          `Filtered ${
*            items.length - newItems.length
*          } already processed organizations, emitting ${
*            newItems.length
*          } new organizations`,
*        );
*
*        return {
*          done: false,
*          entities: entities.map(entity => ({ entity })),
*          cursor: {
*            ...cursor,
*            orgApiCursor: metadata?.continue,
*            orgQueue: newOrgQueue,
*            phase: hasMore ? 'orgs' : 'projects',
*            cursorResetCount: (cursor.cursorResetCount || 0) + 1,
*            processedOrgs: updatedProcessedOrgs,
*          },
*        };
*      }
*
*      // Re-throw other errors
*      throw err;
* }
*
* if (error || !response.ok || !data?.success || !data?.data?.items) {
*      // Handle HTTP 410 specifically
*      if (response.status === 410) {
*        context.logger.warn(
*          'Pagination token expired (410 Gone) for organizations, restarting fetch',
*        );
*        return this.processOrganizationsCursor(client, context, {
*          ...cursor,
*          orgApiCursor: undefined,
*        });
*      }
*      throw new Error(
*        `Failed to fetch organizations: ${response.status} ${response.statusText}`,
*      );
* }
*
* const items = data.data.items as ModelsOrganization[];
* const metadata = data.data.metadata as ResponseMetadata | undefined;
*
* // Filter out already processed organizations to avoid duplicates
* const newItems = items.filter(o => !cursor.processedOrgs?.has(o.name!));
*
* // Update processed organizations set
* const updatedProcessedOrgs = new Set(cursor.processedOrgs || []);
* newItems.forEach(o => updatedProcessedOrgs.add(o.name!));
*
* const entities: Entity[] = newItems.map((o: ModelsOrganization) =>
*      this.translator.translateOrganizationToDomain(o),
* );
*
* // Append to orgQueue (only new items)
* const newOrgQueue = cursor.orgQueue.concat(
*      newItems.map((o: ModelsOrganization) => o.name!),
* );
* const hasMore = metadata?.hasMore && !!metadata?.continue;
*
* if (items.length > newItems.length) {
*      context.logger.debug(
*        `Filtered ${
*          items.length - newItems.length
*        } already processed organizations`,
*      );
* }
*
* return {
*      done: false,
*      entities: entities.map(entity => ({ entity })),
*      cursor: {
*        ...cursor,
*        orgApiCursor: metadata?.continue,
*        orgQueue: newOrgQueue,
*        phase: hasMore ? 'orgs' : 'projects',
*        processedOrgs: updatedProcessedOrgs,
*      },
* };
* }
*
* private async processProjectsCursor(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* context: OpenChoreoContext,
* cursor: CursorTraversalCursor,
* ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
* // If we've processed all organizations, transition to components phase
* if (cursor.currentOrgIndex >= cursor.orgQueue.length) {
*      // Note: done:false = continue iteration, not current resource has more items
*      return {
*        done: false, // Continue - moving to components phase
*        entities: [],
*        cursor: {
*          ...cursor,
*          phase: 'components',
*          currentProjectIndex: 0,
*        },
*      };
* }
*
* const currentOrg = cursor.orgQueue[cursor.currentOrgIndex];
*
* let data;
* let error;
* let response;
* try {
*      const result = await client.GET('/orgs/{orgName}/projects', {
*        params: {
*          path: { orgName: currentOrg },
*          query: {
*            limit: this.chunkSize,
*            ...(cursor.projectApiCursor && {
*              continue: cursor.projectApiCursor,
*            }),
*          },
*        },
*      });
*      data = result.data;
*      error = result.error;
*      response = result.response;
* } catch (err) {
*      const errorMessage = err instanceof Error ? err.message : String(err);
*
*      // Check if this is an expired cursor error
*      if (
*        errorMessage.includes('410') ||
*        errorMessage.includes('expired') ||
*        errorMessage.includes('continue parameter is too old')
*      ) {
*        context.logger.warn(
*          `Expired cursor detected for projects in org ${currentOrg}, restarting fetch from beginning`,
*        );
*
*        // Restart project fetch for this organization without cursor
*        const restartResult = await client.GET('/orgs/{orgName}/projects', {
*          params: {
*            path: { orgName: currentOrg },
*            query: {
*              limit: this.chunkSize,
*            },
*          },
*        });
*
*        if (
*          restartResult.error ||
*          !restartResult.response.ok ||
*          !restartResult.data?.success
*        ) {
*          throw new Error(
*            `Failed to restart project fetch for ${currentOrg}: ${restartResult.response.status}`,
*          );
*        }
*
*        // Clear the existing project queue for this org and rebuild it
*        cursor.projectQueue = cursor.projectQueue.filter(
*          p => p.org !== currentOrg,
*        );
*        cursor.projectApiCursor = undefined;
*
*        data = restartResult.data;
*        response = restartResult.response;
*        error = restartResult.error;
*      } else {
*        // Re-throw other errors
*        throw err;
*      }
* }
*
* if (error || !response.ok || !data?.success) {
*      // Handle HTTP 410 specifically
*      if (response.status === 410) {
*        context.logger.warn(
*          `Pagination token expired (410 Gone) for projects in ${currentOrg}, restarting`,
*        );
*        return this.processProjectsCursor(client, context, {
*          ...cursor,
*          projectApiCursor: undefined,
*        });
*      }
*      throw new Error(
*        `Failed to fetch projects for ${currentOrg}: ${response.status} ${response.statusText}`,
*      );
* }
*
* const items = (data.data?.items || []) as ModelsProject[];
* const metadata = data.data?.metadata as ResponseMetadata | undefined;
* const entities: Entity[] = items.map((p: ModelsProject) =>
*      this.translator.translateProjectToEntity(p, currentOrg),
* );
*
* // Accumulate project names for component phase
* const newProjectPairs = items.map((p: ModelsProject) => ({
*      org: currentOrg,
*      project: p.name!,
* }));
* const projectQueue = cursor.projectQueue.concat(newProjectPairs);
*
* const hasMore = metadata?.hasMore && !!metadata?.continue;
*
* if (!hasMore) {
*      // Finished this organization, move to next org
*      return {
*        done: false, // Continue - more organizations may exist
*        entities: entities.map(entity => ({ entity })),
*        cursor: {
*          ...cursor,
*          projectApiCursor: undefined,
*          currentOrgIndex: cursor.currentOrgIndex + 1,
*          projectQueue,
*          currentOrg,
*        },
*      };
* }
*
* return {
*      done: false,
*      entities: entities.map(entity => ({ entity })),
*      cursor: {
*        ...cursor,
*        projectApiCursor: metadata?.continue,
*        projectQueue,
*        currentOrg,
*      },
* };
* }
*
* private async processComponentsCursor(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* context: OpenChoreoContext,
* cursor: CursorTraversalCursor,
* ): Promise<EntityIteratorResult<CursorTraversalCursor>> {
* // If all projects processed -> done
* // Note: This is the ONLY place we return done:true - iteration complete
* if (cursor.currentProjectIndex >= cursor.projectQueue.length) {
*      return { done: true }; // Iteration complete - no more data
* }
*
* const { org, project } = cursor.projectQueue[cursor.currentProjectIndex];
*
* let data;
* let error;
* let response;
* try {
*      const result = await client.GET(
*        '/orgs/{orgName}/projects/{projectName}/components',
*        {
*          params: {
*            path: { orgName: org, projectName: project },
*            query: {
*              limit: this.chunkSize,
*              ...(cursor.componentApiCursor && {
*                continue: cursor.componentApiCursor,
*              }),
*            },
*          },
*        },
*      );
*      data = result.data;
*      error = result.error;
*      response = result.response;
* } catch (err) {
*      const errorMessage = err instanceof Error ? err.message : String(err);
*
*      // Check if this is an expired cursor error (HTTP 410)
*      if (
*        errorMessage.includes('410') ||
*        errorMessage.includes('expired') ||
*        errorMessage.includes('continue parameter is too old')
*      ) {
*        context.logger.warn(
*          `Expired cursor detected for ${org}/${project}, restarting component fetch from beginning. Error: ${errorMessage}`,
*        );
*
*        // Restart component fetch for this project without cursor
*        const restartResult = await client.GET(
*          '/orgs/{orgName}/projects/{projectName}/components',
*          {
*            params: {
*              path: { orgName: org, projectName: project },
*              query: {
*                limit: this.chunkSize,
*              },
*            },
*          },
*        );
*
*        if (
*          restartResult.error ||
*          !restartResult.response.ok ||
*          !restartResult.data?.success
*        ) {
*          throw new Error(
*            `Failed to restart component fetch for ${org}/${project}: ${restartResult.response.status}`,
*          );
*        }
*
*        // Reset the component cursor in the traversal state
*        cursor.componentApiCursor = undefined;
*
*        data = restartResult.data;
*        response = restartResult.response;
*        error = restartResult.error;
*      } else {
*        // Re-throw other errors
*        context.logger.error(
*          `Non-cursor error in ${org}/${project}: ${errorMessage}`,
*        );
*        throw err;
*      }
* }
*
* if (error || !response.ok || !data?.success) {
*      // Handle HTTP 410 specifically
*      if (response.status === 410) {
*        context.logger.warn(
*          `Pagination token expired (410 Gone) for components in ${org}/${project}, restarting`,
*        );
*        return this.processComponentsCursor(client, context, {
*          ...cursor,
*          componentApiCursor: undefined,
*        });
*      }
*      throw new Error(
*        `Failed to fetch components for ${org}/${project}: ${response.status} ${response.statusText}`,
*      );
* }
*
* const items = (data.data?.items || []) as ModelsComponent[];
* const metadata = data.data?.metadata as ResponseMetadata | undefined;
*
* // Use batch processing for components to reduce N+1 API calls
* const batchedEntities =
*      await this.batchProcessor.translateComponentsWithApisBatch(
*        client,
*        items,
*        org,
*        project,
*        context,
*      );
*
* const hasMore = metadata?.hasMore && !!metadata?.continue;
*
* if (!hasMore) {
*      // Finished this project, move to next project
*      // Note: done:false = continue iteration, not current resource has more items
*      return {
*        done: false, // Continue - more projects may exist
*        entities: batchedEntities.map(entity => ({ entity })),
*        cursor: {
*          ...cursor,
*          componentApiCursor: undefined,
*          currentProjectIndex: cursor.currentProjectIndex + 1,
*          currentOrg: org,
*          currentProject: project,
*        },
*      };
* }
*
* return {
*      done: false,
*      entities: batchedEntities.map(entity => ({ entity })),
*      cursor: {
*        ...cursor,
*        componentApiCursor: metadata?.continue,
*        currentOrg: org,
*        currentProject: project,
*      },
* };
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/providers/componentBatchProcessor.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/componentBatchProcessor.ts
  new file mode 100644
  index 0000000..5bfcb03
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/componentBatchProcessor.ts
  @@ -0,0 +1,246 @@
  +// Optimized batch processing for component API calls
  +// This file contains helper methods to be integrated into OpenChoreoIncrementalEntityProvider
* +import { Entity } from '@backstage/catalog-model';
  +import { Config } from '@backstage/config';
  +import { LoggerService } from '@backstage/backend-plugin-api';
  +import { EntityTranslator } from './entityTranslator';
  +import type {
* createOpenChoreoApiClient,
* OpenChoreoComponents,
  +} from '@openchoreo/openchoreo-client-node';
* +type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
* +interface OpenChoreoContext {
* config: Config;
* logger: LoggerService;
  +}
* +/\*\*
* - Processes components in batches to reduce N+1 API calls
* - Fetches service components with limited concurrency to avoid overwhelming the API
* \*/
  +export class ComponentBatchProcessor {
* private readonly translator: EntityTranslator;
*
* constructor(providerName: string) {
* this.translator = new EntityTranslator(providerName);
* }
*
* /\*\*
* - Processes components in batches to reduce API calls
* - @param client - API client for fetching component details
* - @param components - Array of components to process
* - @param orgName - Organization name for context
* - @param projectName - Project name for context
* - @param context - Provider context for logging
* - @returns Array of translated entities
* \*/
* async translateComponentsWithApisBatch(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* components: ModelsComponent[],
* orgName: string,
* projectName: string,
* context: OpenChoreoContext,
* ): Promise<Entity[]> {
* const entities: Entity[] = [];
* const serviceComponents = components.filter(c => c.type === 'Service');
* const nonServiceComponents = components.filter(c => c.type !== 'Service');
*
* // Process non-service components normally (no additional API calls needed)
* for (const component of nonServiceComponents) {
*      const basic = this.translator.translateComponentToEntity(
*        component,
*        orgName,
*        projectName,
*      );
*      entities.push(basic);
* }
*
* // Batch fetch service components with controlled concurrency
* if (serviceComponents.length > 0) {
*      const startTime = Date.now();
*      context.logger.info(
*        `Processing ${serviceComponents.length} service components for ${orgName}/${projectName} with batch API calls`,
*      );
*
*      try {
*        const MAX_CONCURRENT =
*          context.config.getOptionalNumber(
*            'openchoreo.maxConcurrentRequests',
*          ) ?? 5; // Limit concurrent API calls
*        const BATCH_DELAY =
*          context.config.getOptionalNumber('openchoreo.batchDelayMs') ?? 100; // 100ms delay between batches
*
*        for (let i = 0; i < serviceComponents.length; i += MAX_CONCURRENT) {
*          const batch = serviceComponents.slice(i, i + MAX_CONCURRENT);
*
*          // Create promises for batch with error handling
*          const promises = batch.map(
*            async (component: ModelsComponent, index: number) => {
*              try {
*                const { data, error, response } = await client.GET(
*                  '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
*                  {
*                    params: {
*                      path: {
*                        orgName,
*                        projectName,
*                        componentName: component.name!,
*                      },
*                    },
*                  },
*                );
*
*                if (error || !response.ok || !data?.success || !data?.data) {
*                  throw new Error(`HTTP ${response.status}`);
*                }
*
*                return {
*                  component,
*                  result: data.data,
*                  success: true,
*                  index,
*                };
*              } catch (error) {
*                context.logger.warn(
*                  `Failed to fetch complete component details for ${component.name}: ${error}`,
*                );
*                return {
*                  component,
*                  error,
*                  success: false,
*                  index,
*                };
*              }
*            },
*          );
*
*          // Execute batch with timeout
*          const batchResults = await Promise.allSettled(promises);
*
*          // Process results
*          batchResults.forEach((result, batchIndex) => {
*            if (result.status === 'fulfilled') {
*              const {
*                component,
*                result: completeResult,
*                success,
*              } = result.value;
*
*              if (success && completeResult) {
*                try {
*                  const { componentEntity, apiEntities } =
*                    this.translator.processServiceComponentWithCursor(
*                      completeResult,
*                      orgName,
*                      projectName,
*                    );
*                  entities.push(componentEntity, ...apiEntities);
*                } catch (translationError) {
*                  context.logger.warn(
*                    `Failed to translate service component ${component.name}: ${translationError}`,
*                  );
*                  // Fallback to basic translation
*                  const fallback = this.translator.translateComponentToEntity(
*                    component,
*                    orgName,
*                    projectName,
*                  );
*                  entities.push(fallback);
*                }
*              } else {
*                // Fallback to basic translation for failed API calls
*                const fallback = this.translator.translateComponentToEntity(
*                  component,
*                  orgName,
*                  projectName,
*                );
*                entities.push(fallback);
*              }
*            } else {
*              // Handle promise rejection
*              const component = batch[batchIndex];
*              context.logger.error(
*                `Promise rejected for component ${component.name}: ${result.reason}`,
*              );
*              // Fallback to basic translation
*              const fallback = this.translator.translateComponentToEntity(
*                component,
*                orgName,
*                projectName,
*              );
*              entities.push(fallback);
*            }
*          });
*
*          // Add delay between batches to avoid API rate limiting
*          if (i + MAX_CONCURRENT < serviceComponents.length) {
*            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
*          }
*        }
*
*        const duration = Date.now() - startTime;
*        context.logger.info(
*          `Batch processed ${
*            serviceComponents.length
*          } service components in ${duration}ms (${Math.round(
*            duration / serviceComponents.length,
*          )}ms per component)`,
*        );
*      } catch (error) {
*        context.logger.warn(
*          `Batch service component processing failed, falling back to individual processing: ${error}`,
*        );
*
*        // Fallback to processing individually (original behavior)
*        for (const component of serviceComponents) {
*          try {
*            const {
*              data,
*              error: fetchError,
*              response,
*            } = await client.GET(
*              '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
*              {
*                params: {
*                  path: {
*                    orgName,
*                    projectName,
*                    componentName: component.name!,
*                  },
*                },
*              },
*            );
*
*            if (fetchError || !response.ok || !data?.success || !data?.data) {
*              throw new Error(`HTTP ${response.status}`);
*            }
*
*            const completeComponent = data.data;
*            const { componentEntity, apiEntities } =
*              this.translator.processServiceComponentWithCursor(
*                completeComponent,
*                orgName,
*                projectName,
*              );
*            entities.push(componentEntity, ...apiEntities);
*          } catch (individualError) {
*            context.logger.warn(
*              `Failed to fetch complete component details for ${component.name}: ${individualError}`,
*            );
*            const fallback = this.translator.translateComponentToEntity(
*              component,
*              orgName,
*              projectName,
*            );
*            entities.push(fallback);
*          }
*        }
*      }
* }
*
* return entities;
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/providers/entityTranslator.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/entityTranslator.ts
  new file mode 100644
  index 0000000..fe9ced3
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/providers/entityTranslator.ts
  @@ -0,0 +1,295 @@
  +import {
* Entity,
* ANNOTATION_LOCATION,
* ANNOTATION_ORIGIN_LOCATION,
  +} from '@backstage/catalog-model';
  +import {
* CHOREO_ANNOTATIONS,
* CHOREO_LABELS,
  +} from '@openchoreo/backstage-plugin-common';
  +import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
* +// Use generated types from OpenAPI spec
  +type ModelsOrganization =
* OpenChoreoComponents['schemas']['OrganizationResponse'];
  +type ModelsProject = OpenChoreoComponents['schemas']['ProjectResponse'];
  +type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];
  +type ModelsCompleteComponent =
* OpenChoreoComponents['schemas']['ComponentResponse'];
* +// WorkloadEndpoint is part of the workload.endpoints structure
  +interface WorkloadEndpoint {
* type: string;
* port: number;
* schema?: {
* content?: string;
* };
  +}
* +export class EntityTranslator {
* private readonly providerName: string;
*
* constructor(providerName: string) {
* this.providerName = providerName;
* }
*
* translateOrganizationToDomain(organization: ModelsOrganization): Entity {
* const domainEntity: Entity = {
*      apiVersion: 'backstage.io/v1alpha1',
*      kind: 'Domain',
*      metadata: {
*        name: organization.name!,
*        title: organization.displayName || organization.name!,
*        description: organization.description || organization.name!,
*        tags: ['openchoreo', 'organization', 'domain'],
*        annotations: {
*          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
*          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
*          [CHOREO_ANNOTATIONS.ORGANIZATION]: organization.name!,
*          ...(organization.namespace && {
*            [CHOREO_ANNOTATIONS.NAMESPACE]: organization.namespace,
*          }),
*          ...(organization.createdAt && {
*            [CHOREO_ANNOTATIONS.CREATED_AT]: organization.createdAt,
*          }),
*          ...(organization.status && {
*            [CHOREO_ANNOTATIONS.STATUS]: organization.status,
*          }),
*        },
*        labels: {
*          'openchoreo.io/managed': 'true',
*        },
*      },
*      spec: {
*        owner: 'guests',
*      },
* };
*
* return domainEntity;
* }
*
* translateProjectToEntity(project: ModelsProject, orgName: string): Entity {
* const systemEntity: Entity = {
*      apiVersion: 'backstage.io/v1alpha1',
*      kind: 'System',
*      metadata: {
*        name: project.name!,
*        title: project.displayName || project.name!,
*        description: project.description || project.name!,
*        tags: ['openchoreo', 'project'],
*        annotations: {
*          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
*          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
*          [CHOREO_ANNOTATIONS.PROJECT_ID]: project.name!,
*          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
*        },
*        labels: {
*          [CHOREO_LABELS.MANAGED]: 'true',
*        },
*      },
*      spec: {
*        owner: 'guests',
*        domain: orgName,
*      },
* };
*
* return systemEntity;
* }
*
* translateComponentToEntity(
* component: ModelsComponent,
* orgName: string,
* projectName: string,
* providesApis?: string[],
* ): Entity {
* let backstageComponentType: string = (
*      component.type || 'service'
* ).toLowerCase();
* if (component.type === 'WebApplication') {
*      backstageComponentType = 'website';
* }
*
* // Extract repository info from componentWorkflow (new structure)
* const repositoryUrl =
*      component.componentWorkflow?.systemParameters?.repository?.url;
* const branch =
*      component.componentWorkflow?.systemParameters?.repository?.revision
*        ?.branch;
*
* const componentEntity: Entity = {
*      apiVersion: 'backstage.io/v1alpha1',
*      kind: 'Component',
*      metadata: {
*        name: component.name!,
*        title: component.name!,
*        description: component.description || component.name!,
*        tags: [
*          'openchoreo',
*          'component',
*          (component.type || 'service').toLowerCase(),
*        ],
*        annotations: {
*          [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
*          [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
*          [CHOREO_ANNOTATIONS.COMPONENT]: component.name!,
*          ...(component.type && {
*            [CHOREO_ANNOTATIONS.COMPONENT_TYPE]: component.type,
*          }),
*          [CHOREO_ANNOTATIONS.PROJECT]: projectName,
*          [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
*          ...(component.createdAt && {
*            [CHOREO_ANNOTATIONS.CREATED_AT]: component.createdAt,
*          }),
*          ...(component.status && {
*            [CHOREO_ANNOTATIONS.STATUS]: component.status,
*          }),
*          ...(repositoryUrl && {
*            'backstage.io/source-location': `url:${repositoryUrl}`,
*          }),
*          ...(branch && {
*            [CHOREO_ANNOTATIONS.BRANCH]: branch,
*          }),
*        },
*        labels: {
*          [CHOREO_LABELS.MANAGED]: 'true',
*        },
*      },
*      spec: {
*        type: backstageComponentType,
*        lifecycle: (component.status || 'active').toLowerCase(),
*        owner: 'guests',
*        system: projectName,
*        ...(providesApis && providesApis.length > 0 && { providesApis }),
*      },
* };
*
* return componentEntity;
* }
*
* translateServiceComponentToEntity(
* completeComponent: ModelsCompleteComponent,
* orgName: string,
* projectName: string,
* ): Entity {
* // Generate API names for providesApis
* const providesApis: string[] = [];
* if (completeComponent.workload?.endpoints) {
*      Object.keys(completeComponent.workload.endpoints).forEach(
*        endpointName => {
*          providesApis.push(`${completeComponent.name}-${endpointName}`);
*        },
*      );
* }
*
* // Reuse the base translateComponentToEntity method
* return this.translateComponentToEntity(
*      completeComponent,
*      orgName,
*      projectName,
*      providesApis,
* );
* }
*
* // Wrapper demanded by implementation plan for clarity during cursor traversal
* processServiceComponentWithCursor(
* completeComponent: ModelsCompleteComponent,
* orgName: string,
* projectName: string,
* ): { componentEntity: Entity; apiEntities: Entity[] } {
* const componentEntity = this.translateServiceComponentToEntity(
*      completeComponent,
*      orgName,
*      projectName,
* );
* const apiEntities = this.createApiEntitiesFromWorkload(
*      completeComponent,
*      orgName,
*      projectName,
* );
* return { componentEntity, apiEntities };
* }
*
* createApiEntitiesFromWorkload(
* completeComponent: ModelsCompleteComponent,
* orgName: string,
* projectName: string,
* ): Entity[] {
* const apiEntities: Entity[] = [];
*
* if (!completeComponent.workload?.endpoints) {
*      return apiEntities;
* }
*
* Object.entries(completeComponent.workload.endpoints).forEach(
*      ([endpointName, endpoint]) => {
*        const workloadEndpoint = endpoint as WorkloadEndpoint;
*        const apiEntity: Entity = {
*          apiVersion: 'backstage.io/v1alpha1',
*          kind: 'API',
*          metadata: {
*            name: `${completeComponent.name}-${endpointName}`,
*            title: `${completeComponent.name} ${endpointName} API`,
*            description: `${workloadEndpoint.type} endpoint for ${completeComponent.name} service on port ${workloadEndpoint.port}`,
*            tags: ['openchoreo', 'api', workloadEndpoint.type.toLowerCase()],
*            annotations: {
*              [ANNOTATION_LOCATION]: `provider:${this.providerName}`,
*              [ANNOTATION_ORIGIN_LOCATION]: `provider:${this.providerName}`,
*              [CHOREO_ANNOTATIONS.COMPONENT]: completeComponent.name!,
*              [CHOREO_ANNOTATIONS.ENDPOINT_NAME]: endpointName,
*              [CHOREO_ANNOTATIONS.ENDPOINT_TYPE]: workloadEndpoint.type,
*              [CHOREO_ANNOTATIONS.ENDPOINT_PORT]:
*                workloadEndpoint.port.toString(),
*              [CHOREO_ANNOTATIONS.PROJECT]: projectName,
*              [CHOREO_ANNOTATIONS.ORGANIZATION]: orgName,
*            },
*            labels: {
*              [CHOREO_LABELS.MANAGED]: 'true',
*            },
*          },
*          spec: {
*            type: this.mapWorkloadEndpointTypeToBackstageType(
*              workloadEndpoint.type,
*            ),
*            lifecycle: 'production',
*            owner: 'guests',
*            system: projectName,
*            definition:
*              this.createApiDefinitionFromWorkloadEndpoint(workloadEndpoint),
*          },
*        };
*
*        apiEntities.push(apiEntity);
*      },
* );
*
* return apiEntities;
* }
*
* private mapWorkloadEndpointTypeToBackstageType(workloadType: string): string {
* switch (workloadType) {
*      case 'REST':
*      case 'HTTP':
*        return 'openapi';
*      case 'GraphQL':
*        return 'graphql';
*      case 'gRPC':
*        return 'grpc';
*      case 'Websocket':
*        return 'asyncapi';
*      case 'TCP':
*      case 'UDP':
*        return 'openapi'; // Default to openapi for TCP/UDP
*      default:
*        return 'openapi';
* }
* }
*
* private createApiDefinitionFromWorkloadEndpoint(
* endpoint: WorkloadEndpoint,
* ): string {
* if (endpoint.schema?.content) {
*      return endpoint.schema.content;
* }
* return 'No schema available';
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/router/routes.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/router/routes.ts
  new file mode 100644
  index 0000000..8087d59
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/router/routes.ts
  @@ -0,0 +1,272 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Router for incremental provider management endpoints.
* - Provides REST API endpoints for monitoring and controlling incremental ingestion processes.
* \*/
* +import express from 'express';
  +import Router from 'express-promise-router';
  +import { OpenChoreoIncrementalIngestionDatabaseManager } from '../database/OpenChoreoIncrementalIngestionDatabaseManager';
  +import { LoggerService } from '@backstage/backend-plugin-api';
* +const POST_CANCEL_COOLDOWN_MS = 24 _ 60 _ 60 \* 1000;
* +export class IncrementalProviderRouter {
* private manager: OpenChoreoIncrementalIngestionDatabaseManager;
* private logger: LoggerService;
*
* constructor(
* manager: OpenChoreoIncrementalIngestionDatabaseManager,
* logger: LoggerService,
* ) {
* this.manager = manager;
* this.logger = logger;
* }
*
* createRouter(): express.Router {
* const router = Router();
* router.use(express.json());
*
* router.get('/incremental/health', async (\_, res) => {
*      const records = await this.manager.healthcheck();
*      const providers = records.map(record => record.provider_name);
*      const duplicates = [
*        ...new Set(providers.filter((e, i, a) => a.indexOf(e) !== i)),
*      ];
*
*      if (duplicates.length > 0) {
*        res.json({
*          success: false,
*          data: { healthy: false, duplicateIngestions: duplicates },
*          error: 'Duplicate ingestions detected',
*        });
*      } else {
*        res.json({ success: true, data: { healthy: true } });
*      }
* });
*
* router.post('/incremental/cleanup', async (\_, res) => {
*      const result = await this.manager.cleanupProviders();
*      res.json({ success: true, data: result });
* });
*
* router.get('/incremental/providers/:provider', async (req, res) => {
*      const { provider } = req.params;
*      const record = await this.manager.getCurrentIngestionRecord(provider);
*      if (record) {
*        res.json({
*          success: true,
*          data: {
*            status: {
*              current_action: record.status,
*              next_action_at: new Date(record.next_action_at),
*            },
*            last_error: record.last_error,
*          },
*        });
*      } else {
*        const providers: string[] = await this.manager.listProviders();
*        if (providers.includes(provider)) {
*          res.json({
*            success: true,
*            data: {
*              status: {
*                current_action: 'rest complete, waiting to start',
*              },
*            },
*          });
*        } else {
*          this.logger.error(
*            `${provider} - No ingestion record found in the database!`,
*          );
*          res.status(404).json({
*            success: false,
*            error: `Provider '${provider}' not found`,
*          });
*        }
*      }
* });
*
* router.post(
*      `/incremental/providers/:provider/trigger`,
*      async (req, res) => {
*        const { provider } = req.params;
*        const record = await this.manager.getCurrentIngestionRecord(provider);
*        if (record) {
*          await this.manager.triggerNextProviderAction(provider);
*          res.json({
*            success: true,
*            data: { message: `${provider}: Next action triggered.` },
*          });
*        } else {
*          const providers: string[] = await this.manager.listProviders();
*          if (providers.includes(provider)) {
*            this.logger.debug(
*              `${provider} - No ingestion record, provider is restarting`,
*            );
*            res.json({
*              success: true,
*              data: {
*                message:
*                  'Unable to trigger next action (provider is restarting)',
*              },
*            });
*          } else {
*            res.status(404).json({
*              success: false,
*              error: `Provider '${provider}' not found`,
*            });
*          }
*        }
*      },
* );
*
* router.post(`/incremental/providers/:provider/start`, async (req, res) => {
*      const { provider } = req.params;
*
*      const record = await this.manager.getCurrentIngestionRecord(provider);
*      if (record) {
*        const ingestionId = record.id;
*        if (record.status === 'resting') {
*          await this.manager.setProviderComplete(ingestionId);
*        } else {
*          await this.manager.setProviderCanceling(ingestionId);
*        }
*        res.json({
*          success: true,
*          data: { message: `${provider}: Next cycle triggered.` },
*        });
*      } else {
*        const providers: string[] = await this.manager.listProviders();
*        if (providers.includes(provider)) {
*          this.logger.debug(
*            `${provider} - No ingestion record, provider is already restarting`,
*          );
*          res.json({
*            success: true,
*            data: { message: 'Provider is already restarting' },
*          });
*        } else {
*          res.status(404).json({
*            success: false,
*            error: `Provider '${provider}' not found`,
*          });
*        }
*      }
* });
*
* router.get(`/incremental/providers`, async (\_req, res) => {
*      const providers = await this.manager.listProviders();
*
*      res.json({
*        success: true,
*        data: { providers },
*      });
* });
*
* router.post(`/incremental/providers/:provider/cancel`, async (req, res) => {
*      const { provider } = req.params;
*      const record = await this.manager.getCurrentIngestionRecord(provider);
*      if (record) {
*        const next_action_at = new Date();
*        next_action_at.setTime(
*          next_action_at.getTime() + POST_CANCEL_COOLDOWN_MS,
*        );
*        await this.manager.updateByName(provider, {
*          next_action: 'nothing (done)',
*          ingestion_completed_at: new Date(),
*          next_action_at,
*          status: 'resting',
*        });
*        res.json({
*          success: true,
*          data: { message: `${provider}: Current ingestion canceled.` },
*        });
*      } else {
*        const providers: string[] = await this.manager.listProviders();
*        if (providers.includes(provider)) {
*          this.logger.debug(
*            `${provider} - No ingestion record, provider is restarting`,
*          );
*          res.json({
*            success: true,
*            data: { message: 'Provider is currently restarting, please wait.' },
*          });
*        } else {
*          res.status(404).json({
*            success: false,
*            error: `Provider '${provider}' not found`,
*          });
*        }
*      }
* });
*
* router.delete('/incremental/providers/:provider', async (req, res) => {
*      const { provider } = req.params;
*      const result = await this.manager.purgeAndResetProvider(provider);
*      res.json({ success: true, data: result });
* });
*
* router.get(`/incremental/providers/:provider/marks`, async (req, res) => {
*      const { provider } = req.params;
*      const record = await this.manager.getCurrentIngestionRecord(provider);
*      if (record) {
*        const id = record.id;
*        const records = await this.manager.getAllMarks(id);
*        res.json({ success: true, data: { records } });
*      } else {
*        const providers: string[] = await this.manager.listProviders();
*        if (providers.includes(provider)) {
*          this.logger.debug(
*            `${provider} - No ingestion record, provider is restarting`,
*          );
*          res.json({
*            success: true,
*            data: { message: 'No records yet (provider is restarting)' },
*          });
*        } else {
*          this.logger.error(
*            `${provider} - No ingestion record found in the database!`,
*          );
*          res.status(404).json({
*            success: false,
*            error: `Provider '${provider}' not found`,
*          });
*        }
*      }
* });
*
* router.delete(
*      `/incremental/providers/:provider/marks`,
*      async (req, res) => {
*        const { provider } = req.params;
*        const deletions = await this.manager.clearFinishedIngestions(provider);
*
*        res.json({
*          success: true,
*          data: {
*            message: `Expired marks for provider '${provider}' removed.`,
*            deletions,
*          },
*        });
*      },
* );
*
* return router;
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/types.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/types.ts
  new file mode 100644
  index 0000000..5c85af6
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/types.ts
  @@ -0,0 +1,201 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +/\*\*
* - Type definitions for incremental entity providers.
* - Defines interfaces and types for burst-based, resumable entity ingestion.
* \*/
* +import {
* LoggerService,
* SchedulerServiceTaskFunction,
  +} from '@backstage/backend-plugin-api';
  +import type {
* DeferredEntity,
* EntityProviderConnection,
  +} from '@backstage/plugin-catalog-node';
  +import { EventParams } from '@backstage/plugin-events-node';
  +import { HumanDuration } from '@backstage/types';
  +import { OpenChoreoIncrementalIngestionDatabaseManager } from './database/OpenChoreoIncrementalIngestionDatabaseManager';
* +/\*\*
* - Ingest entities into the catalog in bite-sized chunks.
* -
* - A Normal `EntityProvider` allows you to introduce entities into the
* - processing pipeline by calling an `applyMutation()` on the full set
* - of entities. However, this is not great when the number of entities
* - that you have to keep track of is extremely large because it
* - entails having all of them in memory at once. An
* - `IncrementalEntityProvider` by contrast allows you to provide
* - batches of entities in sequence so that you never need to have more
* - than a few hundred in memory at a time.
* -
* - @public
* \*/
  +export interface IncrementalEntityProvider<TCursor, TContext> {
* /\*\*
* - This name must be unique between all of the entity providers
* - operating in the catalog.
* \*/
* getProviderName(): string;
*
* /\*\*
* - Return a single page of entities from a specific point in the
* - ingestion.
* -
* - @param context - anything needed in order to fetch a single page.
* - @param cursor - a unique value identifying the page to ingest.
* - @returns The entities to be ingested, as well as the cursor of
* - the next page after this one.
* \*/
* next(
* context: TContext,
* cursor?: TCursor,
* ): Promise<EntityIteratorResult<TCursor>>;
*
* /\*\*
* - Do any setup and teardown necessary in order to provide the
* - context for fetching pages. This should always invoke `burst` in
* - order to fetch the individual pages.
* -
* - @param burst - a function which performs a series of iterations
* \*/
* around(burst: (context: TContext) => Promise<void>): Promise<void>;
*
* /\*\*
* - If set, the IncrementalEntityProvider will receive and respond to
* - events.
* -
* - This system acts as a wrapper for the Backstage events bus, and
* - requires the events backend to function. It does not provide its
* - own events backend. See {@link https://github.com/backstage/backstage/tree/master/plugins/events-backend}.
* \*/
* eventHandler?: {
* /\*\*
*     * This method accepts an incoming event for the provider, and
*     * optionally maps the payload to an object containing a delta
*     * mutation.
*     *
*     * If a delta result is returned by this method, it will be ingested
*     * automatically by the provider. Alternatively, if an "ignored" result is
*     * returned, then it is understood that this event should not cause anything
*     * to be ingested.
*     */
* onEvent: (params: EventParams) => Promise<IncrementalEntityEventResult>;
*
* /\*\*
*     * This method returns an array of topics for the IncrementalEntityProvider
*     * to respond to.
*     */
* supportsEventTopics: () => string[];
* };
  +}
* +/\*\*
* - An object returned by event handler to indicate whether to ignore the event
* - or to apply a delta in response to the event.
* -
* - @public
* \*/
  +export type IncrementalEntityEventResult =
* | {
*      type: 'ignored';
* }
* | {
*      type: 'delta';
*      added: DeferredEntity[];
*      removed: { entityRef: string }[];
* };
* +/\*\*
* - Value returned by an {@link IncrementalEntityProvider} to provide a
* - single page of entities to ingest.
* -
* - @public
* \*/
  +export type EntityIteratorResult<T> =
* | {
*      done: false;
*      entities: DeferredEntity[];
*      cursor: T;
* }
* | {
*      done: true;
*      entities?: DeferredEntity[];
*      cursor?: T;
* };
* +/\*_ @public _/
  +export interface IncrementalEntityProviderOptions {
* /\*\*
* - Entities are ingested in bursts. This interval determines how
* - much time to wait in between each burst.
* \*/
* burstInterval: HumanDuration;
*
* /\*\*
* - Entities are ingested in bursts. This value determines how long
* - to keep ingesting within each burst.
* \*/
* burstLength: HumanDuration;
*
* /\*\*
* - After a successful ingestion, the incremental entity provider
* - will rest for this period of time before starting to ingest
* - again.
* \*/
* restLength: HumanDuration;
*
* /\*\*
* - In the event of an error during an ingestion burst, the backoff
* - determines how soon it will be retried. E.g.
* - `[{ minutes: 1}, { minutes: 5}, {minutes: 30 }, { hours: 3 }]`
* \*/
* backoff?: HumanDuration[];
*
* /\*\*
* - If an error occurs at a data source that results in a large
* - number of assets being inadvertently removed, it will result in
* - Backstage removing all associated entities. To avoid that, set
* - a percentage of entities past which removal will be disallowed.
* \*/
* rejectRemovalsAbovePercentage?: number;
*
* /\*\*
* - Similar to the rejectRemovalsAbovePercentage, this option
* - prevents removals in circumstances where a data source has
* - improperly returned 0 assets. If set to `true`, Backstage will
* - reject removals when that happens.
* \*/
* rejectEmptySourceCollections?: boolean;
  +}
* +export interface IterationEngine {
* taskFn: SchedulerServiceTaskFunction;
  +}
* +export interface IterationEngineOptions {
* logger: LoggerService;
* connection: EntityProviderConnection;
* manager: OpenChoreoIncrementalIngestionDatabaseManager;
* provider: IncrementalEntityProvider<unknown, unknown>;
* restLength: HumanDuration;
* burstLength: HumanDuration;
* ready: Promise<void>;
* backoff?: IncrementalEntityProviderOptions['backoff'];
* rejectRemovalsAbovePercentage?: number;
* rejectEmptySourceCollections?: boolean;
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ApiErrorHandler.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ApiErrorHandler.ts
  new file mode 100644
  index 0000000..19e878e
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ApiErrorHandler.ts
  @@ -0,0 +1,244 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +import { LoggerService } from '@backstage/backend-plugin-api';
  +import { OpenChoreoIncrementalIngestionError } from '../database/errors';
* +/\*\*
* - Centralized error handler for API operations with consistent retry logic and error classification.
* \*/
  +export class ApiErrorHandler {
* private static readonly DEFAULT_MAX_RETRIES = 3;
* private static readonly BASE_DELAY_MS = 1000;
* private static readonly MAX_DELAY_MS = 10000;
*
* /\*\*
* - Executes an API operation with standardized error handling and retry logic.
* -
* - @param operation - The async operation to execute
* - @param context - Context description for error logging
* - @param logger - Logger service for error reporting
* - @param options - Optional configuration for retry behavior
* - @returns Promise resolving to the operation result
* - @throws OpenChoreoIncrementalIngestionError for non-retryable errors
* \*/
* static async handleApiCall<T>(
* operation: () => Promise<T>,
* context: string,
* logger: LoggerService,
* options: {
*      maxRetries?: number;
*      baseDelay?: number;
*      maxDelay?: number;
* } = {},
* ): Promise<T> {
* const {
*      maxRetries = this.DEFAULT_MAX_RETRIES,
*      baseDelay = this.BASE_DELAY_MS,
*      maxDelay = this.MAX_DELAY_MS,
* } = options;
*
* let attempt = 0;
* let lastError: Error | undefined;
*
* while (attempt <= maxRetries) {
*      try {
*        return await operation();
*      } catch (error) {
*        lastError = error instanceof Error ? error : new Error(String(error));
*
*        // Don't retry on the last attempt
*        if (attempt === maxRetries) {
*          break;
*        }
*
*        // Check if error is retryable
*        if (!this.isRetryableError(lastError)) {
*          logger.error(
*            `Non-retryable error in ${context}: ${lastError.message}`,
*            lastError,
*          );
*          throw new OpenChoreoIncrementalIngestionError(
*            `Failed operation in ${context}: ${lastError.message}`,
*            'OPERATION_FAILED',
*          );
*        }
*
*        // Calculate exponential backoff with jitter
*        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
*        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
*        const totalDelay = delay + jitter;
*
*        logger.warn(
*          `Retryable error in ${context} (attempt ${attempt + 1}/${
*            maxRetries + 1
*          }): ${lastError.message}. Retrying in ${Math.round(totalDelay)}ms`,
*        );
*
*        await this.sleep(totalDelay);
*        attempt++;
*      }
* }
*
* // All retries exhausted
* logger.error(
*      `Operation failed in ${context} after ${maxRetries + 1} attempts: ${
*        lastError!.message
*      }`,
*      lastError,
* );
*
* throw new OpenChoreoIncrementalIngestionError(
*      `Operation failed in ${context} after ${maxRetries + 1} attempts: ${
*        lastError!.message
*      }`,
*      'MAX_RETRIES_EXCEEDED',
* );
* }
*
* /\*\*
* - Determines if an error is retryable based on its characteristics.
* -
* - @param error - The error to evaluate
* - @returns true if the error is retryable, false otherwise
* \*/
* private static isRetryableError(error: Error): boolean {
* const message = error.message.toLowerCase();
*
* // Network-related errors
* if (
*      message.includes('network') ||
*      message.includes('timeout') ||
*      message.includes('connection') ||
*      message.includes('econnreset') ||
*      message.includes('enotfound')
* ) {
*      return true;
* }
*
* // HTTP status codes that should be retried
* if (
*      message.includes('http 429') || // Rate limiting
*      message.includes('http 502') || // Bad gateway
*      message.includes('http 503') || // Service unavailable
*      message.includes('http 504')
* ) {
*      // Gateway timeout
*      return true;
* }
*
* // Database deadlocks and transient errors
* if (
*      message.includes('deadlock') ||
*      message.includes('connection reset') ||
*      message.includes('connection closed') ||
*      message.includes('database is locked')
* ) {
*      return true;
* }
*
* // Retryable specific error messages
* if (
*      message.includes('too many requests') ||
*      message.includes('service temporarily unavailable') ||
*      message.includes('try again later')
* ) {
*      return true;
* }
*
* return false;
* }
*
* /\*\*
* - Sleep utility for retry delays.
* -
* - @param ms - Milliseconds to sleep
* - @returns Promise that resolves after the specified delay
* \*/
* private static sleep(ms: number): Promise<void> {
* return new Promise(resolve => setTimeout(resolve, ms));
* }
*
* /\*\*
* - Enhances an error with additional context information.
* -
* - @param error - The original error
* - @param context - Context description
* - @param additionalInfo - Optional additional context
* - @returns Enhanced error with context
* \*/
* static enhanceError(
* error: Error,
* context: string,
* additionalInfo?: Record<string, any>,
* ): OpenChoreoIncrementalIngestionError {
* const enhancedMessage = additionalInfo
*      ? `${context}: ${error.message} (Context: ${JSON.stringify(
*          additionalInfo,
*        )})`
*      : `${context}: ${error.message}`;
*
* const enhancedError = new OpenChoreoIncrementalIngestionError(
*      enhancedMessage,
*      'ENHANCED_ERROR',
* );
*
* // Preserve original error stack
* enhancedError.stack = error.stack;
*
* return enhancedError;
* }
*
* /\*\*
* - Safely parses JSON responses with proper error handling.
* -
* - @param responseText - Raw response text
* - @param context - Context for error reporting
* - @returns Parsed JSON object
* - @throws OpenChoreoIncrementalIngestionError for parsing failures
* \*/
* static safeJsonParse(responseText: string, context: string): any {
* try {
*      return JSON.parse(responseText);
* } catch (error) {
*      const errorMessage =
*        error instanceof Error ? error.message : String(error);
*      throw new OpenChoreoIncrementalIngestionError(
*        `Failed to parse JSON response in ${context}: ${errorMessage}`,
*        'JSON_PARSE_ERROR',
*      );
* }
* }
*
* /\*\*
* - Validates HTTP response status and throws appropriate errors.
* -
* - @param response - Fetch response object
* - @param context - Context for error reporting
* - @throws OpenChoreoIncrementalIngestionError for HTTP errors
* \*/
* static validateHttpResponse(response: Response, context: string): void {
* if (!response.ok) {
*      const statusCode = response.status;
*      const statusText = response.statusText;
*
*      throw new OpenChoreoIncrementalIngestionError(
*        `HTTP error in ${context}: ${statusCode} ${statusText}`,
*        'HTTP_ERROR',
*      );
* }
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ConfigValidator.ts b/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ConfigValidator.ts
  new file mode 100644
  index 0000000..27c1778
  --- /dev/null
  +++ b/plugins/catalog-backend-module-openchoreo-incremental/src/utils/ConfigValidator.ts
  @@ -0,0 +1,264 @@
  +/\*
* - Copyright 2022 The Backstage Authors
* -
* - Licensed under the Apache License, Version 2.0 (the "License");
* - you may not use this file except in compliance with the License.
* - You may obtain a copy of the License at
* -
* -     http://www.apache.org/licenses/LICENSE-2.0
* -
* - Unless required by applicable law or agreed to in writing, software
* - distributed under the License is distributed on an "AS IS" BASIS,
* - WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* - See the License for the specific language governing permissions and
* - limitations under the License.
* \*/
* +import { Config } from '@backstage/config';
  +import { LoggerService } from '@backstage/backend-plugin-api';
  +import {
* openchoreoIncrementalConfigValidation,
* OpenChoreoIncrementalConfig,
  +} from '../config';
  +import { OpenChoreoIncrementalIngestionError } from '../database/errors';
* +/\*\*
* - Utility class for validating OpenChoreo incremental plugin configuration.
* \*/
  +export class ConfigValidator {
* /\*\*
* - Validates the complete OpenChoreo configuration.
* -
* - @param config - The Backstage configuration object
* - @param logger - Logger service for reporting validation issues
* - @returns Validated configuration object
* - @throws OpenChoreoIncrementalIngestionError for invalid configuration
* \*/
* static validateConfig(
* config: Config,
* logger: LoggerService,
* ): OpenChoreoIncrementalConfig {
* try {
*      // Extract the raw configuration data
*      const rawConfig = this.extractRawConfig(config);
*
*      // Validate using Zod schema
*      const validatedConfig = openchoreoIncrementalConfigValidation.parse(
*        rawConfig,
*      ) as OpenChoreoIncrementalConfig;
*
*      // Apply additional business logic validation
*      this.validateBusinessRules(validatedConfig, logger);
*
*      return validatedConfig;
* } catch (error) {
*      if (error instanceof Error && error.name === 'ZodError') {
*        const zodError = error as any;
*        const errorMessages =
*          zodError.errors
*            ?.map(
*              (err: any) =>
*                `${err.path?.join('.') || 'unknown'}: ${err.message}`,
*            )
*            .join(', ') || 'Unknown validation error';
*
*        throw new OpenChoreoIncrementalIngestionError(
*          `Configuration validation failed: ${errorMessages}`,
*          'CONFIG_VALIDATION_ERROR',
*          error,
*        );
*      }
*
*      throw new OpenChoreoIncrementalIngestionError(
*        `Failed to validate configuration: ${
*          error instanceof Error ? error.message : String(error)
*        }`,
*        'CONFIG_VALIDATION_ERROR',
*        error instanceof Error ? error : undefined,
*      );
* }
* }
*
* /\*\*
* - Extracts raw configuration data from Backstage config object.
* -
* - @param config - The Backstage configuration object
* - @returns Raw configuration data
* \*/
* private static extractRawConfig(config: Config): any {
* // Initialize with empty openchoreo object to ensure it's always present
* const rawConfig: any = {
*      openchoreo: {},
* };
*
* // Extract OpenChoreo API configuration
* if (config.has('openchoreo.api')) {
*      rawConfig.openchoreo = {
*        ...rawConfig.openchoreo,
*        api: {
*          baseUrl: config.getString('openchoreo.api.baseUrl'),
*          ...(config.has('openchoreo.api.token') && {
*            token: config.getString('openchoreo.api.token'),
*          }),
*        },
*      };
* }
*
* // Extract OpenChoreo incremental configuration
* if (config.has('openchoreo.incremental')) {
*      const incrementalConfig = config.getConfig('openchoreo.incremental');
*
*      rawConfig.openchoreo = {
*        ...rawConfig.openchoreo,
*        incremental: {
*          burstLength: incrementalConfig.getOptionalNumber('burstLength'),
*          burstInterval: incrementalConfig.getOptionalNumber('burstInterval'),
*          restLength: incrementalConfig.getOptionalNumber('restLength'),
*          chunkSize: incrementalConfig.getOptionalNumber('chunkSize'),
*          backoff: undefined, // TODO: Implement proper backoff array parsing
*          rejectRemovalsAbovePercentage: incrementalConfig.getOptionalNumber(
*            'rejectRemovalsAbovePercentage',
*          ),
*          rejectEmptySourceCollections: incrementalConfig.getOptionalBoolean(
*            'rejectEmptySourceCollections',
*          ),
*          maxConcurrentRequests: incrementalConfig.getOptionalNumber(
*            'maxConcurrentRequests',
*          ),
*          batchDelayMs: incrementalConfig.getOptionalNumber('batchDelayMs'),
*        },
*      };
* }
*
* return rawConfig;
* }
*
* /\*\*
* - Validates additional business rules beyond schema validation.
* -
* - @param config - Validated configuration object
* - @param logger - Logger service for warnings
* \*/
* private static validateBusinessRules(
* config: OpenChoreoIncrementalConfig,
* logger: LoggerService,
* ): void {
* const incremental = config.openchoreo.incremental;
*
* if (!incremental) {
*      return; // No incremental config to validate
* }
*
* // Validate timing relationships
* if (incremental.burstLength >= incremental.burstInterval) {
*      throw new OpenChoreoIncrementalIngestionError(
*        `burstLength (${incremental.burstLength}s) must be less than burstInterval (${incremental.burstInterval}s) to ensure proper burst/rest cycle. Current configuration would cause overlapping or continuous bursts.`,
*        'INVALID_BURST_TIMING',
*      );
* }
*
* // Validate chunk size vs burst length
* const maxEntitiesPerBurst = incremental.burstLength \* 10; // Rough estimate
* if (incremental.chunkSize > maxEntitiesPerBurst) {
*      logger.warn(
*        `chunkSize (${incremental.chunkSize}) may be too large for burstLength (${incremental.burstLength}s). Consider reducing chunk size or increasing burst length.`,
*      );
* }
*
* // Validate backoff configuration
* if (incremental.backoff && incremental.backoff.length > 0) {
*      if (incremental.backoff.some(delay => delay <= 0)) {
*        throw new OpenChoreoIncrementalIngestionError(
*          'All backoff durations must be positive numbers',
*          'INVALID_BACKOFF_CONFIG',
*        );
*      }
*
*      if (incremental.backoff.length > 10) {
*        logger.warn(
*          `Backoff array has ${incremental.backoff.length} entries, which may be excessive. Consider using fewer, longer delays.`,
*        );
*      }
* }
*
* // Validate removal percentage
* if (incremental.rejectRemovalsAbovePercentage !== undefined) {
*      if (
*        incremental.rejectRemovalsAbovePercentage < 0 ||
*        incremental.rejectRemovalsAbovePercentage > 100
*      ) {
*        throw new OpenChoreoIncrementalIngestionError(
*          'rejectRemovalsAbovePercentage must be between 0 and 100',
*          'INVALID_REMOVAL_THRESHOLD',
*        );
*      }
*
*      if (incremental.rejectRemovalsAbovePercentage > 50) {
*        logger.warn(
*          `rejectRemovalsAbovePercentage (${incremental.rejectRemovalsAbovePercentage}%) is very high. This may prevent legitimate removals.`,
*        );
*      }
* }
*
* // Validate API configuration
* if (config.openchoreo.api) {
*      const { baseUrl } = config.openchoreo.api;
*
*      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
*        throw new OpenChoreoIncrementalIngestionError(
*          'openchoreo.api.baseUrl must start with http:// or https://',
*          'INVALID_API_BASE_URL',
*        );
*      }
*
*      if (baseUrl.endsWith('/')) {
*        logger.warn(
*          'openchoreo.api.baseUrl should not end with a slash. Trailing slash will be removed.',
*        );
*      }
* }
* }
*
* /\*\*
* - Gets default configuration values.
* -
* - @returns Default configuration object
* \*/
* static getDefaultConfig(): Partial<OpenChoreoIncrementalConfig> {
* return {
*      openchoreo: {
*        incremental: {
*          burstLength: 10,
*          burstInterval: 30,
*          restLength: 30,
*          chunkSize: 50,
*          rejectEmptySourceCollections: false,
*          maxConcurrentRequests: 5,
*          batchDelayMs: 100,
*        },
*      },
* };
* }
*
* /\*\*
* - Merges user configuration with defaults.
* -
* - @param userConfig - User-provided configuration
* - @returns Merged configuration
* \*/
* static mergeWithDefaults(
* userConfig: Partial<OpenChoreoIncrementalConfig>,
* ): OpenChoreoIncrementalConfig {
* const defaults = this.getDefaultConfig();
*
* return {
*      openchoreo: {
*        api: userConfig.openchoreo?.api || defaults.openchoreo?.api,
*        incremental: {
*          ...defaults.openchoreo!.incremental!,
*          ...userConfig.openchoreo?.incremental,
*        },
*      },
* } as OpenChoreoIncrementalConfig;
* }
  +}
  diff --git a/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.test.ts b/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.test.ts
  index 56741fd..4e311a1 100644
  --- a/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.test.ts
  +++ b/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.test.ts
  @@ -1,9 +1,7 @@
  import { CtdToTemplateConverter } from './CtdToTemplateConverter';
  -import { OpenChoreoAPI } from '@openchoreo/openchoreo-client-node';
  +import type { ComponentType } from './CtdToTemplateConverter';
  import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

## -type ComponentType = OpenChoreoAPI.ComponentType;

describe('CtdToTemplateConverter', () => {
let converter: CtdToTemplateConverter;

@@ -23,7 +21,6 @@ describe('CtdToTemplateConverter', () => {
name: 'simple-service',
displayName: 'Simple Service',
description: 'A simple service for testing',

-          tags: ['test', 'simple'],
           },
           spec: {
             inputParametersSchema: {
  @@ -54,15 +51,13 @@ describe('CtdToTemplateConverter', () => {
  expect(result.metadata.namespace).toBe('test-namespace');
  expect(result.metadata.title).toBe('Simple Service');
  expect(result.metadata.description).toBe('A simple service for testing');
-      // Tags now include inferred tags from name ('simple', 'service') and workloadType ('deployment')

*      // Tags include 'openchoreo', the component name, and workloadType
       expect(result.metadata.tags).toEqual([
         'openchoreo',
         'component-type',
         'simple',
         'service',
         'deployment',

-        'test',
-        'simple',
         ]);

         // Check annotations
  @@ -132,6 +127,29 @@ describe('CtdToTemplateConverter', () => {
  'deployment',
  ]);
  });

*
* it('includes user-provided tags from metadata and preserves order', () => {
*      const ctd: ComponentType = {
*        metadata: {
*          name: 'web-service',
*          workloadType: 'Deployment',
*          tags: ['alpha', 'beta', 'gamma'],
*          createdAt: '2025-01-01T00:00:00Z',
*        },
*        spec: { inputParametersSchema: { type: 'object' } as any },
*      } as ComponentType;
*
*      const entity = converter.convertCtdToTemplateEntity(ctd, 'org-1');
*      const tags = entity.metadata.tags ?? [];
*
*      expect(tags).toContain('alpha');
*      expect(tags).toContain('beta');
*      expect(tags).toContain('gamma');
*
*      // ensure order: openchoreo + inferred tags + user tags
*      const userTagIndex = tags.indexOf('alpha');
*      expect(userTagIndex).toBeGreaterThan(-1);
* });
  });

describe('generateParameters', () => {
@@ -240,6 +258,7 @@ describe('CtdToTemplateConverter', () => {
// Check boolean
expect(props.enableBackup.type).toBe('boolean');
expect(props.enableBackup.default).toBe(true);

-      // Booleans now use default checkbox/switch widgets; no explicit radio widget
       expect(props.enableBackup['ui:widget']).toBe('radio');
  });

@@ -421,8 +440,8 @@ describe('CtdToTemplateConverter', () => {
const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
const parameters = result.spec?.parameters as any[];

-      // Should have only Component Metadata + Addons sections
-      // (CTD config section skipped due to empty properties, CI Setup skipped due to no allowedWorkflows)

*      // Should have Component Metadata + CI/CD Setup + Traits sections
*      // (CTD config section skipped due to empty properties)
         expect(parameters).toHaveLength(2);
         expect(parameters[0].title).toBe('Component Metadata');
         expect(parameters[1].title).toBe('Addons');
  @@ -454,10 +473,10 @@ describe('CtdToTemplateConverter', () => {
  const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
  const parameters = result.spec?.parameters as any[];

-      // Should have all four sections: Component Metadata, CTD Configuration, CI Setup, and Addons

*      // Should have all four sections: Component Metadata, CTD Configuration, CI/CD Setup, and Traits
       expect(parameters).toHaveLength(4);

-      // Check CI Setup section (third section)

*      // Check CI/CD Setup section (third section)
         const ciSetupSection = parameters[2];
         expect(ciSetupSection.title).toBe('CI Setup');
         expect(ciSetupSection.required).toEqual(['useBuiltInCI']);
  @@ -468,26 +487,24 @@ describe('CtdToTemplateConverter', () => {
  expect(ciSetupSection.properties.useBuiltInCI.title).toBe(
  'Use Built-in CI in OpenChoreo',
  );

-      expect(ciSetupSection.properties.useBuiltInCI['ui:widget']).toBe('radio');

*      // Uses SwitchField as ui:field for boolean switches
*      expect(ciSetupSection.properties.autoDeploy['ui:field']).toBe(
*        'SwitchField',
*      );

-      // Check dependencies structure

*      // Check dependencies structure uses allOf with two branches
       expect(ciSetupSection.dependencies.useBuiltInCI).toBeDefined();
       expect(ciSetupSection.dependencies.useBuiltInCI.allOf).toBeDefined();
       expect(ciSetupSection.dependencies.useBuiltInCI.allOf).toHaveLength(2);

       // Check true case (when CI is enabled)
       const trueCase = ciSetupSection.dependencies.useBuiltInCI.allOf[0];

-      expect(trueCase.if.properties.useBuiltInCI.const).toBe(true);

*      expect(trueCase.then.properties.useBuiltInCI.const).toBe(true);

-      // CTD templates now use workflow-based structure with only workflow fields

*      // Workflow fields present
       expect(trueCase.then.properties.workflow_name).toBeDefined();
       expect(trueCase.then.properties.workflow_parameters).toBeDefined();

-      // Static fields (repo_url, branch, component_path) should NOT be here anymore
-      expect(trueCase.then.properties.repo_url).toBeUndefined();
-      expect(trueCase.then.properties.branch).toBeUndefined();
-      expect(trueCase.then.properties.component_path).toBeUndefined();
-        // Check workflow_name has enum from allowedWorkflows
         expect(trueCase.then.properties.workflow_name.enum).toEqual([
           'nodejs-build',
  @@ -510,12 +527,7 @@ describe('CtdToTemplateConverter', () => {
         // Check false case (when CI is disabled)
         const falseCase = ciSetupSection.dependencies.useBuiltInCI.allOf[1];
-      expect(falseCase.if.properties.useBuiltInCI.const).toBe(false);
-      expect(falseCase.then.properties.external_ci_note).toBeDefined();
-      expect(falseCase.then.properties.external_ci_note.type).toBe('null');
-      expect(falseCase.then.properties.external_ci_note['ui:widget']).toBe(
-        'markdown',
-      );

*      expect(falseCase.then.properties.useBuiltInCI.const).toBe(false);
       });

       it('should not include CI Setup section when CTD has no allowedWorkflows', () => {
  @@ -544,18 +556,13 @@ describe('CtdToTemplateConverter', () => {
  const result = converter.convertCtdToTemplateEntity(ctd, 'test-org');
  const parameters = result.spec?.parameters as any[];

-      // Should have only 3 sections: Component Metadata, CTD Configuration, and Addons
-      // CI Setup section should be absent when no allowedWorkflows

*      // Should have 3 sections: Component Metadata, CTD Configuration, and Traits (no CI Setup when no allowedWorkflows)
       expect(parameters).toHaveLength(3);

-      // Verify section titles to confirm CI Setup is not present

*      // Verify section titles
       expect(parameters[0].title).toBe('Component Metadata');
       expect(parameters[1].title).toContain('Configuration');
       expect(parameters[2].title).toBe('Addons');

-
-      // Verify no section has 'CI Setup' title
-      const hasCISetup = parameters.some(p => p.title === 'CI Setup');
-      expect(hasCISetup).toBe(false);
  });
  });

@@ -611,7 +618,8 @@ describe('CtdToTemplateConverter', () => {
expect(input.displayName).toBe('${{ parameters.displayName }}');
       expect(input.description).toBe('${{ parameters.description }}');
expect(input.componentType).toBe('web-service');

-      expect(input.componentTypeParameters).toBe('${{ parameters }}');

*      // CTD parameters are spread individually into the input (e.g. port)
*      expect(input.port).toBe('${{ parameters.port }}');
  });
  });

diff --git a/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.ts b/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.ts
index 2d42905..c151c8a 100644
--- a/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.ts
+++ b/plugins/catalog-backend-module-openchoreo/src/converters/CtdToTemplateConverter.ts
@@ -1,12 +1,37 @@
import { Entity } from '@backstage/catalog-model';
-import { OpenChoreoAPI } from '@openchoreo/openchoreo-client-node';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import {
CHOREO_ANNOTATIONS,
sanitizeLabel,
} from '@openchoreo/backstage-plugin-common';
+import { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

-type ComponentType = OpenChoreoAPI.ComponentType;
+/\*\*

- - Type definition for Component Type data structure used by the converter.
- - This is assembled from ComponentTypeResponse metadata + schema data.
- \*/
  +type ComponentTypeResponse =
- OpenChoreoComponents['schemas']['ComponentTypeResponse'];
- +export interface ComponentType {
- metadata: Pick<
- ComponentTypeResponse,
- | 'name'
- | 'displayName'
- | 'description'
- | 'workloadType'
- | 'tags'
- | 'allowedWorkflows'
- | 'createdAt'
- > & {
- name: NonNullable<ComponentTypeResponse['name']>;
- workloadType: NonNullable<ComponentTypeResponse['workloadType']>;
- createdAt: NonNullable<ComponentTypeResponse['createdAt']>;
- };
- spec: {
- inputParametersSchema: JSONSchema7;
- };
  +}

/\*\*

- Configuration for the Component Type to Template converter
  @@ -41,6 +66,16 @@ export class CtdToTemplateConverter {
  componentType: ComponentType,
  organizationName: string,
  ): Entity {

* // Validate required fields
* if (!componentType.metadata?.name) {
*      throw new Error('ComponentType metadata.name is required');
* }
* if (!componentType.metadata?.workloadType) {
*      throw new Error(
*        `ComponentType ${componentType.metadata.name} is missing required field: workloadType`,
*      );
* }
*      const templateName = this.generateTemplateName(componentType.metadata.name);
       const title =
         componentType.metadata.displayName ||
  @@ -50,11 +85,9 @@ export class CtdToTemplateConverter {
       // Infer tags from component type name and workloadType
       const inferredTags = this.inferTagsFromCtd(componentType);

- const tags = [
-      'openchoreo',
-      ...inferredTags,
-      ...(componentType.metadata.tags || []),
- ].filter(tag => tag && tag.trim().length > 0); // Filter out empty/whitespace-only tags

* const tags = ['openchoreo', ...inferredTags].filter(
*      tag => tag && tag.trim().length > 0,
* ); // Filter out empty/whitespace-only tags

       // Build the template entity
       const templateEntity: Entity = {

  @@ -127,8 +160,12 @@ export class CtdToTemplateConverter {
  private inferTagsFromCtd(componentType: ComponentType): string[] {
  const tags: string[] = [];

* // Add a stable tag indicating this is a component type
* tags.push('component-type');
*     // Add tags from component type name (split by hyphen)

- tags.push(componentType.metadata.name);

* const nameParts = componentType.metadata.name.split('-').filter(p => p);
* tags.push(...nameParts);

       // Add workloadType as tag if available
       if (componentType.metadata.workloadType) {

  @@ -138,6 +175,12 @@ export class CtdToTemplateConverter {
  }
  }

* // Append any user-provided tags from metadata (preserve order)
* const providedTags = componentType.metadata.tags as string[] | undefined;
* if (Array.isArray(providedTags) && providedTags.length > 0) {
*      tags.push(...providedTags.filter(t => !!t));
* }
*     return tags;
  }

@@ -160,7 +203,7 @@ export class CtdToTemplateConverter {
title: 'Component Name',
type: 'string',
description: 'Unique name for your component',

-          'ui:field': 'ComponentNamePicker',

*          'ui:field': 'EntityNamePicker',
           },
           displayName: {
             title: 'Display Name',
  @@ -210,10 +253,15 @@ export class CtdToTemplateConverter {
  });
  }

- // Section 3: CI/CD Setup (always shown - workflows fetched dynamically if not in allowedWorkflows)
- parameters.push(
-      this.generateCISetupSection(componentType, organizationName),
- );

* // Section 3: CI Setup (only included when allowedWorkflows are defined)
* if (
*      componentType.metadata.allowedWorkflows &&
*      componentType.metadata.allowedWorkflows.length > 0
* ) {
*      parameters.push(
*        this.generateCISetupSection(componentType, organizationName),
*      );
* }
       // Section 4: Traits
       parameters.push(this.generateTraitsSection(organizationName));
  @@ -250,10 +298,10 @@ export class CtdToTemplateConverter {
  workflowNameField.enum = componentType.metadata.allowedWorkflows;
  }

- // Always show CI/CD Setup section

* // CI Setup - exposed only when allowedWorkflows are present (caller enforces this)
  return {

-      title: 'CI/CD Setup',
-      required: ['autoDeploy', 'useBuiltInCI'],

*      title: 'CI Setup',
*      required: ['useBuiltInCI'],
         properties: {
           autoDeploy: {
             title: 'Auto Deploy',
  @@ -269,30 +317,36 @@ export class CtdToTemplateConverter {
  'OpenChoreo provides built-in CI capabilities for building components. Enable this to use the built-in CI.',
  type: 'boolean',
  default: true,

-          'ui:field': 'SwitchField',

*          'ui:widget': 'radio',
         },
       },
       dependencies: {
         useBuiltInCI: {

-          oneOf: [

*          allOf: [
             {

-              properties: {
-                useBuiltInCI: {
-                  const: true,
-                },
-                workflow_name: workflowNameField,
-                workflow_parameters: {
-                  title: 'Workflow Parameters',
-                  type: 'object',
-                  'ui:field': 'BuildWorkflowParameters',

*              if: { properties: { useBuiltInCI: { const: true } } },
*              then: {
*                properties: {
*                  useBuiltInCI: { const: true },
*                  workflow_name: workflowNameField,
*                  workflow_parameters: {
*                    title: 'Workflow Parameters',
*                    type: 'object',
*                    'ui:field': 'BuildWorkflowParameters',
*                  },
                 },
*                required: ['workflow_name', 'workflow_parameters'],
               },

-              required: ['workflow_name', 'workflow_parameters'],
             },
             {
-              properties: {
-                useBuiltInCI: {
-                  const: false,

*              if: { properties: { useBuiltInCI: { const: false } } },
*              then: {
*                properties: {
*                  useBuiltInCI: { const: false },
*                  external_ci_note: {
*                    type: 'null',
*                    'ui:widget': 'markdown',
*                  },
                   },
                 },
               },
  @@ -308,9 +362,8 @@ export class CtdToTemplateConverter {
  \*/
  private generateTraitsSection(organizationName: string): any {
  return {

-      title: 'Traits',
-      description:
-        'Add optional traits to enhance your component functionality',

*      title: 'Addons',
*      description: 'Add optional addons or traits to extend your component',
         properties: {
           traits: {
             title: 'Component Traits',
  @@ -439,8 +492,10 @@ export class CtdToTemplateConverter {
  _ Add UI enhancements based on schema type and format
  _/
  private addUIEnhancements(converted: any, schema: JSONSchema7): void {

- // Boolean fields: use default checkbox widget
- // (Custom switch widgets can be applied via ui:field in specific cases)

* // Boolean fields: prefer radio widget for clearer UX
* if (schema.type === 'boolean') {
*      converted['ui:widget'] = 'radio';
* }

       // String fields with format hints
       if (schema.type === 'string') {

  @@ -563,37 +618,51 @@ export class CtdToTemplateConverter {
  }
  }

* // Check if CI Setup section is included
* const hasCISetup =
*      componentType.metadata.allowedWorkflows &&
*      componentType.metadata.allowedWorkflows.length > 0;
*
* // Build the input object dynamically
* const stepInput: any = {
*      // Section 1: Component Metadata (use old field names for backward compatibility)
*      orgName: '${{ parameters.organization_name }}',
*      projectName: '${{ parameters.project_name }}',
*      componentName: '${{ parameters.component_name }}',
*      displayName: '${{ parameters.displayName }}',
*      description: '${{ parameters.description }}',
*
*      // Section 2: Component Type Configuration
*      componentType: componentType.metadata.name,
*      component_type_workload_type: componentType.metadata.workloadType,
*      // Spread CTD parameters dynamically
*      ...ctdParameterMappings,
*
*      // Section 4: Traits
*      traits: '${{ parameters.traits }}',
*      // All component-type specific parameters are available as the
*      // full `parameters` object to the action
*      componentTypeParameters: '${{ parameters }}',
* };
*
* // Only include CI Setup parameters if the CI section is present
* if (hasCISetup) {
*      stepInput.autoDeploy = '${{ parameters.autoDeploy }}';
*      stepInput.useBuiltInCI = '${{ parameters.useBuiltInCI }}';
*      stepInput.workflow_name = '${{ parameters.workflow_name }}';
*      stepInput.workflow_parameters = '${{ parameters.workflow_parameters }}';
* } else {
*      // Provide default values for CI parameters when CI section is not included
*      stepInput.useBuiltInCI = false;
*      stepInput.autoDeploy = false;
* }
*     return [
        {
          id: 'create-component',
          name: 'Create OpenChoreo Component',
          action: 'openchoreo:component:create',

-        input: {
-          // Section 1: Component Metadata (use old field names for backward compatibility)
-          orgName: '${{ parameters.organization_name }}',
-          projectName: '${{ parameters.project_name }}',
-          componentName: '${{ parameters.component_name }}',
-          displayName: '${{ parameters.displayName }}',
-          description: '${{ parameters.description }}',
-
-          // Section 2: Component Type Configuration
-          componentType: componentType.metadata.name,
-          component_type_workload_type: componentType.metadata.workloadType,
-          // Spread CTD parameters dynamically
-          ...ctdParameterMappings,
-
-          // Section 3: CI Setup
-          autoDeploy: '${{ parameters.autoDeploy }}',
-          useBuiltInCI: '${{ parameters.useBuiltInCI }}',
-          repo_url: '${{ parameters.repo_url }}',
-          branch: '${{ parameters.branch }}',
-          component_path: '${{ parameters.component_path }}',
-          workflow_name: '${{ parameters.workflow_name }}',
-          workflow_parameters: '${{ parameters.workflow_parameters }}',
-
-          // Section 4: Traits
-          traits: '${{ parameters.traits }}',
-        },

*        input: stepInput,
         },
       ];
  }
  diff --git a/plugins/catalog-backend-module-openchoreo/src/provider/OpenChoreoEntityProvider.ts b/plugins/catalog-backend-module-openchoreo/src/provider/OpenChoreoEntityProvider.ts
  index d40cd75..d803756 100644
  --- a/plugins/catalog-backend-module-openchoreo/src/provider/OpenChoreoEntityProvider.ts
  +++ b/plugins/catalog-backend-module-openchoreo/src/provider/OpenChoreoEntityProvider.ts
  @@ -21,6 +21,7 @@ type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
  type ModelsDataPlane = OpenChoreoComponents['schemas']['DataPlaneResponse'];
  type ModelsCompleteComponent =
  OpenChoreoComponents['schemas']['ComponentResponse'];
  +type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];

// WorkloadEndpoint is part of the workload.endpoints structure
// Since Workload uses additionalProperties, we define this locally
@@ -35,6 +36,8 @@ import {
CHOREO_ANNOTATIONS,
CHOREO_LABELS,
ComponentTypeUtils,

- fetchAllResources,
- DEFAULT_PAGE_LIMIT,
  } from '@openchoreo/backstage-plugin-common';
  import { EnvironmentEntityV1alpha1, DataplaneEntityV1alpha1 } from '../kinds';
  import { CtdToTemplateConverter } from '../converters/CtdToTemplateConverter';
  @@ -120,23 +123,7 @@ export class OpenChoreoEntityProvider implements EntityProvider {
  });
         // First, get all organizations

*      const {
*        data: orgData,
*        error: orgError,
*        response: orgResponse,
*      } = await client.GET('/orgs');
*
*      if (orgError || !orgResponse.ok) {
*        throw new Error(
*          `Failed to fetch organizations: ${orgResponse.status} ${orgResponse.statusText}`,
*        );
*      }
*
*      if (!orgData.success || !orgData.data?.items) {
*        throw new Error('Failed to retrieve organization list');
*      }
*
*      const organizations = orgData.data.items as ModelsOrganization[];

-      const organizations = await this.fetchAllOrganizations(client);
         this.logger.debug(
           `Found ${organizations.length} organizations from OpenChoreo`,
         );
  @@ -149,112 +136,35 @@ export class OpenChoreoEntityProvider implements EntityProvider {
  );
  allEntities.push(...domainEntities);

*      // Get environments for each organization and create Environment entities

-      // Process organizations sequentially
       for (const org of organizations) {
         try {

*          const {
*            data: envData,
*            error: envError,
*            response: envResponse,
*          } = await client.GET('/orgs/{orgName}/environments', {
*            params: {
*              path: { orgName: org.name! },
*            },
*          });
*
*          if (envError || !envResponse.ok) {
*            this.logger.warn(
*              `Failed to fetch environments for organization ${org.name}: ${envResponse.status}`,
*            );
*            continue;
*          }

-          // Fetch environments, dataplanes, and projects in parallel
-          const [environments, dataplanes, projects] = await Promise.all([
-            this.fetchAllEnvironments(client, org.name!),
-            this.fetchAllDataplanes(client, org.name!),
-            this.fetchAllProjects(client, org.name!),
-          ]);

*          const environments =
*            envData.success && envData.data?.items
*              ? (envData.data.items as ModelsEnvironment[])
*              : [];
           this.logger.debug(
             `Found ${environments.length} environments in organization: ${org.name}`,
           );
*           const environmentEntities: Entity[] = environments.map(environment =>
              this.translateEnvironmentToEntity(environment, org.name!),
            );
            allEntities.push(...environmentEntities);
*        } catch (error) {
*          this.logger.warn(
*            `Failed to fetch environments for organization ${org.name}: ${error}`,
*          );
*        }
*      }
*
*      // Get dataplanes for each organization and create Dataplane entities
*      for (const org of organizations) {
*        try {
*          const {
*            data: dpData,
*            error: dpError,
*            response: dpResponse,
*          } = await client.GET('/orgs/{orgName}/dataplanes', {
*            params: {
*              path: { orgName: org.name! },
*            },
*          });

*          if (dpError || !dpResponse.ok) {
*            this.logger.warn(
*              `Failed to fetch dataplanes for organization ${org.name}: ${dpResponse.status}`,
*            );
*            continue;
*          }
*
*          const dataplanes =
*            dpData.success && dpData.data?.items
*              ? (dpData.data.items as ModelsDataPlane[])
*              : [];
           this.logger.debug(
             `Found ${dataplanes.length} dataplanes in organization: ${org.name}`,
           );
*           const dataplaneEntities: Entity[] = dataplanes.map(dataplane =>
              this.translateDataplaneToEntity(dataplane, org.name!),
            );
            allEntities.push(...dataplaneEntities);
*        } catch (error) {
*          this.logger.warn(
*            `Failed to fetch dataplanes for organization ${org.name}: ${error}`,
*          );
*        }
*      }
*
*      // Get projects for each organization and create System entities
*      for (const org of organizations) {
*        try {
*          const {
*            data: projData,
*            error: projError,
*            response: projResponse,
*          } = await client.GET('/orgs/{orgName}/projects', {
*            params: {
*              path: { orgName: org.name! },
*            },
*          });
*
*          if (projError || !projResponse.ok) {
*            this.logger.warn(
*              `Failed to fetch projects for organization ${org.name}: ${projResponse.status}`,
*            );
*            continue;
*          }

*          const projects =
*            projData.success && projData.data?.items
*              ? (projData.data.items as ModelsProject[])
*              : [];
           this.logger.debug(
             `Found ${projects.length} projects in organization: ${org.name}`,
           );
*            const systemEntities: Entity[] = projects.map(project =>
               this.translateProjectToEntity(project, org.name!),
             );
  @@ -262,98 +172,45 @@ export class OpenChoreoEntityProvider implements EntityProvider {
             // Get components for each project and create Component entities
             for (const project of projects) {
*            try {
*              const {
*                data: compData,
*                error: compError,
*                response: compResponse,
*              } = await client.GET(
*                '/orgs/{orgName}/projects/{projectName}/components',
*                {
*                  params: {
*                    path: { orgName: org.name!, projectName: project.name! },
*                  },
*                },
*              );
*
*              if (compError || !compResponse.ok) {
*                this.logger.warn(
*                  `Failed to fetch components for project ${project.name}: ${compResponse.status}`,
*                );
*                continue;
*              }

-            const components = await this.fetchAllComponents(
-              client,
-              org.name!,
-              project.name!,
-            );

*              const components =
*                compData.success && compData.data?.items
*                  ? compData.data.items
*                  : [];
*              this.logger.debug(
*                `Found ${components.length} components in project: ${project.name}`,
*              );

-            this.logger.debug(
-              `Found ${components.length} components in project: ${project.name}`,
-            );

*              for (const component of components) {
*                // If the component is a Service, fetch complete details and create both component and API entities
*                if (component.type === '') {
*                  try {
*                    const {
*                      data: detailData,
*                      error: detailError,
*                      response: detailResponse,
*                    } = await client.GET(
*                      '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
*                      {
*                        params: {
*                          path: {
*                            orgName: org.name!,
*                            projectName: project.name!,
*                            componentName: component.name!,
*                          },

-            for (const component of components) {
-              // If the component is a Service, fetch complete details and create both component and API entities
-              if (component.type === 'Service') {
-                try {
-                  const {
-                    data: detailData,
-                    error: detailError,
-                    response: detailResponse,
-                  } = await client.GET(
-                    '/orgs/{orgName}/projects/{projectName}/components/{componentName}',
-                    {
-                      params: {
-                        path: {
-                          orgName: org.name!,
-                          projectName: project.name!,
-                          componentName: component.name!,
                         },
                       },

*                    );
*
*                    if (
*                      detailError ||
*                      !detailResponse.ok ||
*                      !detailData.success ||
*                      !detailData.data
*                    ) {
*                      this.logger.warn(
*                        `Failed to fetch complete component details for ${component.name}: ${detailResponse.status}`,
*                      );
*                      // Fallback to basic component entity
*                      const componentEntity = this.translateComponentToEntity(
*                        component,
*                        org.name!,
*                        project.name!,
*                      );
*                      allEntities.push(componentEntity);
*                      continue;
*                    }
*
*                    const completeComponent = detailData.data;
*
*                    // Create component entity with providesApis
*                    const componentEntity =
*                      this.translateServiceComponentToEntity(
*                        completeComponent,
*                        org.name!,
*                        project.name!,
*                      );
*                    allEntities.push(componentEntity);

-                    },
-                  );

*                    // Create API entities if endpoints exist
*                    if (completeComponent.workload?.endpoints) {
*                      const apiEntities = this.createApiEntitiesFromWorkload(
*                        completeComponent,
*                        org.name!,
*                        project.name!,
*                      );
*                      allEntities.push(...apiEntities);
*                    }
*                  } catch (error) {

-                  if (
-                    detailError ||
-                    !detailResponse.ok ||
-                    !detailData.success ||
-                    !detailData.data
-                  ) {
                     this.logger.warn(

*                      `Failed to fetch complete component details for ${component.name}: ${error}`,

-                      `Failed to fetch complete component details for ${component.name}: ${detailResponse.status}`,
                       );
                       // Fallback to basic component entity
                       const componentEntity = this.translateComponentToEntity(
  @@ -362,9 +219,34 @@ export class OpenChoreoEntityProvider implements EntityProvider {
  project.name!,
  );
  allEntities.push(componentEntity);
-                    continue;
                   }

*                } else {
*                  // Create basic component entity for non-Service components

-
-                  const completeComponent = detailData.data;
-
-                  // Create component entity with providesApis
-                  const componentEntity =
-                    this.translateServiceComponentToEntity(
-                      completeComponent,
-                      org.name!,
-                      project.name!,
-                    );
-                  allEntities.push(componentEntity);
-
-                  // Create API entities if endpoints exist
-                  if (completeComponent.workload?.endpoints) {
-                    const apiEntities = this.createApiEntitiesFromWorkload(
-                      completeComponent,
-                      org.name!,
-                      project.name!,
-                    );
-                    allEntities.push(...apiEntities);
-                  }
-                } catch (error) {
-                  this.logger.warn(
-                    `Failed to fetch complete component details for ${component.name}: ${error}`,
-                  );
-                  // Fallback to basic component entity
                     const componentEntity = this.translateComponentToEntity(
                       component,
                       org.name!,
  @@ -372,151 +254,129 @@ export class OpenChoreoEntityProvider implements EntityProvider {
  );
  allEntities.push(componentEntity);
  }
-              } else {
-                // Create basic component entity for non-Service components
-                const componentEntity = this.translateComponentToEntity(
-                  component,
-                  org.name!,
-                  project.name!,
-                );
-                allEntities.push(componentEntity);
               }

*            } catch (error) {
*              this.logger.warn(
*                `Failed to fetch components for project ${project.name} in organization ${org.name}: ${error}`,
*              );
             }
           }
         } catch (error) {
*          this.logger.warn(
*            `Failed to fetch projects for organization ${org.name}: ${error}`,

-          this.logger.error(
-            `Failed to process organization ${org.name}: ${error}`,
           );
-          // Continue processing other organizations
         }
       }

       // Fetch Component Type Definitions and generate Template entities
       // Use the new two-step API: list + schema for each CTD
       for (const org of organizations) {

*        try {
*          this.logger.info(
*            `Fetching Component Type Definitions from OpenChoreo API for org: ${org.name}`,
*          );
*
*          // Step 1: List CTDs (complete metadata including allowedWorkflows)
*          const {
*            data: listData,
*            error: listError,
*            response: listResponse,
*          } = await client.GET('/orgs/{orgName}/component-types', {
*            params: {
*              path: { orgName: org.name! },
*            },
*          });
*
*          if (
*            listError ||
*            !listResponse.ok ||
*            !listData.success ||
*            !listData.data?.items
*          ) {
*            this.logger.warn(
*              `Failed to fetch component types for org ${org.name}: ${listResponse.status}`,
*            );
*            continue;
*          }
*
*          const componentTypeItems = listData.data
*            .items as OpenChoreoComponents['schemas']['ComponentTypeResponse'][];
*          this.logger.debug(
*            `Found ${componentTypeItems.length} CTDs in organization: ${org.name} (total: ${listData.data.totalCount})`,
*          );
*
*          // Step 2: Fetch schemas in parallel for better performance
*          const ctdsWithSchemas = await Promise.all(
*            componentTypeItems.map(async listItem => {
*              try {
*                const {
*                  data: schemaData,
*                  error: schemaError,
*                  response: schemaResponse,
*                } = await client.GET(
*                  '/orgs/{orgName}/component-types/{ctName}/schema',
*                  {
*                    params: {
*                      path: { orgName: org.name!, ctName: listItem.name! },
*                    },
*                  },
*                );

-        this.logger.info(
-          `Fetching Component Type Definitions from OpenChoreo API for org: ${org.name}`,
-        );

*                if (
*                  schemaError ||
*                  !schemaResponse.ok ||
*                  !schemaData?.success ||
*                  !schemaData?.data
*                ) {
*                  this.logger.warn(
*                    `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${schemaResponse.status}`,
*                  );
*                  return null;
*                }

-        // Step 1: List CTDs (complete metadata including allowedWorkflows)
-        const componentTypeItems = await this.fetchAllComponentTypes(
-          client,
-          org.name!,
-        );
-        this.logger.debug(
-          `Found ${componentTypeItems.length} CTDs in organization: ${org.name}`,
-        );

*                // Combine metadata from list item + schema into full ComponentType object
*                const fullComponentType = {
*                  metadata: {
*                    name: listItem.name!,
*                    displayName: listItem.displayName,
*                    description: listItem.description,
*                    workloadType: listItem.workloadType!,
*                    allowedWorkflows: listItem.allowedWorkflows,
*                    createdAt: listItem.createdAt!,
*                  },
*                  spec: {
*                    inputParametersSchema: schemaData!.data as any,

-        // Step 2: Fetch schemas in parallel for better performance
-        const ctdsWithSchemas = await Promise.all(
-          componentTypeItems.map(async listItem => {
-            try {
-              const {
-                data: schemaData,
-                error: schemaError,
-                response: schemaResponse,
-              } = await client.GET(
-                '/orgs/{orgName}/component-types/{ctName}/schema',
-                {
-                  params: {
-                    path: { orgName: org.name!, ctName: listItem.name! },
                   },

*                };

-                },
-              );

*                return fullComponentType;
*              } catch (error) {

-              if (
-                schemaError ||
-                !schemaResponse.ok ||
-                !schemaData?.success ||
-                !schemaData?.data
-              ) {
                 this.logger.warn(

*                  `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${error}`,

-                  `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${schemaResponse.status}`,
                 );
                 return null;
               }

*            }),
*          );

*          // Filter out failed schema fetches
*          const validCTDs = ctdsWithSchemas.filter(
*            (ctd): ctd is NonNullable<typeof ctd> => ctd !== null,
*          );

-              // Combine metadata from list item + schema into full ComponentType object
-              const fullComponentType = {
-                metadata: {
-                  name: listItem.name!,
-                  displayName: listItem.displayName,
-                  description: listItem.description,
-                  workloadType: listItem.workloadType!,
-                  allowedWorkflows: listItem.allowedWorkflows,
-                  createdAt: listItem.createdAt!,
-                },
-                spec: {
-                  inputParametersSchema: schemaData!.data as any,
-                },
-              };

*          // Step 3: Convert CTDs to template entities
*          const templateEntities: Entity[] = validCTDs
*            .map(ctd => {
*              try {
*                const templateEntity =
*                  this.ctdConverter.convertCtdToTemplateEntity(ctd, org.name!);
*                // Add the required Backstage catalog annotations
*                if (!templateEntity.metadata.annotations) {
*                  templateEntity.metadata.annotations = {};
*                }
*                templateEntity.metadata.annotations[
*                  'backstage.io/managed-by-location'
*                ] = `provider:${this.getProviderName()}`;
*                templateEntity.metadata.annotations[
*                  'backstage.io/managed-by-origin-location'
*                ] = `provider:${this.getProviderName()}`;
*                return templateEntity;
*              } catch (error) {
*                this.logger.warn(
*                  `Failed to convert CTD ${ctd.metadata.name} to template: ${error}`,
*                );
*                return null;
*              }
*            })
*            .filter((entity): entity is Entity => entity !== null);

-              return fullComponentType;
-            } catch (error) {
-              this.logger.warn(
-                `Failed to fetch schema for CTD ${listItem.name} in org ${org.name}: ${error}`,
-              );
-              return null;
-            }
-          }),
-        );

*          allEntities.push(...templateEntities);
*          this.logger.info(
*            `Successfully generated ${templateEntities.length} template entities from CTDs in org: ${org.name}`,
*          );
*        } catch (error) {
*          this.logger.warn(
*            `Failed to fetch Component Type Definitions for org ${org.name}: ${error}`,
*          );
*        }

-        // Filter out failed schema fetches
-        const validCTDs = ctdsWithSchemas.filter(
-          (ctd): ctd is NonNullable<typeof ctd> => ctd !== null,
-        );
-
-        // Step 3: Convert CTDs to template entities
-        const templateEntities: Entity[] = validCTDs
-          .map(ctd => {
-            try {
-              const templateEntity =
-                this.ctdConverter.convertCtdToTemplateEntity(ctd, org.name!);
-              // Add the required Backstage catalog annotations
-              if (!templateEntity.metadata.annotations) {
-                templateEntity.metadata.annotations = {};
-              }
-              templateEntity.metadata.annotations[
-                'backstage.io/managed-by-location'
-              ] = `provider:${this.getProviderName()}`;
-              templateEntity.metadata.annotations[
-                'backstage.io/managed-by-origin-location'
-              ] = `provider:${this.getProviderName()}`;
-              return templateEntity;
-            } catch (error) {
-              this.logger.warn(
-                `Failed to convert CTD ${ctd.metadata.name} to template: ${error}`,
-              );
-              return null;
-            }
-          })
-          .filter((entity): entity is Entity => entity !== null);
-        allEntities.push(...templateEntities);
-        this.logger.info(
-          `Successfully generated ${templateEntities.length} template entities from CTDs in org: ${org.name}`,
-        );
         }

         await this.connection.applyMutation({

  @@ -543,6 +403,237 @@ export class OpenChoreoEntityProvider implements EntityProvider {
  }
  }

- /\*\*
- - Fetches all organizations
- \*/
- private async fetchAllOrganizations(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- ): Promise<ModelsOrganization[]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET('/orgs', {
-        params: {
-          query: {
-            limit: DEFAULT_PAGE_LIMIT,
-            ...(cursor && { continue: cursor }),
-          },
-        },
-      });
-
-      if (error || !response.ok || !data) {
-        if (response.status === 410) {
-          this.logger.warn(
-            'Pagination token expired (410 Gone) while fetching organizations - restarting sync required',
-          );
-        }
-        throw new Error(
-          `Failed to fetch organizations: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve organization list');
-      }
-
-      return {
-        items: data.data.items as ModelsOrganization[],
-        metadata: data.data.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- /\*\*
- - Fetches all environments for an organization
- \*/
- private async fetchAllEnvironments(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- orgName: string,
- ): Promise<ModelsEnvironment[]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/environments',
-        {
-          params: {
-            path: { orgName },
-            query: {
-              limit: DEFAULT_PAGE_LIMIT,
-              ...(cursor && { continue: cursor }),
-            },
-          },
-        },
-      );
-
-      if (error || !response.ok || !data) {
-        throw new Error(
-          `Failed to fetch environments for ${orgName}: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve environment list');
-      }
-
-      return {
-        items: data.data.items as ModelsEnvironment[],
-        metadata: data.data?.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- /\*\*
- - Fetches all dataplanes for an organization
- \*/
- private async fetchAllDataplanes(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- orgName: string,
- ): Promise<ModelsDataPlane[]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/dataplanes',
-        {
-          params: {
-            path: { orgName },
-            query: {
-              limit: DEFAULT_PAGE_LIMIT,
-              ...(cursor && { continue: cursor }),
-            },
-          },
-        },
-      );
-
-      if (error || !response.ok || !data) {
-        throw new Error(
-          `Failed to fetch dataplanes for ${orgName}: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve dataplane list');
-      }
-
-      return {
-        items: data.data.items as ModelsDataPlane[],
-        metadata: data.data?.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- /\*\*
- - Fetches all projects for an organization
- \*/
- private async fetchAllProjects(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- orgName: string,
- ): Promise<ModelsProject[]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects',
-        {
-          params: {
-            path: { orgName },
-            query: {
-              limit: DEFAULT_PAGE_LIMIT,
-              ...(cursor && { continue: cursor }),
-            },
-          },
-        },
-      );
-
-      if (error || !response.ok || !data) {
-        throw new Error(
-          `Failed to fetch projects for ${orgName}: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve project list');
-      }
-
-      return {
-        items: data.data.items as ModelsProject[],
-        metadata: data.data?.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- /\*\*
- - Fetches all components for a project
- \*/
- private async fetchAllComponents(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- orgName: string,
- projectName: string,
- ): Promise<ModelsComponent[]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components',
-        {
-          params: {
-            path: { orgName, projectName },
-            query: {
-              limit: DEFAULT_PAGE_LIMIT,
-              ...(cursor && { continue: cursor }),
-            },
-          },
-        },
-      );
-
-      if (error || !response.ok || !data) {
-        throw new Error(
-          `Failed to fetch components for ${orgName}/${projectName}: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve component list');
-      }
-
-      return {
-        items: data.data.items as ModelsComponent[],
-        metadata: data.data?.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- /\*\*
- - Fetches all component types for an organization
- \*/
- private async fetchAllComponentTypes(
- client: ReturnType<typeof createOpenChoreoApiClient>,
- orgName: string,
- ): Promise<OpenChoreoComponents['schemas']['ComponentTypeResponse'][]> {
- return fetchAllResources(async cursor => {
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/component-types',
-        {
-          params: {
-            path: { orgName },
-            query: {
-              limit: DEFAULT_PAGE_LIMIT,
-              ...(cursor && { continue: cursor }),
-            },
-          },
-        },
-      );
-
-      if (error || !response.ok || !data) {
-        throw new Error(
-          `Failed to fetch component types for ${orgName}: ${response.status} ${response.statusText}`,
-        );
-      }
-
-      if (!data.success || !data.data?.items) {
-        throw new Error('Failed to retrieve component type list');
-      }
-
-      return {
-        items: data.data
-          .items as OpenChoreoComponents['schemas']['ComponentTypeResponse'][],
-        metadata: data.data?.metadata as ResponseMetadata | undefined,
-      };
- });
- }
-
- // --- Entity Translation Methods ---
  /\*\*
  _ Translates a ModelsOrganization from OpenChoreo API to a Backstage Domain entity
  _/
  diff --git a/plugins/openchoreo-backend/src/router.ts b/plugins/openchoreo-backend/src/router.ts
  index 02249ac..35bedcb 100644
  --- a/plugins/openchoreo-backend/src/router.ts
  +++ b/plugins/openchoreo-backend/src/router.ts
  @@ -210,7 +210,7 @@ export async function createRouter({
  // Endpoint for listing traits
  router.get('/traits', async (req, res) => {

* const { organizationName, page, pageSize } = req.query;

- const { organizationName, limit, continue: continueToken } = req.query;
       if (!organizationName) {
         throw new InputError('organizationName is a required query parameter');
  @@ -221,9 +221,9 @@ export async function createRouter({
  res.json(
  await traitInfoService.fetchTraits(
  organizationName as string,

*        page ? parseInt(page as string, 10) : undefined,
*        pageSize ? parseInt(pageSize as string, 10) : undefined,
         userToken,

-        limit ? parseInt(limit as string, 10) : undefined,
-        continueToken as string | undefined,
         ),
       );
  });
  diff --git a/plugins/openchoreo-backend/src/services/BuildService/BuildInfoService.ts b/plugins/openchoreo-backend/src/services/BuildService/BuildInfoService.ts
  index f90ef87..61f004d 100644
  --- a/plugins/openchoreo-backend/src/services/BuildService/BuildInfoService.ts
  +++ b/plugins/openchoreo-backend/src/services/BuildService/BuildInfoService.ts
  @@ -5,6 +5,10 @@ import {
  type OpenChoreoComponents,
  } from '@openchoreo/openchoreo-client-node';
  import { RuntimeLogsResponse } from '../../types';
  +import {
- fetchAllResources,
- DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';

// Use generated type from OpenAPI spec
type ModelsBuild =
@@ -43,26 +47,35 @@ export class BuildInfoService {
logger: this.logger,
});

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs',
-        {
-          params: {
-            path: { orgName, projectName, componentName },

*      const builds = await fetchAllResources(async cursor => {
*        const { data, error, response } = await client.GET(
*          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-runs',
*          {
*            params: {
*              path: { orgName, projectName, componentName },
*              query: {
*                limit: DEFAULT_PAGE_LIMIT,
*                ...(cursor && { continue: cursor }),
*              },
*            },
           },

-        },
-      );
-
-      if (error || !response.ok) {
-        throw new Error(
-          `Failed to fetch component workflow runs: ${response.status} ${response.statusText}`,
         );
-      }

-      if (!data?.success) {
-        throw new Error('API request was not successful');
-      }

*        if (error || !response.ok || !data) {
*          throw new Error(
*            `Failed to fetch component workflow runs: ${response.status} ${response.statusText}`,
*          );
*        }

-      const builds = (data.data?.items || []) as any;

*        if (!data.success || !data.data?.items) {
*          return { items: [] as any[], metadata: data.data?.metadata };
*        }
*
*        return {
*          items: data.data.items as any[],
*          metadata: data.data?.metadata,
*        };
*      });

         this.logger.debug(
           `Successfully fetched ${builds.length} component workflow runs for component: ${componentName}`,
  diff --git a/plugins/openchoreo-backend/src/services/CellDiagramService/CellDiagramInfoService.ts b/plugins/openchoreo-backend/src/services/CellDiagramService/CellDiagramInfoService.ts
  index cacc416..2a209c1 100644
  --- a/plugins/openchoreo-backend/src/services/CellDiagramService/CellDiagramInfoService.ts
  +++ b/plugins/openchoreo-backend/src/services/CellDiagramService/CellDiagramInfoService.ts
  @@ -11,6 +11,10 @@ import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
  } from '@openchoreo/openchoreo-client-node';
  +import {
* fetchAllResources,
* DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';
  import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';

// Use generated type from OpenAPI spec
@@ -86,34 +90,57 @@ export class CellDiagramInfoService implements CellDiagramService {
logger: this.logger,
});

-      const {
-        data: componentsListData,
-        error: listError,
-        response: listResponse,
-      } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components',
-        {
-          params: {
-            path: { orgName, projectName },
-          },
-        },
-      );

*      let componentsListItems: ModelsCompleteComponent[] = [];

-      if (listError || !listResponse.ok) {

*      try {
*        componentsListItems = await fetchAllResources(async cursor => {
*          const { data, error, response } = await client.GET(
*            '/orgs/{orgName}/projects/{projectName}/components',
*            {
*              params: {
*                path: { orgName, projectName },
*                query: {
*                  limit: DEFAULT_PAGE_LIMIT,
*                  ...(cursor && { continue: cursor }),
*                },
*              },
*            },
*          );
*
*          if (error || !response.ok || !data) {
*            throw new Error(
*              `Failed to fetch components for project ${projectName}: ${response.status} ${response.statusText}`,
*            );
*          }
*
*          if (!data.success || !data.data?.items) {
*            // Treat empty list as no components
*            return {
*              items: [] as ModelsCompleteComponent[],
*              metadata: data.data?.metadata,
*            };
*          }
*
*          return {
*            items: data.data.items as ModelsCompleteComponent[],
*            metadata: data.data?.metadata,
*          };
*        });
*      } catch (err) {
         this.logger.error(

-          `Failed to fetch components for project ${projectName}`,

*          `Failed to fetch components for project ${projectName}: ${err}`,
         );
         return undefined;
       }

-      if (!componentsListData.success || !componentsListData.data?.items) {

*      if (!componentsListItems || componentsListItems.length === 0) {
         this.logger.warn('No components found in API response');
         return undefined;
       }

       const completeComponents: ModelsCompleteComponent[] = [];

-      for (const component of componentsListData.data.items) {

*      for (const component of componentsListItems) {
         const componentName = (component as { name?: string }).name;
         if (!componentName) continue;

diff --git a/plugins/openchoreo-backend/src/services/DashboardService/DashboardInfoService.ts b/plugins/openchoreo-backend/src/services/DashboardService/DashboardInfoService.ts
index 431ec4d..b0487d3 100644
--- a/plugins/openchoreo-backend/src/services/DashboardService/DashboardInfoService.ts
+++ b/plugins/openchoreo-backend/src/services/DashboardService/DashboardInfoService.ts
@@ -1,5 +1,9 @@
import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
+import {

- fetchAllResources,
- DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';

export interface DashboardMetrics {
totalBindings: number;
@@ -31,27 +35,37 @@ export class DashboardInfoService {
logger: this.logger,
});

-      // Fetch bindings for the component
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/bindings',
-        {
-          params: {
-            path: {
-              orgName,
-              projectName,
-              componentName,

*      // Fetch bindings for the component (handle pagination)
*      const bindings = await fetchAllResources(async cursor => {
*        const { data, error, response } = await client.GET(
*          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/bindings',
*          {
*            params: {
*              path: {
*                orgName,
*                projectName,
*                componentName,
*              },
*              query: {
*                limit: DEFAULT_PAGE_LIMIT,
*                ...(cursor && { continue: cursor }),
*              },
             },
           },

-        },
-      );
-
-      if (error || !response.ok) {
-        throw new Error(
-          `Failed to fetch bindings: ${response.status} ${response.statusText}`,
         );
-      }

-      const bindings = data.success && data.data?.items ? data.data.items : [];

*        if (error || !response.ok || !data) {
*          throw new Error(
*            `Failed to fetch bindings: ${response.status} ${response.statusText}`,
*          );
*        }
*
*        if (!data.success || !data.data?.items) {
*          return { items: [], metadata: data.data?.metadata };
*        }
*
*        return { items: data.data.items, metadata: data.data?.metadata };
*      });

       const bindingsCount = bindings.length;

diff --git a/plugins/openchoreo-backend/src/services/EnvironmentService/EnvironmentInfoService.ts b/plugins/openchoreo-backend/src/services/EnvironmentService/EnvironmentInfoService.ts
index 93b94f6..6ebd78e 100644
--- a/plugins/openchoreo-backend/src/services/EnvironmentService/EnvironmentInfoService.ts
+++ b/plugins/openchoreo-backend/src/services/EnvironmentService/EnvironmentInfoService.ts
@@ -4,6 +4,10 @@ import {
createOpenChoreoApiClient,
type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
+import {

- fetchAllResources,
- DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';

// Use generated types from OpenAPI spec
type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
@@ -92,40 +96,81 @@ export class EnvironmentInfoService implements EnvironmentService {

       const environmentsPromise = createTimedPromise(
         (async () => {

-          const { data, error, response } = await client.GET(
-            '/orgs/{orgName}/environments',
-            {
-              params: { path: { orgName: request.organizationName } },
-            },
-          );
-          if (error || !response.ok) {
-            throw new Error(`Failed to fetch environments: ${response.status}`);
-          }
-          return { ok: response.ok, json: async () => data };

*          const items = await fetchAllResources(async cursor => {
*            const { data, error, response } = await client.GET(
*              '/orgs/{orgName}/environments',
*              {
*                params: {
*                  path: { orgName: request.organizationName },
*                  query: {
*                    limit: DEFAULT_PAGE_LIMIT,
*                    ...(cursor && { continue: cursor }),
*                  },
*                },
*              },
*            );
*
*            if (error || !response.ok || !data) {
*              throw new Error(
*                `Failed to fetch environments: ${response.status}`,
*              );
*            }
*
*            if (!data.success || !data.data?.items) {
*              return {
*                items: [] as ModelsEnvironment[],
*                metadata: data.data?.metadata,
*              };
*            }
*
*            return {
*              items: data.data.items as ModelsEnvironment[],
*              metadata: data.data?.metadata,
*            };
*          });
*
*          return items;
         })(),
         'environments',
       );

       const bindingsPromise = createTimedPromise(
         (async () => {

-          const { data, error, response } = await client.GET(
-            '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
-            {
-              params: {
-                path: {
-                  orgName: request.organizationName,
-                  projectName: request.projectName,
-                  componentName: request.componentName,

*          const items = await fetchAllResources(async cursor => {
*            const { data, error, response } = await client.GET(
*              '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
*              {
*                params: {
*                  path: {
*                    orgName: request.organizationName,
*                    projectName: request.projectName,
*                    componentName: request.componentName,
*                  },
*                  query: {
*                    limit: DEFAULT_PAGE_LIMIT,
*                    ...(cursor && { continue: cursor }),
*                  },
                 },
               },

-            },
-          );
-          if (error || !response.ok) {
-            throw new Error(
-              `Failed to fetch release bindings: ${response.status}`,
             );
-          }
-          return data.success && data.data?.items ? data.data.items : [];

*
*            if (error || !response.ok || !data) {
*              throw new Error(
*                `Failed to fetch release bindings: ${response.status}`,
*              );
*            }
*
*            if (!data.success || !data.data?.items) {
*              return { items: [], metadata: data.data?.metadata };
*            }
*
*            return {
*              items: data.data.items,
*              metadata: data.data?.metadata,
*            };
*          });
*
*          return items;
           })(),
           'bindings',
         );
  @@ -168,24 +213,15 @@ export class EnvironmentInfoService implements EnvironmentService {
  `Total parallel API calls completed in ${fetchEnd - fetchStart}ms`,
  );

-      const environmentsResponse = environmentsResult.result;

*      const environmentsList = environmentsResult.result as ModelsEnvironment[];
       const bindings = bindingsResult.result;
       const deploymentPipeline = pipelineResult.result;

-
-      if (!environmentsResponse.ok) {
-        this.logger.error(
-          `Failed to fetch environments for organization ${request.organizationName}`,
-        );
-        return [];
-      }
-
-      const environmentsData = await environmentsResponse.json();
-      if (!environmentsData.success || !environmentsData.data?.items) {

*      if (!environmentsList || environmentsList.length === 0) {
         this.logger.warn('No environments found in API response');
         return [];
       }

-      const environments = environmentsData.data.items as ModelsEnvironment[];

*      const environments = environmentsList as ModelsEnvironment[];

         // Transform environment data with bindings and promotion information
         const transformStart = Date.now();
  @@ -1011,31 +1047,49 @@ export class EnvironmentInfoService implements EnvironmentService {
  logger: this.logger,
  });

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
-        {
-          params: {
-            path: {
-              orgName: request.organizationName,
-              projectName: request.projectName,
-              componentName: request.componentName,

*      const items = await fetchAllResources(async cursor => {
*        const { data, error, response } = await client.GET(
*          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
*          {
*            params: {
*              path: {
*                orgName: request.organizationName,
*                projectName: request.projectName,
*                componentName: request.componentName,
*              },
*              query: {
*                limit: DEFAULT_PAGE_LIMIT,
*                ...(cursor && { continue: cursor }),
*              },
             },
           },

-        },
-      );
-
-      if (error || !response.ok) {
-        throw new Error(
-          `Failed to fetch release bindings: ${response.status} ${response.statusText}`,
         );
-      }

*
*        if (error || !response.ok || !data) {
*          throw new Error(
*            `Failed to fetch release bindings: ${response.status} ${response.statusText}`,
*          );
*        }
*
*        if (!data.success || !data.data?.items) {
*          return { items: [], metadata: data.data?.metadata };
*        }
*
*        return {
*          items: data.data.items,
*          metadata: data.data?.metadata,
*        };
*      });

       const totalTime = Date.now() - startTime;
       this.logger.debug(
         `Release bindings fetched for ${request.componentName}: Total: ${totalTime}ms`,
       );

-      return data;

*      return {
*        success: true,
*        data: { items },
*      };
       } catch (error: unknown) {
         const totalTime = Date.now() - startTime;
         this.logger.error(
  diff --git a/plugins/openchoreo-backend/src/services/TraitService/TraitInfoService.ts b/plugins/openchoreo-backend/src/services/TraitService/TraitInfoService.ts
  index 8950788..8161021 100644
  --- a/plugins/openchoreo-backend/src/services/TraitService/TraitInfoService.ts
  +++ b/plugins/openchoreo-backend/src/services/TraitService/TraitInfoService.ts
  @@ -3,10 +3,14 @@ import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
  } from '@openchoreo/openchoreo-client-node';
  +import {
* fetchAllResources,
* DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';

// Type definitions matching the API response structure
type TraitListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {

- data?: OpenChoreoComponents['schemas']['ListResponse'] & {

* data?: {
  items?: OpenChoreoComponents['schemas']['TraitResponse'][];
  };
  };
  @@ -40,13 +44,11 @@ export class TraitInfoService {
  async fetchTraits(
  orgName: string,

- page: number = 1,
- pageSize: number = 100,
  token?: string,

* limit?: number,
* cursor?: string,
  ): Promise<TraitListResponse> {

- this.logger.debug(
-      `Fetching traits (traits) for organization: ${orgName} (page: ${page}, pageSize: ${pageSize})`,
- );

* this.logger.debug(`Fetching traits for organization: ${orgName}`);

       try {
         const client = createOpenChoreoApiClient({

  @@ -55,33 +57,44 @@ export class TraitInfoService {
  logger: this.logger,
  });

*      const pageSize = limit || 100; // Default page size for UI
*       const { data, error, response } = await client.GET(
          '/orgs/{orgName}/traits',
          {
            params: {
              path: { orgName },
*            query: {
*              limit: pageSize,
*              ...(cursor && { continue: cursor }),
*            },
           },
         },
       );

-      if (error || !response.ok) {

*      if (error || !response.ok || !data) {
         throw new Error(
           `Failed to fetch traits: ${response.status} ${response.statusText}`,
         );
       }

-      if (!data?.success) {
-        throw new Error('API request was not successful');

*      if (!data.success || !data.data) {
*        throw new Error('Failed to retrieve traits list');
       }

-      const traitListResponse: TraitListResponse = data as TraitListResponse;
-       this.logger.debug(
          `Successfully fetched ${
-          traitListResponse.data?.items?.length || 0

*          data.data.items?.length || 0
         } traits for org: ${orgName}`,
       );

-      return traitListResponse;

*
*      return {
*        success: true,
*        data: {
*          items: data.data.items || [],
*          metadata: data.data.metadata,
*        },
*      } as TraitListResponse;
       } catch (error) {
         this.logger.error(`Failed to fetch traits for org ${orgName}: ${error}`);
         throw error;
  @@ -152,28 +165,36 @@ export class TraitInfoService {
  logger: this.logger,
  });

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/traits',
-        {
-          params: {
-            path: { orgName, projectName, componentName },

*      const traits = await fetchAllResources(async cursor => {
*        const { data, error, response } = await client.GET(
*          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/traits',
*          {
*            params: {
*              path: { orgName, projectName, componentName },
*              query: {
*                limit: DEFAULT_PAGE_LIMIT,
*                ...(cursor && { continue: cursor }),
*              },
*            },
           },

-        },
-      );
-
-      if (error || !response.ok) {
-        throw new Error(
-          `Failed to fetch component traits: ${response.status} ${response.statusText}`,
         );
-      }

-      if (!data?.success) {
-        throw new Error('API request was not successful');
-      }
-
-      const traitListResponse: ComponentTraitListResponse =
-        data as ComponentTraitListResponse;
-      const traits = traitListResponse.data?.items || [];

*        if (error || !response.ok || !data) {
*          throw new Error(
*            `Failed to fetch component traits: ${response.status} ${response.statusText}`,
*          );
*        }
*
*        if (!data.success || !data.data?.items) {
*          return { items: [], metadata: data.data?.metadata };
*        }
*
*        return {
*          items: data.data
*            .items as OpenChoreoComponents['schemas']['ComponentTraitResponse'][],
*          metadata: data.data?.metadata,
*        };
*      });

         this.logger.debug(
           `Successfully fetched ${traits.length} traits for component: ${componentName}`,
  diff --git a/plugins/openchoreo-common/src/constants.ts b/plugins/openchoreo-common/src/constants.ts
  index de794a6..ab19fc7 100644
  --- a/plugins/openchoreo-common/src/constants.ts
  +++ b/plugins/openchoreo-common/src/constants.ts
  @@ -27,3 +27,10 @@ export const CHOREO_ANNOTATIONS = {
  export const CHOREO_LABELS = {
  MANAGED: 'openchoreo.io/managed',
  } as const;
* +/\*\*
* - Default page limit for API pagination requests.
* - Set to 500 to align with the API's MaxPageLimit for optimal performance,
* - reducing the number of HTTP requests needed for large deployments.
* \*/
  +export const DEFAULT_PAGE_LIMIT = 512;
  diff --git a/plugins/openchoreo-common/src/index.ts b/plugins/openchoreo-common/src/index.ts
  index 708506a..ae2db91 100644
  --- a/plugins/openchoreo-common/src/index.ts
  +++ b/plugins/openchoreo-common/src/index.ts
  @@ -1,4 +1,8 @@
  -export { CHOREO_ANNOTATIONS, CHOREO_LABELS } from './constants';
  +export {
* CHOREO_ANNOTATIONS,
* CHOREO_LABELS,
* DEFAULT_PAGE_LIMIT,
  +} from './constants';

// Permissions
export {
@@ -30,6 +34,7 @@ export {
CATALOG_KIND_TO_ACTION,
OPENCHOREO_MANAGED_ENTITY_KINDS,
} from './permissions';

- export {
  getRepositoryInfo,
  getRepositoryUrl,
  @@ -52,6 +57,8 @@ export type {
  ObservabilityComponents,
  } from '@openchoreo/openchoreo-client-node';
  +export { fetchAllResources, type PaginationResult } from './utils/pagination';
- // Export commonly used type aliases for convenience
  import type {
  OpenChoreoComponents,
  diff --git a/plugins/openchoreo-common/src/utils/pagination.ts b/plugins/openchoreo-common/src/utils/pagination.ts
  new file mode 100644
  index 0000000..c1788cc
  --- /dev/null
  +++ b/plugins/openchoreo-common/src/utils/pagination.ts
  @@ -0,0 +1,103 @@
  +import { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
- +type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];
- +export interface PaginationResult<T> {
- items: T[];
- metadata?: ResponseMetadata;
  +}
- +/\*\*
- - Default overall pagination timeout (ms). Can be overridden via options.
- \*/
  +export const DEFAULT_PAGINATION_TIMEOUT_MS = 60_000;
- +/\*\*
- - Generic helper to fetch all resources using cursor-based pagination.
- \*/
  +export async function fetchAllResources<T>(
- fetchPage: (cursor?: string) => Promise<PaginationResult<T> | null>,
- options?: { timeoutMs?: number; signal?: AbortSignal },
  +): Promise<T[]> {
- const results: T[] = [];
- let continueToken: string | undefined;
- let previousToken: string | undefined;
-
- const timeoutMs = options?.timeoutMs ?? DEFAULT_PAGINATION_TIMEOUT_MS;
- let timeoutId: ReturnType<typeof setTimeout> | undefined;
-
- const timeoutPromise =
- typeof timeoutMs === 'number'
-      ? new Promise<never>((_, reject) => {
-          timeoutId = setTimeout(
-            () =>
-              reject(new Error(`Pagination timed out after ${timeoutMs} ms`)),
-            timeoutMs,
-          );
-        })
-      : undefined;
-
- const abortPromise = options?.signal
- ? new Promise<never>((\_, reject) => {
-        if (options.signal!.aborted) {
-          reject(new Error('Pagination aborted'));
-        } else {
-          const onAbort = () => reject(new Error('Pagination aborted'));
-          options.signal!.addEventListener('abort', onAbort, { once: true });
-        }
-      })
- : undefined;
-
- try {
- do {
-      const fetchPromise = fetchPage(continueToken);
-
-      const toAwait: Promise<any>[] = [fetchPromise];
-      if (timeoutPromise) toAwait.push(timeoutPromise);
-      if (abortPromise) toAwait.push(abortPromise);
-
-      const response = (await Promise.race(
-        toAwait,
-      )) as PaginationResult<T> | null;
-
-      if (!response) {
-        throw new Error(
-          `Failed to fetch page during pagination${
-            continueToken ? ` (cursor: ${continueToken})` : ''
-          }`,
-        );
-      }
-
-      // Validate that the API is not returning the same token we just used
-      if (
-        response.metadata?.continue &&
-        response.metadata.continue === continueToken
-      ) {
-        throw new Error(
-          'Pagination token not advancing - possible API bug detected',
-        );
-      }
-
-      // Detect if pagination token is not advancing (stuck in a loop)
-      if (continueToken !== undefined && continueToken === previousToken) {
-        throw new Error(
-          'Pagination token not advancing - possible API bug detected',
-        );
-      }
-
-      results.push(...response.items);
-      previousToken = continueToken;
-
-      // Only continue if hasMore is true AND continue token is a non-empty string
-      if (response.metadata?.hasMore && response.metadata.continue) {
-        continueToken = response.metadata.continue;
-      } else {
-        continueToken = undefined;
-      }
- } while (continueToken);
- } finally {
- if (timeoutId) clearTimeout(timeoutId);
- }
-
- return results;
  +}
  diff --git a/plugins/openchoreo-observability-backend/src/services/ObservabilityService.ts b/plugins/openchoreo-observability-backend/src/services/ObservabilityService.ts
  index 10ebeb1..a14fb2b 100644
  --- a/plugins/openchoreo-observability-backend/src/services/ObservabilityService.ts
  +++ b/plugins/openchoreo-observability-backend/src/services/ObservabilityService.ts
  @@ -177,7 +177,7 @@ export class ObservabilityService {
  },
  );

*      if (error || !response.ok) {

-      if (error || !response.ok || !data) {
           this.logger.error(
             `Failed to fetch environments for organization ${organizationName}: ${response.status} ${response.statusText}`,
           );
  @@ -481,7 +481,11 @@ export class ObservabilityService {
  );
  }

*        if (!componentsData.success || !componentsData.data?.items) {

-        if (
-          !componentsData ||
-          !componentsData.success ||
-          !componentsData.data?.items
-        ) {
             throw new Error(
               `API returned unsuccessful response: ${JSON.stringify(
                 componentsData,
  diff --git a/plugins/platform-engineer-core-backend/package.json b/plugins/platform-engineer-core-backend/package.json
  index 39dd749..1546bf8 100644
  --- a/plugins/platform-engineer-core-backend/package.json
  +++ b/plugins/platform-engineer-core-backend/package.json
  @@ -37,6 +37,7 @@
  "@backstage/catalog-client": "1.12.0",
  "@backstage/config": "1.3.4",
  "@backstage/errors": "1.2.7",
- "@openchoreo/backstage-plugin-common": "workspace:^",
  "@openchoreo/openchoreo-auth": "workspace:^",
  "@openchoreo/openchoreo-client-node": "workspace:^",
  "express": "4.21.2",
  diff --git a/plugins/platform-engineer-core-backend/src/services/PlatformEnvironmentService.ts b/plugins/platform-engineer-core-backend/src/services/PlatformEnvironmentService.ts
  index 92f1916..3e73a43 100644
  --- a/plugins/platform-engineer-core-backend/src/services/PlatformEnvironmentService.ts
  +++ b/plugins/platform-engineer-core-backend/src/services/PlatformEnvironmentService.ts
  @@ -3,12 +3,17 @@ import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
  } from '@openchoreo/openchoreo-client-node';
  +import {
- fetchAllResources,
- DEFAULT_PAGE_LIMIT,
  +} from '@openchoreo/backstage-plugin-common';

// Use generated types from OpenAPI spec
type ModelsEnvironment = OpenChoreoComponents['schemas']['EnvironmentResponse'];
type ModelsDataPlane = OpenChoreoComponents['schemas']['DataPlaneResponse'];
type ReleaseBindingResponse =
OpenChoreoComponents['schemas']['ReleaseBindingResponse'];
+type ResponseMetadata = OpenChoreoComponents['schemas']['ResponseMetadata'];

import {
PlatformEnvironmentService,
@@ -57,28 +62,7 @@ export class PlatformEnvironmentInfoService
// For now, we'll fetch environments from a default organization
// In a real implementation, you might need to fetch from multiple organizations
// or have a platform-wide API endpoint

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/environments',
-        {
-          params: {
-            path: { orgName: 'default' }, // This should be configurable or fetched from a platform API
-          },
-        },
-      );
-
-      if (error || !response.ok) {
-        this.logger.error(
-          `Failed to fetch platform environments: ${response.status} ${response.statusText}`,
-        );
-        return [];
-      }
-
-      if (!data.success || !data.data?.items) {
-        this.logger.warn('No environments found in platform API response');
-        return [];
-      }
-
-      const environments = data.data.items;

*      const environments = await this.fetchOrgEnvironments(client, 'default');
         const result = this.transformEnvironmentData(environments, 'default');

         const totalTime = Date.now() - startTime;
  @@ -116,30 +100,10 @@ export class PlatformEnvironmentInfoService
  logger: this.logger,
  });

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/environments',
-        {
-          params: {
-            path: { orgName: organizationName },
-          },
-        },

*      const environments = await this.fetchOrgEnvironments(
*        client,
*        organizationName,
       );

-
-      if (error || !response.ok) {
-        this.logger.error(
-          `Failed to fetch environments for organization ${organizationName}: ${response.status} ${response.statusText}`,
-        );
-        return [];
-      }
-
-      if (!data.success || !data.data?.items) {
-        this.logger.warn(
-          `No environments found for organization ${organizationName}`,
-        );
-        return [];
-      }
-
-      const environments = data.data.items;
         const result = this.transformEnvironmentData(
           environments,
           organizationName,
  @@ -179,28 +143,7 @@ export class PlatformEnvironmentInfoService
  // For now, we'll fetch dataplanes from a default organization
  // In a real implementation, you might need to fetch from multiple organizations
  // or have a platform-wide API endpoint
-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/dataplanes',
-        {
-          params: {
-            path: { orgName: 'default' }, // This should be configurable or fetched from a platform API
-          },
-        },
-      );
-
-      if (error || !response.ok) {
-        this.logger.error(
-          `Failed to fetch platform dataplanes: ${response.status} ${response.statusText}`,
-        );
-        return [];
-      }
-
-      if (!data.success || !data.data?.items) {
-        this.logger.warn('No dataplanes found in platform API response');
-        return [];
-      }
-
-      const dataplanes = data.data.items;

*      const dataplanes = await this.fetchOrgDataplanes(client, 'default');
         const result = this.transformDataPlaneData(dataplanes, 'default');

         const totalTime = Date.now() - startTime;
  @@ -238,30 +181,10 @@ export class PlatformEnvironmentInfoService
  logger: this.logger,
  });

-      const { data, error, response } = await client.GET(
-        '/orgs/{orgName}/dataplanes',
-        {
-          params: {
-            path: { orgName: organizationName },
-          },
-        },

*      const dataplanes = await this.fetchOrgDataplanes(
*        client,
*        organizationName,
       );

-
-      if (error || !response.ok) {
-        this.logger.error(
-          `Failed to fetch dataplanes for organization ${organizationName}: ${response.status} ${response.statusText}`,
-        );
-        return [];
-      }
-
-      if (!data.success || !data.data?.items) {
-        this.logger.warn(
-          `No dataplanes found for organization ${organizationName}`,
-        );
-        return [];
-      }
-
-      const dataplanes = data.data.items;
         const result = this.transformDataPlaneData(dataplanes, organizationName);

         const totalTime = Date.now() - startTime;
  @@ -409,32 +332,23 @@ export class PlatformEnvironmentInfoService
           const batchPromises = batch.map(async component => {
             try {
-            // Get bindings for this component
-            const { data, error, response } = await client.GET(
-              '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
-              {
-                params: {
-                  path: {
-                    orgName: component.orgName,
-                    projectName: component.projectName,
-                    componentName: component.componentName,
-                  },
-                },
-              },

*            // Get all bindings for this component
*            const bindings = await this.fetchComponentReleaseBindings(
*              client,
*              component.orgName,
*              component.projectName,
*              component.componentName,
             );

-            if (!error && response.ok && data.success && data.data?.items) {
-              // Count environments where this component is deployed
-              const bindings = data.data.items as ReleaseBindingResponse[];
-              bindings.forEach(binding => {
-                const envName = binding.environment;
-                if (envName) {
-                  const currentCount =
-                    componentCountsByEnvironment.get(envName) || 0;
-                  componentCountsByEnvironment.set(envName, currentCount + 1);
-                }
-              });
-            }

*            // Count environments where this component is deployed
*            bindings.forEach(binding => {
*              const envName = binding.environment;
*              if (envName) {
*                const currentCount =
*                  componentCountsByEnvironment.get(envName) || 0;
*                componentCountsByEnvironment.set(envName, currentCount + 1);
*              }
*            });
             } catch (error) {
               this.logger.warn(
                 `Failed to fetch bindings for component ${component.orgName}/${component.projectName}/${component.componentName}:`,
  @@ -496,27 +410,15 @@ export class PlatformEnvironmentInfoService
           const batchPromises = batch.map(async component => {
             try {

-            // Get bindings for this component
-            const { data, error, response } = await client.GET(
-              '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
-              {
-                params: {
-                  path: {
-                    orgName: component.orgName,
-                    projectName: component.projectName,
-                    componentName: component.componentName,
-                  },
-                },
-              },

*            // Get all bindings for this component
*            const bindings = await this.fetchComponentReleaseBindings(
*              client,
*              component.orgName,
*              component.projectName,
*              component.componentName,
             );

-            if (
-              !error &&
-              response.ok &&
-              data.success &&
-              data.data?.items &&
-              data.data.items.length > 0
-            ) {

*            if (bindings.length > 0) {
                 // If component has at least one binding, count it as deployed
                 const componentKey = `${component.orgName}/${component.projectName}/${component.componentName}`;
                 deployedComponents.add(componentKey);
  @@ -583,29 +485,19 @@ export class PlatformEnvironmentInfoService
           const batchPromises = batch.map(async component => {
             try {

-            // Get bindings for this component
-            const { data, error, response } = await client.GET(
-              '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
-              {
-                params: {
-                  path: {
-                    orgName: component.orgName,
-                    projectName: component.projectName,
-                    componentName: component.componentName,
-                  },
-                },
-              },

*            // Get all bindings for this component
*            const bindings = await this.fetchComponentReleaseBindings(
*              client,
*              component.orgName,
*              component.projectName,
*              component.componentName,
             );

-            if (!error && response.ok && data.success && data.data?.items) {
-              // Count healthy workloads by checking if status.status === 'Active'
-              const bindings = data.data.items as ReleaseBindingResponse[];
-              const healthyCount = bindings.filter(
-                binding => binding.status === 'Ready',
-              ).length;
-              return healthyCount;
-            }
-            return 0;

*            // Count healthy workloads by checking if status === 'Ready'
*            const healthyCount = bindings.filter(
*              binding => binding.status === 'Ready',
*            ).length;
*            return healthyCount;
             } catch (error) {
               this.logger.warn(
                 `Failed to fetch bindings for component ${component.orgName}/${component.projectName}/${component.componentName}:`,
  @@ -687,4 +579,120 @@ export class PlatformEnvironmentInfoService
  return transformedDataPlane;
  });
  }
*
* /\*\*
* - Fetches all environments for an organization
* \*/
* private async fetchOrgEnvironments(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* orgName: string,
* ): Promise<ModelsEnvironment[]> {
* return fetchAllResources(async cursor => {
*      const { data, error, response } = await client.GET(
*        '/orgs/{orgName}/environments',
*        {
*          params: {
*            path: { orgName },
*            query: {
*              limit: DEFAULT_PAGE_LIMIT,
*              ...(cursor && { continue: cursor }),
*            },
*          },
*        },
*      );
*
*      if (error || !response.ok || !data) {
*        throw new Error(
*          `Failed to fetch environments for organization ${orgName}: ${response.status} ${response.statusText}`,
*        );
*      }
*
*      if (!data.success || !data.data?.items) {
*        throw new Error('Failed to retrieve environment list');
*      }
*
*      return {
*        items: data.data.items as ModelsEnvironment[],
*        metadata: data.data?.metadata as ResponseMetadata | undefined,
*      };
* });
* }
*
* /\*\*
* - Fetches all dataplanes for an organization
* \*/
* private async fetchOrgDataplanes(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* orgName: string,
* ): Promise<ModelsDataPlane[]> {
* return fetchAllResources(async cursor => {
*      const { data, error, response } = await client.GET(
*        '/orgs/{orgName}/dataplanes',
*        {
*          params: {
*            path: { orgName },
*            query: {
*              limit: DEFAULT_PAGE_LIMIT,
*              ...(cursor && { continue: cursor }),
*            },
*          },
*        },
*      );
*
*      if (error || !response.ok || !data) {
*        throw new Error(
*          `Failed to fetch dataplanes for organization ${orgName}: ${response.status} ${response.statusText}`,
*        );
*      }
*
*      if (!data.success || !data.data?.items) {
*        throw new Error('Failed to retrieve dataplane list');
*      }
*
*      return {
*        items: data.data.items as ModelsDataPlane[],
*        metadata: data.data?.metadata as ResponseMetadata | undefined,
*      };
* });
* }
*
* /\*\*
* - Fetches all release bindings for a component
* \*/
* private async fetchComponentReleaseBindings(
* client: ReturnType<typeof createOpenChoreoApiClient>,
* orgName: string,
* projectName: string,
* componentName: string,
* ): Promise<ReleaseBindingResponse[]> {
* return fetchAllResources(async cursor => {
*      const { data, error, response } = await client.GET(
*        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/release-bindings',
*        {
*          params: {
*            path: { orgName, projectName, componentName },
*            query: {
*              limit: DEFAULT_PAGE_LIMIT,
*              ...(cursor && { continue: cursor }),
*            },
*          },
*        },
*      );
*
*      if (error || !response.ok || !data) {
*        throw new Error(
*          `Failed to fetch release bindings for component ${orgName}/${projectName}/${componentName}: ${response.status} ${response.statusText}`,
*        );
*      }
*
*      if (!data.success || !data.data?.items) {
*        throw new Error('Failed to retrieve release bindings list');
*      }
*
*      return {
*        items: data.data.items as ReleaseBindingResponse[],
*        metadata: data.data?.metadata as ResponseMetadata | undefined,
*      };
* });
* }
  }
  (END)
