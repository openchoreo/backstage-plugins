# Frontend Plugin Testing Guide

## Testing Utilities

### `renderInTestApp` (from `@backstage/test-utils`)

The **recommended default** for rendering components in tests. Provides full Backstage context: theme, routing, API registry, and error boundaries.

Use for:

- Page-level components that depend on routing or Backstage APIs
- Components that use Backstage UI components (`Progress`, `Table`, `EmptyState`, etc.) which internally call hooks like `useTranslationRef()`

```tsx
import { renderInTestApp } from '@backstage/test-utils';

await renderInTestApp(<MyPage />);
```

### `EntityProvider` (from `@backstage/plugin-catalog-react`)

Wrap components that call `useEntity()` to provide entity context. Use alongside `renderInTestApp`.

```tsx
import { EntityProvider } from '@backstage/plugin-catalog-react';

await renderInTestApp(
  <EntityProvider entity={mockEntity}>
    <MyPage />
  </EntityProvider>,
);
```

### `TestApiProvider` (from `@backstage/test-utils`)

For standalone scenarios where you need specific API mocks but not the full app context (no routing needed). Prefer `renderInTestApp` when possible.

### Plain `render()` (from `@testing-library/react`)

For simple components with no Backstage context dependencies (no Backstage hooks or components used internally).

```tsx
import { render } from '@testing-library/react';

render(<MyButton onClick={fn} />);
```

## What to Mock

**Do mock:**

- Your own hooks (`../../hooks`)
- Sibling/child components (to isolate the unit under test)
- External service plugins (`@openchoreo/backstage-plugin-react`)

**Do NOT mock:**

- `@backstage/core-components` — use `renderInTestApp` instead, which provides the required context. Mocking these components is [documented as broken](https://github.com/backstage/backstage/issues/20713) and strips away real rendering behavior.
- `@backstage/plugin-catalog-react` — use `EntityProvider` to supply entity context.
- MUI components — they work without any special context.

## Quick Reference

| Component type                     | Render with       | Entity context                         |
| ---------------------------------- | ----------------- | -------------------------------------- |
| Page (uses routing + Backstage UI) | `renderInTestApp` | `EntityProvider` if uses `useEntity()` |
| Component using Backstage UI only  | `renderInTestApp` | No                                     |
| Pure component (MUI / HTML only)   | `render`          | No                                     |

## Test Structure

```tsx
// 1. Imports
import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';

// 2. Mock own hooks and siblings only
jest.mock('../../hooks', () => ({ ... }));
jest.mock('./ChildComponent', () => ({ ... }));

// 3. Render helper
function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={entity}>
      <MyPage />
    </EntityProvider>,
  );
}

// 4. Tests (always async with renderInTestApp)
it('renders content', async () => {
  await renderPage();
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```
