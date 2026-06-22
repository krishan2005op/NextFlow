import type { Edge, Node } from "@xyflow/react";

export function createDefaultWorkflowNodes(): Node[] {
  return [
    {
      id: "request-inputs",
      type: "request_inputs",
      position: { x: 120, y: 120 },
      draggable: false,
      deletable: false,
      data: {
        fields: [
          {
            id: "text_field",
            name: "text_field",
            type: "text_field",
            value: "",
          },
          {
            id: "image_field",
            name: "image_field",
            type: "image_field",
            value: "",
            preview: "",
          },
        ],
        status: "idle",
      },
    },
    {
      id: "response",
      type: "response",
      position: { x: 980, y: 420 },
      deletable: false,
      data: {
        status: "idle",
        result: "",
      },
    },
  ];
}

export function createDefaultWorkflowEdges(): Edge[] {
  return [];
}
