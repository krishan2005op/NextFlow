"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Pencil, Trash2, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns"; // Wait, date-fns is not listed in dependencies, I'll use standard Intl API instead

type WorkflowStatus = "idle" | "running" | "success" | "failed";

interface Workflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  updatedAt: string;
}

export function DashboardClient() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchWorkflows = async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error("Failed to fetch workflows", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const createWorkflow = async () => {
    try {
      setCreating(true);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      if (res.ok) {
        const newWorkflow = await res.json();
        router.push(`/workflow/${newWorkflow.id}`);
      }
    } catch (error) {
      console.error("Failed to create workflow", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete workflow", error);
    }
  };

  const renameWorkflow = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWorkflows((prev) =>
          prev.map((w) => (w.id === id ? { ...w, name: updated.name } : w))
        );
      }
    } catch (error) {
      console.error("Failed to rename workflow", error);
    } finally {
      setEditingId(null);
    }
  };

  const getStatusBadge = (status: WorkflowStatus = "idle") => {
    switch (status) {
      case "running":
        return <span className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded text-xs font-medium"><Play className="w-3 h-3" /> Running</span>;
      case "success":
        return <span className="flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Success</span>;
      case "failed":
        return <span className="flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded text-xs font-medium"><XCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="flex items-center gap-1 text-gray-400 bg-gray-400/10 px-2 py-1 rounded text-xs font-medium"><Clock className="w-3 h-3" /> Idle</span>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">My Workflows</h1>
          <button
            onClick={createWorkflow}
            disabled={creating}
            className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors px-4 py-2 rounded-md font-medium disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {creating ? "Creating..." : "Create Workflow"}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 border border-[#2A2A2A] rounded-lg bg-[#1A1A1A]">
            <div className="bg-[#2A2A2A] p-4 rounded-full mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-medium mb-2">No workflows yet</h2>
            <p className="text-gray-400 mb-6">Create your first AI workflow to get started.</p>
            <button
              onClick={createWorkflow}
              disabled={creating}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] px-4 py-2 rounded-md font-medium transition-colors"
            >
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group flex items-center justify-between p-4 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A] transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => router.push(`/workflow/${workflow.id}`)}>
                  <div className="w-10 h-10 rounded bg-[#2A2A2A] flex items-center justify-center">
                    <Play className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    {editingId === workflow.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => renameWorkflow(workflow.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameWorkflow(workflow.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="bg-[#2A2A2A] text-white px-2 py-1 rounded outline-none focus:ring-2 focus:ring-[#7C3AED] border-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="font-medium text-lg">{workflow.name}</h3>
                    )}
                    <p className="text-sm text-gray-400 mt-1">
                      Edited {formatDate(workflow.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {getStatusBadge(workflow.status)}
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditName(workflow.name);
                        setEditingId(workflow.id);
                      }}
                      className="p-2 hover:bg-[#2A2A2A] rounded text-gray-400 hover:text-white transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(workflow.id);
                      }}
                      className="p-2 hover:bg-[#2A2A2A] rounded text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
