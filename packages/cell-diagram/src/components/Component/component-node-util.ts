import {
  COMPONENT_LINK,
  COMPONENT_NODE,
  NAME_JOIN_CHAR,
} from '../../resources';
import { Component } from '../../types';

export function getComponentName(component: Component): string {
  return getComponentNameById(component.id);
}

export function getComponentNameById(id: string): string {
  return `${COMPONENT_NODE}${NAME_JOIN_CHAR}${id}`;
}

export function getComponentMetadataByName(name: string): {
  type: string;
  id: string;
} {
  const parts = name.split(NAME_JOIN_CHAR);
  return { type: parts[0], id: parts[1] };
}

export function getComponentLinkName(source: string, target: string): string {
  return `${COMPONENT_LINK}${NAME_JOIN_CHAR}${source}::${target}`;
}
