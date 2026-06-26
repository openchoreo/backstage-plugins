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
import { Container } from "../utils";
import { allComponentModel } from "./data/models";

/**
 * Demonstrates the new `mode` and `colors` props introduced in v0.3.0.
 *
 * - `Light` and `Dark` cover the two presets.
 * - `BrandOverride` shows a partial token override applied on top of the
 *   dark preset — useful for host apps that want to snap accents to their
 *   own primary color.
 *
 * Toggle the `mode` control in the toolbar to swap between presets without
 * remounting; zoom and selection state persist across the swap.
 */
const meta: Meta<typeof CellDiagram> = {
    title: "Theming/Dark Mode",
    component: CellDiagram,
    decorators: [
        (Story, context) => {
            // Pick a wrapper background that matches the active mode so the
            // canvas isn't framed by a clashing color.
            const bg = context.args.mode === "dark" ? "#0f1117" : "#ffffff";
            return (
                <div style={{ width: "100vw", height: "100vh", background: bg }}>
                    <Container><Story /></Container>
                </div>
            );
        },
    ],
    argTypes: {
        mode: {
            control: { type: "inline-radio" },
            options: ["light", "dark"],
        },
    },
    parameters: {
        layout: "fullscreen",
    },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Light: Story = {
    args: {
        project: allComponentModel,
        mode: "light",
    },
};

export const Dark: Story = {
    args: {
        project: allComponentModel,
        mode: "dark",
    },
};

export const BrandOverride: Story = {
    args: {
        project: allComponentModel,
        mode: "dark",
        colors: {
            // Snap the brand accent to a custom hue while keeping the rest
            // of the dark preset.
            PRIMARY: "#22D3EE",
            PRIMARY_HOVER: "#67E8F9",
        },
    },
};
