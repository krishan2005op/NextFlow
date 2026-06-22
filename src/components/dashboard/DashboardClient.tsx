"use client";

import { useEffect, useState } from "react";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  CheckCircle2,
  Clock,
  LogOut,
  Pencil,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type WorkflowStatus = "idle" | "running" | "success" | "failed";

interface Workflow {
  id: string;
  name: string;
  status?: WorkflowStatus;
  updatedAt: string;
}

export function DashboardClient() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/workflows");
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as Workflow[];
        setWorkflows(data);
      } catch (error) {
        console.error("Failed to fetch workflows", error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const createWorkflow = async () => {
    try {
      setCreating(true);
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });

      if (!res.ok) {
        return;
      }

      const newWorkflow = (await res.json()) as Workflow;
      router.push(`/workflow/${newWorkflow.id}`);
    } catch (error) {
      console.error("Failed to create workflow", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Delete this workflow?")) {
      return;
    }

    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows((current) => current.filter((workflow) => workflow.id !== id));
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
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) {
        return;
      }

      const updated = (await res.json()) as Workflow;
      setWorkflows((current) =>
        current.map((workflow) =>
          workflow.id === id ? { ...workflow, name: updated.name } : workflow,
        ),
      );
    } catch (error) {
      console.error("Failed to rename workflow", error);
    } finally {
      setEditingId(null);
    }
  };

  const getStatusBadge = (status: WorkflowStatus = "idle") => {
    if (status === "running") {
      return (
        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <Play className="h-3 w-3" />
          Running
        </span>
      );
    }

    if (status === "success") {
      return (
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </span>
      );
    }

    if (status === "failed") {
      return (
        <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
        <Clock className="h-3 w-3" />
        Idle
      </span>
    );
  };

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));

  return (
    <div className="min-h-screen bg-[#f3f1ec] px-6 py-6 text-[#171511]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between rounded-[28px] border border-[#e1dbd0] bg-white px-6 py-5 shadow-[0_12px_32px_rgba(27,26,23,0.06)]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#93897c]">
              NextFlow
            </div>
            <h1 className="mt-1 text-2xl font-semibold">My workflows</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={createWorkflow}
              disabled={creating}
              className="flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#23201b] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Creating..." : "New workflow"}
            </button>
            <UserButton />
            <SignOutButton redirectUrl="/sign-in">
              <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd7cb] bg-white text-[#625b52] transition-colors hover:bg-[#f3efe7] hover:text-[#171511]">
                <LogOut className="h-4 w-4" />
              </button>
            </SignOutButton>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-[#e1dbd0] bg-white px-6 py-16 text-center text-sm text-[#7f766a] shadow-[0_12px_32px_rgba(27,26,23,0.06)]">
            Loading workflows...
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-[28px] border border-[#e1dbd0] bg-white px-6 py-20 text-center shadow-[0_12px_32px_rgba(27,26,23,0.06)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4f1ea]">
              <Plus className="h-6 w-6 text-[#7b7368]" />
            </div>
            <h2 className="text-lg font-semibold">No workflows yet</h2>
            <p className="mt-2 text-sm text-[#7f766a]">
              Start with a blank canvas and add nodes as you go.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group flex items-center justify-between rounded-[24px] border border-[#e1dbd0] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(27,26,23,0.05)]"
              >
                <div
                  className="flex flex-1 cursor-pointer items-center gap-4"
                  onClick={() => router.push(`/workflow/${workflow.id}`)}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4f1ea]">
                    <Play className="h-5 w-5 text-[#575046]" />
                  </div>
                  <div>
                    {editingId === workflow.id ? (
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        onBlur={() => renameWorkflow(workflow.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void renameWorkflow(workflow.id);
                          }
                          if (event.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        className="rounded-xl border border-[#ddd7cb] bg-[#fbfaf6] px-3 py-1.5 text-sm outline-none focus:border-brand-purple"
                        autoFocus
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      <h3 className="text-base font-semibold">{workflow.name}</h3>
                    )}
                    <p className="mt-1 text-sm text-[#7f766a]">
                      Updated {formatDate(workflow.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {getStatusBadge(workflow.status)}
                  <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditName(workflow.name);
                        setEditingId(workflow.id);
                      }}
                      className="rounded-full border border-[#e7e1d7] p-2 text-[#6a6258] hover:bg-[#f3efe7]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteWorkflow(workflow.id);
                      }}
                      className="rounded-full border border-[#e7e1d7] p-2 text-[#8b4d4d] hover:bg-[#fbf0f0]"
                    >
                      <Trash2 className="h-4 w-4" />
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
