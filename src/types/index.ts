export type WorkflowStatus = "idle" | "running" | "success" | "failed";

export type NodeType =
  | "request_inputs"
  | "crop_image"
  | "gemini"
  | "response";

export type FieldType = "text_field" | "image_field";

export interface WorkflowField {
  id: string;
  name: string;
  type: FieldType;
  value: string;
  connected: boolean;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: {
    x: number;
    y: number;
  };
  fields: WorkflowField[];
  status: WorkflowStatus;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  userId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NodeResult {
  nodeId: string;
  status: WorkflowStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  output?: string;
  error?: string;
}

export interface RunHistoryEntry {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  scope: "full" | "single" | "selection";
  startedAt: string;
  finishedAt?: string;
  nodeResults: NodeResult[];
}
