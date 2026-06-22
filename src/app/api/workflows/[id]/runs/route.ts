import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const STALE_RUNNING_RUN_MS = 2 * 60 * 1000;

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

    const now = Date.now();
    const normalizedRuns = runs.map((run) => {
      const isStaleRunning =
        run.status === "running" &&
        !run.finishedAt &&
        now - run.startedAt.getTime() > STALE_RUNNING_RUN_MS;

      if (!isStaleRunning) {
        return run;
      }

      return {
        ...run,
        status: "failed",
        finishedAt: new Date(run.startedAt.getTime() + STALE_RUNNING_RUN_MS),
        nodeResults: [
          ...(Array.isArray(run.nodeResults) ? run.nodeResults : []),
          {
            nodeId: "workflow",
            status: "failed",
            startedAt: run.startedAt.toISOString(),
            finishedAt: new Date(
              run.startedAt.getTime() + STALE_RUNNING_RUN_MS,
            ).toISOString(),
            error:
              "Run timed out before completion. Please run the workflow again.",
          },
        ],
      };
    });

    return NextResponse.json(normalizedRuns);
  } catch (error) {
    console.error("[WORKFLOW_RUNS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
