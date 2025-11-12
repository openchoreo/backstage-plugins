# OpenAPI Client Generator

A generic, reusable OpenAPI client generator for Backstage plugins. This package provides scripts and utilities to generate type-safe TypeScript API clients from OpenAPI specifications.

## Features

- Generate TypeScript types from OpenAPI 3.0 specifications
- Support for multiple API specs in a single package
- Type-safe clients using `openapi-fetch`
- Automatic version tracking
- Configurable via JSON configuration file
- Based on modern `openapi-typescript` tooling

## Installation

Add this package as a dev dependency to your plugin:

```bash
yarn workspace @your-org/your-plugin-node add --dev @openchoreo/openapi-client-generator-node
```

## Usage

### 1. Create OpenAPI Configuration

Create an `openapi-config.json` file in your package root:

```json
{
  "outputDir": "src/generated",
  "specs": [
    {
      "name": "user",
      "input": "openapi/user.yaml",
      "description": "User Management API"
    },
    {
      "name": "admin",
      "input": "openapi/admin.yaml",
      "description": "Admin API"
    }
  ],
  "versionField": "apiVersion",
  "versionFile": "src/version.ts"
}
```

### 2. Add OpenAPI Specifications

Place your OpenAPI YAML files in the configured locations (e.g., `openapi/user.yaml`).

### 3. Add Generation Script

In your `package.json`, add a script to generate clients:

```json
{
  "scripts": {
    "generate:clients": "bash node_modules/@openchoreo/openapi-client-generator-node/scripts/generate-client.sh --config openapi-config.json",
    "clean:generated": "rimraf src/generated src/version.ts"
  }
}
```

### 4. Generate Clients

Run the generation script:

```bash
yarn generate:clients
```

This will:

- Generate TypeScript types for each API spec
- Create organized output directories
- Generate a version file (if configured)
- Create index files for easy imports

### 5. Create Factory Functions

Create a `factory.ts` file to instantiate your generated clients:

```typescript
import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths as UserPaths } from './generated/user/types';
import type { paths as AdminPaths } from './generated/admin/types';

export interface ApiClientConfig {
  baseUrl: string;
  token?: string;
}

export function createUserClient(config: ApiClientConfig) {
  const clientOptions: ClientOptions = {
    baseUrl: config.baseUrl,
    headers: config.token
      ? { Authorization: `Bearer ${config.token}` }
      : undefined,
  };
  return createClient<UserPaths>(clientOptions);
}

export function createAdminClient(config: ApiClientConfig) {
  const clientOptions: ClientOptions = {
    baseUrl: config.baseUrl,
    headers: config.token
      ? { Authorization: `Bearer ${config.token}` }
      : undefined,
  };
  return createClient<AdminPaths>(clientOptions);
}
```

### 6. Use the Generated Clients

```typescript
import { createUserClient } from './factory';

const userClient = createUserClient({
  baseUrl: 'https://api.example.com',
  token: 'your-token',
});

const { data, error } = await userClient.GET('/users/{id}', {
  params: { path: { id: '123' } },
});
```

## Configuration Options

| Field                 | Type   | Required | Description                                     |
| --------------------- | ------ | -------- | ----------------------------------------------- |
| `outputDir`           | string | Yes      | Directory where generated files will be placed  |
| `specs`               | array  | Yes      | Array of OpenAPI spec configurations            |
| `specs[].name`        | string | Yes      | Name for this API (used as directory name)      |
| `specs[].input`       | string | Yes      | Path to OpenAPI spec file                       |
| `specs[].description` | string | No       | Human-readable description                      |
| `versionField`        | string | No       | Field name in package.json for version tracking |
| `versionFile`         | string | No       | Path for generated version file                 |

## Benefits

- **Type Safety**: Full TypeScript support with auto-generated types
- **Modern**: Uses `openapi-fetch` for lightweight, native fetch-based clients
- **Maintainable**: Auto-generate clients instead of manual API implementation
- **Consistent**: Same pattern across all your API clients
- **Flexible**: Supports multiple APIs in a single package

## Example: Multiple APIs

For a package with multiple related APIs:

```json
{
  "outputDir": "src/generated",
  "specs": [
    {
      "name": "openchoreo",
      "input": "openapi/openchoreo-api.yaml",
      "description": "OpenChoreo Main API"
    },
    {
      "name": "observability",
      "input": "openapi/openchoreo-observability-api.yaml",
      "description": "OpenChoreo Observability API"
    }
  ],
  "versionField": "openChoreoVersion",
  "versionFile": "src/version.ts"
}
```

This generates:

- `src/generated/openchoreo/types.ts`
- `src/generated/openchoreo/index.ts`
- `src/generated/observability/types.ts`
- `src/generated/observability/index.ts`
- `src/version.ts` (with API_VERSION constant)

## License

Apache-2.0
