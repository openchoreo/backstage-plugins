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
