"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

type RequestField = {
  id: string;
  name: string;
  type: "text_field" | "image_field";
  value: string;
  preview?: string;
  uploading?: boolean;
  error?: string;
};

export function RequestInputsNode({
  id,
  data,
}: {
  id: string;
  data: { fields?: RequestField[]; status?: string };
}) {
  const { updateNode } = useWorkflowStore();
  const [showPicker, setShowPicker] = useState(false);

  const fields = data.fields || [];
  const status = data.status || "idle";

  const addField = (type: "text_field" | "image_field") => {
    const count = fields.filter((field) => field.type === type).length + 1;
    const newField: RequestField = {
      id: `${type}_${Date.now()}`,
      name: count === 1 ? type : `${type}_${count}`,
      type,
      value: "",
      preview: "",
    };

    updateNode(id, { fields: [...fields, newField] });
    setShowPicker(false);
  };

  const removeField = (fieldId: string) => {
    updateNode(id, {
      fields: fields.filter((field) => field.id !== fieldId),
    });
  };

  const updateField = (fieldId: string, updates: Partial<RequestField>) => {
    updateNode(id, {
      fields: fields.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field,
      ),
    });
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const preview = URL.createObjectURL(file);
    updateField(fieldId, { preview, uploading: true, error: undefined });

    try {
      const formData = new FormData();
      formData.append(
        "params",
        JSON.stringify({
          auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
          steps: {
            import: { robot: "/upload/handle" },
          },
        }),
      );
      formData.append("file", file);

      const res = await fetch("https://api2.transloadit.com/assemblies", {
        method: "POST",
        body: formData,
      });
      const result = (await res.json()) as {
        uploads?: Array<{ ssl_url?: string }>;
        results?: { import?: Array<{ ssl_url?: string }> };
      };
      const uploadedUrl =
        result.uploads?.[0]?.ssl_url || result.results?.import?.[0]?.ssl_url;

      updateField(fieldId, {
        value: uploadedUrl || preview,
        preview,
        uploading: false,
        error: uploadedUrl ? undefined : "Upload fallback preview in use",
      });
    } catch (error) {
      console.error("Transloadit upload error", error);
      updateField(fieldId, {
        value: preview,
        preview,
        uploading: false,
        error: "Upload failed. Using local preview.",
      });
    }

    event.target.value = "";
  };

  return (
    <div
      className={`min-w-[340px] rounded-[24px] border border-[#ddd7cb] bg-white shadow-[0_12px_40px_rgba(27,26,23,0.08)] ${
        status === "running" ? "animate-pulse-glow" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#ece6db] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-brand-purple" />
          <div className="text-sm font-semibold text-[#171511]">Request Inputs</div>
        </div>
        <div className="relative">
          {showPicker && (
            <div className="absolute right-0 top-full z-10 mt-2 flex w-36 flex-col gap-1 rounded-2xl border border-[#e3ddd1] bg-white p-1 shadow-xl">
              <button
                onClick={() => addField("text_field")}
                className="rounded-xl px-3 py-2 text-left text-xs font-medium text-[#4c463f] hover:bg-[#f5f1e8]"
              >
                Text Field
              </button>
              <button
                onClick={() => addField("image_field")}
                className="rounded-xl px-3 py-2 text-left text-xs font-medium text-[#4c463f] hover:bg-[#f5f1e8]"
              >
                Image Field
              </button>
            </div>
          )}
          <button
            onClick={() => setShowPicker((current) => !current)}
            className="rounded-full p-1.5 text-[#746c61] transition-colors hover:bg-[#f3eee5] hover:text-[#171511]"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {fields.map((field) => (
          <div
            key={field.id}
            className="relative rounded-[20px] border border-[#ece6db] bg-[#fbf9f4] p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <input
                type="text"
                value={field.name}
                onChange={(event) =>
                  updateField(field.id, { name: event.target.value })
                }
                className="w-2/3 border-b border-transparent bg-transparent text-xs font-semibold text-[#3f3932] outline-none focus:border-brand-purple"
              />
              <button
                onClick={() => removeField(field.id)}
                className="rounded-full p-1 text-[#92897d] transition-colors hover:bg-[#efe8dc] hover:text-[#8b2d2d]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {field.type === "text_field" ? (
              <textarea
                value={field.value}
                onChange={(event) =>
                  updateField(field.id, { value: event.target.value })
                }
                className="nodrag min-h-[88px] w-full resize-none rounded-2xl border border-[#e8e1d5] bg-white px-3 py-2 text-xs text-[#3f3932] outline-none focus:border-brand-purple"
                placeholder="Enter text..."
              />
            ) : (
              <div className="rounded-[18px] border border-[#e8e1d5] bg-white p-3">
                <input
                  id={`${field.id}-upload`}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => handleImageUpload(event, field.id)}
                />
                {field.preview || field.value ? (
                  <div className="flex flex-col gap-3">
                    <div className="relative overflow-hidden rounded-2xl border border-[#efe8dc] bg-[#faf7f0]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.preview || field.value}
                        alt={field.name}
                        className="h-[120px] w-full object-cover"
                      />
                      {field.uploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium text-[#4c463f]">
                          Uploading...
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          document.getElementById(`${field.id}-upload`)?.click()
                        }
                        className="flex items-center gap-2 rounded-full bg-[#111111] px-3 py-1.5 text-xs font-medium text-white"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        Change
                      </button>
                      <button
                        onClick={() =>
                          updateField(field.id, {
                            value: "",
                            preview: "",
                            error: undefined,
                          })
                        }
                        className="flex items-center gap-2 rounded-full border border-[#e2dbcf] px-3 py-1.5 text-xs font-medium text-[#5f574d]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    {field.error ? (
                      <div className="text-[11px] text-[#8f6740]">{field.error}</div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      document.getElementById(`${field.id}-upload`)?.click()
                    }
                    className="flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d7d0c2] bg-[#fbf9f4] text-[#7a7266]"
                  >
                    <div className="rounded-full bg-white p-2 shadow-sm">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="text-xs font-medium">Upload or replace image</div>
                  </button>
                )}
              </div>
            )}

            <Handle
              type="source"
              position={Position.Right}
              id={field.id}
              className="!right-[-14px] !h-3 !w-3 !border-2 !border-[#fbf9f4] bg-brand-purple"
              style={{ top: "50%" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
