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

import { useContext } from "react";
import { DiagramEngine } from "@projectstorm/react-diagrams";
import { ComponentPortWidget } from "../../ComponentPort/ComponentPortWidget";
import { ComponentPortModel } from "../../ComponentPort/ComponentPortModel";
import { ComponentModel } from "../ComponentModel";
import { ComponentHead, ComponentKind, IconWrapper } from "../styles";
import { ComponentType } from "../../../../types";
import {
    WebAppIcon,
    ScheduledTaskIcon,
    ServiceIcon,
    ProxyIcon,
    EventIcon,
    AddCheckIcon,
    ManualTaskIcon,
    WebhookIcon,
    ExternalConsumerIcon,
    SettingsIcon
} from "../../../../resources/assets/icons";
import * as icons from "../../../../resources/assets/icons"; // import all icon SVGs as an object
import { MoreVertMenu } from "../../../MoreVertMenu/MoreVertMenu";
import { MoreVertMenuItem } from "../../../../types";
import { DiagramContext } from "../../../DiagramContext/DiagramContext";
import { COMPONENT_LINE_MIN_WIDTH, COMPONENT_LINE_PREVIEW_WIDTH } from "../../../../resources";

interface ServiceHeadProps {
    engine: DiagramEngine;
    node: ComponentModel;
    isSelected: boolean;
    isFocused: boolean;
    menuItems: MoreVertMenuItem[];
    onFocusOut?: () => void;
}

export function ComponentHeadWidget(props: ServiceHeadProps) {
    const { engine, node, isSelected, isFocused, menuItems, onFocusOut } = props;

    const { zoomLevel, previewMode } = useContext(DiagramContext);

    const isDisabled = Boolean(node.component.disabled?.status);
    const getComponentTypeIcon = (type: ComponentType) => {
        switch (type) {
            case ComponentType.API_PROXY:
                return <ProxyIcon />;
            case ComponentType.EVENT_HANDLER:
                return <EventIcon />;
            case ComponentType.MANUAL_TASK:
                return <ManualTaskIcon />;
            case ComponentType.SCHEDULED_TASK:
                return <ScheduledTaskIcon />;
            case ComponentType.SERVICE:
                return <ServiceIcon />;
            case ComponentType.TEST:
                return <AddCheckIcon />;
            case ComponentType.WEB_APP:
                return <WebAppIcon />;
            case ComponentType.WEB_HOOK:
                return <WebhookIcon />;
            case ComponentType.EXTERNAL_CONSUMER:
                return <ExternalConsumerIcon />;
            case ComponentType.SYSTEM_COMPONENT:
                return <SettingsIcon />;
            default:
                return <ServiceIcon />;
        }
    };

    const getComponentBuildIcon = (kind: string) => {
        const icon = (`${kind  }Icon`) as keyof typeof icons;
        const IconComponent = icons[icon] || icons.codeIcon;
        return <IconComponent />;
    };

    return (
        <ComponentHead
            isSelected={isSelected || isFocused}
            borderWidth={previewMode ? COMPONENT_LINE_PREVIEW_WIDTH : node.getDynamicLineWidth(zoomLevel, COMPONENT_LINE_MIN_WIDTH)}
            disabled={isDisabled}
        >
            <IconWrapper disabled={isDisabled} previewMode={Boolean(previewMode)}>
                {getComponentTypeIcon(node.component.type)}
            </IconWrapper>
            <ComponentPortWidget port={node.getPort(`left-${node.getID()}`) as ComponentPortModel} engine={engine} />
            <ComponentPortWidget port={node.getPort(`right-${node.getID()}`) as ComponentPortModel} engine={engine} />
            {node.component.buildPack && node.component.buildPack.toLowerCase() !== "other" && !previewMode && (
                <ComponentKind>{getComponentBuildIcon(node.component.buildPack)}</ComponentKind>
            )}
            {isFocused && menuItems?.length > 0 && !previewMode && (
                <MoreVertMenu
                    component={node.component}
                    menuItems={menuItems}
                    hasComponentKind={Boolean(node.component.buildPack && node.component.buildPack.toLowerCase() !== "other")}
                    onClose={onFocusOut}
                />
            )}
        </ComponentHead>
    );
}
