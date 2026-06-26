import styled from "@emotion/styled";
import IconButton from "@mui/material/IconButton";

/**
 * Themed IconButton used by `CanvasControlButton`. Background and border are
 * pulled from the active cell-diagram theme so the canvas controls match
 * dark mode automatically.
 */
export const ControlIconButton: React.FC<any> = styled(IconButton)`
    background-color: ${({ theme }) => theme.colors.SURFACE_BRIGHT} !important;
    border: 1px solid ${({ theme }) => theme.colors.SURFACE_DIM} !important;
    border-radius: 2px !important;
    height: 32px !important;
    width: 32px !important;
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};

    & svg {
        height: 20px;
        width: 20px;
    }
`;
