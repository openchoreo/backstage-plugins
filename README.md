# OpenChoreo Backstage Plugins

This repository contains Backstage plugins for integrating with [OpenChoreo](https://openchoreo.dev), providing a developer portal for cloud-native application management, deployment visualization, and observability.

## Features

- **Environment Management**: View and manage application environments and workloads
- **Cell Diagrams**: Visualize system architecture and component relationships
- **Runtime Logs**: Real-time log viewing and filtering capabilities
- **Build Integration**: Track builds and deployment pipelines
- **Scaffolding**: Templates for creating OpenChoreo projects and components
- **Catalog Integration**: Automatic discovery and management of OpenChoreo entities

## Prerequisites

### OpenChoreo Setup

Follow the setup [guide](https://openchoreo.dev/docs/getting-started/single-cluster/)

## Development Setup

### Required Tools

- Node.js 22
- Yarn 4.4.1
- Docker

### 1. Install Dependencies

```bash
yarn install
```

### 2. Local Development Setup with Kind Cluster

**Quick Start (Recommended):**

If you're running the OpenChoreo Kind cluster locally and want to connect Backstage (running at localhost:3000/7007) to it:

```bash
# Copy the pre-configured local development template
cp app-config.local.yaml.example app-config.local.yaml

# Start Backstage
yarn start

# Access at http://localhost:3000
```

This is the **easiest way** to get started - all values are pre-configured to connect your local Backstage instance to the Kind cluster services (\*.openchoreo.localhost).

#### What's in app-config.local.yaml?

The `app-config.local.yaml.example` file contains hardcoded values for:

- **Frontend URL:** `http://localhost:3000`
- **Backend URL:** `http://localhost:7007`
- **OpenChoreo API:** `http://api.openchoreo.localhost` (Kind cluster)
- **Thunder IDP:** `http://sts.openchoreo.localhost` (Kind cluster)
- **OAuth Credentials:** Pre-configured from Kind cluster helm values
  - Client ID: `openchoreo-backstage-client`
  - Client Secret: `backstage-portal-secret`

**Note:** `app-config.local.yaml` is gitignored and won't affect Docker builds or production deployments. The Docker build only uses `app-config.production.yaml`.

#### Optional: GitHub Integration

If you need GitHub integration for catalog/templates, add your personal access token to `app-config.local.yaml`:

```yaml
integrations:
  github:
    - host: github.com
      token: YOUR_GITHUB_TOKEN_HERE
```

### 3. Configuration Files

The application uses three configuration files:

| File                         | Purpose                                                   | Used When                                          |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `app-config.yaml`            | Base configuration with environment variable placeholders | Referenced by both local and Docker builds         |
| `app-config.local.yaml`      | Local development overrides (gitignored)                  | Local development with `yarn start`                |
| `app-config.production.yaml` | Production configuration                                  | Docker builds, Kind cluster, production Kubernetes |

**Configuration Loading Order:**

Backstage CLI automatically loads configs in this order (later files override earlier ones):

1. `app-config.yaml`
2. `app-config.local.yaml` (if it exists)

#### Advanced: Using Environment Variables

If you prefer to use environment variables instead of `app-config.local.yaml`, you can set these in your shell:

```bash
export BACKSTAGE_BASE_URL=http://localhost:3000
export BACKEND_SECRET=your-secret-key-here
export OPENCHOREO_API_URL=http://api.openchoreo.localhost
export THUNDER_BASE_URL=http://sts.openchoreo.localhost
export OPENCHOREO_AUTH_CLIENT_ID=openchoreo-backstage-client
export OPENCHOREO_AUTH_CLIENT_SECRET=backstage-portal-secret
export OPENCHOREO_AUTH_AUTHORIZATION_URL=http://sts.openchoreo.localhost/oauth2/authorize
export OPENCHOREO_AUTH_TOKEN_URL=http://sts.openchoreo.localhost/oauth2/token
export GITHUB_TOKEN=your-github-token  # Optional
```

Then run: `yarn start`

**Note:** In production deployments (Kubernetes/Helm), environment variables are automatically injected by the Helm chart. See the [openchoreo/openchoreo repository](https://github.com/openchoreo/openchoreo) at `install/helm/openchoreo/templates/backstage/deployment.yaml` for details.

### 4. Start the Application

```bash
# Start both frontend and backend
yarn start

# Or start individual services
yarn build:backend  # Build backend first
yarn start          # Start full application
```

**Development Mode:** When using `yarn start`, two separate processes will start:

- **Frontend:** `http://localhost:3000` (webpack dev server) - Access the application here
- **Backend API:** `http://localhost:7007` (API endpoints only)

**Production Mode:** After building with `yarn build:all`, the backend will serve both the static frontend assets and API endpoints from `http://localhost:7007` (or your configured `BACKSTAGE_BASE_URL`).

**Note:** If you access `http://localhost:7007` directly in development mode (without building first), you'll see a 403 error because the `@backstage/plugin-app-backend` has no built frontend assets to serve. Always access `http://localhost:3000` during development.

### 5. Development Workflow

```bash
# Run tests
yarn test           # Changed files only
yarn test:all       # All tests with coverage

# Code quality
yarn lint           # Lint changed files
yarn lint:all       # Lint all files
yarn fix            # Auto-fix issues

# Build
yarn build:all      # Build all packages
yarn tsc            # TypeScript check
```

## Plugin Development

To develop individual plugins in isolation:

```bash
yarn workspace {plugin-name} start
```

example

```bash
yarn workspace @openchoreo/backstage-plugin-backend start
```

Create new plugins:

```bash
yarn new
```

## Available Plugins

- **`@openchoreo/backstage-plugin`** - Frontend UI components
- **`@openchoreo/backstage-plugin-backend`** - Backend API services
- **`@openchoreo/backstage-plugin-api`** - Shared API client library
- **`@openchoreo/backstage-plugin-catalog-backend-module`** - Catalog entity provider
- **`@openchoreo/backstage-plugin-scaffolder-backend-module`** - Scaffolder actions

## Installation

The plugins are published to GitHub Packages. To install them in your Backstage application:

```bash
# Configure npm to use GitHub Packages for @openchoreo scope
echo "@openchoreo:registry=https://npm.pkg.github.com" >> .npmrc

# Install the plugins you need
yarn add @openchoreo/backstage-plugin
yarn add @openchoreo/backstage-plugin-backend
yarn add @openchoreo/backstage-plugin-api
```

Note: You'll need a GitHub personal access token with `packages:read` permission to install from GitHub Packages.

## Documentation

- Check individual plugin README files in `plugins/` directory
- Visit [Backstage documentation](https://backstage.io/docs) for general Backstage guidance
