export interface Environment {
  name: string;
  displayName?: string;
  namespace: string;
  dataPlaneRef?: { kind?: string; name?: string };
}
