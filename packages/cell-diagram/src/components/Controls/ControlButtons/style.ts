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
