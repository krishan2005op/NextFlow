"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
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
import { Plus } from "lucide-react";

const nodeTypes = {
  request_inputs: RequestInputsNode,
  response: ResponseNode,
  crop_image: CropImageNode,
  gemini: GeminiNode,
};

export function WorkflowCanvas({ workflowId, initialNodes, initialEdges }: { workflowId: string, initialNodes: any[], initialEdges: any[] }) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    setWorkflowId,
    addNode,
    undo,
    redo,
    historyIndex
  } = useWorkflowStore();

  const [showPicker, setShowPicker] = useState(false);

  // Initialize store with server data
  useEffect(() => {
    setWorkflowId(workflowId);
    if (nodes.length === 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // Auto-save logic
  useEffect(() => {
    if (nodes.length === 0) return; // avoid saving empty on initial mount if state not synced
    const timer = setTimeout(() => {
      fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      }).catch(console.error);
    }, 1000);

    return () => clearTimeout(timer);
  }, [nodes, edges, workflowId]);

  // Keyboard shortcuts
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
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 },
      data: { label },
    };
    addNode(newNode);
    setShowPicker(false);
  };

  const isValidConnection = useCallback((connection: any) => {
    const { sourceHandle, targetHandle } = connection;
    
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

  return (
    <div className="flex-1 w-full h-full bg-[#0F0F0F] relative">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#0F0F0F]"
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#2A2A2A" gap={20} variant={BackgroundVariant.Dots} />
          <Controls className="bg-[#1A1A1A] border border-[#2A2A2A] fill-white text-white" />
          <MiniMap 
            nodeColor="#7C3AED" 
            maskColor="rgba(15, 15, 15, 0.7)" 
            className="bg-[#1A1A1A] border border-[#2A2A2A]"
          />

          <Panel position="bottom-center" className="mb-4">
            <div className="relative">
              {showPicker && (
                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl p-2 w-48 flex flex-col gap-1 z-50">
                  <button
                    onClick={() => handleAddNode("crop_image", "Crop Image")}
                    className="text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2A2A2A] hover:text-white rounded transition-colors"
                  >
                    Crop Image
                  </button>
                  <button
                    onClick={() => handleAddNode("gemini", "Gemini 3.1 Pro")}
                    className="text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#2A2A2A] hover:text-white rounded transition-colors"
                  >
                    Gemini 3.1 Pro
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105"
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
