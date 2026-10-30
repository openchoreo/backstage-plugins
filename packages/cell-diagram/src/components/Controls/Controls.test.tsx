import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { ReactNode } from 'react';
import { DiagramEngine } from '@projectstorm/react-diagrams';
import { CellDiagramThemeProvider } from '../../theme';
import { DiagramLayer } from '../../types';
import { CellDiagramContext } from '../DiagramContext/DiagramContext';
import { DiagramControls } from './DiagramControls';
import { DiagramLayers } from './DiagramLayers';
import { DiagramLegend } from './DiagramLegend';
import { PANEL_REVEAL_CLASS } from '../../utils/animations';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <CellDiagramThemeProvider>
      <CellDiagramContext
        selectedNodeId=""
        focusedNodeId=""
        zoomLevel={1}
        defaultDiagramLayer={DiagramLayer.ARCHITECTURE}
        setSelectedNodeId={() => undefined}
        setFocusedNodeId={() => undefined}
      >
        {children}
      </CellDiagramContext>
    </CellDiagramThemeProvider>
  );
}

const engine = {
  getModel: () => ({
    getZoomLevel: () => 100,
    setZoomLevel: jest.fn(),
  }),
  repaintCanvas: jest.fn(),
  zoomToFitNodes: jest.fn(),
} as unknown as DiagramEngine;

/** Returns the panel element: the first child rendered into the container. */
function panelOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('canvas control panels reveal animation', () => {
  describe('DiagramControls', () => {
    it('animates in by default', () => {
      const { container } = render(<DiagramControls engine={engine} />, {
        wrapper: Wrapper,
      });
      expect(panelOf(container)).toHaveClass(PANEL_REVEAL_CLASS);
    });

    it('does not animate when disabled', () => {
      const { container } = render(
        <DiagramControls engine={engine} animation={false} />,
        { wrapper: Wrapper },
      );
      expect(panelOf(container)).not.toHaveClass(PANEL_REVEAL_CLASS);
    });

    it('still renders its buttons', () => {
      const { getAllByRole } = render(
        <DiagramControls engine={engine} refreshDiagram={() => undefined} />,
        { wrapper: Wrapper },
      );
      expect(getAllByRole('button')).toHaveLength(5);
    });
  });

  describe('DiagramLayers', () => {
    it('animates in by default', () => {
      const { container, getByText } = render(<DiagramLayers />, {
        wrapper: Wrapper,
      });
      expect(panelOf(container)).toHaveClass(PANEL_REVEAL_CLASS);
      expect(getByText('Static')).toBeInTheDocument();
    });

    it('does not animate when disabled', () => {
      const { container } = render(<DiagramLayers animation={false} />, {
        wrapper: Wrapper,
      });
      expect(panelOf(container)).not.toHaveClass(PANEL_REVEAL_CLASS);
    });
  });

  describe('DiagramLegend', () => {
    it('animates in by default', () => {
      const { container, getByText } = render(<DiagramLegend />, {
        wrapper: Wrapper,
      });
      expect(panelOf(container)).toHaveClass(PANEL_REVEAL_CLASS);
      expect(getByText('Only static dependency')).toBeInTheDocument();
    });

    it('does not animate when disabled', () => {
      const { container } = render(<DiagramLegend animation={false} />, {
        wrapper: Wrapper,
      });
      expect(panelOf(container)).not.toHaveClass(PANEL_REVEAL_CLASS);
    });
  });
});
