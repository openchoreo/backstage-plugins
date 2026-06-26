import { Project } from "../../../../types";

export const model1 = {
    id: "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
    name: "A",
    components: [
        {
            id: "Users",
            version: "0.1.0",
            type: "service",
            services: {
                "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:users": {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:users",
                    label: "users",
                    type: "http",
                    dependencyIds: ["ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:svc2Basepath"],
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
                "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:admin": {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:admin",
                    label: "admin",
                    type: "http",
                    dependencyIds: [
                        "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:svc2Basepath",
                        "salesforce://salesforceCorporate",
                    ],
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
                    id: "mysql://mysql",
                    type: "datastore",
                    onPlatform: true,
                },
                {
                    id: "salesforce://salesforceCorporate",
                    type: "connector",
                    onPlatform: false,
                },
                {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Members:members",
                    type: "http",
                },
            ],
        },
        {
            id: "Inventories",
            version: "0.1.1",
            type: "service",
            services: {
                "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:inventories": {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:inventories",
                    label: "inventories",
                    type: "http",
                    dependencyIds: ["ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Inventories:svc2Basepath"],
                    deploymentMetadata: {
                        gateways: {
                            internet: {
                                isExposed: true,
                                tooltip: "No data from internet gateway",
                            },
                            intranet: {
                                isExposed: true,
                                tooltip: "No data from intranet gateway",
                            },
                        },
                    },
                },
            },
            connections: [
                {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Payments:payments",
                    type: "http",
                    tooltip: "No data form payment service",
                },
                {
                    id: "mysql://mysql",
                    type: "datastore",
                    onPlatform: true,
                    tooltip: "No data from database connection",
                },
                {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Products:products",
                    type: "grpc",
                },
            ],
        },
        {
            id: "Payments",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Payments:payments": {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Payments:payments",
                    label: "payments",
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
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Users:users",
                    type: "http",
                    onPlatform: true,
                },
                {
                    id: "mysql://mysql",
                    type: "datastore",
                    onPlatform: true,
                },
                {
                    id: "paypal://paypal",
                    type: "connector",
                    onPlatform: false,
                },
            ],
        },
        {
            id: "Offers",
            version: "0.2.0",
            type: "service",
            services: {
                "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Offers:basepath": {
                    id: "ABC:110ec58a-a0f2-4ac4-8393-c866d813b8d1:Offers:basepath",
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
                    id: "firebase://firebase",
                    type: "datastore",
                    onPlatform: false,
                },
            ],
        },
        {
            id: "Notifications",
            version: "0.2.0",
            type: "scheduled-task",
            services: {},
            connections: [],
        },
    ],
    configurations: [
        {
            id: "twilio://twilio",
            type: "connector",
            onPlatform: false,
        },
        {
            id: "paypal://paypal",
            type: "connector",
            onPlatform: false,
        },
    ],
    modelVersion: "0.4.0",
} as Project;
