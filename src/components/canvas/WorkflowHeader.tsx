"use client";

import { useState } from "react";
import { useWorkflowStore } from "@/store/workflow-store";
import { Play, Download, Upload } from "lucide-react";

export function WorkflowHeader({ workflowId, workflowName }: { workflowId: string, workflowName: string }) {
  const [running, setRunning] = useState(false);
  const { setRunStatus } = useWorkflowStore();

  const handleRun = async () => {
    if (running) return;
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

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.replace("data: ", ""));
              
              if (data.type === "node_start") {
                setRunStatus(data.nodeId, "running");
              } else if (data.type === "node_success") {
                setRunStatus(data.nodeId, "success");
              } else if (data.type === "node_failed") {
                setRunStatus(data.nodeId, "failed");
              } else if (data.type === "workflow_success" || data.type === "workflow_failed") {
                // Done
                window.dispatchEvent(new Event('refresh-history'));
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRunning(false);
      // reset statuses after a bit
      setTimeout(() => {
        // We might want to keep the success/failure state visible for a bit
      }, 5000);
    }
  };

  const handleExport = () => {
    const { nodes, edges } = useWorkflowStore.getState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `workflow-${workflowId}.json`);
    dlAnchorElem.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.nodes && json.edges) {
          const { setNodes, setEdges } = useWorkflowStore.getState();
          setNodes(json.nodes);
          setEdges(json.edges);
        } else {
          alert("Invalid workflow JSON format");
        }
      } catch (err) {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <header className="h-14 border-b border-[#2A2A2A] flex items-center justify-between px-4 bg-[#1A1A1A] shrink-0 z-10">
      <div className="flex items-center gap-4">
        <a href="/dashboard" className="text-gray-400 hover:text-white transition-colors text-sm">
          ← Dashboard
        </a>
        <h1 className="font-medium text-sm text-white">{workflowName}</h1>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white rounded transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" /> Export JSON
        </button>
        <div className="relative">
          <button className="px-3 py-1.5 text-sm bg-[#2A2A2A] hover:bg-[#3A3A3A] text-white rounded transition-colors flex items-center gap-2" onClick={() => document.getElementById('import-upload')?.click()}>
            <Upload className="w-4 h-4" /> Import JSON
          </button>
          <input id="import-upload" type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
        <button 
          onClick={handleRun}
          disabled={running}
          className="px-4 py-1.5 text-sm bg-brand-purple hover:bg-[#6D28D9] text-white rounded font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <span className="animate-spin text-xl leading-none">⟳</span> : <Play className="w-4 h-4" />}
          {running ? "Running..." : "Run Workflow"}
        </button>
      </div>
    </header>
  );
}
