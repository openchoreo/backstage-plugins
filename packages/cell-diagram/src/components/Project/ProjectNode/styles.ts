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
import { LABEL_FONT_SIZE, LABEL_MAX_WIDTH } from "../../../resources";

export const ProjectNode = styled.div<any>`
    color: ${({ theme }) => theme.colors.ON_SURFACE_VARIANT};
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
    padding: 2px;
    pointer-events: all;
    &:active {
        cursor: grabbing;
    }
`;

interface ProjectNodeStyleProps {
    id: string;
    height: number;
    borderWidth: number;
    isSelected?: boolean;
}

export const ProjectCellNode = styled.div<ProjectNodeStyleProps>`
    width: ${(props: ProjectNodeStyleProps) => props.height}px;
    height: ${(props: ProjectNodeStyleProps) => props.height}px;

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
        stroke: ${({ theme, isSelected }) => (isSelected ? theme.colors.SECONDARY : theme.colors.ON_SURFACE)};
        stroke-width: ${(props: ProjectNodeStyleProps) => props.borderWidth};
        fill: ${({ theme, isSelected }) =>
            isSelected ? theme.colors.SECONDARY_CONTAINER : theme.colors.SURFACE};
        pointer-events: none;
    }
`;

export const ProjectName: React.FC<any> = styled.span`
    font-size: ${LABEL_FONT_SIZE}px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    /* max-width: ${LABEL_MAX_WIDTH}px; */
    &:hover {
        color: ${({ theme, isClickable }: { theme: any; isClickable?: boolean }) =>
            isClickable ? theme.colors.PRIMARY_HOVER : ``};
        text-decoration: ${(props: { isClickable?: boolean }) => (props.isClickable ? `underline` : ``)};
    }
`;

export const TopArrowContainer = styled.div`
    position: absolute;
    top: 0;
`;
