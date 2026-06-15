"use client";

import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import { Image as ImageIcon } from "lucide-react";

const InputField = ({ id, label, type, value, onChange, nodeId, disabled }: any) => {
  const connections = useNodeConnections({ handleType: "target", handleId: id });
  const isConnected = connections.length > 0;

  return (
    <div className="flex items-center justify-between gap-4 mb-3 relative">
      <Handle
        type="target"
        position={Position.Left}
        id={id}
        className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-18px]"
        style={{ top: '50%' }}
      />
      <span className="text-xs text-gray-300 font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={isConnected || disabled}
        className={`w-16 bg-[#0F0F0F] border border-[#2A2A2A] rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-brand-purple ${
          isConnected ? "opacity-50 cursor-not-allowed" : ""
        } nodrag`}
      />
    </div>
  );
};

export function CropImageNode({ id, data }: any) {
  const { updateNode } = useWorkflowStore();
  const status = data.status || "idle";

  const inputs = data.inputs || {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };

  const updateInput = (key: string, val: string | number) => {
    updateNode(id, { inputs: { ...inputs, [key]: val } });
  };

  const imageConnections = useNodeConnections({ handleType: "target", handleId: "input_image" });
  const isImageConnected = imageConnections.length > 0;

  return (
    <div className={`bg-canvas-node border border-canvas-border rounded-lg min-w-[260px] shadow-lg ${status === "running" ? "animate-pulse-glow" : ""}`}>
      <div className="flex items-center gap-2 p-3 border-b border-canvas-border">
        <div className="w-6 h-6 rounded bg-[#2A2A2A] flex items-center justify-center">
          <ImageIcon className="w-3 h-3 text-brand-purple" />
        </div>
        <div className="font-medium text-white">Crop Image</div>
      </div>

      <div className="p-4">
        {/* Input Image Handle */}
        <div className="flex items-center gap-2 mb-4 relative h-6">
          <Handle
            type="target"
            position={Position.Left}
            id="input_image"
            className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
            style={{ top: '50%' }}
          />
          <span className={`text-xs font-medium ${isImageConnected ? 'text-gray-400' : 'text-gray-300'}`}>Input Image</span>
        </div>

        <InputField
          id="x"
          label="X Position (%)"
          type="number"
          value={inputs.x}
          onChange={(e: any) => updateInput("x", Number(e.target.value))}
          nodeId={id}
        />
        <InputField
          id="y"
          label="Y Position (%)"
          type="number"
          value={inputs.y}
          onChange={(e: any) => updateInput("y", Number(e.target.value))}
          nodeId={id}
        />
        <InputField
          id="width"
          label="Width (%)"
          type="number"
          value={inputs.width}
          onChange={(e: any) => updateInput("width", Number(e.target.value))}
          nodeId={id}
        />
        <InputField
          id="height"
          label="Height (%)"
          type="number"
          value={inputs.height}
          onChange={(e: any) => updateInput("height", Number(e.target.value))}
          nodeId={id}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output_image"
        className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] right-[-6px]"
      />
    </div>
  );
}
