import { Chip } from '@material-ui/core';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import { getKindLabel, getKindPalette } from './kindPalette';

/** A small colored chip identifying an item's kind (Component, Resource, …). */
export const KindCell = ({ kind }: { kind: string }) => {
  const tokens = useChoreoTokens();
  const { fg, bg } = getKindPalette(kind, tokens);

  return (
    <Chip
      size="small"
      label={getKindLabel(kind)}
      style={{ backgroundColor: bg, color: fg, fontWeight: 600 }}
    />
  );
};
