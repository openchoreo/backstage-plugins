/*
 * Copyright (c) 2025, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import styled from "@emotion/styled";
import { CIRCLE_WIDTH, DOT_WIDTH, CELL_LINE_MIN_WIDTH } from "../../../resources";

interface StyleProps {
    isSelected?: boolean;
    isClickable?: boolean;
    isCollapsed?: boolean;
    isFocused?: boolean;
    height?: number;
    borderWidth: number;
}

export const CellNode = styled.div<StyleProps>`
    width: ${(props: StyleProps) => props.height}px;
    height: ${(props: StyleProps) => props.height}px;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;
    position: relative;
    overflow: visible;
    pointer-events: none;

    #mainCell svg {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }

    #mainCell path {
        stroke: ${({ theme }) => theme.colors.OUTLINE};
        stroke-width: ${(props: StyleProps) => props.borderWidth};
        fill: none;
        pointer-events: none;
    }
`;

interface ElementProps {
    show: boolean;
}


export const Circle = styled.div<ElementProps>`
    visibility: ${(props: ElementProps) => (props.show ? "unset" : "hidden")};
    width: ${CIRCLE_WIDTH}px;
    height: ${CIRCLE_WIDTH}px;
    border-radius: 50%;
    border: ${CELL_LINE_MIN_WIDTH}px solid ${({ theme }) => theme.colors.OUTLINE};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: ${({ theme }) => theme.colors.SURFACE};
`;

export const Dot = styled.div<any>`
    width: ${DOT_WIDTH}px;
    height: ${DOT_WIDTH}px;
    border-radius: 50%;
    border: ${CELL_LINE_MIN_WIDTH}px solid ${({ theme }) => theme.colors.OUTLINE};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: ${({ theme }) => theme.colors.SURFACE_DIM};
`;

export const TopPortCircle: React.FC<any> = styled(Circle)`
    position: absolute;
    top: -${CIRCLE_WIDTH / 2}px;
    left: 50% - ${CIRCLE_WIDTH / 2}px;
`;

export const LeftPortCircle: React.FC<any> = styled(Circle)`
    position: absolute;
    top: 50% - ${CIRCLE_WIDTH / 2}px;
    left: -${CIRCLE_WIDTH / 2}px;
`;

export const RightPortCircle: React.FC<any> = styled(Dot)`
    position: absolute;
    top: 50% - ${DOT_WIDTH / 2 + CELL_LINE_MIN_WIDTH}px;
    right: -${DOT_WIDTH / 2 + CELL_LINE_MIN_WIDTH}px;
`;

export const BottomPortsWrapper: React.FC<any> = styled.div`
    position: absolute;
    bottom: -${DOT_WIDTH / 2 + CELL_LINE_MIN_WIDTH}px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: ${CIRCLE_WIDTH}px;
`;

export const RightPortsWrapper: React.FC<any> = styled.div`
    position: absolute;
    right: -${DOT_WIDTH / 2 + CELL_LINE_MIN_WIDTH}px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${CIRCLE_WIDTH}px;
`;

export const DotWrapper: React.FC<any> = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
`;

export const Label: React.FC<any> = styled.div`
    margin-top: 10px;
`;

export const PortLabel: React.FC<any> = styled.div`
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: "GilmerMedium";
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    font-size: 20px;
    span {
        text-align: left;
        width: max-content;
    }
`;

export const TopPortLabel: React.FC<any> = styled(PortLabel)`
    top: -24px;
    right: -116px;
`;

export const LeftPortLabel: React.FC<any> = styled(PortLabel)`
    top: -24px;
    left: -116px;
    align-items: flex-end;
    span {
        text-align: right;
    }
`;

export const RightPortLabel: React.FC<any> = styled(PortLabel)`
    top: -32px;
    right: -116px;
`;

export const BottomPortLabel: React.FC<any> = styled(PortLabel)`
    bottom: -36px;
    left: -132px;
    align-items: flex-end;
    span {
        text-align: right;
    }
`;

export const IconWrapper: React.FC<any> = styled.div`
    height: 32px;
    width: 32px;
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    font-size: 28px;
`;

export const TopIconWrapper: React.FC<any> = styled.div`
    height: 32px;
    width: 32px;
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    font-size: 28px;
    transform: rotate(90deg);
`;
