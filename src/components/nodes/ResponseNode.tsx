"use client";

import { Handle, Position } from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";

export function ResponseNode({ data }: any) {
  const status = data.status || "idle";
  const result = data.result || null;

  return (
    <div className={`bg-canvas-node border border-canvas-border rounded-lg min-w-[280px] shadow-lg ${status === "running" ? "animate-pulse-glow" : ""}`}>
      <div className="flex items-center gap-2 p-3 border-b border-canvas-border">
        <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-brand-purple" />
        </div>
        <div className="font-medium text-white">Response</div>
      </div>

      <div className="p-4 flex flex-col gap-2">
        <div className="relative flex items-center h-6">
          <Handle
            type="target"
            position={Position.Left}
            id="result"
            className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
          />
          <span className="text-xs font-medium text-white">Result</span>
        </div>

        <div className="mt-2 min-h-[60px] p-2 bg-[#0F0F0F] border border-[#2A2A2A] rounded text-xs text-gray-300 max-h-48 overflow-y-auto break-words">
          {result ? result : <span className="text-gray-500 italic">Workflow output will appear here...</span>}
        </div>
      </div>
    </div>
  );
}
