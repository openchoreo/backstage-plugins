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

import { Component } from "react";
import { PointModel } from "@projectstorm/react-diagrams-core";
import styled from "@emotion/styled";

export interface AdvancedLinkPointWidgetProps {
    point: PointModel;
    color?: string;
    colorSelected?: string;
}

export interface AdvancedLinkPointWidgetState {
    selected: boolean;
}

namespace S {
    export const PointTop = styled.circle`
        pointer-events: all;
    `;
}

export class AdvancedLinkPointWidget extends Component<AdvancedLinkPointWidgetProps, AdvancedLinkPointWidgetState> {
    constructor(props: AdvancedLinkPointWidgetProps | Readonly<AdvancedLinkPointWidgetProps>) {
        super(props);
        this.state = {
            selected: false,
        };
    }

    render() {
        const { point } = this.props;
        return (
            <g>
                <circle
                    cx={point.getPosition().x}
                    cy={point.getPosition().y}
                    r={0}
                />
                <S.PointTop
                    className="point"
                    onMouseLeave={() => {
                        this.setState({ selected: false });
                    }}
                    onMouseEnter={() => {
                        this.setState({ selected: true });
                    }}
                    data-id={point.getID()}
                    data-linkid={point.getLink().getID()}
                    cx={point.getPosition().x}
                    cy={point.getPosition().y}
                    r={15}
                    opacity={0.0}
                />
            </g>
        );
    }
}
