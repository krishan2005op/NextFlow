"use client";

import { Handle, Position } from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";

export function ResponseNode({
  data,
}: {
  data: { result?: string; status?: string };
}) {
  const status = data.status || "idle";
  const result = data.result || "";

  return (
    <div
      className={`w-[420px] max-w-[420px]  rounded-[24px] border border-[#ddd7cb] bg-white shadow-[0_12px_40px_rgba(27,26,23,0.08)] ${
        status === "running" ? "animate-pulse-glow" : ""
      }`}
    >
      <div className="flex items-center gap-2 border-b border-[#ece6db] p-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3efe7]">
          <CheckCircle2 className="h-3 w-3 text-brand-purple" />
        </div>
        <div className="text-sm font-semibold text-[#171511]">Response</div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="relative flex h-6 items-center">
          <Handle
            type="target"
            position={Position.Left}
            id="result"
            className="!left-[-22px] !h-3 !w-3 !border-2 !border-white bg-brand-purple"
          />
          <span className="text-xs font-medium text-[#171511]">Result</span>
        </div>

        <div className="mt-2 min-h-[72px] max-h-96 overflow-y-auto rounded-[18px] border border-[#ece6db] bg-[#fbfaf6] p-3 text-xs  text-[#2f2a24] whitespace-pre-wrap break-words">
          {result || (
            <span className="italic text-[#8b8276]">
              Workflow output will appear here...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
