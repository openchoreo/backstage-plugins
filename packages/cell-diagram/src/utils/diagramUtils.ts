import createEngine, { DiagramEngine } from "@projectstorm/react-diagrams";
import gsap from "gsap";
import {
    OverlayLayerFactory,
    ComponentFactory,
    ComponentLinkFactory,
    ComponentPortFactory,
    CellFactory,
    CellLinkFactory,
    CellPortFactory,
    EmptyFactory,
    ExternalFactory,
    ExternalLinkFactory,
    ConnectionPortFactory,
    ConnectionFactory,
    ProjectLinkFactory,
    ProjectPortFactory,
    ProjectFactory,
    DefaultLinkFactory,
} from "../components";
import {
    CELL_LINK,
    COMPONENT_LINK,
    COMPONENT_NODE,
    CONNECTION_NODE,
    EXTERNAL_LINK,
    MAIN_CELL,
    PROJECT_NODE,
} from "../resources";
import { ZoomCanvasAction } from "@projectstorm/react-canvas-core";

// Diagram engine utils

export function generateEngine(previewMode?: boolean): DiagramEngine {
    const engine: DiagramEngine = createEngine({
        registerDefaultPanAndZoomCanvasAction: false,
        registerDefaultZoomCanvasAction: false,
    });
    engine.getLinkFactories().registerFactory(new ProjectLinkFactory());
    engine.getPortFactories().registerFactory(new ProjectPortFactory());
    engine.getNodeFactories().registerFactory(new ProjectFactory());
    engine.getLinkFactories().registerFactory(new DefaultLinkFactory());

    engine.getLinkFactories().registerFactory(new ComponentLinkFactory());
    engine.getPortFactories().registerFactory(new ComponentPortFactory());
    engine.getNodeFactories().registerFactory(new ComponentFactory());

    engine.getPortFactories().registerFactory(new ConnectionPortFactory());
    engine.getNodeFactories().registerFactory(new ConnectionFactory());

    engine.getLinkFactories().registerFactory(new CellLinkFactory());
    engine.getPortFactories().registerFactory(new CellPortFactory());
    engine.getNodeFactories().registerFactory(new CellFactory());

    engine.getLinkFactories().registerFactory(new ExternalLinkFactory());
    engine.getNodeFactories().registerFactory(new ExternalFactory());

    engine.getNodeFactories().registerFactory(new EmptyFactory());

    engine.getLayerFactories().registerFactory(new OverlayLayerFactory());

    if (!previewMode) {
        engine.getActionEventBus().registerAction(new ZoomCanvasAction({ inverseZoom: true }));
    }
    return engine;
}

// reveal diagram with animation
export function animateProjectDiagram() {
    const tl = gsap.timeline();
    const safeAnimate = (selector: string, animation: gsap.TweenVars, label?: gsap.Position) => {
        const elements = gsap.utils.toArray(selector);
        if (elements.length > 0) {
            tl.from(elements, animation, label);
        }
    };
    safeAnimate(`div[data-nodeid="${MAIN_CELL}"]`, {
        scale: 0,
        opacity: 0,
        duration: 0.5,
    });
    safeAnimate(
        `g[data-linkid^="${EXTERNAL_LINK}|"]`,
        {
            opacity: 0,
            duration: 0.5,
        },
        "showNodeTime"
    );
    safeAnimate(
        `div[data-nodeid^="${COMPONENT_NODE}|"]`,
        {
            opacity: 0,
            duration: 0.5,
        },
        "showNodeTime"
    );
    safeAnimate(
        `div[data-nodeid^="${CONNECTION_NODE}|"]`,
        {
            opacity: 0,
            duration: 0.5,
        },
        "showNodeTime"
    );
    safeAnimate(
        `g[data-linkid^="${COMPONENT_LINK}|"]`,
        {
            opacity: 0,
            duration: 0.5,
        },
        "showNodeTime"
    );
    safeAnimate(
        `g[data-linkid^="${CELL_LINK}|"]`,
        {
            opacity: 0,
            duration: 0.5,
        },
        "showNodeTime"
    );
}

export function animateOrgDiagram() {
    const tl = gsap.timeline();
    const safeAnimate = (selector: string, animation: gsap.TweenVars, label?: gsap.Position) => {
        const elements = gsap.utils.toArray(selector);
        if (elements.length > 0) {
            tl.from(elements, animation, label);
        }
    };
    safeAnimate(`div[data-nodeid^="${PROJECT_NODE}|"]`, {
        scale: 0.5,
        opacity: 0,
        duration: 0.5,
    });
    safeAnimate(`g[data-default-link-test^="${PROJECT_NODE}|"]`, {
        opacity: 0,
        duration: 0.5,
    });
}
