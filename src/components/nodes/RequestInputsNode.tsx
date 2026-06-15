"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus, X, Upload, Image as ImageIcon } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

export function RequestInputsNode({ id, data }: any) {
  const { updateNode } = useWorkflowStore();
  const [showPicker, setShowPicker] = useState(false);

  const fields = data.fields || [];
  const status = data.status || "idle";

  const addField = (type: "text_field" | "image_field") => {
    const newField = {
      id: `${type}_${Date.now()}`,
      name: type,
      type,
      value: "",
    };
    updateNode(id, { fields: [...fields, newField] });
    setShowPicker(false);
  };

  const removeField = (fieldId: string) => {
    updateNode(id, { fields: fields.filter((f: any) => f.id !== fieldId) });
  };

  const updateField = (fieldId: string, updates: any) => {
    updateNode(id, {
      fields: fields.map((f: any) => (f.id === fieldId ? { ...f, ...updates } : f)),
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple preview immediately
    const objectUrl = URL.createObjectURL(file);
    updateField(fieldId, { preview: objectUrl, uploading: true });

    try {
      const formData = new FormData();
      formData.append(
        "params",
        JSON.stringify({
          auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
          template_id: "", // If you have a specific template, add it. Otherwise, standard upload
          steps: {
            import: { robot: "/upload/handle" },
          },
        })
      );
      formData.append("file", file);

      const res = await fetch("https://api2.transloadit.com/assemblies", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      const uploadedUrl = data.uploads?.[0]?.ssl_url || data.results?.import?.[0]?.ssl_url;

      if (uploadedUrl) {
        updateField(fieldId, { value: uploadedUrl, uploading: false });
      } else {
        updateField(fieldId, { uploading: false, error: "Upload failed" });
      }
    } catch (error) {
      console.error("Transloadit upload error", error);
      updateField(fieldId, { uploading: false, error: "Upload failed" });
    }
  };

  return (
    <div className={`bg-canvas-node border border-canvas-border rounded-lg min-w-[300px] shadow-lg ${status === "running" ? "animate-pulse-glow" : ""}`}>
      <div className="flex items-center justify-between p-3 border-b border-canvas-border">
        <div className="font-medium text-white flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-purple"></div>
          Request Inputs
        </div>
        <div className="relative">
          {showPicker && (
            <div className="absolute top-full mt-1 right-0 bg-[#2A2A2A] border border-[#3A3A3A] rounded shadow-xl p-1 z-10 w-32 flex flex-col gap-1">
              <button
                onClick={() => addField("text_field")}
                className="text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3A3A3A] hover:text-white rounded"
              >
                Text Field
              </button>
              <button
                onClick={() => addField("image_field")}
                className="text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3A3A3A] hover:text-white rounded"
              >
                Image Field
              </button>
            </div>
          )}
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="p-1 hover:bg-[#2A2A2A] rounded text-gray-400 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {fields.length === 0 ? (
          <div className="text-xs text-gray-500 italic">No inputs added yet.</div>
        ) : (
          fields.map((field: any, index: number) => (
            <div key={field.id} className="relative bg-[#0F0F0F] border border-[#2A2A2A] rounded p-2">
              <div className="flex items-center justify-between mb-2">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(field.id, { name: e.target.value })}
                  className="bg-transparent text-xs text-gray-300 font-medium outline-none border-b border-transparent focus:border-brand-purple w-2/3"
                />
                <button
                  onClick={() => removeField(field.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {field.type === "text_field" ? (
                <textarea
                  value={field.value}
                  onChange={(e) => updateField(field.id, { value: e.target.value })}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded text-xs text-gray-300 p-2 min-h-[60px] resize-none focus:outline-none focus:border-brand-purple nodrag"
                  placeholder="Enter text..."
                />
              ) : (
                <div className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded p-2 flex flex-col items-center justify-center min-h-[80px] relative">
                  {field.preview || field.value ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={field.value || field.preview}
                        alt="Preview"
                        className="max-h-[100px] object-contain rounded"
                      />
                      {field.uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                          <div className="text-xs text-white">Uploading...</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => handleImageUpload(e, field.id)}
                      />
                      <Upload className="w-5 h-5 text-gray-500 mb-1" />
                      <span className="text-xs text-gray-500">Upload Image</span>
                    </>
                  )}
                </div>
              )}

              {/* Individual Output Handle for each field */}
              <Handle
                type="source"
                position={Position.Right}
                id={field.id}
                className="w-3 h-3 bg-brand-purple !border-2 !border-[#0F0F0F] right-[-14px]"
                style={{ top: '50%' }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
