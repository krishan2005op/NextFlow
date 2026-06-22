import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";
import { WorkflowHeader } from "@/components/canvas/WorkflowHeader";
import { HistorySidebar } from "@/components/canvas/HistorySidebar";
import { Metadata } from "next";
import { parseStoredJson } from "@/lib/workflow-json";

export const metadata: Metadata = {
  title: "Workflow Builder - NextFlow",
};

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { id } = await params;

  const dbUser = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!dbUser) {
    redirect("/dashboard");
  }

  const workflow = await db.workflow.findUnique({
    where: {
      id: id,
      userId: dbUser.id,
    },
  });

  if (!workflow) {
    redirect("/dashboard");
  }

  return (
    <div className="w-full h-screen bg-[#f3f1ec] text-[#1b1a17] flex flex-col overflow-hidden">
      <WorkflowHeader workflowId={workflow.id} workflowName={workflow.name} />

      <div className="flex-1 relative flex overflow-hidden">
        <WorkflowCanvas 
          workflowId={workflow.id} 
          initialNodes={parseStoredJson(workflow.nodes, [])} 
          initialEdges={parseStoredJson(workflow.edges, [])} 
        />
        <HistorySidebar workflowId={workflow.id} />
      </div>
    </div>
  );
}
