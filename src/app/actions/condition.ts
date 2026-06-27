"use server";

import { prisma } from "@/lib/db";
import { assertCan, isProjectScoped } from "@/lib/rbac";
import { isOutsideOperatingWindow } from "@/lib/ops";
import { revalidatePath } from "next/cache";

export async function logDailyConditionAction(assetId: string, status: string, note: string | null = null) {
  let user;
  try {
    user = await assertCan("create");
  } catch (err) {
    return { error: "You are not authorized to log machine conditions" };
  }

  if (status !== "WORKING" && status !== "BREAKDOWN") {
    return { error: "Invalid status value. Must be WORKING or BREAKDOWN." };
  }

  // Daily logging is restricted to the operating-hours window (admin-configurable)
  if (await isOutsideOperatingWindow()) {
    return { error: "Condition logging is only allowed between 8:00 AM and 17:00 PM." };
  }

  // Daily logDate truncated to Colombo local midnight YYYY-MM-DD
  const colomboTodayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const [colomboYear, colomboMonth, colomboDay] = colomboTodayStr.split("-").map(Number);
  const logDate = new Date(colomboYear, colomboMonth - 1, colomboDay);

  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      return { error: "Asset not found" };
    }

    // Check project user scope
    if (isProjectScoped(user.role) && user.projectId && asset.projectId !== user.projectId) {
      return { error: "Asset does not belong to your assigned project" };
    }

    // Upsert condition log for this asset and date
    const condition = await prisma.dailyCondition.upsert({
      where: {
        assetId_logDate: {
          assetId,
          logDate,
        },
      },
      update: {
        status,
        note,
        recordedById: user.id,
      },
      create: {
        assetId,
        status,
        note,
        logDate,
        recordedById: user.id,
      },
    });

    // Also sync status in the Asset table so that it displays in fleet list correctly!
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        status: status === "WORKING" ? "ACTIVE" : "INACTIVE",
      },
    });

    // Track continuous breakdown periods (start -> repair) for downtime reporting.
    // Best-effort: a missing/unmigrated table must never block condition logging.
    try {
      const openEvent = await prisma.breakdownEvent.findFirst({
        where: { assetId, resolvedAt: null },
        orderBy: { startedAt: "desc" },
      });
      if (status === "BREAKDOWN" && !openEvent) {
        await prisma.breakdownEvent.create({
          data: { assetId, startedById: user.id, note },
        });
      } else if (status === "WORKING" && openEvent) {
        await prisma.breakdownEvent.update({
          where: { id: openEvent.id },
          data: { resolvedAt: new Date(), resolvedById: user.id },
        });
      }
    } catch (err: any) {
      console.warn("Breakdown event tracking skipped:", err?.message || err);
    }

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entity: "Asset",
        entityId: assetId,
        summary: `Set daily machine condition of ${asset.code} to ${status}`,
      },
    });

    revalidatePath("/");
    revalidatePath("/fleet");
    revalidatePath(`/fleet/${asset.code}`);
    revalidatePath("/admin/breakdowns");
    return { success: true };
  } catch (err: any) {
    console.error("Log daily condition error:", err);
    return { error: err.message || "Failed to log daily machine condition" };
  }
}
