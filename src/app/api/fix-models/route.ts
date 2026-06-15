import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-1.5-pro": "gemini-2.0-flash",
  "gemini-1.5-pro-latest": "gemini-2.0-flash",
  "gemini-3.1-pro": "gemini-2.0-flash",
  "gemini-pro": "gemini-2.0-flash",
  "gemini-1.0-pro": "gemini-2.0-flash",
};

// GET /api/fix-models - patches all workflows in DB to use current models
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const dbUser = await db.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const workflows = await db.workflow.findMany({ where: { userId: dbUser.id } });

  let patchedCount = 0;

  for (const wf of workflows) {
    const nodes = JSON.parse(wf.nodes as string);
    let changed = false;

    const updatedNodes = nodes.map((node: any) => {
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
        data: { nodes: JSON.stringify(updatedNodes) },
      });
      patchedCount++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, workflowsPatched: patchedCount }),
    { headers: { "Content-Type": "application/json" } }
  );
}
