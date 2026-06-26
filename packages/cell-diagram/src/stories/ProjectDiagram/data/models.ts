import { ComponentType, ConnectionType, Project } from "../../../types";

export const noComponentModel = {
    id: "A",
    name: "A",
    components: [],
    modelVersion: "0.4.0",
} as Project;

export const singleComponentModel = {
    id: "A",
    name: "A",
    components: [
        {
            id: "User Service",
            version: "0.2.0",
            type: "service",
            services: {},
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const singleExposedComponentModel = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Users",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Users:basepath": {
                    id: "ABC:A:Users:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: true,
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "madusha:B:C:endpoint1",
                    onPlatform: true,
                },
                {
                    id: "dynamoDb://dynamoDb",
                    onPlatform: false,
                    type: ConnectionType.Datastore,
                },
            ],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const allComponentModel = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Ballerina Service",
            version: "0.2.0",
            type: ComponentType.SERVICE,
            buildPack: "ballerina",
            services: {},
            connections: [],
        },
        {
            id: "Wep App",
            version: "0.2.0",
            type: "web-app",
            services: {},
            connections: [],
        },
        {
            id: "Scheduled Task ABCDEFGHT",
            version: "0.2.0",
            type: "scheduled-task",
            buildPack: "java",
            services: {},
            connections: [],
        },
        {
            id: "Manual Task",
            version: "0.2.0",
            type: "manual-task",
            buildPack: "python",
            services: {},
            connections: [],
        },
        {
            id: "Api Proxy",
            version: "0.2.0",
            type: "api-proxy",
            buildPack: "go",
            services: {},
            connections: [],
        },
        {
            id: "Web Hook",
            version: "0.2.0",
            type: "web-hook",
            buildPack: "nodejs",
            services: {},
            connections: [],
        },
        {
            id: "Event Handler",
            version: "0.2.0",
            type: "event-handler",
            buildPack: "php",
            services: {},
            connections: [],
        },
        {
            id: "Test",
            version: "0.2.0",
            type: "test",
            buildPack: "microintegrator",
            services: {},
            connections: [],
        },
        {
            id: "Ruby Service",
            version: "0.2.0",
            type: "service",
            buildPack: "ruby",
            services: {},
            connections: [],
        },
        {
            id: "Rust Service",
            version: "0.2.0",
            type: "service",
            buildPack: "rust",
            services: {},
            connections: [],
        },
        {
            id: "Docker Service",
            version: "0.2.0",
            type: "service",
            buildPack: "docker",
            services: {},
            connections: [],
        },
        {
            id: "XYZ Service",
            version: "0.2.0",
            type: "service",
            buildPack: "xyz",
            services: {},
            connections: [],
        },
        {
            id: "Local Bridge",
            version: "0.2.0",
            type: "system",
            buildPack: "debug",
            services: {},
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const componentDependencyModel = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Users",
            version: "0.2.0",
            type: "api-proxy",
            services: {
                "ABC:A:Users:basepath": {
                    id: "ABC:A:Users:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Courses",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Courses:basepath": {
                    id: "ABC:A:Courses:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "ABC:A:Users:basepath",
                    type: "http",
                },
                {
                    id: "ABC:A:Task",
                    type: "http",
                },
            ],
        },
        {
            id: "Task",
            version: "0.2.0",
            type: "manual-task",
            services: {},
            connections: [
                {
                    id: "ABC:A:WebApp",
                    type: "http",
                },
            ],
        },
        {
            id: "WebApp",
            version: "0.2.0",
            type: "web-app",
            services: {},
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const unlinkConfigurationModel = {
    id: "A",
    name: "A",
    components: [],
    configurations: [
        {
            id: "twilio://twilio",
            type: "connector",
            onPlatform: false,
        },
        {
            id: "paypal://paypal",
            label: "Paypal",
            type: "connector",
            onPlatform: false,
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const observabilityModel = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Users",
            version: "0.2.0",
            type: "api-proxy",
            services: {
                "ABC:A:Users:basepath": {
                    id: "ABC:A:Users:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Courses",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Courses:basepath": {
                    id: "ABC:A:Courses:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "ABC:A:Users:basepath",
                    type: "http",
                    observations: [
                        {
                            version: "0.2.0",
                            avgLatency: 191934320,
                            destinationNodeId: 1,
                            errorCount: 0,
                            p50Latency: 191934320,
                            p90Latency: 191934320,
                            p99Latency: 191934320,
                            requestCount: 1,
                            sourceNodeId: 2,
                        },
                    ],
                },
            ],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const testModel1 = {
    id: "wknh",
    name: "FinFlux",
    components: [
        {
            id: "uatwvb",
            label: "tickets",
            version: "v1.0",
            type: "service",
            buildPack: "ballerina",
            services: {
                "Kanushka Gayan:wknh:uatwvb:Support": {
                    id: "Kanushka Gayan:wknh:uatwvb:Support",
                    label: "",
                    type: "HTTP",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: true,
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "kanushkagayan:wknh:xxkhcb:dec73",
                    onPlatform: true,
                },
                {
                    id: "kanushkagayan:wknh:umaikp:ac468",
                    onPlatform: true,
                },
            ],
        },
        {
            id: "xxkhcb",
            label: "notifications",
            version: "v1.0",
            type: "service",
            buildPack: "ballerina",
            services: {
                "Kanushka Gayan:wknh:xxkhcb:Notification": {
                    id: "Kanushka Gayan:wknh:xxkhcb:Notification",
                    label: "",
                    type: "HTTP",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "xivajd",
            label: "web-app",
            version: "",
            type: "web-app",
            buildPack: "other",
            services: {
                "web-app": {
                    id: "",
                    label: "",
                    type: "other",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "hqlmlp",
            label: "subscribe-webhook",
            version: "v1.0",
            type: "web-hook",
            buildPack: "ballerina",
            services: {
                "subscribe-webhook": {
                    id: "",
                    label: "",
                    type: "other",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "wnodex",
            label: "ticket-proxy",
            version: "v1.0",
            type: "api-proxy",
            buildPack: "ballerina",
            services: {
                "ticket-proxy": {
                    id: "",
                    label: "",
                    type: "other",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "umaikp",
            label: "transactions",
            version: "v1.0",
            type: "service",
            buildPack: "ballerina",
            services: {
                "Kanushka Gayan:wknh:umaikp:Transaction": {
                    id: "Kanushka Gayan:wknh:umaikp:Transaction",
                    label: "",
                    type: "HTTP",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "kanushkagayan:wknh:xxkhcb:dec73",
                    onPlatform: true,
                },
            ],
        },
        {
            id: "loencn",
            label: "accounts",
            version: "v1.0",
            type: "service",
            buildPack: "ballerina",
            services: {
                "Kanushka Gayan:wknh:loencn:defaultEp": {
                    id: "Kanushka Gayan:wknh:loencn:defaultEp",
                    label: "",
                    type: "HTTP",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const testModel2 = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Users 2",
            version: "0.2.0",
            type: "api-proxy",
            services: {
                "ABC:A:Users:basepath": {
                    id: "ABC:A:Users:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
            disabled: {
                status: true,
                reason: "Disabled for testing",
            },
        },
        {
            id: "Courses",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Courses:basepath": {
                    id: "ABC:A:Courses:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Task",
            version: "0.2.0",
            type: "manual-task",
            services: {
                "ABC:A:Task:basepath": {
                    id: "ABC:A:Task:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "WebApp",
            version: "0.2.0",
            type: "web-app",
            services: {
                "ABC:A:WebApp:basepath": {
                    id: "ABC:A:WebApp:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const testModel22 = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Courses",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Courses:basepath": {
                    id: "ABC:A:Courses:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Task",
            version: "0.2.0",
            type: "manual-task",
            services: {
                "ABC:A:Task:basepath": {
                    id: "ABC:A:Task:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "WebApp",
            version: "0.2.0",
            type: "web-app",
            services: {
                "ABC:A:WebApp:basepath": {
                    id: "ABC:A:WebApp:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;

export const testModel3 = {
    id: "A",
    name: "A",
    components: [
        {
            id: "Users",
            version: "0.2.0",
            type: "api-proxy",
            services: {
                "ABC:A:Users:basepath": {
                    id: "ABC:A:Users:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Courses",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:A:Courses:basepath": {
                    id: "ABC:A:Courses:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Task",
            version: "0.2.0",
            type: "manual-task",
            services: {
                "ABC:A:Task:basepath": {
                    id: "ABC:A:Task:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "WebApp",
            version: "0.2.0",
            type: "web-app",
            services: {
                "ABC:A:WebApp:basepath": {
                    id: "ABC:A:WebApp:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: true,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Task2",
            version: "0.2.0",
            type: "manual-task",
            services: {
                "ABC:A:Task:basepath": {
                    id: "ABC:A:Task:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: false,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "WebApp2",
            version: "0.2.0",
            type: "web-app",
            services: {
                "ABC:A:WebApp:basepath": {
                    id: "ABC:A:WebApp:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "Task3",
            version: "0.2.0",
            type: "manual-task",
            services: {
                "ABC:A:Task:basepath": {
                    id: "ABC:A:Task:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
        {
            id: "WebApp3",
            version: "0.2.0",
            type: "web-app",
            services: {
                "ABC:A:WebApp:basepath": {
                    id: "ABC:A:WebApp:basepath",
                    label: "basepath",
                    type: "http",
                    dependencyIds: [],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                            },
                            intranet: {
                                isExposed: false,
                            },
                        },
                    },
                },
            },
            connections: [],
        },
    ],
    modelVersion: "0.4.0",
} as Project;
