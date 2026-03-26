export type GraphId = string;

export type GraphValue = null | boolean | number | string | GraphValue[] | { [k: string]: GraphValue };

export type PortDirection = 'in' | 'out';

export type ValueType =
  | 'any'
  | 'number'
  | 'boolean'
  | 'string'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'texture2d'
  | 'audio'
  | 'event';

export interface PortDef {
  name: string;
  direction: PortDirection;
  type: ValueType;
  optional?: boolean;
}

export interface NodeDef {
  kind: string;
  label?: string;
  ports?: PortDef[];
  defaultParams?: Record<string, GraphValue>;
  allowCycles?: boolean;
}

export interface NodeRegistry {
  get(kind: string): NodeDef | null;
  has(kind: string): boolean;
  listKinds(): string[];
}

export interface GraphNode {
  id: GraphId;
  kind: string;
  params?: Record<string, GraphValue>;
}

export interface PortRef {
  node: GraphId;
  port: string;
}

export interface GraphEdge {
  id?: string;
  from: PortRef;
  to: PortRef;
}

export interface Graph {
  version?: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'duplicate-node-id'
    | 'missing-node'
    | 'unknown-kind'
    | 'missing-port'
    | 'wrong-port-direction'
    | 'type-mismatch'
    | 'multiple-inputs'
    | 'cycle';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface GraphValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  nodeById: Map<string, GraphNode>;
}

export interface TopoResult {
  order: string[];
  hasCycle: boolean;
  cyclicNodes: string[];
}
