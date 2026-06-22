"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  PanelRightOpen,
  XCircle,
} from "lucide-react";
import { NodeResult, RunHistoryEntry } from "@/types";

export function HistorySidebar({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<RunHistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchRuns = async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as Array<
          RunHistoryEntry & { nodeResults: NodeResult[] | string }
        >;
        const parsed = data.map((run) => ({
          ...run,
          nodeResults:
            typeof run.nodeResults === "string"
              ? (JSON.parse(run.nodeResults) as NodeResult[])
              : run.nodeResults,
        }));
        setRuns(parsed);

        const hasRunningRun = parsed.some((run) => run.status === "running");
        if (hasRunningRun && !intervalId) {
          intervalId = setInterval(fetchRuns, 3000);
        }
        if (!hasRunningRun && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch (error) {
        console.error("Failed to fetch runs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();

    const handleRefresh = () => fetchRuns();
    window.addEventListener("refresh-history", handleRefresh);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("refresh-history", handleRefresh);
    };
  }, [workflowId]);

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));

  const getDuration = (start: string, end?: string) => {
    if (!end) {
      return "Running...";
    }

    const ms = new Date(end).getTime() - new Date(start).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Activity className="h-4 w-4 animate-pulse text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-[#857c70]" />;
    }
  };

  if (collapsed) {
    return (
      <div className="flex h-full w-14 items-start justify-center border-l border-[#e3ddd1] bg-white pt-4">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-full border border-[#ddd7cb] bg-[#faf8f3] p-2 text-[#625b52] transition-colors hover:bg-white"
          title="Open history"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[420px] flex-col border-l border-[#e3ddd1] bg-[#fbfaf6]">
      <div className="sticky top-0 z-10 flex justify-between items-start border-b border-[#ece6db] bg-[#fbfaf6] px-4 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#90877a]">
            History
          </div>
          <div className="text-sm font-semibold text-[#171511]">Workflow Runs</div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-full border border-[#ddd7cb] bg-white p-2 text-[#625b52] transition-colors hover:bg-[#f3efe7]"
          title="Collapse history"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {loading ? (
          <div className="rounded-3xl border border-[#e7e1d7] bg-white px-4 py-8 text-center text-sm text-[#7d7468]">
            Loading history...
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-3xl border border-[#e7e1d7] bg-white px-4 py-8 text-center text-sm text-[#7d7468]">
            No runs yet
          </div>
        ) : (
          runs.map((run, index) => {
            const isExpanded = expandedId === run.id;
            const runNumber = runs.length - index;

            return (
              <div
                key={run.id}
                className="overflow-hidden rounded-[24px] border border-[#e7e1d7] bg-white shadow-[0_8px_24px_rgba(27,26,23,0.06)]"
              >
                <button
  onClick={() => setExpandedId(isExpanded ? null : run.id)}
  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#faf7f0]"
>
  <div className="flex min-w-0 flex-1 flex-col gap-1">
    <div className="flex items-center gap-2 text-sm font-semibold text-[#171511]">
      {getStatusIcon(run.status)}
      <span className="truncate">Run #{runNumber}</span>
    </div>
    <div className="truncate text-xs text-[#857c70]">
      {formatDate(run.startedAt)} ·{" "}
      {run.scope === "full" ? "Full workflow" : "Partial run"}
    </div>
  </div>
  <div className="flex flex-shrink-0 flex-col items-end gap-2">
    <span className="text-xs font-medium text-[#625b52]">
      {getDuration(run.startedAt, run.finishedAt)}
    </span>
    {isExpanded ? (
      <ChevronDown className="h-4 w-4 text-[#857c70]" />
    ) : (
      <ChevronRight className="h-4 w-4 text-[#857c70]" />
    )}
  </div>
</button>

                {isExpanded ? (
                  <div className="border-t border-[#f0eadf] bg-[#fcfbf8] px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {run.nodeResults.map((result) => (
                        <div
                          key={result.nodeId}
                          className="rounded-2xl border border-[#ece6db] bg-white px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-[#2f2a24]">
                              {getStatusIcon(result.status)}
                              <span className="truncate">{result.nodeId}</span>
                            </div>
                            <span className="text-[11px] text-[#857c70]">
                              {getDuration(result.startedAt, result.finishedAt)}
                            </span>
                          </div>
                          {result.error ? (
                            <div className="mt-1 text-[11px] text-red-500">
                              {result.error}
                            </div>
                          ) : result.output ? (
                            <div className="mt-1 truncate text-[11px] text-[#786f63]">
                              {JSON.stringify(result.output)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
