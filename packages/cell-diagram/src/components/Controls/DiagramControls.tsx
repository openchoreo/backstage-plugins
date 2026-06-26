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

import { FC, useEffect, useRef } from "react";
import { FullScreenIcon, FitScreenIcon, AddIcon, RemoveIcon, RefreshIcon } from "../../resources/assets/icons";
import styled from "@emotion/styled";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { CanvasControlButton } from "./ControlButtons/ControlButton";
import gsap from "gsap";

interface ControlProps {
    engine: DiagramEngine;
    animation?: boolean;
    refreshDiagram?: () => void;
}

export const ControlPanel: FC<any> = styled.div`
    bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    justify-content: space-between;
    position: absolute;
    right: 15px;
    width: 32px;
`;

export function DiagramControls(props: ControlProps) {
    const { engine, animation = true, refreshDiagram } = props;
    const controlPanelRef = useRef(null);

    useEffect(() => {
        if (animation) {
            gsap.fromTo(
                controlPanelRef.current,
                { scale: 0 },
                {
                    scale: 1,
                    duration: 1,
                    ease: "power3.out",
                    delay: 1,
                }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onZoom = (zoomIn: boolean) => {
        const delta: number = zoomIn ? +5 : -5;
        engine.getModel().setZoomLevel(engine.getModel().getZoomLevel() + delta);
        engine.repaintCanvas();
    };

    const zoomToFit = () => {
        engine.zoomToFitNodes({ margin: 10, maxZoom: 1 });
    };

    const zoomToActualSize = () => {
        engine.getModel().setZoomLevel(100);
        engine.repaintCanvas();
    };

    return (
        <ControlPanel ref={controlPanelRef}>
            {refreshDiagram && (
                <CanvasControlButton onClick={refreshDiagram} tooltipTitle="Refresh">
                    <RefreshIcon />
                </CanvasControlButton>
            )}

            <CanvasControlButton onClick={zoomToFit} tooltipTitle="Zoom to fit nodes">
                <FullScreenIcon />
            </CanvasControlButton>

            <CanvasControlButton onClick={zoomToActualSize} tooltipTitle="Zoom to actual size">
                <FitScreenIcon />
            </CanvasControlButton>

            <div>
                <CanvasControlButton
                    onClick={() => {
                        onZoom(true);
                    }}
                    tooltipTitle="Zoom in"
                >
                    <AddIcon />
                </CanvasControlButton>

                <CanvasControlButton
                    onClick={() => {
                        onZoom(false);
                    }}
                    tooltipTitle="Zoom out"
                >
                    <RemoveIcon />
                </CanvasControlButton>
            </div>
        </ControlPanel>
    );
}
