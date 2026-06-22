"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronRight, Settings2, Sparkles } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

export function GeminiNode({
  id,
  data,
}: {
  id: string;
  data: {
    fallback?: boolean;
    model?: string;
    response?: string;
    status?: string;
  };
}) {
  const { updateNode } = useWorkflowStore();
  const [showSettings, setShowSettings] = useState(false);
  const status = data.status || "idle";
  const model = data.model || "gemini-2.5-flash";
  const response = data.response || "";
  const fallback = data.fallback || false;

  return (
    <div
      className={`min-w-[330px] rounded-[24px] border border-[#ddd7cb] bg-white shadow-[0_12px_40px_rgba(27,26,23,0.08)] ${
        status === "running" ? "animate-pulse-glow" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#ece6db] p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3efe7]">
            <Sparkles className="h-3 w-3 text-brand-purple" />
          </div>
          <select
            value={model}
            onChange={(event) => updateNode(id, { model: event.target.value })}
            className="nodrag rounded px-1 text-sm font-semibold text-[#171511] outline-none focus:ring-1 focus:ring-brand-purple"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="relative flex h-6 items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="prompt"
              className="!left-[-22px] !h-3 !w-3 !border-2 !border-white bg-brand-purple"
            />
            <span className="text-xs font-medium text-[#171511]">
              Prompt <span className="text-red-400">*</span>
            </span>
          </div>

          <div className="relative flex h-6 items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="system_prompt"
              className="!left-[-22px] !h-3 !w-3 !border-2 !border-white bg-brand-purple"
            />
            <span className="text-xs font-medium text-[#625b52]">
              System Prompt
            </span>
          </div>

          <div className="relative flex h-6 items-center">
            <Handle
              type="target"
              position={Position.Left}
              id="image_vision"
              className="!left-[-22px] !h-3 !w-3 !border-2 !border-white bg-brand-purple"
            />
            <span className="text-xs font-medium text-[#625b52]">
              Image (Vision)
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#ece6db] bg-[#faf8f3]">
          <button
            onClick={() => setShowSettings((current) => !current)}
            className="flex w-full items-center justify-between p-2 text-xs text-[#6f675d] transition-colors hover:text-[#171511]"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-3 w-3" />
              <span>Advanced Settings</span>
            </div>
            {showSettings ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {showSettings ? (
            <div className="flex flex-col gap-3 border-t border-[#ece6db] p-3">
              {["video", "audio", "file"].map((handleId) => (
                <div key={handleId} className="relative flex h-5 items-center">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={handleId}
                    className="!left-[-17px] !h-2.5 !w-2.5 !border-2 !border-[#faf8f3] bg-brand-purple"
                  />
                  <span className="text-xs capitalize text-[#6f675d]">
                    {handleId}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        

        {fallback ? (
          <div className="text-[11px] font-medium text-[#9a6b2f]">
            Fallback response used because the remote Gemini task is unavailable.
          </div>
        ) : null}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="response"
        className="!right-[-6px] !h-3 !w-3 !border-2 !border-white bg-brand-purple"
      />
    </div>
  );
}
