# @openchoreo/cell-diagram

A React component library that visualizes cell architectures.

> Previously published as `@wso2/cell-diagram`. The exported API is unchanged;
> only the package name has moved into the `@openchoreo` scope.

## Provenance

This package was imported into the monorepo from
[`wso2/cell-diagram`](https://github.com/wso2/cell-diagram) at commit
[`d590506`](https://github.com/wso2/cell-diagram/commit/d590506cecdc1eee478a057a5f535075d5f56dde)
(last published as `@wso2/cell-diagram@0.3.1`), per
[openchoreo/openchoreo#4003](https://github.com/openchoreo/openchoreo/issues/4003).
The original repository's git history is preserved upstream; it is not
reproduced here because the PR lands as a single squashed commit. The source is
unchanged in behaviour — only adapted to the monorepo's strict TypeScript and
lint settings, and the per-file Apache-2.0 headers were dropped to match repo
convention (the package remains Apache-2.0 licensed; see `package.json`).

## Installation

```bash
npm install @openchoreo/cell-diagram
```

## Basic usage

```tsx
import { CellDiagram } from '@openchoreo/cell-diagram';

<CellDiagram project={project} />;
```

## Theming (light / dark)

`<CellDiagram>` accepts an optional `mode` prop and, for advanced cases, a
`colors` prop that lets host applications drive the palette from the outside.
Defaults are unchanged — callers that don't pass `mode` get the original
light appearance.

### Switching modes

```tsx
import { CellDiagram } from '@openchoreo/cell-diagram';

// Follow the host application's theme.
<CellDiagram project={project} mode={isDarkTheme ? 'dark' : 'light'} />;
```

The library subscribes its internal styled components to an Emotion
`ThemeProvider`, so toggling `mode` re-renders the canvas live; zoom, layout
and selection state persist across the swap.

### Backstage example

```tsx
import { useTheme } from '@material-ui/core/styles';

export function CellDiagramTab({ project }) {
  const theme = useTheme();
  return (
    <CellDiagram
      project={project}
      mode={theme.palette.type === 'dark' ? 'dark' : 'light'}
    />
  );
}
```

### Per-token overrides

For host apps that want to snap accents to their own brand without giving up
the rest of the preset, pass `colors`:

```tsx
import { CellDiagram, CellDiagramColors } from '@openchoreo/cell-diagram';

const brandOverride: Partial<CellDiagramColors> = {
  PRIMARY: '#22D3EE',
  PRIMARY_HOVER: '#67E8F9',
};

<CellDiagram project={project} mode="dark" colors={brandOverride} />;
```

The full token set is exported as `CellDiagramColors` and the two presets as
`lightColors` / `darkColors`.

### What's themed and what isn't

Themed surfaces include the canvas background, all node types
(cell/component/connection/project/external), all link layers
(architecture/observability/diff), legend, controls and tooltips.

**Not themed**: brand language-icon SVGs (Java blue, Python yellow, NodeJS
green, etc.) — those are kept identity-colored in both modes.

## Development

This package builds with `backstage-cli` and ships a Storybook (Vite builder)
for local component development:

```bash
yarn workspace @openchoreo/cell-diagram storybook   # http://localhost:6006
yarn workspace @openchoreo/cell-diagram build       # dist/ (esm + cjs + types)
```

## Migration from `0.2.x`

- The `Colors` enum was previously a TypeScript `enum`. From `0.3.0` it is a
  frozen object alias of `lightColors`. Value imports (`Colors.PRIMARY`) keep
  working unchanged. Type imports (`: Colors`) also keep working through a
  `type Colors = CellDiagramColors` alias.
- Callers that don't pass `mode` see no visual change.
