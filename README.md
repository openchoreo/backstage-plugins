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

### 2. Environment Variables

The application requires several environment variables for configuration. These can be set in your shell or via a `.env` file.

#### Required Variables

```bash
# Backstage Base URL (used for both frontend and backend in production)
# For local development, see "Local Development Considerations" below
export BACKSTAGE_BASE_URL=http://localhost:3000

# Backend session secret (required for authentication cookies)
export BACKEND_SECRET=your-secret-key-here

# OpenChoreo API configuration
export OPENCHOREO_API_URL=http://localhost:8080/api/v1
export OPENCHOREO_TOKEN=your-openchoreo-token  # Optional

# Thunder IDP configuration (for authentication)
export THUNDER_BASE_URL=http://localhost:8090
# export THUNDER_TOKEN=your-thunder-token  # Optional: uncomment if needed

# OAuth authentication credentials
export OPENCHOREO_AUTH_CLIENT_ID=openchoreo-backstage-client
export OPENCHOREO_AUTH_CLIENT_SECRET=your-client-secret
export OPENCHOREO_AUTH_AUTHORIZATION_URL=http://localhost:8090/oauth2/authorize
export OPENCHOREO_AUTH_TOKEN_URL=http://localhost:8090/oauth2/token
```

#### Optional Variables

```bash
# GitHub integration (for catalog and templates)
export GITHUB_TOKEN=your-github-personal-access-token
```

#### Complete .env.example

Here's a complete example you can copy to create a `.env` file:

```bash
# Backstage Configuration
BACKSTAGE_BASE_URL=http://localhost:3000
BACKEND_SECRET=change-me-in-production

# OpenChoreo API
OPENCHOREO_API_URL=http://localhost:8080/api/v1
OPENCHOREO_TOKEN=

# Thunder IDP
THUNDER_BASE_URL=http://localhost:8090
# THUNDER_TOKEN=

# OAuth Authentication
OPENCHOREO_AUTH_CLIENT_ID=openchoreo-backstage-client
OPENCHOREO_AUTH_CLIENT_SECRET=backstage-portal-secret
OPENCHOREO_AUTH_AUTHORIZATION_URL=http://localhost:8090/oauth2/authorize
OPENCHOREO_AUTH_TOKEN_URL=http://localhost:8090/oauth2/token

# GitHub Integration (Optional)
GITHUB_TOKEN=
```

#### Local Development Considerations

**IMPORTANT:** The `BACKSTAGE_BASE_URL` variable is used for both `app.baseUrl` and `backend.baseUrl` in the configuration. This works well in production with ingress routing but requires special handling for local development:

**Development Mode (`yarn start`):**

- Frontend runs on **http://localhost:3000** (webpack dev server with hot reloading)
- Backend runs on **http://localhost:7007** (API only)
- These run as **separate processes on different ports**
- The `@backstage/plugin-app-backend` is loaded but inactive (no built assets to serve)
- Access the application at **http://localhost:3000**

**Production/Build Mode:**

- Frontend must be built first: `yarn build:all`
- Backend serves the built static assets via `@backstage/plugin-app-backend`
- Both accessible from the same URL (e.g., **http://localhost:7007** or ingress URL)

**Configuration Options for Local Development:**

Since frontend and backend run on separate ports in development, you need to configure the URLs accordingly:

- **Option 1 (Recommended):** Manually override in `app-config.yaml`:

  ```yaml
  app:
    baseUrl: http://localhost:3000 # Frontend URL

  backend:
    baseUrl: http://localhost:7007 # Backend API URL
    cors:
      origin: http://localhost:3000 # Allow frontend to call backend
  ```

- **Option 2:** Create `app-config.local.yaml` (not tracked in git) with the above overrides.

- **Option 3:** Use environment variables:
  ```bash
  export BACKSTAGE_BASE_URL=http://localhost:3000  # For app.baseUrl
  # Note: You'll still need to override backend.baseUrl and cors.origin in config
  ```

**Production/Kind with Ingress:**

- Set `BACKSTAGE_BASE_URL` to your ingress URL (e.g., `http://openchoreo.localhost`)
- The ingress routes both frontend and backend through the same origin
- Both `app.baseUrl` and `backend.baseUrl` use the same value

### 3. Configuration

The application uses two primary configuration files:

- `app-config.yaml` - Base configuration for local development (uses environment variables)
- `app-config.production.yaml` - Production configuration

You can optionally create `app-config.local.yaml` for local overrides (this file is not tracked in git).

#### Environment-Driven Configuration

All configuration now uses environment variables for flexibility across deployment environments. Key configuration sections in `app-config.yaml`:

```yaml
# Backstage base URLs (from commit 5d84dd7)
app:
  title: OpenChoreo Portal
  baseUrl: ${BACKSTAGE_BASE_URL} # Frontend URL

backend:
  baseUrl: ${BACKSTAGE_BASE_URL} # Backend API URL
  session:
    secret: ${BACKEND_SECRET} # Required for authentication cookies
  cors:
    origin: ${BACKSTAGE_BASE_URL} # CORS origin (should match frontend URL)

# OpenChoreo integration
openchoreo:
  baseUrl: ${OPENCHOREO_API_URL}
  token: ${OPENCHOREO_TOKEN} # optional
  defaultOwner: 'platformengineer'
  schedule:
    frequency: 30 # seconds between catalog syncs
    timeout: 120 # request timeout

# Thunder IDP integration
thunder:
  baseUrl: ${THUNDER_BASE_URL} # e.g., http://localhost:8090
  # token: ${THUNDER_TOKEN}  # Optional: uncomment if needed
  defaultNamespace: 'default'
  schedule:
    frequency: 600 # seconds between runs (10 minutes)
    timeout: 300 # seconds for timeout (5 minutes)

# OAuth authentication provider
auth:
  environment: development
  providers:
    default-idp:
      development:
        clientId: ${OPENCHOREO_AUTH_CLIENT_ID}
        clientSecret: ${OPENCHOREO_AUTH_CLIENT_SECRET}
        authorizationUrl: ${OPENCHOREO_AUTH_AUTHORIZATION_URL}
        tokenUrl: ${OPENCHOREO_AUTH_TOKEN_URL}
        scope: 'openid profile email'

# GitHub integration (optional)
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
```

**Note:** In production deployments (Kubernetes/Helm), these environment variables are automatically injected by the Helm chart. See the [openchoreo/openchoreo repository](https://github.com/openchoreo/openchoreo) deployment configuration at `install/helm/openchoreo/templates/backstage/deployment.yaml` for details.

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
