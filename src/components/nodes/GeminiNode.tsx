"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import { Sparkles, Settings2, ChevronDown, ChevronRight } from "lucide-react";

export function GeminiNode({ id, data }: any) {
  const { updateNode } = useWorkflowStore();
  const [showSettings, setShowSettings] = useState(false);
  const status = data.status || "idle";

  const model = data.model || "gemini-3.1-pro";
  const response = data.response || null;

  return (
    <div className={`bg-canvas-node border border-canvas-border rounded-lg min-w-[320px] shadow-lg ${status === "running" ? "animate-pulse-glow" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-canvas-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-brand-purple" />
          </div>
          <select
            value={model}
            onChange={(e) => updateNode(id, { model: e.target.value })}
            className="bg-transparent text-white font-medium text-sm outline-none focus:ring-1 focus:ring-brand-purple rounded px-1 nodrag"
          >
            <option value="gemini-3.1-pro" className="bg-[#1A1A1A]">Gemini 3.1 Pro</option>
            <option value="gemini-1.5-pro" className="bg-[#1A1A1A]">Gemini 1.5 Pro</option>
            <option value="gemini-1.5-flash" className="bg-[#1A1A1A]">Gemini 1.5 Flash</option>
          </select>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Inputs */}
        <div className="flex flex-col gap-3">
          <div className="relative flex items-center h-6">
            <Handle
              type="target"
              position={Position.Left}
              id="prompt"
              className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
            />
            <span className="text-xs font-medium text-white">Prompt <span className="text-red-400">*</span></span>
          </div>

          <div className="relative flex items-center h-6">
            <Handle
              type="target"
              position={Position.Left}
              id="system_prompt"
              className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
            />
            <span className="text-xs font-medium text-gray-300">System Prompt</span>
          </div>

          <div className="relative flex items-center h-6">
            <Handle
              type="target"
              position={Position.Left}
              id="image_vision"
              className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
            />
            <span className="text-xs font-medium text-gray-300">Image (Vision)</span>
          </div>
        </div>

        {/* Collapsed Settings */}
        <div className="border border-[#2A2A2A] rounded bg-[#0F0F0F] overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between p-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-3 h-3" />
              <span>Advanced Settings</span>
            </div>
            {showSettings ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          
          {showSettings && (
            <div className="p-3 border-t border-[#2A2A2A] flex flex-col gap-3">
              <div className="relative flex items-center h-5">
                <Handle
                  type="target"
                  position={Position.Left}
                  id="video"
                  className="w-2.5 h-2.5 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-17px]"
                />
                <span className="text-xs text-gray-400">Video</span>
              </div>
              <div className="relative flex items-center h-5">
                <Handle
                  type="target"
                  position={Position.Left}
                  id="audio"
                  className="w-2.5 h-2.5 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-17px]"
                />
                <span className="text-xs text-gray-400">Audio</span>
              </div>
              <div className="relative flex items-center h-5">
                <Handle
                  type="target"
                  position={Position.Left}
                  id="file"
                  className="w-2.5 h-2.5 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-17px]"
                />
                <span className="text-xs text-gray-400">File</span>
              </div>
            </div>
          )}
        </div>

        {/* Output */}
        {response && (
          <div className="mt-2 p-2 bg-[#0F0F0F] border border-[#2A2A2A] rounded text-xs text-gray-300 max-h-32 overflow-y-auto">
            {response}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="response"
        className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] right-[-6px]"
      />
    </div>
  );
}
