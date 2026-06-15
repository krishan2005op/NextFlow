"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, ChevronRight, ChevronDown, Activity } from "lucide-react";
import { useWorkflowStore } from "@/store/workflow-store";
import { RunHistoryEntry, NodeResult } from "@/types";

export function HistorySidebar({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<RunHistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll for updates or fetch once. The store could trigger a refresh.
  // For simplicity, we poll every 5 seconds if there's a running workflow, else just fetch once.
  useEffect(() => {
    let interval: any;
    
    const fetchRuns = async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/runs`);
        if (res.ok) {
          const data = await res.json();
          // Parse nodeResults since it's JSON in DB
          const parsed = data.map((run: any) => ({
            ...run,
            nodeResults: typeof run.nodeResults === 'string' ? JSON.parse(run.nodeResults) : run.nodeResults
          }));
          setRuns(parsed);
          
          if (parsed.some((r: any) => r.status === 'running')) {
            if (!interval) interval = setInterval(fetchRuns, 3000);
          } else {
            if (interval) clearInterval(interval);
          }
        }
      } catch (error) {
        console.error("Failed to fetch runs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
    
    // Subscribe to custom event or polling
    const handleRefresh = () => fetchRuns();
    window.addEventListener('refresh-history', handleRefresh);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('refresh-history', handleRefresh);
    };
  }, [workflowId]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString));
  };

  const getDuration = (start: string, end?: string) => {
    if (!end) return "Running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-400" />;
      case "running": return <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (loading) {
    return <div className="w-80 bg-[#1A1A1A] border-l border-[#2A2A2A] p-4 flex items-center justify-center text-gray-400">Loading history...</div>;
  }

  return (
    <div className="w-80 bg-[#1A1A1A] border-l border-[#2A2A2A] h-full overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-[#2A2A2A] font-medium text-white sticky top-0 bg-[#1A1A1A] z-10">
        Run History
      </div>
      <div className="p-2 flex flex-col gap-2">
        {runs.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">No runs yet</div>
        ) : (
          runs.map((run, i) => {
            const isExpanded = expandedId === run.id;
            const runNumber = runs.length - i; // just for display
            
            return (
              <div key={run.id} className="border border-[#2A2A2A] rounded bg-[#0F0F0F] overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      {getStatusIcon(run.status)}
                      Run #{runNumber}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(run.startedAt)} ({run.scope === 'full' ? 'Full Workflow' : 'Partial'})
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                    <div>{getDuration(run.startedAt, run.finishedAt)}</div>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {isExpanded && run.nodeResults && (
                  <div className="p-3 border-t border-[#2A2A2A] flex flex-col gap-2 bg-[#1A1A1A]/50">
                    {run.nodeResults.map((nr: NodeResult) => (
                      <div key={nr.nodeId} className="flex flex-col gap-1 text-xs bg-[#0F0F0F] p-2 rounded border border-[#2A2A2A]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-medium text-gray-300">
                            {getStatusIcon(nr.status)}
                            <span className="truncate max-w-[120px]">{nr.nodeId}</span>
                          </div>
                          <span className="text-gray-500">{getDuration(nr.startedAt, nr.finishedAt)}</span>
                        </div>
                        
                        {nr.error ? (
                          <div className="text-red-400 mt-1 pl-5 truncate">{nr.error}</div>
                        ) : nr.output ? (
                          <div className="text-gray-400 mt-1 pl-5 truncate opacity-70">
                            → {JSON.stringify(nr.output).substring(0, 50)}...
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
