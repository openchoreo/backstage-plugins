/**
 * Utility functions for handling action selection with wildcard support.
 *
 * Actions follow the format: `category:operation` (e.g., "component:view", "project:create")
 * Wildcards:
 *   - `*` means all actions globally
 *   - `category:*` means all actions in that category (e.g., "component:*")
 */

/**
 * Group actions by their category (the part before the colon)
 */
export function groupActionsByCategory(
  actions: string[],
): Record<string, string[]> {
  return actions.reduce((groups, action) => {
    const [category] = action.split(':');
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(action);
    return groups;
  }, {} as Record<string, string[]>);
}

/**
 * Expand wildcards to individual actions for internal selection state.
 * - `*` expands to all available actions
 * - `category:*` expands to all actions in that category
 * - Individual actions are kept as-is
 */
export function expandWildcards(
  selectedActions: string[],
  availableActions: string[],
): Set<string> {
  const expanded = new Set<string>();
  const groupedActions = groupActionsByCategory(availableActions);

  for (const action of selectedActions) {
    if (action === '*') {
      // Global wildcard - add all actions
      availableActions.forEach(a => expanded.add(a));
    } else if (action.endsWith(':*')) {
      // Category wildcard - add all actions in that category
      const category = action.slice(0, -2); // Remove ':*'
      const categoryActions = groupedActions[category] || [];
      categoryActions.forEach(a => expanded.add(a));
    } else {
      // Individual action
      expanded.add(action);
    }
  }

  return expanded;
}

/**
 * Convert a set of individual selections to wildcards where applicable.
 * - If all actions are selected, returns ['*']
 * - If all actions in a category are selected, uses 'category:*'
 * - Otherwise, returns individual actions
 */
export function convertToWildcards(
  selection: Set<string>,
  availableActions: string[],
): string[] {
  // If nothing selected, return empty array
  if (selection.size === 0) {
    return [];
  }

  // If all actions selected, return global wildcard
  if (selection.size === availableActions.length) {
    const allSelected = availableActions.every(a => selection.has(a));
    if (allSelected) {
      return ['*'];
    }
  }

  const groupedActions = groupActionsByCategory(availableActions);
  const result: string[] = [];

  for (const [category, actions] of Object.entries(groupedActions)) {
    const selectedInCategory = actions.filter(a => selection.has(a));

    if (selectedInCategory.length === 0) {
      // No actions selected in this category
      continue;
    }

    if (selectedInCategory.length === actions.length) {
      // All actions in category selected - use category wildcard
      result.push(`${category}:*`);
    } else {
      // Partial selection - add individual actions
      result.push(...selectedInCategory);
    }
  }

  return result;
}

/**
 * Get a human-readable display label for an action.
 * - `*` -> "All Actions"
 * - `category:*` -> "All category actions"
 * - Individual actions -> as-is
 */
export function getActionDisplayLabel(action: string): string {
  if (action === '*') {
    return 'All Actions';
  }
  if (action.endsWith(':*')) {
    const category = action.slice(0, -2);
    return `All ${category} actions`;
  }
  return action;
}

/**
 * Check if a selection contains wildcards
 */
export function hasWildcards(selectedActions: string[]): boolean {
  return selectedActions.some(a => a === '*' || a.endsWith(':*'));
}

/**
 * Get all categories from a list of actions
 */
export function getCategories(actions: string[]): string[] {
  const categories = new Set<string>();
  for (const action of actions) {
    const [category] = action.split(':');
    categories.add(category);
  }
  return Array.from(categories).sort();
}
