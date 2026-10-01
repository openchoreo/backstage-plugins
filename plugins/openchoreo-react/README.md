# @openchoreo/backstage-plugin-react

Shared React components, hooks, and utilities for OpenChoreo Backstage plugins.

## Overview

This package provides reusable React components, custom hooks, and frontend utilities that are shared across multiple OpenChoreo Backstage plugins. It follows the Backstage convention of creating a `-react` package for React-specific shared code.

## Package Organization

```
src/
├── components/     # Shared React components
├── hooks/          # Custom React hooks
├── utils/          # Frontend utilities
└── index.ts        # Public API exports
```

## Installation

A Backstage host does not install this directly — it is an ordinary dependency of the
OpenChoreo frontend plugins. Inside this monorepo, add it to a workspace that needs it:

```bash
yarn workspace @openchoreo/backstage-plugin add @openchoreo/backstage-plugin-react@workspace:^
```

## Usage

### Components

Import shared components:

```tsx
import {
  SummaryWidgetWrapper,
  BuildLogs,
} from '@openchoreo/backstage-plugin-react';
```

### Hooks

Import custom hooks:

```tsx
import {
  useInfiniteScroll,
  useEntityDetails,
} from '@openchoreo/backstage-plugin-react';
```

### Utilities

Import utilities:

```tsx
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
```

## Development

```bash
# Build the package
yarn build

# Run linter
yarn lint

# Run tests
yarn test

# Start in watch mode for development
yarn start
```

## Architecture

This package follows Backstage's architectural patterns:

- **`@openchoreo/backstage-plugin-common`** - Platform-agnostic types and utilities (no React)
- **`@openchoreo/backstage-plugin-react`** - React components, hooks, and frontend utilities (this package)
- **`@openchoreo/backstage-design-system`** - Pure visual/brand elements (theme, icons, basic styled components)

## License

Apache-2.0
