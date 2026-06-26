import { CELL_LINK, EMPTY_NODE, NAME_JOIN_CHAR } from "../../resources/constants";
import { CellBounds } from "./CellNode/CellModel";
import { PortModelAlignment } from "@projectstorm/react-diagrams";

export function getRoundedOctagonSVG(sideLength: number, radius: number, padding: number = 0): { width: number; height: number; path: string } {
    const sideCount = 8;
    const halfAngle = ((sideCount - 2) * Math.PI) / sideCount / 2;
    const sin = Math.sin(halfAngle);
    const cos = Math.cos(halfAngle);
    const gap = sideLength - (2 / Math.tan(halfAngle)) * radius;
    const round = 2 * cos * radius;
    let diameter = sideLength / cos;
    let offsetY = 0;

    if (sideCount % 2) {
        const vertical = diameter / 2 + (diameter / 2) * sin;
        diameter = Math.sqrt(Math.pow(sideLength / 2, 2) + Math.pow(vertical, 2));
        offsetY = (diameter - vertical) / 2;
    }

    diameter += 2 * padding;

    const getQuadrant = (x: number) => Math.floor(((x + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 2)) + 1;

    const points: number[][] = [[0, radius / sin - radius * sin + padding + offsetY]];
    const angles = [halfAngle - Math.PI / 2];
    let horizontalCut = 0;

    for (let i = 1; i <= sideCount; i += 1) {
        const prev = angles[i - 1];
        const next = prev + Math.PI - 2 * halfAngle;
        const middle = (prev + next) / 2;

        const prevQ = getQuadrant(prev);
        const nextQ = getQuadrant(next);

        if (prevQ === 1 && nextQ >= 2 && nextQ <= 3) {
            horizontalCut = (Math.cos(Math.abs(middle - Math.PI / 2)) * radius) / sin - radius;
        }

        angles.push(next);
        points.push([Math.cos(middle) * round, Math.sin(middle) * round]);
        if (i !== sideCount) {
            points.push([Math.cos(next) * gap, Math.sin(next) * gap]);
        }
    }

    const verticalCut = radius / sin - radius;

    if (sideCount % 2) {
        diameter -= horizontalCut * 2;
        points[0][1] -= (horizontalCut * 2 + verticalCut) / 2;
    } else {
        diameter -= verticalCut * 2;
        points[0][1] -= verticalCut;
    }
    points[0][0] = diameter / 2 - cos * radius;

    const width = Math.ceil(diameter);
    const delta = (width - diameter) / 2;
    points[0][0] += delta;
    points[0][1] += delta;

    const fixFloat = (value: number) => {
        const fixed = +value.toPrecision(14);
        return Math.abs(fixed) < 1e-13 ? 0 : fixed;
    };

    const list: string[] = [];
    points.forEach((p, index) => {
        const x = fixFloat(p[0]);
        const y = fixFloat(p[1]);
        if (index === 0) {
            list.push(`M${x} ${y}`);
        } else if (index % 2) {
            list.push(`a${radius} ${radius} 0 0 1 ${x} ${y}`);
        } else {
            list.push(`l${x} ${y}`);
        }
    });

    // Connect the end of the path to the start
    list.push(`Z`);

    const path = list.join("");

    return {
        width: width,
        height: width,
        path: path,
    };
}

// Cell port utils

export function getCellPortId(name: string, bound: CellBounds, align?: PortModelAlignment, ...args: string[]): string {
    const portName = getCellPortIdWithoutAlignment(name, bound, ...args);
    if (align) {
        return `${align}-${portName}`;
    }
    return portName;
}

// this will return the port name without the alignment
export function getCellPortIdWithoutAlignment(name: string, bound: CellBounds, ...args: string[]): string {
    let rest = "";
    if (args.length > 0) {
        rest = `${NAME_JOIN_CHAR}${args.join(NAME_JOIN_CHAR)}`;
    }
    return `${name}${NAME_JOIN_CHAR}${bound}${rest !== "" ? `${rest}` : ""}`;
}

// destruct the port name to get the name, bound, alignment and args
export function getCellPortMetadata(cellPortId: string): { name: string; bound: CellBounds; align?: PortModelAlignment; args: string[] } {
    const parts = cellPortId.split(NAME_JOIN_CHAR);
    const nameAndAlign = parts[0].split("-");
    let name: string;
    let align: PortModelAlignment | undefined;
    if (nameAndAlign.length === 1) {
        name = nameAndAlign[0];
    } else {
        name = nameAndAlign[1];
        align = nameAndAlign[0] as PortModelAlignment;
    }
    const bound = parts[1] as CellBounds;
    let args: string[] = [];
    if (parts.length > 2) {
        args = parts.slice(2);
    }
    return { name, bound, align, args };
}

export function getNodePortId(name: string, align?: PortModelAlignment): string {
    return `${align ? `${align}-` : ""}${name}`;
}

// Cell link utils

export function getCellLinkName(source: string, target: string): string {
    return `${CELL_LINK}${NAME_JOIN_CHAR}${source}::${target}`;
}

// Empty node utils

export function getEmptyNodeName(bound: CellBounds, ...args: string[]): string {
    let rest = "";
    args?.forEach((arg) => {
        if (arg) {
            rest += `${NAME_JOIN_CHAR}${arg}`;
        }
    });
    return `${EMPTY_NODE}${NAME_JOIN_CHAR}${bound}${rest !== "" ? `${rest}` : ""}`;
}

