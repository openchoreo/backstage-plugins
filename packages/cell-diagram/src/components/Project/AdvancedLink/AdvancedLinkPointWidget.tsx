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
