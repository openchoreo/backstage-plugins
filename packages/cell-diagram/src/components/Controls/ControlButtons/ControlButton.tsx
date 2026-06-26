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

import { ReactNode } from "react";
import Tooltip from "@mui/material/Tooltip";
import { ControlIconButton } from "./style";

interface ControlButtonProps {
    children: ReactNode;
    onClick: () => void;
    tooltipTitle: string;
    tooltipPlacement?: "left-end" | "right-end" | "top-start";
}

export function CanvasControlButton(props: ControlButtonProps) {
    const { children, onClick, tooltipTitle, tooltipPlacement = "left-end" } = props;

    return (
        <Tooltip
            arrow
            placement={tooltipPlacement}
            title={tooltipTitle}
            enterNextDelay={200}
            componentsProps={{
                tooltip: {
                    sx: {
                        fontFamily: "GilmerRegular",
                        fontSize: "12px",
                        padding: "6px 10px",
                    },
                },
            }}
            PopperProps={{
                modifiers: [
                    {
                        name: "offset",
                        options: {
                            offset: [0, -10],
                        },
                    },
                ],
            }}
        >
            <ControlIconButton
                size="small"
                onClick={onClick}
                sx={{
                    cursor: "pointer",
                }}
            >
                {children}
            </ControlIconButton>
        </Tooltip>
    );
}
