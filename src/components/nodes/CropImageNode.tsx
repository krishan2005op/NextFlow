"use client";

import { Handle, Position, useNodeConnections } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflow-store";
import { Image as ImageIcon } from "lucide-react";

type CropInputs = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type InputFieldProps = {
  id: keyof CropInputs;
  label: string;
  type: "number";
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

const InputField = ({ id, label, type, value, onChange, disabled }: InputFieldProps) => {
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
      <span className="text-xs font-medium text-[#3f3932]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={isConnected || disabled}
        className={`nodrag w-16 rounded-lg border border-[#e3ddd1] bg-[#fbfaf6] px-2 py-1 text-right text-xs text-[#2f2a24] focus:border-brand-purple focus:outline-none ${
          isConnected ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );
};

export function CropImageNode({
  id,
  data,
}: {
  id: string;
  data: { inputs?: Partial<CropInputs>; status?: string };
}) {
  const { updateNode } = useWorkflowStore();
  const status = data.status || "idle";

  const inputs: CropInputs = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...data.inputs,
  };

  const updateInput = (key: keyof CropInputs, val: number) => {
    updateNode(id, { inputs: { ...inputs, [key]: val } });
  };

  const imageConnections = useNodeConnections({ handleType: "target", handleId: "input_image" });
  const isImageConnected = imageConnections.length > 0;

  return (
    <div className={`min-w-[280px] rounded-[24px] border border-[#ddd7cb] bg-white shadow-[0_12px_40px_rgba(27,26,23,0.08)] ${status === "running" ? "animate-pulse-glow" : ""}`}>
      <div className="flex items-center gap-2 border-b border-[#ece6db] p-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3efe7]">
          <ImageIcon className="w-3 h-3 text-brand-purple" />
        </div>
        <div className="text-sm font-semibold text-[#171511]">Crop Image</div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 relative h-6">
          <Handle
            type="target"
            position={Position.Left}
            id="input_image"
            className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] left-[-22px]"
            style={{ top: '50%' }}
          />
          <span className={`text-xs font-medium ${isImageConnected ? 'text-[#9a9184]' : 'text-[#3f3932]'}`}>Input Image</span>
        </div>

        <InputField
          id="x"
          label="X Position (%)"
          type="number"
          value={inputs.x}
          onChange={(e) => updateInput("x", Number(e.target.value))}
        />
        <InputField
          id="y"
          label="Y Position (%)"
          type="number"
          value={inputs.y}
          onChange={(e) => updateInput("y", Number(e.target.value))}
        />
        <InputField
          id="width"
          label="Width (%)"
          type="number"
          value={inputs.width}
          onChange={(e) => updateInput("width", Number(e.target.value))}
        />
        <InputField
          id="height"
          label="Height (%)"
          type="number"
          value={inputs.height}
          onChange={(e) => updateInput("height", Number(e.target.value))}
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
