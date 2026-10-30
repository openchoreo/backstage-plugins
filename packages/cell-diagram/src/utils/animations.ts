import { css, keyframes } from '@emotion/react';

/**
 * CSS keyframe animations shared by the cell diagram.
 *
 * These replace the imperative GSAP tweens that used to reveal the diagram
 * nodes and the canvas control panels. Keyframes are declared once with
 * emotion and attached to elements through class names, so the browser runs
 * the animation natively without any runtime animation library.
 */

/** Approximation of GSAP's `power3.out` easing (cubic ease-out). */
export const EASE_OUT_CUBIC = 'cubic-bezier(0.215, 0.61, 0.355, 1)';
/** Approximation of GSAP's default `power1.out` easing (quadratic ease-out). */
export const EASE_OUT_QUAD = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';

/** Duration of the node reveal animation (seconds). */
export const REVEAL_DURATION = 0.5;
/** Duration of the control panel pop-in animation (seconds). */
export const PANEL_DURATION = 1;
/** Delay before the control panel pop-in starts (seconds). */
export const PANEL_DELAY = 1;

export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const scaleIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

export const scaleInHalf = keyframes`
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

export const popIn = keyframes`
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
`;

/** Class names applied to diagram elements to trigger a reveal animation. */
export const RevealClass = {
  FADE: 'cell-diagram-reveal-fade',
  SCALE: 'cell-diagram-reveal-scale',
  SCALE_HALF: 'cell-diagram-reveal-scale-half',
} as const;

/** Class name applied to a canvas control panel to trigger its pop-in. */
export const PANEL_REVEAL_CLASS = 'cell-diagram-panel-reveal';

/**
 * Styles for the node reveal classes. Included once in the diagram
 * container so every node/link inside it can opt in by class name.
 * `animation-delay` is set per element (see `diagramUtils`) so the
 * fade-in can be sequenced after the containing cell has appeared.
 */
export const revealStyles = css`
  .${RevealClass.FADE} {
    animation: ${fadeIn} ${REVEAL_DURATION}s ${EASE_OUT_QUAD} backwards;
  }
  .${RevealClass.SCALE} {
    animation: ${scaleIn} ${REVEAL_DURATION}s ${EASE_OUT_QUAD} backwards;
  }
  .${RevealClass.SCALE_HALF} {
    animation: ${scaleInHalf} ${REVEAL_DURATION}s ${EASE_OUT_QUAD} backwards;
  }
`;

/** Styles for the control panel pop-in. Included by each panel component. */
export const panelRevealStyles = css`
  &.${PANEL_REVEAL_CLASS} {
    animation: ${popIn} ${PANEL_DURATION}s ${EASE_OUT_CUBIC} ${PANEL_DELAY}s
      backwards;
  }
`;
