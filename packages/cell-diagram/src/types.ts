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
import {
    CellLinkModel,
    ComponentLinkModel,
    ComponentModel,
    ConnectionModel,
    EmptyModel,
    ExternalLinkModel,
    ExternalModel,
    ProjectModel,
} from "./components";
import { CellBounds } from "./components/Cell/CellNode/CellModel";
import { AdvancedLinkModel } from "./components/Project/AdvancedLink/AdvancedLinkModel";
import { BaseEvent } from "@projectstorm/react-canvas-core";

export interface Organization {
    id: string;
    name: string;
    projects: Project[];
    configurations?: Connection[];
    modelVersion: string;
}

export interface Project {
    id: string;
    name: string;
    components: Component[];
    connections?: OrgConnection[];
    configurations?: Connection[];
    modelVersion?: string;
}

export enum ComponentType {
    SERVICE = "service",
    WEB_APP = "web-app",
    SCHEDULED_TASK = "scheduled-task",
    MANUAL_TASK = "manual-task",
    API_PROXY = "api-proxy",
    WEB_HOOK = "web-hook",
    EVENT_HANDLER = "event-handler",
    TEST = "test",
    EXTERNAL_CONSUMER = "external-consumer",
    SYSTEM_COMPONENT = "system",
}


export type ExternalConsumerLinkSelectEvent = BaseEvent & {
    cellBound: CellBounds;
};

export interface Component {
    id: string;
    label?: string;
    version: string;
    type: ComponentType;
    buildPack?: string; // Component implemented language
    services: Services;
    connections: Connection[];
    disabled?: {
        status: boolean;
        reason?: string;
    };
}

export interface Services {
    [key: string]: Service;
}

export interface Service {
    id: string;
    label?: string;
    type: string;
    dependencyIds: string[];
    deploymentMetadata?: DeploymentMetadata;
}

export interface Connection {
    id: string;
    label?: string;
    type?: ConnectionType;
    onPlatform?: boolean;
    tooltip?: string;
    observations?: Observations[];
    observationOnly?: boolean;
}

export enum ConnectionType {
    HTTP = "http",
    GRPC = "grpc",
    WebSocket = "web-socket",
    Connector = "connector",
    Datastore = "datastore",
}

export interface ProjectGateway {
    projectId: string;
    boundary: CellBounds;
}

export interface OrgConnection {
    id: string;
    label?: string;
    tooltip?: string;
    source: {
        boundary: CellBounds;
    };
    target?: ProjectGateway | Connection;
}

export interface ComponentMetadata {
    type: ConnectionType;
    organization: string;
    project: string;
    component: string;
    service?: string;
}
export interface ConnectorMetadata {
    type: ConnectionType.Connector;
    organization: string;
    package: string;
}

export type ConnectionMetadata = ComponentMetadata | ConnectorMetadata;

export interface DeploymentMetadata {
    gateways: {
        internet: {
            isExposed: boolean;
            tooltip?: string;
            observations?: Observations[];
            observationOnly?: boolean;
        };
        intranet: {
            isExposed: boolean;
            tooltip?: string;
            observations?: Observations[];
            observationOnly?: boolean;
        };
    };
}

export interface Observations {
    label?: string;
    componentVersion?: string;
    sourceNodeId: number;
    destinationNodeId: number;
    avgLatency: number;
    errorCount: number;
    p50Latency: number;
    p90Latency: number;
    p99Latency: number;
    requestCount: number;
}

// Util function types

export type CommonModel = ProjectModel | ComponentModel | ConnectionModel | ExternalModel | EmptyModel;
export interface OrgDiagramData {
    nodes: Nodes;
    links: Links;
}
export interface ProjectDiagramData {
    nodes: Nodes;
    links: Links;
    gateways: Gateways;
    observationSummary: ObservationSummary;
}

export interface Gateways {
    internet: boolean;
    intranet: boolean;
}

export interface ObservationSummary {
    requestCount: { min: number; max: number };
}

export interface Nodes {
    [key: string]: Map<string, CommonModel>;
}

export interface Links {
    [key: string]: Map<string, ComponentLinkModel | ExternalLinkModel | CellLinkModel | AdvancedLinkModel>;
}

export interface MoreVertMenuItem {
    label: string;
    callback: (id: string, version?: string) => void;
}

export enum DiagramLayer {
    ARCHITECTURE = "architecture",
    OBSERVABILITY = "observability",
    DIFF = "diff",
}

export interface CustomTooltips {
    diagramLayers: DiagramLayerTooltips;
}

export interface DiagramLayerTooltips {
    staticLayer?: string;
    runtimeLayer?: string;
    diffLayer?: string;
}
