import { create } from "zustand";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { WorkflowStatus } from "@/types";

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];
  workflowId: string | null;
  history: { nodes: Node[]; edges: Edge[] }[];
  historyIndex: number;
  
  // Actions
  setWorkflowId: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  resetWorkflow: (nodes: Node[], edges: Edge[]) => void;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Record<string, unknown>) => void;
  removeNode: (id: string) => void;
  setRunStatus: (nodeId: string, status: WorkflowStatus) => void;
  setNodeOutput: (nodeId: string, output: Record<string, unknown>) => void;
  
  // Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodes: [],
  workflowId: null,
  history: [],
  historyIndex: -1,

  setWorkflowId: (id) => set({ workflowId: id }),

  setNodes: (nodes) => set({ nodes }),
  
  setEdges: (edges) => set({ edges }),

  resetWorkflow: (nodes, edges) =>
    set({
      nodes,
      edges,
      history: [],
      historyIndex: -1,
      selectedNodes: [],
    }),

  onNodesChange: (changes: NodeChange<Node>[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    // Add custom edge styling
    const edge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}-${connection.sourceHandle}-${connection.targetHandle}`,
      animated: true,
      style: { stroke: "#7C3AED", strokeWidth: 2 },
    };
    
    get().pushHistory();
    set({
      edges: addEdge(edge, get().edges),
    });
  },

  addNode: (node) => {
    get().pushHistory();
    set({ nodes: [...get().nodes, node] });
  },

  updateNode: (id, data) => {
    get().pushHistory();
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },

  removeNode: (id) => {
    // Prevent removing Request-Inputs and Response nodes
    if (id === "request-inputs" || id === "response") return;

    get().pushHistory();
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
    });
  },

  setRunStatus: (nodeId, status) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, status } } : node
      ),
    });
  },

  setNodeOutput: (nodeId, output) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...output } } : node
      ),
    });
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    // Remove future history if we are in the middle of undo stack
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes, edges });
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= 0) {
      // If we are at the latest state and haven't saved it yet, we should save current before going back
      // Actually, for simplicity, we just jump to historyIndex
      const prevState = history[historyIndex];
      set({
        nodes: prevState.nodes,
        edges: prevState.edges,
        historyIndex: historyIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 2) {
      const nextIndex = historyIndex + 2; // +1 is the state we just restored from, +2 is the next
      const nextState = history[nextIndex];
      if (nextState) {
        set({
          nodes: nextState.nodes,
          edges: nextState.edges,
          historyIndex: nextIndex - 1,
        });
      }
    } else if (historyIndex === history.length - 2) {
      const nextState = history[history.length - 1];
      set({
        nodes: nextState.nodes,
        edges: nextState.edges,
        historyIndex: history.length - 1,
      });
    }
  },
}));
