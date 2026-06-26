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

import { AdvancedLinkModel } from "./AdvancedLinkModel";
import { AdvancedLinkWidget } from "./AdvancedLinkWidget";
import styled from "@emotion/styled";
import { AbstractReactFactory } from "@projectstorm/react-canvas-core";
import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import { keyframes } from "@emotion/react";

namespace S {
    export const Keyframes = keyframes`
		from {
			stroke-dashoffset: 24;
		}
		to {
			stroke-dashoffset: 0;
		}
	`;

    export const Path = styled.path`
        fill: none;
        pointer-events: auto;
    `;
}

export class AdvancedLinkFactory<Link extends AdvancedLinkModel = AdvancedLinkModel> extends AbstractReactFactory<Link, DiagramEngine> {
    constructor(type = "default-2") {
        super(type);
    }

    generateReactWidget(event: { model: AdvancedLinkModel }): JSX.Element {
        return <AdvancedLinkWidget link={event.model} diagramEngine={this.engine} />;
    }

    generateModel(): Link {
        return new AdvancedLinkModel() as Link;
    }

    generateLinkSegment(model: Link, selected: boolean, path: string, showArrow?: boolean) {
        return (
            <g>
                <S.Path
                    // selected={selected}
                    stroke={selected ? model.getOptions().selectedColor : model.getOptions().color}
                    strokeWidth={model.getOptions().width}
                    d={path}
                    markerEnd={showArrow ? `url(#arrow-head-${model.getID()})` :""}
                />
                <defs>
                    <marker
                        id={`arrow-head-${model.getID()}`}
                        markerWidth="5"
                        markerHeight="5"
                        markerUnits="strokeWidth"
                        refX="5"
                        refY="2.5"
                        viewBox="0 0 5 5"
                        orient="auto"
                    >
                        <polygon
                            points="0,5 0,0 5,2.5"
                            fill={selected ? model.getOptions().selectedColor : model.getOptions().color}
                         />
                    </marker>
                </defs>
            </g>
        );
    }
}
