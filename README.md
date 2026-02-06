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

Follow the setup [guide](https://openchoreo.dev/docs/getting-started/quick-start-guide/)

## Local Domain Configuration

To access the OpenChoreo services locally, you need to configure DNS resolution for `.localhost` domains.

### Setup (Required)

Add the following entries to your `/etc/hosts` file:

```bash
sudo nano /etc/hosts
```

Add these lines:

```
127.0.0.1       openchoreo.localhost
127.0.0.1       api.openchoreo.localhost
127.0.0.1       thunder.openchoreo.localhost
```

Save and exit. The changes take effect immediately.

### Why is this needed?

While browsers automatically resolve `.localhost` domains to `127.0.0.1`, Node.js and other tools use system DNS which doesn't have this built-in behavior for subdomains. The `/etc/hosts` entries ensure consistent resolution across all tools.

### Alternative Approaches

If you cannot modify `/etc/hosts`, you can:

- **Use IP directly**: Connect to `http://127.0.0.1` instead and set the `Host` header manually in your requests
- **DNS lookup override**: Implement custom DNS resolution in your Node.js code to intercept `.localhost` domains
- **Local DNS server**: Run `dnsmasq` or similar to handle `.localhost` wildcard resolution

However, the `/etc/hosts` approach is recommended for its simplicity and reliability.

## Development Setup

### Required Tools

- Node.js 22
- Yarn 4.4.1
- Docker

### 1. Install Dependencies

```bash
yarn install
```

### 2. Local Development Setup

If you're running OpenChoreo locally and want to connect Backstage (running at localhost:3000/7007) to it:

**Note:** The following steps are for the [single cluster setup](https://openchoreo.dev/docs/next/getting-started/try-it-out/on-self-hosted-kubernetes/).

```bash
helm upgrade openchoreo-control-plane oci://ghcr.io/openchoreo/helm-charts/openchoreo-control-plane \
  --version 0.0.0-latest-dev \
  --namespace openchoreo-control-plane \
  --reuse-values \
  --set-json 'backstage.auth.redirectUrls=["http://localhost:3000/api/auth/openchoreo-auth/handler/frame","http://localhost:7007/api/auth/openchoreo-auth/handler/frame","http://openchoreo.localhost:8080/api/auth/openchoreo-auth/handler/frame"]'
```

To develop observability plane features, port-forward the observer API:

```bash
kubectl patch observabilityplane default --type='merge' -p '{"spec":{"observerURL":"http://localhost:9097"}}'
```

```bash
kubectl port-forward -n openchoreo-observability-plane svc/observer 9097:8080
```

```bash
# Copy the pre-configured local development template
cp app-config.local.yaml.example app-config.local.yaml

# Start Backstage
yarn start

# Access at http://localhost:3000
```

This is the **easiest way** to get started - all values are pre-configured to connect your local Backstage instance to the OpenChoreo services (\*.openchoreo.localhost).

#### What's in app-config.local.yaml?

The `app-config.local.yaml.example` file contains hardcoded values for:

- **Frontend URL:** `http://localhost:3000`
- **Backend URL:** `http://localhost:7007`
- **OpenChoreo API:** `http://api.openchoreo.localhost:8080/api/v1`
- **Thunder IDP:** `http://thunder.openchoreo.localhost:8080`
- **OAuth Credentials:** Pre-configured from helm values
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

| File                         | Purpose                                                   | Used When                                         |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `app-config.yaml`            | Base configuration with environment variable placeholders | Referenced by both local and Docker builds        |
| `app-config.local.yaml`      | Local development overrides (gitignored)                  | Local development with `yarn start`               |
| `app-config.production.yaml` | Production configuration                                  | Docker builds, k3d cluster, production Kubernetes |

**Configuration Loading Order:**

Backstage CLI automatically loads configs in this order (later files override earlier ones):

1. `app-config.yaml`
2. `app-config.local.yaml` (if it exists)

#### Advanced: Using Environment Variables

If you prefer to use environment variables instead of `app-config.local.yaml`, you can set these in your shell:

```bash
export BACKSTAGE_BASE_URL=http://localhost:3000
export BACKEND_SECRET=your-secret-key-here
export OPENCHOREO_API_URL=http://api.openchoreo.localhost:8080/api/v1
export THUNDER_BASE_URL=http://thunder.openchoreo.localhost:8080
export OPENCHOREO_AUTH_CLIENT_ID=openchoreo-backstage-client
export OPENCHOREO_AUTH_CLIENT_SECRET=backstage-portal-secret
export OPENCHOREO_AUTH_AUTHORIZATION_URL=http://thunder.openchoreo.localhost:8080/oauth2/authorize
export OPENCHOREO_AUTH_TOKEN_URL=http://thunder.openchoreo.localhost:8080/oauth2/token
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

## Feature Flags

OpenChoreo includes configurable feature flags that allow you to enable or disable major functionality without code changes.

### Available Feature Flags

| Feature           | Environment Variable                        | Description                                                                                                            |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Workflows**     | `OPENCHOREO_FEATURES_WORKFLOWS_ENABLED`     | Build plane / CI pipeline features. When disabled, hides Workflows tab and WorkflowsOverviewCard from component pages. |
| **Observability** | `OPENCHOREO_FEATURES_OBSERVABILITY_ENABLED` | Metrics, Traces, and Runtime Logs. When disabled, hides these tabs and RuntimeHealthCard from component pages.         |
| **Auth**          | `OPENCHOREO_FEATURES_AUTH_ENABLED`          | OAuth authentication. When disabled, users are automatically logged in as guests (demo/development mode).              |
| **Authz**         | `OPENCHOREO_FEATURES_AUTHZ_ENABLED`         | Authorization / Access Control. When disabled, hides Access Control sidebar and pages.                                 |

### Configuration

**Local Development (`app-config.local.yaml`):**

```yaml
openchoreo:
  features:
    workflows:
      enabled: true
    observability:
      enabled: true
    auth:
      enabled: false # Use guest mode for local development
    authz:
      enabled: true
```

**Production (Environment Variables):**

The Helm chart automatically injects these environment variables. You can configure them via Helm values:

```yaml
backstage:
  features:
    workflowsEnabled: true
    observabilityEnabled: true
    authEnabled: true
    authzEnabled: true
```

### Behavior When Features Are Disabled

When a feature is disabled:

- **Tabs remain visible** but show an informative empty state explaining that the feature is disabled
- **Overview cards** for the feature are hidden from the Overview tab
- This approach ensures consistent navigation while clearly communicating feature availability

## External CI Platform Integration

OpenChoreo includes built-in support for viewing CI build status from external platforms directly in Backstage.

### Supported Platforms

| Platform           | Required Annotation                                  | Environment Variables                                     |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------- |
| **Jenkins**        | `jenkins.io/job-full-name`                           | `JENKINS_BASE_URL`, `JENKINS_USERNAME`, `JENKINS_API_KEY` |
| **GitHub Actions** | `github.com/project-slug`                            | `GITHUB_TOKEN`                                            |
| **GitLab CI**      | `gitlab.com/project-slug` or `gitlab.com/project-id` | `GITLAB_HOST`, `GITLAB_TOKEN`                             |

### How It Works

External CI plugins work differently based on the platform:

- **Jenkins**: Backend plugin is always enabled and handles missing config gracefully (API calls fail, not startup)
- **GitHub Actions**: Uses the GitHub integration token from `integrations.github` - no separate backend plugin needed
- **GitLab**: Backend plugin requires `integrations.gitlab` config at startup. The plugin is **commented out by default** - you must uncomment it in `packages/backend/src/index.ts` after adding GitLab config.

The UI components (tabs and status cards) appear when the entity has the required CI annotation.

### Configuration

#### Local Development (`app-config.local.yaml`)

```yaml
# Jenkins Configuration
jenkins:
  baseUrl: http://jenkins.example.com
  username: admin
  apiKey: YOUR_JENKINS_API_KEY

# GitHub Integration (used by GitHub Actions and scaffolder)
integrations:
  github:
    - host: github.com
      token: YOUR_GITHUB_TOKEN

  # GitLab Integration (required for GitLab CI)
  gitlab:
    - host: gitlab.com
      token: YOUR_GITLAB_TOKEN
```

> **Note for GitLab**: Unlike Jenkins, the GitLab backend plugin requires configuration at startup.
> After adding GitLab config to `app-config.local.yaml`, you must also uncomment the GitLab backend
> plugin in `packages/backend/src/index.ts`:
>
> ```typescript
> backend.add(import('@immobiliarelabs/backstage-plugin-gitlab-backend'));
> ```

#### Production (Helm Chart)

For Kubernetes deployments, configure CI integrations via Helm values:

```yaml
backstage:
  externalCI:
    jenkins:
      enabled: true
      baseUrl: 'https://jenkins.example.com'
      username: 'admin'
      apiKey: 'your-jenkins-api-key'
    github:
      enabled: true
      token: 'ghp_xxxxxxxxxxxx'
    gitlab:
      enabled: true
      host: 'gitlab.com'
      token: 'glpat-xxxxxxxxxxxx'
```

The Helm chart will:

- Inject environment variables when `enabled: true`
- Store sensitive values (apiKey, token) in Kubernetes secrets
- Skip injection when `enabled: false` (default)

### Adding CI Annotations

Once configured, add annotations to your components:

1. Navigate to the component in Backstage
2. Click the context menu (**...**) and select **Edit Annotations**
3. Add the appropriate CI annotation for your platform
4. Click **Save**

When annotations are present, you'll see:

- **Status cards** on the component Overview page (replaces the Workflows card when external CI is configured)
- **Dedicated tabs** (Jenkins, GitHub Actions, or GitLab) with full build history

For detailed setup instructions, see the [External CI Integration Guide](https://openchoreo.dev/docs/integrating-with-openchoreo/external-ci).

## Documentation

- Check individual plugin README files in `plugins/` directory
- Visit [Backstage documentation](https://backstage.io/docs) for general Backstage guidance
