export const SCOPE_CLUSTER = 'cluster' as const;
export const SCOPE_NAMESPACE = 'namespace' as const;

export type BindingScope = typeof SCOPE_CLUSTER | typeof SCOPE_NAMESPACE;
