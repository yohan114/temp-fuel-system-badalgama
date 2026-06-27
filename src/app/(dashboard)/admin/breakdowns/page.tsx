import React from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : "0m";
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Summary {
  code: string;
  regNo: string | null;
  count: number;
  totalMs: number;
  ongoing: boolean;
}

export default async function AdminBreakdownsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;

  let events: any[] = [];
  try {
    events = await prisma.breakdownEvent.findMany({
      include: { asset: { select: { code: true, regNo: true } } },
      orderBy: { startedAt: "desc" },
      take: 500,
    });
  } catch (e) {
    // BreakdownEvent table not migrated yet — show empty state.
  }

  const now = Date.now();

  // Per-vehicle summary
  const byAsset: Record<string, Summary> = {};
  for (const ev of events) {
    const end = ev.resolvedAt ? new Date(ev.resolvedAt).getTime() : now;
    const dur = Math.max(0, end - new Date(ev.startedAt).getTime());
    if (!byAsset[ev.assetId]) {
      byAsset[ev.assetId] = { code: ev.asset.code, regNo: ev.asset.regNo, count: 0, totalMs: 0, ongoing: false };
    }
    byAsset[ev.assetId].count += 1;
    byAsset[ev.assetId].totalMs += dur;
    if (!ev.resolvedAt) byAsset[ev.assetId].ongoing = true;
  }
  const summaries = Object.values(byAsset).sort((a, b) => {
    if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
    return b.totalMs - a.totalMs;
  });

  const currentlyDown = summaries.filter((s) => s.ongoing).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">Breakdown Log</h2>
        <p className="text-xs text-gray-400 mt-1">
          Every machine breakdown with its start, repair and total downtime. Currently-down vehicles are listed first.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Currently Down</span>
            <span className="text-base font-bold text-white block mt-0.5">{currentlyDown} vehicles</span>
          </div>
        </div>
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Breakdown Events</span>
            <span className="text-base font-bold text-white block mt-0.5">{events.length}</span>
          </div>
        </div>
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Vehicles Affected</span>
            <span className="text-base font-bold text-white block mt-0.5">{summaries.length}</span>
          </div>
        </div>
      </div>

      {/* Per-vehicle summary */}
      <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl overflow-x-auto">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
          Downtime by Vehicle
        </h3>
        {summaries.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-500">No breakdowns recorded yet.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-white/5">
                <th className="py-2.5">Vehicle</th>
                <th className="py-2.5">Breakdowns</th>
                <th className="py-2.5">Total Downtime</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {summaries.map((s) => (
                <tr key={s.code} className="hover:bg-white/[0.01]">
                  <td className="py-3">
                    <span className="font-bold text-white">{s.code}</span>
                    {s.regNo && <span className="text-gray-500 ml-1.5 font-mono">({s.regNo})</span>}
                  </td>
                  <td className="py-3 text-gray-300 font-semibold">{s.count}</td>
                  <td className="py-3 font-bold text-white">{formatDuration(s.totalMs)}</td>
                  <td className="py-3 text-right">
                    {s.ongoing ? (
                      <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/15 px-2 py-0.5 rounded font-bold uppercase">
                        Down
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-2 py-0.5 rounded font-bold uppercase">
                        Working
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detailed event log */}
      <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 md:p-6 shadow-xl overflow-x-auto">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
          Breakdown History
        </h3>
        {events.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-500">No breakdown events logged.</div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-white/5">
                <th className="py-2.5">Vehicle</th>
                <th className="py-2.5">Breakdown Date</th>
                <th className="py-2.5">Repaired</th>
                <th className="py-2.5 text-right">Downtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((ev) => {
                const end = ev.resolvedAt ? new Date(ev.resolvedAt).getTime() : now;
                const dur = Math.max(0, end - new Date(ev.startedAt).getTime());
                return (
                  <tr key={ev.id} className="hover:bg-white/[0.01]">
                    <td className="py-3">
                      <span className="font-bold text-white">{ev.asset.code}</span>
                      {ev.asset.regNo && <span className="text-gray-500 ml-1.5 font-mono">({ev.asset.regNo})</span>}
                    </td>
                    <td className="py-3 text-gray-300">{formatDateTime(ev.startedAt)}</td>
                    <td className="py-3">
                      {ev.resolvedAt ? (
                        <span className="text-gray-300">{formatDateTime(ev.resolvedAt)}</span>
                      ) : (
                        <span className="text-red-400 font-semibold">Ongoing</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-bold text-white">{formatDuration(dur)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
