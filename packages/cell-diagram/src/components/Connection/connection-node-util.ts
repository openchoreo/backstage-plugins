import { CONNECTION_NODE, NAME_JOIN_CHAR } from "../../resources";
import { Connection } from "../../types";

export function getConnectionName(connection: Connection): string {
    return getConnectionNameById(connection.id);
}

export function getConnectionNameById(id:string): string {
    return `${CONNECTION_NODE}${NAME_JOIN_CHAR}${id}`;
}

export function getConnectionMetadataByName(name: string): { type: string, id: string } {
    const parts = name.split(NAME_JOIN_CHAR);
    return { type: parts[0], id: parts[1] };
}

export function getConnectionLinkName(source: string, target: string): string {
    return `${CONNECTION_NODE}${NAME_JOIN_CHAR}${source}::${target}`;
}
