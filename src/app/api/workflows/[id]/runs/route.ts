import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
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

    const runs = await db.workflowRun.findMany({
      where: {
        workflowId: id,
        workflow: {
          userId: dbUser.id,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    return NextResponse.json(runs);
  } catch (error) {
    console.error("[WORKFLOW_RUNS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
