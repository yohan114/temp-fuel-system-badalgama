import React from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Fuel, Database, Droplet, Coins, TrendingUp, Layers } from "lucide-react";

interface SiteAgg {
  litres: number;
  cost: number;
  count: number;
  auto: number;
  superD: number;
}

function emptyAgg(): SiteAgg {
  return { litres: 0, cost: 0, count: 0, auto: 0, superD: 0 };
}

export default async function AdminSitesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;

  // Current calendar month boundaries (Colombo timezone)
  const now = new Date();
  const colomboTodayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const [year, month] = colomboTodayStr.split("-").map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // 1. Sites with their storage tanks
  const projects = await prisma.project.findMany({
    include: { bulkTanks: true },
    orderBy: { name: "asc" },
  });

  // 2. This month's issues, grouped by project
  const monthIssues = await prisma.fuelIssue.findMany({
    where: { issueDate: { gte: startOfMonth, lte: endOfMonth } },
    select: {
      litres: true,
      totalCost: true,
      fuelKind: true,
      asset: { select: { projectId: true } },
    },
  });

  const byProject: Record<string, SiteAgg> = {};
  const unassigned = emptyAgg();
  for (const iss of monthIssues) {
    const pid = iss.asset.projectId;
    const bucket = pid ? (byProject[pid] || (byProject[pid] = emptyAgg())) : unassigned;
    bucket.litres += iss.litres;
    bucket.cost += iss.totalCost;
    bucket.count += 1;
    if (iss.fuelKind === "AUTO_DIESEL") bucket.auto += iss.litres;
    else bucket.superD += iss.litres;
  }

  // 3. Recent bulk deliveries into site tanks
  const recentTransfers = await prisma.bulkTransfer.findMany({
    where: { type: "TRANSFER" },
    include: {
      toTank: { include: { project: true } },
      fromTank: true,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  // Top-line totals
  const totalStored = projects.reduce(
    (sum, p) => sum + p.bulkTanks.reduce((s, t) => s + t.balance, 0),
    0
  );
  const totalMonthLitres = monthIssues.reduce((s, i) => s + i.litres, 0);
  const totalMonthCost = monthIssues.reduce((s, i) => s + i.totalCost, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-wide">Site Fuel Overview</h2>
        <p className="text-xs text-gray-400 mt-1">
          Per-site storage tank levels and fuel issued during {monthLabel}.
        </p>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Total Stored (All Site Tanks)</span>
            <span className="text-base font-bold text-white block mt-0.5">
              {totalStored.toLocaleString("en-US", { maximumFractionDigits: 1 })} L
            </span>
          </div>
        </div>
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Issued This Month</span>
            <span className="text-base font-bold text-white block mt-0.5">
              {totalMonthLitres.toLocaleString("en-US", { maximumFractionDigits: 1 })} L
            </span>
          </div>
        </div>
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-semibold uppercase block tracking-wider">Spend This Month</span>
            <span className="text-base font-bold text-white block mt-0.5">
              Rs. {(totalMonthCost / 100).toLocaleString("en-LK", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Per-site cards */}
      {projects.length === 0 ? (
        <div className="bg-[#1b1e30] border border-white/5 rounded-2xl py-12 text-center text-xs text-gray-500">
          No project sites registered yet. Create one under Project Sites.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
            const agg = byProject[proj.id] || emptyAgg();
            return (
              <div key={proj.id} className="bg-[#1b1e30] border border-white/5 rounded-2xl p-6 shadow-lg space-y-5">
                {/* Site header */}
                <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-4">
                  <div>
                    <span className="font-bold text-white text-sm block">{proj.name}</span>
                    <span className="text-[10px] text-gray-500 font-mono uppercase">{proj.code}</span>
                  </div>
                  <span className="text-[10px] bg-white/5 border border-white/5 text-gray-400 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {agg.count} issues
                  </span>
                </div>

                {/* Tanks */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" /> Storage Tanks
                  </h4>
                  {proj.bulkTanks.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic">No storage tank assigned to this site.</p>
                  ) : (
                    proj.bulkTanks.map((tank) => {
                      const percent = Math.min(100, Math.max(0, (tank.balance / tank.capacity) * 100));
                      return (
                        <div key={tank.id} className="space-y-1">
                          <div className="flex justify-between items-baseline text-[11px]">
                            <span className="text-gray-300 font-semibold">{tank.name}</span>
                            <span className="text-gray-400">
                              <span className="text-white font-bold">{tank.balance.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                              {" / "}{tank.capacity.toLocaleString()} L
                            </span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Month issue split */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[9px] text-gray-500 font-semibold uppercase block">This Month</span>
                    <span className="text-sm font-bold text-white">{agg.litres.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[9px] text-gray-500 font-semibold uppercase block flex items-center gap-1"><Droplet className="w-3 h-3" /> Auto</span>
                    <span className="text-sm font-bold text-white">{agg.auto.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <span className="text-[9px] text-gray-500 font-semibold uppercase block flex items-center gap-1"><Droplet className="w-3 h-3" /> Super</span>
                    <span className="text-sm font-bold text-white">{agg.superD.toLocaleString(undefined, { maximumFractionDigits: 0 })} L</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent deliveries to sites */}
      <div className="bg-[#1b1e30] border border-white/5 rounded-2xl p-6 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> Recent Deliveries to Site Tanks
        </h3>
        {recentTransfers.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">No site tank deliveries recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {recentTransfers.map((tr) => (
              <div key={tr.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5 text-xs">
                <div>
                  <span className="font-bold text-white">
                    {tr.fromTank?.name || "Main Pump"} → {tr.toTank?.name || "Site Tank"}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {tr.toTank?.project ? `Site: ${tr.toTank.project.name} • ` : ""}
                    {new Date(tr.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className="font-bold text-indigo-400">
                  {tr.litres.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
