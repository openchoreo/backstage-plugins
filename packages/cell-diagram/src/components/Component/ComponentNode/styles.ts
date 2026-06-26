import styled from "@emotion/styled";
import { Theme } from "@emotion/react";
import { COMPONENT_CIRCLE_WIDTH, ICON_SCALE, LABEL_FONT_SIZE, LABEL_MAX_WIDTH } from "../../../resources";

interface ComponentNodeStyleProps {
    previewMode: boolean;
}
export const ComponentNode = styled.div<ComponentNodeStyleProps>`
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: ${COMPONENT_CIRCLE_WIDTH * 2}px;
    gap: 10px;
    padding: 2px;
    pointer-events: all;
    cursor: ${(props: ComponentNodeStyleProps) => (props.previewMode ? "pointer" : "grab")};
    &:active {
        cursor: ${(props: ComponentNodeStyleProps) => (props.previewMode ? "pointer" : "grabbing")};
    }
`;

interface ComponentHeadStyleProps {
    isSelected: boolean;
    borderWidth: number;
    disabled: boolean;
}

const getComponentHeadBorderColor = ({
    theme,
    disabled,
    isSelected,
}: Pick<ComponentHeadStyleProps, "disabled" | "isSelected"> & { theme: Theme }) => {
    if (disabled) {
        return theme.colors.SURFACE_DIM;
    }
    if (isSelected) {
        return theme.colors.SECONDARY;
    }
    return theme.colors.PRIMARY;
};

export const ComponentHead = styled.div<ComponentHeadStyleProps>`
    background-color: ${({ theme, disabled, isSelected }) =>
        !disabled && isSelected ? theme.colors.SECONDARY_CONTAINER : theme.colors.SURFACE};
    border: ${({ theme, borderWidth, disabled, isSelected }) =>
        `${borderWidth}px solid ${getComponentHeadBorderColor({ theme, disabled, isSelected })}`};
    border-radius: 50%;
    height: ${COMPONENT_CIRCLE_WIDTH}px;
    width: ${COMPONENT_CIRCLE_WIDTH}px;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;

    position: relative;
`;

export const ComponentKind = styled.div`
    background-color: ${({ theme }) => theme.colors.SURFACE};
    border-radius: 50%;

    height: ${COMPONENT_CIRCLE_WIDTH / 3}px;
    width: ${COMPONENT_CIRCLE_WIDTH / 3}px;

    position: relative;
    bottom: -16px;
    right: 44px;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    padding: 4px;
`;

interface ComponentNameStyleProps {
    disabled: boolean;
}
export const ComponentName = styled.span<ComponentNameStyleProps>`
    font-size: ${LABEL_FONT_SIZE}px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    max-width: ${LABEL_MAX_WIDTH}px;
    color: ${({ theme, disabled }) => (disabled ? theme.colors.SURFACE_DIM : theme.colors.ON_SURFACE_VARIANT)};
`;

interface IconWrapperStyleProps {
    previewMode: boolean;
    disabled: boolean;
}
export const IconWrapper = styled.div<IconWrapperStyleProps>`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;

    color: ${({ theme, disabled }) => (disabled ? theme.colors.SURFACE_DIM : theme.colors.PRIMARY)};
    font-size: 32px;

    svg {
        fill: ${({ theme, disabled }) => (disabled ? theme.colors.SURFACE_DIM : theme.colors.PRIMARY)};
        height: 32px;
        width: 32px;
        transform: ${({ previewMode }) => (previewMode ? `scale(${ICON_SCALE.PREVIEW})` : "none")};
    }
`;

export const PortsContainer = styled.div`
    display: flex;
    justify-content: center;
`;
