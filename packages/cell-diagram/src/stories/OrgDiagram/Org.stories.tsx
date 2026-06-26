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

import { Meta, StoryObj } from "@storybook/react";
import { CellDiagram } from "../../Diagram";
import { Organization } from "../../types";
import { Container, handleComponentDoubleClick } from "../utils";
import { CellBounds } from "../../components/Cell/CellNode/CellModel";
import wso2OrgModel from "./wso2-org-model.json";
import yOrgModel from "./y-org-model.json";
import kOrgModel from "./k-org-model.json";

const noProjectsOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [],
    modelVersion: "0.4.0",
};

const singleProjectOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [
        {
            id: "1234",
            name: "Project A",
            components: [],
        },
    ],
    modelVersion: "0.4.0",
};

const simpleOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [
        {
            id: "1234",
            name: "Project A",
            components: [],
            connections: [
                {
                    id: "1234-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "1234-9012",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "9012",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
        {
            id: "5678",
            name: "Project B",
            components: [],
        },
        {
            id: "9012",
            name: "Project C",
            components: [],
            connections: [
                {
                    id: "9012-3456",
                    source: {
                        boundary: CellBounds.SouthBound,
                    },
                    target: {
                        id: "github",
                        label: "GitHub",
                    },
                },
            ],
        },
        {
            id: "3456",
            name: "Project D",
            components: [],
        },
    ],
    modelVersion: "0.4.0",
};

const simpleNoLinkOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [
        {
            id: "1234",
            name: "Project A",
            components: [],
            connections: [],
        },
        {
            id: "5678",
            name: "Project B",
            components: [],
        },
        {
            id: "9012",
            name: "Project C",
            components: [],
            connections: [
                {
                    id: "9012-3456",
                    source: {
                        boundary: CellBounds.SouthBound,
                    },
                    target: {
                        id: "github",
                        label: "GitHub",
                    },
                },
            ],
        },
        {
            id: "3456",
            name: "Project D",
            components: [],
        },
    ],
    modelVersion: "0.4.0",
};

const multiProjectsOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [
        {
            id: "1234",
            name: "Project A",
            components: [],
            connections: [
                {
                    id: "1234-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "1234-9012",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "9012",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "1234-N",
                    source: {
                        boundary: CellBounds.NorthBound,
                    },
                },
            ],
        },
        {
            id: "5678",
            name: "Project B",
            components: [],
        },
        {
            id: "9012",
            name: "Project C",
            components: [],
            connections: [
                {
                    id: "9012-3456",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "3456",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
        {
            id: "3456",
            name: "Project D",
            components: [],
            connections: [
                {
                    id: "3456-7890",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "7890",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "3456-N",
                    source: {
                        boundary: CellBounds.NorthBound,
                    },
                },
                {
                    id: "3456-github",
                    source: {
                        boundary: CellBounds.SouthBound,
                    },
                    target: {
                        id: "github",
                        label: "GitHub",
                    },
                },
            ],
        },
        {
            id: "7890",
            name: "Project E",
            components: [],
            connections: [
                {
                    id: "7890-1234",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "1234",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "7890-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
    ],
    modelVersion: "0.4.0",
};

const complexOrgModel: Organization = {
    id: "A",
    name: "A",
    projects: [
        {
            id: "1234",
            name: "Project A",
            components: [],
            connections: [
                {
                    id: "1234-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "1234-9012",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "9012",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "1234-3456",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "3456",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "3456-github",
                    source: {
                        boundary: CellBounds.SouthBound,
                    },
                    target: {
                        id: "github",
                        label: "GitHub",
                    },
                },
            ],
        },
        {
            id: "5678",
            name: "Project B",
            components: [],
        },
        {
            id: "9012",
            name: "Project C",
            components: [],
            connections: [
                {
                    id: "9012-3456",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "3456",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "9012-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "9012-7890",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "7890",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
        {
            id: "3456",
            name: "Project D",
            components: [],
            connections: [
                {
                    id: "3456-7890",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "7890",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "3456-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
        {
            id: "7890",
            name: "Project E",
            components: [],
            connections: [
                {
                    id: "7890-1234",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "1234",
                        boundary: CellBounds.WestBound,
                    },
                },
                {
                    id: "7890-5678",
                    source: {
                        boundary: CellBounds.EastBound,
                    },
                    target: {
                        projectId: "5678",
                        boundary: CellBounds.WestBound,
                    },
                },
            ],
        },
    ],
    modelVersion: "0.4.0",
};

const meta: Meta<typeof CellDiagram> = {
    title: "Org",
    component: CellDiagram,
    decorators: [Story => <Container><Story /></Container>],
    parameters: {
        layout: "centered",
    },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const EmptyOrganization: Story = {
    args: {
        organization: noProjectsOrgModel,
    },
};

export const SingleProjectOrganization: Story = {
    args: {
        organization: singleProjectOrgModel,
    },
};

export const SimpleOrganization: Story = {
    args: {
        organization: simpleOrgModel,
    },
};

export const SimpleOrgWithoutDependencies: Story = {
    args: {
        organization: simpleNoLinkOrgModel,
    },
};

export const MultiProjectsOrganization: Story = {
    args: {
        organization: multiProjectsOrgModel,
        onComponentDoubleClick: handleComponentDoubleClick,
    },
};

export const ComplexOrganization: Story = {
    args: {
        organization: complexOrgModel,
        onComponentDoubleClick: handleComponentDoubleClick,
    },
};

export const Wso2Organization: Story = {
    args: {
        organization: wso2OrgModel as Organization,
        animation: false,
        onComponentDoubleClick: handleComponentDoubleClick,
    },
};

export const LargeOrganizationWithoutConnections: Story = {
    args: {
        organization: kOrgModel as Organization,
        animation: false,
        onComponentDoubleClick: handleComponentDoubleClick,
    },
};

export const LargeOrganizationWithSomeConnections: Story = {
    args: {
        organization: yOrgModel as Organization,
        animation: false,
    },
};
