import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createWorkflowSchema } from "@/lib/validators";
import {
  createDefaultWorkflowEdges,
  createDefaultWorkflowNodes,
} from "@/lib/workflow-defaults";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return NextResponse.json([]);
    }

    const workflows = await db.workflow.findMany({
      where: {
        userId: dbUser.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(workflows);
  } catch (error) {
    console.error("[WORKFLOWS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = createWorkflowSchema.parse(body);

    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      // Ensure user exists in our DB
      user = await db.user.create({
        data: {
          clerkId: userId,
          email: "user@example.com", 
        },
      });
    }

    const initialNodes = createDefaultWorkflowNodes();
    const initialEdges = createDefaultWorkflowEdges();

    const workflow = await db.workflow.create({
      data: {
        name,
        userId: user.id,
        nodes: initialNodes as unknown as Prisma.InputJsonValue,
        edges: initialEdges as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("[WORKFLOWS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
