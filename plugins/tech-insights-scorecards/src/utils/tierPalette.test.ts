import { createTheme, getContrastRatio } from '@material-ui/core/styles';
import { getFilledTierColors, getTierColor } from './tierPalette';

const themes = {
  light: createTheme({
    palette: { type: 'light', background: { paper: '#ffffff' } },
  }),
  dark: createTheme({
    palette: { type: 'dark', background: { paper: '#1a1d26' } },
  }),
};

describe.each(Object.entries(themes))('tier colours, %s', (_name, theme) => {
  it.each([0, 1, 2, 3])('tier %d reads at AA on paper', rank => {
    expect(
      getContrastRatio(
        getTierColor(rank, theme),
        theme.palette.background.paper,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([0, 1, 2, 3])('a filled tier %d chip reads at AA', rank => {
    const { background, text } = getFilledTierColors(rank, theme);
    expect(getContrastRatio(background, text)).toBeGreaterThanOrEqual(4.5);
  });
});
