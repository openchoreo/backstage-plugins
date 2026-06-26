// Import the font files so the bundler (backstage-cli's forwardFileImports /
// the host app's loader) copies them to the output and gives us their final
// resolved URLs. Building the @font-face rules from these imported URLs — rather
// than from a static CSS file with relative url()s — guarantees the fonts load
// regardless of where the consuming app serves the bundle from.
import GilmerRegularWoff2 from "./Gilmer-Regular.woff2";
import GilmerRegularWoff from "./Gilmer-Regular.woff";
import GilmerRegularTtf from "./Gilmer-Regular.ttf";
import GilmerMediumWoff2 from "./Gilmer-Medium.woff2";
import GilmerMediumWoff from "./Gilmer-Medium.woff";
import GilmerMediumTtf from "./Gilmer-Medium.ttf";
import GilmerBoldWoff2 from "./Gilmer-Bold.woff2";
import GilmerBoldWoff from "./Gilmer-Bold.woff";
import GilmerBoldTtf from "./Gilmer-Bold.ttf";

const FONT_FACE_CSS = `
@font-face {
    font-family: 'GilmerRegular';
    src:
        url('${GilmerRegularWoff2}') format('woff2'),
        url('${GilmerRegularWoff}') format('woff'),
        url('${GilmerRegularTtf}') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'GilmerMedium';
    src:
        url('${GilmerMediumWoff2}') format('woff2'),
        url('${GilmerMediumWoff}') format('woff'),
        url('${GilmerMediumTtf}') format('truetype');
    font-weight: 600;
    font-style: normal;
}

@font-face {
    font-family: 'GilmerBold';
    src:
        url('${GilmerBoldWoff2}') format('woff2'),
        url('${GilmerBoldWoff}') format('woff'),
        url('${GilmerBoldTtf}') format('truetype');
    font-weight: 700;
    font-style: normal;
}
`;

const STYLE_ELEMENT_ID = "cell-diagram-fonts";

/**
 * Inject the Gilmer @font-face declarations once into the document head.
 * Safe to call multiple times and in non-DOM environments (no-op there).
 */
export function ensureFontsLoaded(): void {
    if (typeof document === "undefined") {
        return;
    }
    if (document.getElementById(STYLE_ELEMENT_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent = FONT_FACE_CSS;
    document.head.appendChild(style);
}
