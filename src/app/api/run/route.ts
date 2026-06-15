import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { topologicalSort } from "@/lib/dag";
import { tasks } from "@trigger.dev/sdk/v3";
import { cropImageTask, geminiTask } from "@/triggers";

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
            const result = await tasks.triggerAndWait<typeof cropImageTask>("crop-image", {
              imageUrl: inputs.input_image,
              x: inputs.x || 0,
              y: inputs.y || 0,
              width: inputs.width || 100,
              height: inputs.height || 100,
            });
            if (result.ok) {
              output = { output_image: result.output?.croppedImageUrl };
            } else {
              throw new Error(`Task failed: ${result.error}`);
            }
          } 
          else if (node.type === "gemini") {
            const inputs = resolveInputs(nodeId, node);
            let prompt = inputs.prompt;
            if (!prompt && node.data?.prompt) prompt = node.data.prompt;

            const result = await tasks.triggerAndWait<typeof geminiTask>("gemini-task", {
              prompt: prompt || "",
              systemPrompt: inputs.system_prompt,
              imageUrl: inputs.image_vision,
              model: node.data?.model || "gemini-1.5-pro",
            });
            if (result.ok) {
              output = { response: result.output?.response };
            } else {
              throw new Error(`Task failed: ${result.error}`);
            }
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
