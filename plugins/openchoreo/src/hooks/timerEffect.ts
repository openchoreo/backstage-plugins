import { useEffect, useRef } from 'react';

export function useTimerEffect(
  callback: () => void,
  delay: number,
  dependencies: any[],
) {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    tick();
    if (delay > 0) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, ...dependencies]);
}
