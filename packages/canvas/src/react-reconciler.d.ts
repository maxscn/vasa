declare module "react-reconciler" {
  const Reconciler: (hostConfig: Record<string, unknown>) => unknown;
  export default Reconciler;
}

declare module "react-reconciler/constants" {
  export const DefaultEventPriority: number;
  export const NoEventPriority: number;
}
