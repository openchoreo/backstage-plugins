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

import { useContext, useEffect, useState } from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ExternalLinkModel } from "./ExternalLinkModel";
import { EXTERNAL_LINK, LINK_WIDTH } from "../../../resources";
import { DiagramContext } from "../../DiagramContext/DiagramContext";
import { useColors } from "../../../theme";

interface WidgetProps {
    engine: DiagramEngine;
    link: ExternalLinkModel;
}

export function ExternalLinkWidget(props: WidgetProps) {
    const { link } = props;
    const colors = useColors();

    const [isSelected, setIsSelected] = useState<boolean>(false);
    const { previewMode } = useContext(DiagramContext);

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

    return (
        <g className={EXTERNAL_LINK}>
            <defs>
                <marker
                    id={link.getLinkArrowId()}
                    markerWidth="8"
                    markerHeight="8"
                    markerUnits="strokeWidth"
                    refX="4"
                    refY="3"
                    viewBox="0 0 6 6"
                    orient="auto"
                >
                    <polygon points="0,6 0,0 5,3" fill={isSelected ? colors.SECONDARY : colors.OUTLINE} />
                </marker>
            </defs>
            <path
                id={link.getID()}
                d={link.withRightOffset ? link.getCurvePathWithOffset() : link.getCurvePath()}
                fill="none"
                stroke={isSelected ? colors.SECONDARY : colors.OUTLINE}
                strokeWidth={previewMode ? LINK_WIDTH.PREVIEW : LINK_WIDTH.DEFAULT}
                markerEnd={`url(#${  link.getLinkArrowId()  })`}
            />
        </g>
    );
}
