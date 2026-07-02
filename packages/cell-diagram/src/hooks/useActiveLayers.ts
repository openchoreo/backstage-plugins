import { useState } from 'react';
import { DiagramLayer } from '../types';

interface ActiveLayersHookProps {
  defaultDiagramLayer?: DiagramLayer;
}

export const useActiveLayers = (props: ActiveLayersHookProps) => {
  const [activeLayers, setActiveLayers] = useState<DiagramLayer[]>([
    props.defaultDiagramLayer as DiagramLayer,
  ]);

  const addLayer = (layer: DiagramLayer) => {
    if (!activeLayers.includes(layer)) {
      setActiveLayers(prev => [...prev, layer]);
    }
  };

  const removeLayer = (layer: DiagramLayer) => {
    if (activeLayers.length > 1) {
      // Don't allow removing the last layer
      setActiveLayers(activeLayers.filter(l => l !== layer));
    }
  };

  const setLayer = (layer: DiagramLayer) => {
    setActiveLayers([layer]);
  };

  const hasLayer = (layer: DiagramLayer) => {
    return activeLayers.includes(layer);
  };

  return { activeLayers, addLayer, removeLayer, setLayer, hasLayer };
};
