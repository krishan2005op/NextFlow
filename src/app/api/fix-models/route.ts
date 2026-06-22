import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseStoredJson } from "@/lib/workflow-json";

type ModelNode = {
  type?: string;
  data?: {
    model?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-1.5-pro": "gemini-2.0-flash",
  "gemini-1.5-pro-latest": "gemini-2.0-flash",
  "gemini-3.1-pro": "gemini-2.0-flash",
  "gemini-pro": "gemini-2.0-flash",
  "gemini-1.0-pro": "gemini-2.0-flash",
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const workflows = await db.workflow.findMany({ where: { userId: dbUser.id } });

  let patchedCount = 0;

  for (const wf of workflows) {
    const nodes = parseStoredJson<ModelNode[]>(wf.nodes, []);
    let changed = false;

    const updatedNodes = nodes.map((node) => {
      if (node.type === "gemini" && node.data?.model) {
        const replacement = DEPRECATED_MODELS[node.data.model];
        if (replacement) {
          changed = true;
          return { ...node, data: { ...node.data, model: replacement } };
        }
      }
      return node;
    });

    if (changed) {
      await db.workflow.update({
        where: { id: wf.id },
        data: { nodes: updatedNodes as unknown as Prisma.InputJsonValue },
      });
      patchedCount++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, workflowsPatched: patchedCount }),
    { headers: { "Content-Type": "application/json" } }
  );
}
