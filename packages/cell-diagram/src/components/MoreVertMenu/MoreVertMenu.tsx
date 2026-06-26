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

import { MouseEvent, useState } from "react";
import styled from "@emotion/styled";
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Component } from "../../types";
import { MoreVertMenuItem } from "../../types";

const IconStyles = styled.button`
    position: absolute;
    background-color: ${({ theme }) => theme.colors.SURFACE};
    margin-left: 68px;
    margin-bottom: 58px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    line-height: 0;
    border: 3px solid ${({ theme }) => theme.colors.SURFACE_DIM};
    transition: "transform 0.3s ease-in-out";
    cursor: pointer;
`;

interface MoreVertMenuProps {
    component: Component;
    menuItems: MoreVertMenuItem[];
    hasComponentKind?: boolean;
    onClose?: () => void;
}

export function MoreVertMenu(props: MoreVertMenuProps) {
    const { component, menuItems, onClose } = props;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const menuId = `menu-${  component.id}`;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        onClose && onClose();
    };

    return (
        <>
            <IconStyles
                aria-controls={open ? menuId : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}>
                <MoreVertIcon />
            </IconStyles>

            <Menu
                id={menuId}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                {menuItems.map((item) => (
                    <MenuItem key={`menu-item ${item.label}`} onClick={() => {
                        item.callback(component.id, component.version);
                        handleClose();
                    }}>{item.label}</MenuItem>
                ))}
            </Menu>
        </>
    );
}
