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

import { MouseEvent, useContext, useEffect, useRef, useState } from "react";
import Fade from '@mui/material/Fade';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { DiagramEngine, PortModel } from "@projectstorm/react-diagrams";
import { ProjectModel } from "./ProjectModel";
import { ProjectHeadWidget } from "./ProjectHeadWidget/ProjectHeadWidget";
import { ProjectName, ProjectNode } from "./styles";
import { DiagramContext } from "../../DiagramContext/DiagramContext";
import { useColors } from "../../../theme";

interface ProjectWidgetProps {
    node: ProjectModel;
    engine: DiagramEngine;
}

export function ProjectWidget(props: ProjectWidgetProps) {
    const { node, engine } = props;
    const colors = useColors();
    const { selectedNodeId, focusedNodeId, componentMenu, onComponentDoubleClick } = useContext(DiagramContext);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const headPorts = useRef<PortModel[]>([]);

    const displayName: string = node.project.name;

    useEffect(() => {
        headPorts.current.push(node.getPortFromID(`right-${node.getID()}`)!);
    }, [node]);

    const handleOnHover = (task: string) => {
        setIsHovered(task === "SELECT" ? true : false);
        node.handleHover(headPorts.current, task);
    };

    const handleOnWidgetDoubleClick = () => {
        if (onComponentDoubleClick) {
            onComponentDoubleClick(node.project.id);
        }
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        handleOnHover("SELECT");
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        handleOnHover("UNSELECT");
    };

    const handleOnContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <>
            <ProjectNode
                isSelected={node.getID() === selectedNodeId}
                isFocused={node.getID() === focusedNodeId}
                onMouseOver={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onDoubleClick={handleOnWidgetDoubleClick}
                onContextMenu={handleOnContextMenu}
            >
                <ProjectHeadWidget
                    engine={engine}
                    node={node}
                    isSelected={node.getID() === selectedNodeId}
                    isFocused={node.getID() === focusedNodeId || isHovered}
                    menuItems={componentMenu}
                />
                <Tooltip title={displayName} placement="bottom" enterNextDelay={500} arrow>
                    <ProjectName>{displayName}</ProjectName>
                </Tooltip>

                <Box sx={{ position: 'absolute', top: '26px', padding: '8px', cursor: 'pointer' }} onClick={handleOnWidgetDoubleClick}>
                    <Fade in={isHovered} timeout={350}>
                        <Tooltip title="View Project" placement="bottom" enterNextDelay={1000}>
                            <OpenInNewRoundedIcon sx={{ color: colors.OUTLINE_VARIANT, fontSize: 20 }} />
                        </Tooltip>
                    </Fade>
                </Box>
            </ProjectNode>
        </>
    );
}
