"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Search, Fuel, Coins, Calendar, User, Edit, X, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { editFuelIssueAction } from "@/app/actions/fuel";

interface AssetProp {
  id: string;
  code: string;
  meterType: string;
}

interface UserProp {
  id: string;
  name: string;
}

interface FuelIssueProp {
  id: string;
  fuelKind: string;
  litres: number;
  meterReading: number | null;
  readingType: string | null;
  pricePerLitre: number;
  totalCost: number;
  source: string;
  issueDate: Date | string;
  createdAt: Date | string;
  assetId: string;
  asset: AssetProp;
  issuedById: string;
  issuedBy: UserProp;
  bulkTankId: string | null;
}

interface FuelIssuesClientProps {
  initialIssues: FuelIssueProp[];
  isAdmin: boolean;
  q: string;
  fuelKindFilter: string;
}

export default function FuelIssuesClient({
  initialIssues,
  isAdmin,
  q,
  fuelKindFilter,
}: FuelIssuesClientProps) {
  const [issues, setIssues] = useState<FuelIssueProp[]>(initialIssues);
  const [editingIssue, setEditingIssue] = useState<FuelIssueProp | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Sync state if props change
  React.useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Compute sums
  let totalLitres = 0;
  let totalCostCents = 0;
  issues.forEach((issue) => {
    totalLitres += issue.litres;
    totalCostCents += issue.totalCost;
  });

  const openEditModal = (issue: FuelIssueProp) => {
    setEditingIssue(issue);
    setError(null);
    setSuccess(false);
  };

  const closeEditModal = () => {
    setEditingIssue(null);
    setError(null);
    setSuccess(false);
  };

  const formatDateForInput = (date: Date | string) => {
    const d = new Date(date);
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingIssue) return;
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const targetId = editingIssue.id;

    startTransition(async () => {
      const res = await editFuelIssueAction(targetId, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          closeEditModal();
          // Reload the page window to fetch fresh data from server
          window.location.reload();
        }, 1200);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter and Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters Form */}
        <div className="lg:col-span-2 bg-[#121420] border border-white/5 rounded-2xl p-5 shadow-lg flex items-center">
          <form method="GET" action="/fuel/issues" className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search by asset */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search asset e.g. DT-01"
                className="w-full bg-[#1b1e30] border border-white/5 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-500 text-xs focus:outline-none"
              />
            </div>

            {/* Fuel Kind dropdown */}
            <div>
              <select
                name="fuelKind"
                defaultValue={fuelKindFilter}
                className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
              >
                <option value="">All Fuel Kinds</option>
                <option value="AUTO_DIESEL">Auto Diesel</option>
                <option value="SUPER_DIESEL">Super Diesel</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl py-2.5 active:scale-95 transition-all shadow-md"
              >
                Filter Log
              </button>
              <Link
                href="/fuel/issues"
                className="px-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center border border-white/5 active:scale-95 transition-all"
              >
                Clear
              </Link>
            </div>
          </form>
        </div>

        {/* Aggregated totals info */}
        <div className="bg-[#121420] border border-white/5 rounded-2xl p-5 shadow-lg flex items-center justify-between text-xs">
          <div>
            <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Filter Sum</span>
            <span className="text-white block mt-1 font-bold text-base">
              {totalLitres.toLocaleString("en-US", { maximumFractionDigits: 1 })} L
            </span>
            <span className="text-[10px] text-gray-500 block">Total volume matching filters</span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 font-semibold block uppercase tracking-wider text-[10px]">Total Cost</span>
            <span className="text-indigo-400 block mt-1 font-bold text-base">
              Rs. {(totalCostCents / 100).toLocaleString("en-LK", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] text-gray-500 block">Total cost in LKR</span>
          </div>
        </div>
      </div>

      {/* Dispatches List */}
      {issues.length === 0 ? (
        <div className="bg-[#121420] border border-white/5 rounded-2xl py-16 text-center text-xs text-gray-500">
          No dispatches found matching filters.
        </div>
      ) : (
        <div className="bg-[#121420] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-white/5 text-gray-400 border-b border-white/5">
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Asset Code</th>
                  <th className="px-6 py-4 font-semibold">Fuel Kind</th>
                  <th className="px-6 py-4 font-semibold">Volume</th>
                  <th className="px-6 py-4 font-semibold">Odo/Hours</th>
                  <th className="px-6 py-4 font-semibold">Pump Price</th>
                  <th className="px-6 py-4 font-semibold">Total Cost</th>
                  <th className="px-6 py-4 font-semibold">Issued By</th>
                  <th className="px-6 py-4 font-semibold">Source</th>
                  {isAdmin && <th className="px-6 py-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-gray-300 font-medium">
                      {new Date(issue.issueDate).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/fleet/${issue.asset.code}`}
                        className="font-bold text-white hover:text-indigo-400 tracking-wide transition-colors"
                      >
                        {issue.asset.code}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-400 capitalize">
                      {issue.fuelKind.replace("_", " ").toLowerCase()}
                    </td>
                    <td className="px-6 py-4 text-white font-bold">
                      {issue.litres.toFixed(1)} L
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono">
                      {issue.meterReading !== null ? (
                        <span>
                          {issue.meterReading.toLocaleString()} {issue.readingType}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono">
                      Rs. {(issue.pricePerLitre / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-white font-bold font-mono">
                      Rs. {(issue.totalCost / 100).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {issue.issuedBy.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-white/5 px-2 py-0.5 rounded text-[9px] uppercase font-bold text-gray-400 border border-white/5">
                        {issue.source}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditModal(issue)}
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold hover:underline"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Issue Modal */}
      {editingIssue && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#121420] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative text-left">
            <button
              onClick={closeEditModal}
              className="absolute right-4 top-4 text-gray-400 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Fuel className="w-5 h-5 text-indigo-400" />
              Edit Fuel Issue Details
            </h3>
            <p className="text-xs text-gray-400">
              Modify the dispatch records for asset <strong>{editingIssue.asset.code}</strong>.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/10 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Fuel issue updated successfully! Reloading...</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Asset Code
                </label>
                <input
                  type="text"
                  name="assetCode"
                  required
                  defaultValue={editingIssue.asset.code}
                  className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 font-semibold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Fuel Kind
                  </label>
                  {editingIssue.bulkTankId ? (
                    <>
                      <select
                        name="fuelKind_disabled"
                        disabled
                        defaultValue={editingIssue.fuelKind}
                        className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none disabled:opacity-50"
                      >
                        <option value="AUTO_DIESEL">Auto Diesel</option>
                        <option value="SUPER_DIESEL">Super Diesel</option>
                      </select>
                      <input type="hidden" name="fuelKind" value={editingIssue.fuelKind} />
                    </>
                  ) : (
                    <select
                      name="fuelKind"
                      required
                      defaultValue={editingIssue.fuelKind}
                      className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                    >
                      <option value="AUTO_DIESEL">Auto Diesel</option>
                      <option value="SUPER_DIESEL">Super Diesel</option>
                    </select>
                  )}
                  {editingIssue.bulkTankId && (
                    <span className="text-[9px] text-gray-500 mt-1 block">
                      Locked to storage tank kind.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Litres Issued
                  </label>
                  <input
                    type="number"
                    name="litres"
                    step="0.1"
                    min="0.1"
                    required
                    defaultValue={editingIssue.litres}
                    className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Odometer / Hour Reading
                  </label>
                  <input
                    type="number"
                    name="meterReading"
                    step="0.1"
                    min="0"
                    placeholder="None"
                    defaultValue={editingIssue.meterReading !== null ? editingIssue.meterReading : ""}
                    className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Source Location
                  </label>
                  <input
                    type="text"
                    name="source"
                    required
                    defaultValue={editingIssue.source}
                    className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Issue Date / Time
                </label>
                <input
                  type="datetime-local"
                  name="issueDate"
                  required
                  defaultValue={formatDateForInput(editingIssue.issueDate)}
                  className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
