import { ComponentType } from 'react';
import { GridSize } from '@material-ui/core';

/**
 * A predefined home page card. Cards are registered once in the card
 * registry and referenced by id from named layout configs, so a future
 * "edit home page" experience can let users pick from the same set.
 */
export interface HomeCardDefinition {
  /** Stable identifier referenced by layout configs. */
  id: string;
  /** Human-readable name, for the upcoming card picker UI. */
  title: string;
  /** Short description of what the card shows, for the card picker UI. */
  description: string;
  /** The card content. Rendered inside a grid slot sized by the layout. */
  component: ComponentType;
  /**
   * Optional visibility hook (e.g. a permission check). Called as a React
   * hook from the card slot, so it must follow the rules of hooks. When it
   * returns false the card (and its grid slot) is not rendered.
   */
  useVisibility?: () => boolean;
}

/** Placement of a card within a home layout config. */
export interface HomeCardPlacement {
  /** Id of a card in the registry. Unknown ids are skipped. */
  cardId: string;
  /** Material-UI grid column widths for the card's slot. */
  size: {
    xs?: GridSize;
    md?: GridSize;
  };
}

/** A named, ordered home page layout built from predefined cards. */
export interface HomeCardConfig {
  name: string;
  cards: HomeCardPlacement[];
}
