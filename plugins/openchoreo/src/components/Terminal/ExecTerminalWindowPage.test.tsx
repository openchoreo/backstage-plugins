import { render, screen } from '@testing-library/react';
import { ExecTerminalWindowPage } from './ExecTerminalWindowPage';

// Stub the terminal viewer so the test exercises ExecTerminalWindowPage's param
// parsing / EntityProvider / URL-strip logic without the exec session machinery.
jest.mock(
  '../Environments/ReleaseDataRenderer/ResourceTreeView/ResourcePodTerminalViewer',
  () => ({
    ResourcePodTerminalViewer: (props: {
      podName?: string;
      containers?: string[];
      initialContainer?: string;
      autoConnect?: boolean;
      fullWindow?: boolean;
      execContext: {
        componentName: string;
        environmentName: string;
        entityRef: string;
      };
    }) => (
      <div
        data-testid="terminal-viewer"
        data-pod={props.podName}
        data-containers={(props.containers ?? []).join(',')}
        data-initial={props.initialContainer}
        data-auto={String(props.autoConnect)}
        data-full={String(props.fullWindow)}
        data-component={props.execContext.componentName}
        data-env={props.execContext.environmentName}
        data-entityref={props.execContext.entityRef}
      />
    ),
  }),
);

function setSearch(search: string) {
  window.history.replaceState(null, '', `/exec-terminal${search}`);
}

describe('ExecTerminalWindowPage', () => {
  it('renders the terminal from URL params and strips the query string', () => {
    setSearch(
      '?ns=default&project=default&component=greeter-service&env=development' +
        '&envLabel=Development&entityRef=component:default/greeter-service' +
        '&pod=greeter-0&containers=main,sidecar&container=sidecar',
    );

    render(<ExecTerminalWindowPage />);

    const viewer = screen.getByTestId('terminal-viewer');
    expect(viewer.getAttribute('data-component')).toBe('greeter-service');
    expect(viewer.getAttribute('data-env')).toBe('development');
    expect(viewer.getAttribute('data-entityref')).toBe(
      'component:default/greeter-service',
    );
    expect(viewer.getAttribute('data-pod')).toBe('greeter-0');
    expect(viewer.getAttribute('data-containers')).toBe('main,sidecar');
    expect(viewer.getAttribute('data-initial')).toBe('sidecar');
    expect(viewer.getAttribute('data-auto')).toBe('true');
    expect(viewer.getAttribute('data-full')).toBe('true');

    // Params captured in state, then cleared from the address bar.
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/exec-terminal');
  });

  it('shows a message when required params are missing', () => {
    setSearch('?ns=default'); // missing project / component / env / entityRef
    render(<ExecTerminalWindowPage />);

    expect(screen.queryByTestId('terminal-viewer')).toBeNull();
    expect(screen.getByText(/Missing terminal parameters/i)).toBeTruthy();
  });

  it('treats a malformed entityRef as missing params', () => {
    setSearch(
      '?ns=default&project=default&component=greeter-service&env=development' +
        '&entityRef=not-a-valid-ref',
    );
    render(<ExecTerminalWindowPage />);

    expect(screen.queryByTestId('terminal-viewer')).toBeNull();
    expect(screen.getByText(/Missing terminal parameters/i)).toBeTruthy();
  });
});
