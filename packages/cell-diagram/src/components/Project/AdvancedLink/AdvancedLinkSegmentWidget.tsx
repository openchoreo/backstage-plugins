import { cloneElement, Component, RefObject } from "react";
import { AdvancedLinkFactory } from "./AdvancedLinkFactory";
import { DiagramEngine } from "@projectstorm/react-diagrams-core";
import { AdvancedLinkModel } from "./AdvancedLinkModel";

export interface AdvancedLinkSegmentWidgetProps {
    path: string;
    link: AdvancedLinkModel;
    selected: boolean;
    forwardRef: RefObject<SVGPathElement>;
    factory: AdvancedLinkFactory;
    diagramEngine: DiagramEngine;
    onSelection: (selected: boolean) => any;
    extras: object;
    showArrow?: boolean;
}

export class AdvancedLinkSegmentWidget extends Component<AdvancedLinkSegmentWidgetProps> {
    render() {
        const Bottom = cloneElement(
            this.props.factory.generateLinkSegment(
                this.props.link,
                this.props.selected,
                this.props.path,
                this.props.showArrow
            ),
            {
                ref: this.props.forwardRef,
            }
        );

        const Top = cloneElement(Bottom, {
            strokeLinecap: "round",
            onMouseLeave: () => {
                this.props.onSelection(false);
            },
            onMouseEnter: () => {
                this.props.onSelection(true);
            },
            ...this.props.extras,
            ref: null,
            "data-linkid": this.props.link.getID(),
            strokeOpacity: this.props.selected ? 0.1 : 0,
            strokeWidth: 20,
            fill: "none",
            onContextMenu: () => {
                if (!this.props.link.isLocked()) {
                    event?.preventDefault();
                    this.props.link.remove();
                }
            },
        });

        return (
            <g>
                {Bottom}
                {Top}
            </g>
        );
    }
}
