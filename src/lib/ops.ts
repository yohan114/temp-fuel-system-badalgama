import { prisma } from "./db";

// Whether the operating-hours lock (default 08:00–17:00 Asia/Colombo) is enforced.
// Admin-configurable via the "ops.timeLockEnabled" setting; defaults to enabled.
export async function isTimeLockEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "ops.timeLockEnabled" } });
  return (row?.value ?? "true") === "true";
}

// Current hour (0–23) in the Asia/Colombo timezone.
function colomboHour(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
}

// True when fuel operations are currently blocked by the operating-hours window.
// Honours TEST_ENV (never blocks under test) and the admin time-lock toggle, so the
// default behaviour is identical to the previous hardcoded 08:00–17:00 check.
export async function isOutsideOperatingWindow(): Promise<boolean> {
  if (process.env.TEST_ENV === "true") return false;
  if (!(await isTimeLockEnabled())) return false;
  const h = colomboHour();
  return h < 8 || h >= 17;
}
