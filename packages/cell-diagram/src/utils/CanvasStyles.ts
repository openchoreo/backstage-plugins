import { createStyles, makeStyles } from "@material-ui/core/styles";
import styled from "@emotion/styled";

import { MAIN_CELL } from "../resources";

/**
 * Structural styles for the SVG canvas wrapper. Kept on MUI v4 `makeStyles`
 * because it carries no theme-dependent values; the call-sites use the
 * `canvas` class to size the canvas.
 */
export const useStyles = makeStyles(() =>
    createStyles({
        canvas: {
            height: "100%",
            width: "100%",
        },
    })
);

export const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    font-family: "GilmerRegular";

    &.preview-mode {
        padding: 10px;
        background-image: radial-gradient(${({ theme }) => theme.colors.SURFACE_CONTAINER} 10%, transparent 0px);
        background-size: 8px 8px;
        background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
        overflow: hidden;
        border-radius: 8px;
        cursor: pointer ;
        border: 1px solid ${({ theme }) => theme.colors.SURFACE_CONTAINER};
    }
`;

export const DiagramContainer = styled.div`
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    width: 100%;
    background-image: radial-gradient(${({ theme }) => theme.colors.SURFACE_CONTAINER} 10%, transparent 0px);
    background-size: 16px 16px;
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT};
    svg:not(:root) {
        overflow: visible;
    }
    [data-nodeid="${MAIN_CELL}"] {
        pointer-events: none;
    }

    &.preview-mode {
        background-size: 8px 8px;
        padding: 5px;
        .cell-diagram-canvas {
            cursor: pointer ;
        }
    }
`;
