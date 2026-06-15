import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { topologicalSort } from "@/lib/dag";
import { tasks } from "@trigger.dev/sdk/v3";
import { cropImageTask, geminiTask } from "@/triggers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

// Helper: poll a Trigger.dev run until it completes
async function pollTriggerRun(runId: string): Promise<any> {
  const apiKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY;
  if (!apiKey) throw new Error("TRIGGER_SECRET_KEY is not set");

  const terminalStatuses = new Set(["SUCCESS", "COMPLETED", "FAILURE", "FAILED", "CANCELED", "CRASHED", "TIMED_OUT"]);

  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`https://api.trigger.dev/api/v2/runs/${runId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Trigger API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const runData = await res.json();
    const status: string = runData.status ?? runData.state ?? "";

    if (status === "SUCCESS" || status === "COMPLETED") {
      return runData.output;
    }
    if (terminalStatuses.has(status)) {
      throw new Error(`Trigger run ${runId} ended with status: ${status}`);
    }
    // still running – loop
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { workflowId, scope = "full" } = await req.json();

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const workflow = await db.workflow.findUnique({
    where: { id: workflowId, userId: dbUser.id },
  });

  if (!workflow) {
    return new Response("Workflow not found", { status: 404 });
  }

  const nodes = JSON.parse(workflow.nodes as string);
  const edges = JSON.parse(workflow.edges as string);

  try {
    topologicalSort(nodes, edges); // just to validate DAG
  } catch (error) {
    return new Response(JSON.stringify({ error: "Cycle detected in DAG" }), { status: 400 });
  }

  // Create a DB run record
  const runRecord = await db.workflowRun.create({
    data: {
      workflowId,
      status: "running",
      scope,
      nodeResults: JSON.stringify([]),
    },
  });

  // Setup streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const nodeResults: any[] = [];
      const nodeOutputs: Record<string, any> = {};
      const nodePromises: Record<string, Promise<any>> = {};

      const resolveInputs = (nodeId: string, node: any) => {
        const incomingEdges = edges.filter((e: any) => e.target === nodeId);
        const resolved: Record<string, any> = {};

        if (node.data?.inputs) {
          Object.assign(resolved, node.data.inputs);
        }

        incomingEdges.forEach((edge: any) => {
          const sourceOutput = nodeOutputs[edge.source];
          if (sourceOutput) {
            if (edge.targetHandle) {
               if (edge.targetHandle === "image_vision") {
                  if (!resolved[edge.targetHandle]) resolved[edge.targetHandle] = [];
                  resolved[edge.targetHandle].push(sourceOutput[edge.sourceHandle || 'output']);
               } else {
                  resolved[edge.targetHandle] = sourceOutput[edge.sourceHandle || 'output'];
               }
            } else {
               resolved['input'] = sourceOutput['output'];
            }
          }
        });
        
        return resolved;
      };

      const executeNode = async (nodeId: string) => {
        // Wait for all immediate upstream dependencies to finish
        const incomingEdges = edges.filter((e: any) => e.target === nodeId);
        const depPromises = incomingEdges.map((e: any) => nodePromises[e.source]);
        await Promise.all(depPromises);

        const node = nodes.find((n: any) => n.id === nodeId);
        if (!node) return null;

        const startedAt = new Date().toISOString();
        sendUpdate({ type: "node_start", nodeId });

        let output: any = null;
        try {
          if (node.type === "request_inputs") {
            output = {};
            node.data.fields?.forEach((f: any) => {
              output[f.id] = f.value;
            });
            await new Promise((r) => setTimeout(r, 100));
          } 
          else if (node.type === "crop_image") {
            const inputs = resolveInputs(nodeId, node);
            const handle = await tasks.trigger<typeof cropImageTask>("crop-image", {
              imageUrl: inputs.input_image,
              x: inputs.x || 0,
              y: inputs.y || 0,
              width: inputs.width || 100,
              height: inputs.height || 100,
            });
            const cropResult = await pollTriggerRun(handle.id);
            output = { output_image: cropResult?.croppedImageUrl };
          } 
          else if (node.type === "gemini") {
            const inputs = resolveInputs(nodeId, node);
            let prompt = inputs.prompt;
            if (!prompt && node.data?.prompt) prompt = node.data.prompt;

            // Call Gemini directly from the route (no Trigger needed for text-only)
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set");

            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({
              model: node.data?.model || "gemini-2.0-flash",
              systemInstruction: inputs.system_prompt,
            });

            const parts: any[] = [{ text: prompt || "" }];

            if (inputs.image_vision) {
              const imageUrls = Array.isArray(inputs.image_vision) ? inputs.image_vision : [inputs.image_vision];
              for (const url of imageUrls) {
                if (!url) continue;
                if (url.startsWith("data:")) {
                  const matches = url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                  if (matches) {
                    parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
                  }
                } else {
                  const imgRes = await axios.get(url, { responseType: "arraybuffer" });
                  const ct = (imgRes.headers["content-type"] as string) ?? "";
                  if (!ct.startsWith("image/")) throw new Error(`Not an image URL: ${url}`);
                  parts.push({ inlineData: { mimeType: ct, data: Buffer.from(imgRes.data, "binary").toString("base64") } });
                }
              }
            }

            const geminiResult = await model.generateContent(parts);
            output = { response: geminiResult.response.text() };
          }
          else if (node.type === "response") {
            const inputs = resolveInputs(nodeId, node);
            output = { result: inputs.result };
            await new Promise((r) => setTimeout(r, 100));
          }

          const finishedAt = new Date().toISOString();
          nodeOutputs[nodeId] = output;
          const nodeResult = { nodeId, status: "success", startedAt, finishedAt, output };
          nodeResults.push(nodeResult);
          sendUpdate({ type: "node_success", ...nodeResult });
          return output;
        } catch (error: any) {
          const finishedAt = new Date().toISOString();
          const nodeResult = { nodeId, status: "failed", startedAt, finishedAt, error: error.message };
          nodeResults.push(nodeResult);
          sendUpdate({ type: "node_failed", ...nodeResult });
          throw new Error(`Node ${nodeId} failed: ${error.message}`);
        }
      };

      try {
        // Kick off execution for all nodes. 
        // Each node will internally await its upstream dependencies before doing work.
        nodes.forEach((node: any) => {
          nodePromises[node.id] = executeNode(node.id);
        });

        // Wait for ALL node executions to settle
        await Promise.all(Object.values(nodePromises));

        await db.workflowRun.update({
          where: { id: runRecord.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            nodeResults: JSON.stringify(nodeResults),
          },
        });
        sendUpdate({ type: "workflow_success" });
        controller.close();
      } catch (err: any) {
        await db.workflowRun.update({
          where: { id: runRecord.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            nodeResults: JSON.stringify(nodeResults),
          },
        });
        sendUpdate({ type: "workflow_failed", error: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
