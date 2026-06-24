import React from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import FuelIssuesClient from "./FuelIssuesClient";

interface PageProps {
  searchParams: Promise<{ q?: string; fuelKind?: string }>;
}

export default async function FuelIssuesPage(props: PageProps) {
  const session = await getSession();
  if (!session) return null;

  const searchParams = await props.searchParams;
  const q = searchParams.q || "";
  const fuelKindFilter = searchParams.fuelKind || "";

  // 1. Build where query
  const where: any = {};
  if (fuelKindFilter) {
    where.fuelKind = fuelKindFilter;
  }

  if (q) {
    where.asset = {
      code: { contains: q.trim().toUpperCase() },
    };
  }

  if (session.role === "USER" && session.projectId) {
    where.asset = {
      ...where.asset,
      projectId: session.projectId,
    };
  }

  // 2. Query dispatches
  const issues = await prisma.fuelIssue.findMany({
    where,
    include: {
      asset: true,
      issuedBy: true,
    },
    orderBy: {
      issueDate: "desc",
    },
  });

  const isAdmin = session.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-wide">Fuel Issues Log</h1>
        <p className="text-xs text-gray-400 mt-1">
          Historical record of fuel dispatches, cost snapshots, and linked request references.
        </p>
      </div>

      <FuelIssuesClient
        initialIssues={issues as any}
        isAdmin={isAdmin}
        q={q}
        fuelKindFilter={fuelKindFilter}
      />
    </div>
  );
}

