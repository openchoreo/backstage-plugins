import { RefObject, useLayoutEffect, useState } from 'react';

/**
 * The height, in px, that lets the element at `ref` reach the bottom of the
 * Backstage page without the page itself scrolling.
 *
 * Measured rather than written as `calc(100vh - <offset>)`: what sits above the
 * table (query bar, notices, the actions row) changes height as it wraps on a
 * narrower screen or as notices come and go, so no fixed offset fits every
 * layout.
 *
 * Returns `fallback` until a measurement is possible — on first render, and
 * wherever there is no layout (tests).
 */
export function useFillPageHeight(
  ref: RefObject<HTMLElement>,
  { minHeight, fallback }: { minHeight: number; fallback: number | string },
): number | string {
  const [height, setHeight] = useState<number | string>(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    const page = element?.closest<HTMLElement>('[data-backstage-core-page]');
    const content = element?.closest<HTMLElement>('article');
    if (!element || !page || !content) return undefined;

    const measure = () => {
      if (page.clientHeight === 0) return;

      const pageTop = page.getBoundingClientRect().top;
      const top =
        element.getBoundingClientRect().top - pageTop + page.scrollTop;

      // Everything below the element inside the page content: its own bottom
      // padding, then the siblings after the branch that holds it. Not the
      // content's bottom edge, which moves with the element's own height.
      let below = parseFloat(getComputedStyle(element).paddingBottom) || 0;
      let branch: HTMLElement = element;
      while (branch.parentElement && branch.parentElement !== content) {
        branch = branch.parentElement;
      }
      for (
        let sibling = branch.nextElementSibling;
        sibling;
        sibling = sibling.nextElementSibling
      ) {
        const style = getComputedStyle(sibling);
        below +=
          (sibling as HTMLElement).offsetHeight +
          (parseFloat(style.marginTop) || 0) +
          (parseFloat(style.marginBottom) || 0);
      }
      below += parseFloat(getComputedStyle(content).paddingBottom) || 0;

      const next = Math.max(
        minHeight,
        Math.floor(page.clientHeight - top - below),
      );
      setHeight(current => (current === next ? current : next));
    };

    measure();
    window.addEventListener('resize', measure);

    // The content area is stretched to the page's height, so its own size does
    // not change when something above the element shrinks. Each block is
    // watched instead, and blocks mounting or unmounting (a notice, the Live
    // caption) re-arm the watch.
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measure);
    const observeBlocks = () => {
      if (!resizeObserver) return;
      resizeObserver.disconnect();
      resizeObserver.observe(page);
      for (const block of Array.from(content.children)) {
        resizeObserver.observe(block);
      }
    };
    observeBlocks();

    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(() => {
            observeBlocks();
            measure();
          });
    mutationObserver?.observe(content, { childList: true });

    return () => {
      window.removeEventListener('resize', measure);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [ref, minHeight]);

  return height;
}
