import { EXTERNAL_LINK, EXTERNAL_NODE, NAME_JOIN_CHAR } from '../../resources';

export function getExternalNodeName(id: string): string {
  return `${EXTERNAL_NODE}${NAME_JOIN_CHAR}${id}`;
}

export function getExternalNodeMetadataByName(name: string): {
  type: string;
  id: string;
} {
  const parts = name.split(NAME_JOIN_CHAR);
  return { type: parts[0], id: parts[1] };
}

export function getExternalLinkName(source: string, target: string): string {
  return `${EXTERNAL_LINK}${NAME_JOIN_CHAR}${source}::${target}`;
}
