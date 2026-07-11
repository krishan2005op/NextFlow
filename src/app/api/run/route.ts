import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { topologicalSort } from "@/lib/dag";
import { parseStoredJson } from "@/lib/workflow-json";
import { cropImageTask, aiTask } from "@/triggers";
import { generateAI } from "@/lib/ai/provider";

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

const GEMINI_SAFE_MODEL = "gemini-2.5-flash";
const RNET_SAFE_MODEL = "gemini-2.5-flash-lite";
const GEMINI_TRIGGER_TIMEOUT_MS = 60_000; 
const CROP_TRIGGER_TIMEOUT_MS = 45_000;
const GEMINI_DEPRECATED_MODELS: Record<string, string> = {
  "gemini-1.5-pro": GEMINI_SAFE_MODEL,
  "gemini-1.5-pro-latest": GEMINI_SAFE_MODEL,
  "gemini-3.1-pro": GEMINI_SAFE_MODEL,
  "gemini-pro": GEMINI_SAFE_MODEL,
  "gemini-1.0-pro": GEMINI_SAFE_MODEL,
};

function sanitizeModel(
  model: string | undefined,
  provider: "GEMINI" | "RNET"
): string {
  if (provider === "RNET") {
    return RNET_SAFE_MODEL;
  }

  if (!model) {
    return GEMINI_SAFE_MODEL;
  }

  return GEMINI_DEPRECATED_MODELS[model] ?? model;
}

function buildQuotaFallback(prompt: string, systemPrompt?: string) {
  const compactPrompt = prompt.replace(/\s+/g, " ").trim();
  const clippedPrompt =
    compactPrompt.length > 220
      ? `${compactPrompt.slice(0, 217).trimEnd()}...`
      : compactPrompt;

  if (systemPrompt?.toLowerCase().includes("tweet")) {
    return `Launch-ready hook: ${clippedPrompt.slice(0, 180)}${
      clippedPrompt.length > 180 ? "..." : ""
    }`;
  }

  if (systemPrompt?.toLowerCase().includes("marketing")) {
    return `A polished marketing draft based on the provided product details: ${clippedPrompt}`;
  }

  return `Temporary fallback response generated while the remote LLM task is unavailable. Source prompt: ${clippedPrompt}`;
}

function normalizeTriggerError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Trigger task did not complete";

  if (message.includes("<!DOCTYPE html")) {
    return "Trigger.dev returned an HTML 404 while polling the run. Check that the Trigger task is deployed and the API URL/key belong to the same environment.";
  }

  return message;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function pollTriggerRun(
  runId: string,
  timeoutMs: number,
): Promise<TriggerRunOutput> {
  const runData = await withTimeout(
    runs.poll(runId, { pollIntervalMs: 2000 }),
    timeoutMs,
    `Trigger run ${runId}`,
  );

  if (runData.status === "COMPLETED") {
    return (runData.output ?? {}) as TriggerRunOutput;
  }

  throw new Error(
    runData.error?.message ??
      `Trigger run ${runId} ended with status: ${runData.status}`,
  );
}

async function updateWorkflowRunWithRetry(
  runId: string,
  data: Prisma.WorkflowRunUpdateInput,
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.workflowRun.update({
        where: { id: runId },
        data,
      });
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.warn("[NextFlow] Retrying workflow run update", {
        attempt,
        error: error instanceof Error ? error.message : "Unknown DB error",
      });
      await db.$disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      await db.$connect().catch(() => undefined);
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

  const aiConnection = await db.aIConnection.findUnique({
  where:{
    userId: dbUser.id
  }
});


const aiProvider =
  aiConnection?.provider ?? "GEMINI";

  

  const workflow = await db.workflow.findUnique({
    where: { id: workflowId, userId: dbUser.id },
  });

  if (!workflow) {
    return new Response("Workflow not found", { status: 404 });
  }

  const nodes = parseStoredJson<StoredNode[]>(workflow.nodes, []);
  const edges = parseStoredJson<StoredEdge[]>(workflow.edges, []);
  console.log(
    "ALL NODE TYPES:",
    nodes.map(n => n.type)
  );
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
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

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

      const runNode = (nodeId: string): Promise<Record<string, unknown> | null> => {
        nodePromises[nodeId] ??= executeNode(nodeId);
        return nodePromises[nodeId];
      };

      const executeNode = async (nodeId: string) => {
        const incomingEdges = edges.filter((edge) => edge.target === nodeId);
        await Promise.all(incomingEdges.map((edge) => runNode(edge.source)));

        const node = nodeById.get(nodeId);

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
            let cropResult: TriggerRunOutput;

            try {
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
              cropResult = await pollTriggerRun(
                handle.id,
                CROP_TRIGGER_TIMEOUT_MS,
              );
            } catch (error) {
              console.warn("[NextFlow] Crop task fallback", {
                error: normalizeTriggerError(error),
              });
              await new Promise((resolve) => setTimeout(resolve, 30000));
              cropResult = {
                croppedImageUrl: String(inputs.input_image ?? ""),
                fallback: true,
              };
            }

            output = {
              output_image: cropResult.croppedImageUrl ?? "",
              fallback: cropResult.fallback ?? false,
            };
          } else if (node.type === "gemini") {
            console.log("========== GEMINI NODE EXECUTION ==========");
            console.log("Node ID:", nodeId);
            console.log("Provider:", aiProvider);
            console.log("============================================");
            const inputs = resolveInputs(nodeId, node);
            const prompt =
              typeof inputs.prompt === "string" && inputs.prompt.trim().length > 0
                ? inputs.prompt
                : node.data?.prompt ?? "Write a helpful response.";

            const systemPrompt =
              typeof inputs.system_prompt === "string"
                ? inputs.system_prompt
                : undefined;
            let geminiResult: TriggerRunOutput;

            try {
              
              const handle = await tasks.trigger<typeof aiTask>(
  "ai-task",
  {
    provider: aiProvider,
    prompt,
    systemPrompt,
    imageUrl: inputs.image_vision as string | string[] | undefined,
    model: sanitizeModel(
      node.data?.model,
      aiProvider
    ),

    accessToken: aiConnection?.accessToken ?? undefined, // temporary
    userId: dbUser.id,
  },
);
              geminiResult = await pollTriggerRun(
                handle.id,
                GEMINI_TRIGGER_TIMEOUT_MS,
              );
            } catch (error) {
              console.warn("[NextFlow] Gemini task fallback", {
                error: normalizeTriggerError(error),
              });
              geminiResult = {
                response: buildQuotaFallback(prompt, systemPrompt),
                fallback: true,
              };
            }

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
          runNode(node.id);
        }

        await Promise.all(Object.values(nodePromises));

        await updateWorkflowRunWithRetry(runRecord.id, {
          status: "success",
          finishedAt: new Date(),
          nodeResults: nodeResults as Prisma.InputJsonValue,
        });

        sendUpdate({ type: "workflow_success" });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Workflow execution failed";

        await updateWorkflowRunWithRetry(runRecord.id, {
          status: "failed",
          finishedAt: new Date(),
          nodeResults: nodeResults as Prisma.InputJsonValue,
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
