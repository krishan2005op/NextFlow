"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Connection,
  Edge,
  Node,
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflow-store";
import { RequestInputsNode, ResponseNode, CropImageNode, GeminiNode } from "@/components/nodes";
import { Plus, Search } from "lucide-react";

const nodeTypes = {
  request_inputs: RequestInputsNode,
  response: ResponseNode,
  crop_image: CropImageNode,
  gemini: GeminiNode,
};

export function WorkflowCanvas({
  workflowId,
  initialNodes,
  initialEdges,
}: {
  workflowId: string;
  initialNodes: Node[];
  initialEdges: Edge[];
}) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    resetWorkflow,
    setWorkflowId,
    addNode,
    removeNode,
    removeEdges,
    undo,
    redo,
  } = useWorkflowStore();

  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery] = useState("");
  const pickerItems = useMemo(
    () =>
      [
        { type: "crop_image", label: "Crop Image", category: "Image" },
        { type: "gemini", label: "Gemini 3.1 Pro", category: "LLM" },
      ].filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  useEffect(() => {
    setWorkflowId(workflowId);
    resetWorkflow(initialNodes, initialEdges);
  }, [initialEdges, initialNodes, resetWorkflow, setWorkflowId, workflowId]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      }).catch(console.error);
    }, 1000);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflowId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const handleAddNode = (type: string, label: string) => {
    const totalNodes = nodes.length;
    let nodeIndex = nodes.filter((node) => node.type === type).length + 1;
    let nodeId = `${type}-${nodeIndex}`;

    while (nodes.some((node) => node.id === nodeId)) {
      nodeIndex += 1;
      nodeId = `${type}-${nodeIndex}`;
    }

    const newNode = {
      id: nodeId,
      type,
      position: {
        x: 420 + totalNodes * 42,
        y: 180 + (totalNodes % 4) * 120,
      },
      data:
        type === "crop_image"
          ? {
              label,
              status: "idle",
              inputs: { x: 0, y: 0, width: 100, height: 100 },
            }
          : {
              label,
              status: "idle",
              model: "gemini-2.5-flash",
              inputs: { system_prompt: "" },
            },
    };
    addNode(newNode);
    setShowPicker(false);
    setQuery("");
  };

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const sourceHandle = connection.sourceHandle ?? null;
    const targetHandle = connection.targetHandle ?? null;
    
    if (!sourceHandle || !targetHandle) return true;

    // Determine Source Type
    let sourceType = "unknown";
    if (sourceHandle.startsWith("text_") || sourceHandle === "response") {
      sourceType = "text";
    } else if (sourceHandle.startsWith("image_") || sourceHandle === "output_image") {
      sourceType = "image";
    }

    // Determine Target Accept Type
    let targetAccepts = "any";
    if (["input_image", "image_vision"].includes(targetHandle)) {
      targetAccepts = "image";
    } else if (["prompt", "system_prompt", "x", "y", "width", "height"].includes(targetHandle)) {
      targetAccepts = "text";
    } else if (targetHandle === "result") {
      targetAccepts = "any";
    }

    if (targetAccepts === "any") return true;
    return sourceType === targetAccepts;
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) {
        return;
      }

      onConnect(connection);
    },
    [isValidConnection, onConnect],
  );

  return (
    <div className="flex-1 w-full h-full bg-[#f6f4ef] relative">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onEdgesDelete={removeEdges}
          deleteKeyCode={["Delete", "Backspace"]}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#f6f4ef]"
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#d7d2c8" gap={22} variant={BackgroundVariant.Dots} />
          <Controls className="rounded-2xl border border-[#ded9ce] bg-white fill-[#1b1a17] text-[#1b1a17] shadow-sm" />
          <MiniMap 
            nodeColor="#7C3AED" 
            maskColor="rgba(244, 241, 234, 0.78)" 
            className="rounded-2xl border border-[#ded9ce] bg-white shadow-sm"
          />

          <Panel position="bottom-center" className="mb-5">
            <div className="relative">
              {showPicker && (
                <div className="absolute bottom-full left-1/2 z-50 mb-4 flex w-[280px] -translate-x-1/2 flex-col gap-2 rounded-3xl border border-[#ded9ce] bg-white p-3 shadow-[0_18px_50px_rgba(27,26,23,0.16)]">
                  <div className="flex items-center gap-2 rounded-2xl border border-[#ebe6dc] bg-[#faf8f3] px-3 py-2">
                    <Search className="h-4 w-4 text-[#8f887b]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search nodes"
                      className="w-full bg-transparent text-sm text-[#1b1a17] outline-none placeholder:text-[#9d9487]"
                    />
                  </div>
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9d9487]">
                    Add Node
                  </div>
                  {pickerItems.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNode(item.type, item.label)}
                      className="flex items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[#f4f1ea]"
                    >
                      <span className="text-sm font-medium text-[#1b1a17]">
                        {item.label}
                      </span>
                      <span className="rounded-full bg-[#f0ece4] px-2 py-1 text-[11px] font-medium text-[#6f675d]">
                        {item.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="rounded-full bg-[#111111] p-3 text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#23201b]"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
