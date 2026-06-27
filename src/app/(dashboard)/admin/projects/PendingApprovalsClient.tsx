"use client";

import React, { useState, useTransition } from "react";
import { approveBulkRequestAction, rejectBulkRequestAction } from "@/app/actions/workshop";
import { Layers, Check, X, AlertTriangle, RefreshCw } from "lucide-react";

interface RequestProp {
  id: string;
  fuelKind: string;
  requestedLitres: number;
  createdAt: string | Date;
  bulkTank: { name: string };
  requestedBy: { name: string };
}

export default function PendingApprovalsClient({ initialRequests }: { initialRequests: RequestProp[] }) {
  const [requests, setRequests] = useState<RequestProp[]>(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const handle = (id: string, kind: "approve" | "reject") => {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res =
          kind === "approve"
            ? await approveBulkRequestAction(id, "Approved by Admin")
            : await rejectBulkRequestAction(id, "Rejected by Admin");
        if (res?.error) {
          setError(res.error);
        } else {
          setRequests((prev) => prev.filter((r) => r.id !== id));
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred while processing the request.");
      } finally {
        setBusyId(null);
      }
    });
  };

  if (requests.length === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 shadow-md space-y-4">
      <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
        <Layers className="w-4 h-4 text-amber-400" />
        Pending Replenishment Approvals ({requests.length})
      </h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/15 text-red-400 text-xs px-4 py-3 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="divide-y divide-white/5">
        {requests.map((req) => {
          const busy = isPending && busyId === req.id;
          return (
            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{req.bulkTank.name}</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded uppercase">
                    {req.fuelKind.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Requested by {req.requestedBy.name} • {new Date(req.createdAt).toLocaleString()}
                </p>
                <p className="text-white font-bold mt-2 text-md">
                  Request Quantity: {req.requestedLitres.toLocaleString()} L
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handle(req.id, "approve")}
                  disabled={busy}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-2 rounded-xl text-xs active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none"
                >
                  {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Approve Refuel
                </button>

                <button
                  onClick={() => handle(req.id, "reject")}
                  disabled={busy}
                  className="flex items-center gap-1 bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-gray-400 border border-white/5 font-semibold px-3 py-2 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
