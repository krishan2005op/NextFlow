"use client";

import { useState } from "react";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { Download, LogOut, Play, Upload } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";

export function WorkflowHeader({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName: string;
}) {
  const [running, setRunning] = useState(false);
  const { setNodeOutput, setRunStatus } = useWorkflowStore();

  const handleRun = async () => {
    if (running) {
      return;
    }

    setRunning(true);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId, scope: "full" }),
      });

      if (!res.ok) {
        throw new Error("Failed to start run");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        return;
      }

      const handleStreamLine = (line: string) => {
        if (!line.startsWith("data: ")) {
          return;
        }

        const data = JSON.parse(line.replace("data: ", "")) as {
          error?: string;
          nodeId?: string;
          output?: Record<string, unknown>;
          type: string;
        };

        if (!data.nodeId) {
          if (
            data.type === "workflow_success" ||
            data.type === "workflow_failed"
          ) {
            window.dispatchEvent(new Event("refresh-history"));
          }
          return;
        }

        if (data.type === "node_start") {
          setRunStatus(data.nodeId, "running");
        }

        if (data.type === "node_success") {
          setRunStatus(data.nodeId, "success");
          if (data.output) {
            setNodeOutput(data.nodeId, data.output);
          }
        }

        if (data.type === "node_failed") {
          setRunStatus(data.nodeId, "failed");
          if (data.error) {
            setNodeOutput(data.nodeId, { error: data.error });
          }
        }
      };

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          handleStreamLine(line);
        }
      }

      if (buffer.trim()) {
        handleStreamLine(buffer.trim());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    const { nodes, edges } = useWorkflowStore.getState();
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const anchor = document.createElement("a");
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `workflow-${workflowId}.json`);
    anchor.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const json = JSON.parse(loadEvent.target?.result as string) as {
          edges?: unknown[];
          nodes?: unknown[];
        };
        if (Array.isArray(json.nodes) && Array.isArray(json.edges)) {
          const { resetWorkflow } = useWorkflowStore.getState();
          resetWorkflow(json.nodes as never[], json.edges as never[]);
        } else {
          alert("Invalid workflow JSON format");
        }
      } catch {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#e3ddd1] bg-[#f8f6f1] px-5">
      <div className="flex items-center gap-4">
        <a
          href="/dashboard"
          className="rounded-full border border-[#ddd7cb] bg-white px-3 py-1.5 text-sm font-medium text-[#625b52] transition-colors hover:border-[#c9c0b2] hover:text-[#171511]"
        >
          Back
        </a>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#90877a]">
            Workflow
          </div>
          <h1 className="text-sm font-semibold text-[#171511]">{workflowName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-full border border-[#ddd7cb] bg-white px-3 py-2 text-sm font-medium text-[#171511] transition-colors hover:bg-[#f3efe7]"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-full border border-[#ddd7cb] bg-white px-3 py-2 text-sm font-medium text-[#171511] transition-colors hover:bg-[#f3efe7]"
            onClick={() => document.getElementById("import-upload")?.click()}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <input
            id="import-upload"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#23201b] disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {running ? "Running..." : "Run Workflow"}
        </button>
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: "h-9 w-9",
            },
          }}
        />
        <SignOutButton redirectUrl="/sign-in">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd7cb] bg-white text-[#625b52] transition-colors hover:bg-[#f3efe7] hover:text-[#171511]">
            <LogOut className="h-4 w-4" />
          </button>
        </SignOutButton>
      </div>
    </header>
  );
}
