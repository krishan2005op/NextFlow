import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { updateWorkflowSchema } from "@/lib/validators";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, nodes, edges } = updateWorkflowSchema.parse(body);

    const workflow = await db.workflow.update({
      where: {
        id: id,
        userId: dbUser.id,
      },
      data: {
        ...(name && { name }),
        ...(nodes !== undefined && { nodes }),
        ...(edges !== undefined && { edges }),
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("[WORKFLOW_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const dbUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflow = await db.workflow.delete({
      where: {
        id: id,
        userId: dbUser.id,
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("[WORKFLOW_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
