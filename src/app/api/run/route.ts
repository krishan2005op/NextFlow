import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { topologicalSort } from "@/lib/dag";
import { parseStoredJson } from "@/lib/workflow-json";
import { cropImageTask, geminiTask } from "@/triggers";

type StoredNode = {
  id: string;
  type: string;
  data?: {
    fields?: Array<{ id: string; value: string }>;
    inputs?: Record<string, unknown>;
    model?: string;
    prompt?: string;
  };
};

type StoredEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};

type TriggerRunOutput = {
  croppedImageUrl?: string;
  response?: string;
  fallback?: boolean;
};

const SAFE_MODEL = "gemini-2.0-flash";
const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-1.5-pro": SAFE_MODEL,
  "gemini-1.5-pro-latest": SAFE_MODEL,
  "gemini-3.1-pro": SAFE_MODEL,
  "gemini-pro": SAFE_MODEL,
  "gemini-1.0-pro": SAFE_MODEL,
};

function sanitizeModel(model?: string): string {
  if (!model) {
    return SAFE_MODEL;
  }

  return DEPRECATED_MODELS[model] ?? model;
}

async function pollTriggerRun(runId: string): Promise<TriggerRunOutput> {
  const apiKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY;

  if (!apiKey) {
    throw new Error("TRIGGER_API_KEY is not set");
  }

  const terminalStatuses = new Set([
    "SUCCESS",
    "COMPLETED",
    "FAILURE",
    "FAILED",
    "CANCELED",
    "CRASHED",
    "TIMED_OUT",
  ]);

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const res = await fetch(`https://api.trigger.dev/api/v2/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Trigger API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const runData = (await res.json()) as {
      output?: TriggerRunOutput;
      status?: string;
      state?: string;
    };
    const status = runData.status ?? runData.state ?? "";

    if (status === "SUCCESS" || status === "COMPLETED") {
      return runData.output ?? {};
    }

    if (terminalStatuses.has(status)) {
      throw new Error(`Trigger run ${runId} ended with status: ${status}`);
    }
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { workflowId, scope = "full" } = (await req.json()) as {
    workflowId: string;
    scope?: string;
  };

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });

  if (!dbUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workflow = await db.workflow.findUnique({
    where: { id: workflowId, userId: dbUser.id },
  });

  if (!workflow) {
    return new Response("Workflow not found", { status: 404 });
  }

  const nodes = parseStoredJson<StoredNode[]>(workflow.nodes, []);
  const edges = parseStoredJson<StoredEdge[]>(workflow.edges, []);

  try {
    topologicalSort(nodes, edges);
  } catch {
    return new Response(JSON.stringify({ error: "Cycle detected in DAG" }), {
      status: 400,
    });
  }

  const runRecord = await db.workflowRun.create({
    data: {
      workflowId,
      status: "running",
      scope,
      nodeResults: [] as Prisma.InputJsonValue,
    },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const nodeResults: Array<Record<string, unknown>> = [];
      const nodeOutputs: Record<string, Record<string, unknown>> = {};
      const nodePromises: Record<string, Promise<Record<string, unknown> | null>> =
        {};

      const resolveInputs = (nodeId: string, node: StoredNode) => {
        const incomingEdges = edges.filter((edge) => edge.target === nodeId);
        const resolved: Record<string, unknown> = {
          ...(node.data?.inputs ?? {}),
        };

        for (const edge of incomingEdges) {
          const sourceOutput = nodeOutputs[edge.source];

          if (!sourceOutput) {
            continue;
          }

          if (edge.targetHandle === "image_vision") {
            const existing = Array.isArray(resolved.image_vision)
              ? resolved.image_vision
              : [];
            resolved.image_vision = [
              ...existing,
              sourceOutput[edge.sourceHandle ?? "output"],
            ];
            continue;
          }

          if (edge.targetHandle) {
            resolved[edge.targetHandle] =
              sourceOutput[edge.sourceHandle ?? "output"];
          } else {
            resolved.input = sourceOutput.output;
          }
        }

        return resolved;
      };

      const executeNode = async (nodeId: string) => {
        const incomingEdges = edges.filter((edge) => edge.target === nodeId);
        await Promise.all(incomingEdges.map((edge) => nodePromises[edge.source]));

        const node = nodes.find((entry) => entry.id === nodeId);

        if (!node) {
          return null;
        }

        const startedAt = new Date().toISOString();
        sendUpdate({ type: "node_start", nodeId });

        try {
          let output: Record<string, unknown> = {};

          if (node.type === "request_inputs") {
            for (const field of node.data?.fields ?? []) {
              output[field.id] = field.value;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          } else if (node.type === "crop_image") {
            const inputs = resolveInputs(nodeId, node);
            const handle = await tasks.trigger<typeof cropImageTask>(
              "crop-image",
              {
                imageUrl: String(inputs.input_image ?? ""),
                x: Number(inputs.x ?? 0),
                y: Number(inputs.y ?? 0),
                width: Number(inputs.width ?? 100),
                height: Number(inputs.height ?? 100),
              },
            );
            const cropResult = await pollTriggerRun(handle.id);
            output = {
              output_image: cropResult.croppedImageUrl ?? "",
              fallback: cropResult.fallback ?? false,
            };
          } else if (node.type === "gemini") {
            const inputs = resolveInputs(nodeId, node);
            const prompt =
              typeof inputs.prompt === "string" && inputs.prompt.trim().length > 0
                ? inputs.prompt
                : node.data?.prompt ?? "Write a helpful response.";

            const handle = await tasks.trigger<typeof geminiTask>("gemini-task", {
              prompt,
              systemPrompt:
                typeof inputs.system_prompt === "string"
                  ? inputs.system_prompt
                  : undefined,
              imageUrl: inputs.image_vision as string | string[] | undefined,
              model: sanitizeModel(node.data?.model),
            });
            const geminiResult = await pollTriggerRun(handle.id);
            output = {
              response: geminiResult.response ?? "",
              fallback: geminiResult.fallback ?? false,
            };
          } else if (node.type === "response") {
            const inputs = resolveInputs(nodeId, node);
            output = { result: String(inputs.result ?? "") };
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const finishedAt = new Date().toISOString();
          nodeOutputs[nodeId] = output;

          const nodeResult = {
            nodeId,
            status: "success",
            startedAt,
            finishedAt,
            output,
          };
          nodeResults.push(nodeResult);
          sendUpdate({ type: "node_success", ...nodeResult });

          return output;
        } catch (error) {
          const finishedAt = new Date().toISOString();
          const message =
            error instanceof Error ? error.message : "Unknown execution error";
          const nodeResult = {
            nodeId,
            status: "failed",
            startedAt,
            finishedAt,
            error: message,
          };
          nodeResults.push(nodeResult);
          sendUpdate({ type: "node_failed", ...nodeResult });
          throw new Error(`Node ${nodeId} failed: ${message}`);
        }
      };

      try {
        for (const node of nodes) {
          nodePromises[node.id] = executeNode(node.id);
        }

        await Promise.all(Object.values(nodePromises));

        await db.workflowRun.update({
          where: { id: runRecord.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            nodeResults: nodeResults as Prisma.InputJsonValue,
          },
        });

        sendUpdate({ type: "workflow_success" });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Workflow execution failed";

        await db.workflowRun.update({
          where: { id: runRecord.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            nodeResults: nodeResults as Prisma.InputJsonValue,
          },
        });

        sendUpdate({ type: "workflow_failed", error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
