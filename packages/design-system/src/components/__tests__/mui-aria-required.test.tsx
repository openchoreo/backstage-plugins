// Pins MUI v4 TextField's `required` -> native `required` attribute wiring.
//
// Audit finding #20 asked whether MUI v4 emits `aria-required="true"`. The
// runtime answer is no — MUI v4 forwards the prop to the native HTML
// `required` attribute on the rendered <input> instead. NVDA, VoiceOver and
// JAWS all map native `required` to the same announcement, and axe-core
// does NOT flag inputs that use native `required` without `aria-required`
// (the `aria-required-attr` rule only checks for consistency *within* ARIA).
//
// So the codebase relies on the native attribute and this test catches a
// future MUI upgrade that silently drops it.
import { render } from '@testing-library/react';
import { TextField } from '@material-ui/core';

describe('MUI v4 TextField required', () => {
  it('forwards required to the underlying input as a native attribute', () => {
    const { container } = render(<TextField label="My field" required />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('required');
  });

  it('does not set required when the prop is omitted', () => {
    const { container } = render(<TextField label="Optional field" />);
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input).not.toHaveAttribute('required');
  });
});
