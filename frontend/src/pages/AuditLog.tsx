import React, { useState, useEffect } from "react";
import { History, Filter, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { AuditLogItem } from "../types";

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.admin.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) =>
    actionFilter ? log.action.toLowerCase().includes(actionFilter.toLowerCase()) : true
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Immutable Governance Audit Trail
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono text-xs font-bold">
              {logs.length} Events
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Tamper-evident system log tracking submissions, findings resolutions, and reviewer decisions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-all self-start md:self-auto"
          title="Refresh audit log"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-line text-xs">
          <Filter size={13} className="text-muted" />
          <span className="text-muted">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-transparent text-white font-mono text-xs focus:outline-none"
          >
            <option value="" className="bg-[#1D1D18]">All Actions</option>
            <option value="submission" className="bg-[#1D1D18]">Submissions</option>
            <option value="audit" className="bg-[#1D1D18]">Audit Executions</option>
            <option value="finding" className="bg-[#1D1D18]">Finding Resolutions</option>
            <option value="review" className="bg-[#1D1D18]">Review Decisions</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4">
        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading compliance audit records from Supabase...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-line">
            <History className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-white">No audit records found</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Actions taken across the engine will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-line overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1D1D18]/80 border-b border-line text-muted font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Target Object</th>
                  <th className="px-5 py-3 font-semibold">Actor</th>
                  <th className="px-5 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-xs text-white px-2 py-0.5 rounded bg-white/5 border border-line">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted text-[11px]">
                      {log.object_type}:{log.object_id || "-"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-primary text-xs">
                      {log.actor_id ? `User #${log.actor_id}` : "System"}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <pre className="text-[10px] font-mono text-muted bg-[#0E0E0B] p-1.5 rounded border border-line overflow-x-auto truncate">
                        {JSON.stringify(log.meta)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
