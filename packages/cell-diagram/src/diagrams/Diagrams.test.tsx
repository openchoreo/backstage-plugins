import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { ReactNode } from 'react';
import { CellDiagramThemeProvider } from '../theme';
import { ComponentType, Organization, Project } from '../types';
import { MAIN_CELL, PROJECT_NODE } from '../resources';
import { RevealClass } from '../utils/animations';
import { ProjectDiagram } from './ProjectDiagram';
import { OrgDiagram } from './OrgDiagram';

// react-diagrams observes node size on mount; jsdom has no ResizeObserver and
// the polyfill's CommonJS build has no `default` export for the bundle to use
jest.mock('resize-observer-polyfill', () => ({
  __esModule: true,
  default: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
}));

const project: Project = {
  id: 'A',
  name: 'A',
  components: [
    {
      id: 'User Service',
      version: '0.2.0',
      type: ComponentType.SERVICE,
      services: {},
      connections: [],
    },
  ],
  modelVersion: '0.4.0',
};

const organization: Organization = {
  id: 'A',
  name: 'A',
  projects: [{ id: '1234', name: 'Project A', components: [] }],
  modelVersion: '0.4.0',
};

function Wrapper({ children }: { children: ReactNode }) {
  return <CellDiagramThemeProvider>{children}</CellDiagramThemeProvider>;
}

/** Advances past the diagram's load timer so the reveal effect runs. */
function finishLoading() {
  act(() => {
    jest.advanceTimersByTime(1100);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProjectDiagram', () => {
  it('reveals the main cell once the diagram has loaded', () => {
    const { container } = render(<ProjectDiagram project={project} />, {
      wrapper: Wrapper,
    });
    finishLoading();

    const cell = container.querySelector(`div[data-nodeid="${MAIN_CELL}"]`);
    expect(cell).toHaveClass(RevealClass.SCALE);
  });

  it('does not add reveal classes when animation is off', () => {
    const { container } = render(
      <ProjectDiagram project={project} animation={false} />,
      { wrapper: Wrapper },
    );
    finishLoading();

    expect(
      container.querySelector(`div[data-nodeid="${MAIN_CELL}"]`),
    ).not.toHaveClass(RevealClass.SCALE);
  });
});

describe('OrgDiagram', () => {
  it('reveals the project nodes once the diagram has loaded', () => {
    const { container } = render(<OrgDiagram organization={organization} />, {
      wrapper: Wrapper,
    });
    finishLoading();

    const node = container.querySelector(
      `div[data-nodeid^="${PROJECT_NODE}|"]`,
    );
    expect(node).toHaveClass(RevealClass.SCALE_HALF);
  });

  it('does not add reveal classes when animation is off', () => {
    const { container } = render(
      <OrgDiagram organization={organization} animation={false} />,
      { wrapper: Wrapper },
    );
    finishLoading();

    expect(
      container.querySelector(`div[data-nodeid^="${PROJECT_NODE}|"]`),
    ).not.toHaveClass(RevealClass.SCALE_HALF);
  });
});
