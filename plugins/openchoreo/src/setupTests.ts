import '@testing-library/jest-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  (window as any).IS_REACT_ACT_ENVIRONMENT = true;
}
if (typeof global !== 'undefined') {
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;
}


const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Could not parse CSS stylesheet') ||
      args[0].includes('css parsing') ||
      args[0].includes('not configured to support act'))
  ) {
    return;
  }
  if (
    args[0] &&
    typeof args[0] === 'object' &&
    (args[0].message?.includes('Could not parse CSS stylesheet') ||
      args[0].type === 'css parsing' ||
      args[0].message?.includes('not configured to support act'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
