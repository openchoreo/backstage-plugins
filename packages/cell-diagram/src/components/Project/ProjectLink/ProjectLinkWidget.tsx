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

import { MouseEvent, useEffect, useState } from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ProjectLinkModel } from "./ProjectLinkModel";
import { PROJECT_LINK } from "../../../resources";
import { SharedLink } from "../../SharedLink/SharedLink";
import { useColors } from "../../../theme";

interface WidgetProps {
    engine: DiagramEngine;
    link: ProjectLinkModel;
}

export function ProjectLinkWidget(props: WidgetProps) {
    const { link } = props;
    const colors = useColors();

    const [isSelected, setIsSelected] = useState<boolean>(false);

    useEffect(() => {
        const listener = link.registerListener({
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            SELECT: selectPath,
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            UNSELECT: unselectPath,
        });
        return () => {
            link.deregisterListener(listener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [link]);

    const selectPath = () => {
        setIsSelected(true);
        link.selectLinkedNodes();
    };

    const unselectPath = () => {
        setIsSelected(false);
        link.resetLinkedNodes();
    };

    const handleMouseOver = (event: MouseEvent<SVGGElement, globalThis.MouseEvent>) => {
        event.stopPropagation();
        selectPath();
        // setAnchorEl(event.currentTarget);
    };

    const handleMouseLeave = (event: MouseEvent<SVGGElement, globalThis.MouseEvent>) => {
        event.stopPropagation();
        unselectPath();
        // setAnchorEl(null);
    };

    const strokeColor = () => {
        if (isSelected) {
            return colors.SECONDARY;
        }

        return colors.ON_SURFACE_VARIANT;
    };

    // const midPoint = link.getMidPoint();

    return (
        <>
            <g
                onMouseOver={handleMouseOver}
                onMouseLeave={handleMouseLeave}
                pointerEvents="all"
                className={PROJECT_LINK}
            >
                <defs>
                    <marker
                        id={link.getLinkArrowId()}
                        markerWidth="5"
                        markerHeight="5"
                        markerUnits="strokeWidth"
                        refX="5"
                        refY="2.5"
                        viewBox="0 0 5 5"
                        orient="auto"
                    >
                        <polygon points="0,5 0,0 5,2.5" fill={strokeColor()} />
                    </marker>
                </defs>
                <path d={link.getCurvePath()} fill="none" stroke="transparent" strokeWidth={40} />
                <SharedLink.Path
                    selected={isSelected}
                    id={link.getID()}
                    d={link.getCurvePath()}
                    fill="none"
                    stroke={strokeColor()}
                    strokeWidth={2}
                    markerEnd={`url(#${  link.getLinkArrowId()  })`}
                />
            </g>
        </>
    );
}
