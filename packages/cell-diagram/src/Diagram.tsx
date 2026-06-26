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

import { Container } from "./utils/CanvasStyles";
import { CustomTooltips, DiagramLayer, MoreVertMenuItem, Organization, Project } from "./types";
import { ensureFontsLoaded } from "./resources/assets/font/fonts";
import { ProjectDiagram } from "./diagrams/ProjectDiagram";
import { PromptScreen } from "./components";
import { OrgDiagram } from "./diagrams/OrgDiagram";
import {
    CellDiagramColors,
    CellDiagramThemeMode,
    CellDiagramThemeProvider,
} from "./theme";

// Inject the Gilmer @font-face declarations as soon as the diagram module
// loads, matching the original eager `import "./...fonts.css"` side effect.
ensureFontsLoaded();

export { DiagramLayer } from "./types";
export type { MoreVertMenuItem, Project } from "./types";
export type { CellDiagramColors, CellDiagramThemeMode } from "./theme";
export { lightColors, darkColors } from "./theme";

export interface CellDiagramProps {
    organization?: Organization;
    project?: Project;
    componentMenu?: MoreVertMenuItem[];
    showControls?: boolean;
    animation?: boolean;
    defaultDiagramLayer?: DiagramLayer;
    customTooltips?: CustomTooltips;
    modelVersion?: string;
    previewMode?: boolean;
    onComponentDoubleClick?: (componentId: string) => void;
    /**
     * Color scheme to render the diagram in. Defaults to `'light'` so
     * existing callers see no visual change.
     */
    mode?: CellDiagramThemeMode;
    /**
     * Optional per-token overrides merged on top of the `mode` preset. Use
     * this to snap the diagram to a host application's brand palette.
     */
    colors?: Partial<CellDiagramColors>;
}

export function CellDiagram(props: CellDiagramProps) {
    const { organization, project, previewMode, mode, colors } = props;

    let diagram;
    if (organization) {
        diagram = <OrgDiagram organization={organization} {...props} />;
    } else if (project) {
        diagram = <ProjectDiagram project={project} {...props} previewMode={previewMode} />;
    } else {
        diagram = <PromptScreen userMessage="Organization or Project model not provided." />;
    }

    return (
        <CellDiagramThemeProvider mode={mode} colors={colors}>
            <Container className={previewMode ? "preview-mode" : ""}>
                {diagram}
            </Container>
        </CellDiagramThemeProvider>
    );
}
