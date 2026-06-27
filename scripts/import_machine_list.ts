/**
 * Import vehicles/machinery from data/MACHINE_LIST_2022.11.10.xlsx into the database.
 *
 * Adds ASSETS that are missing (matched by E&C code). Existing assets are left
 * untouched by default so production data is never overwritten.
 *
 * Run on the server (uses DATABASE_URL):
 *   npx tsx scripts/import_machine_list.ts                 # import missing vehicles
 *   DRY_RUN=true npx tsx scripts/import_machine_list.ts    # preview only, write nothing
 *   SKIP_SOLD=true npx tsx scripts/import_machine_list.ts  # don't import SOLD vehicles at all
 *   UPDATE_EXISTING=true npx tsx scripts/import_machine_list.ts  # also refresh existing assets
 *
 * SOLD vehicles are imported with status "DISPOSED" (so they stay out of the
 * active fleet lists) unless SKIP_SOLD=true.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./data/app.db",
});
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === "true";
const SKIP_SOLD = process.env.SKIP_SOLD === "true";
const UPDATE_EXISTING = process.env.UPDATE_EXISTING === "true";

const CATEGORY_MAP: Record<
  string,
  { name: string; defaultMeterType: "KM" | "HOURS"; fleetGroup: "ROAD_VEHICLE" | "MACHINERY_GENSET" }
> = {
  // KM / ROAD_VEHICLE
  DT: { name: "Dump Truck", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  DC: { name: "Double Cab", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  SC: { name: "Single Cab", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  HCC: { name: "Crew Cab", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  TM: { name: "Truck Mixer", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  BD: { name: "Bed Truck", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  DB: { name: "Dump Bowser", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  WB: { name: "Water Bowser", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  TB: { name: "Tractor Bowser", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  BS: { name: "Bus", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  PV: { name: "Prime Mover", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  BM: { name: "Boom Truck", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  MB: { name: "Motor Bicycle", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },

  // HOURS / MACHINERY_GENSET
  LB: { name: "Backhoe Loader", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  LD: { name: "Wheel Loader", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  SL: { name: "Skid Steer Loader", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  MG: { name: "Motor Grader", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  HEX: { name: "Excavator", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  SR: { name: "Static Roller", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  VR: { name: "Vibrating Roller", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  PTR: { name: "Pneumatic Roller", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  AP: { name: "Asphalt Paver", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  CR: { name: "Mobile Crane", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  PC: { name: "Pump Truck", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  FL: { name: "Fork Lift", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
  FT: { name: "Farm Tractor", defaultMeterType: "HOURS", fleetGroup: "MACHINERY_GENSET" },
};

function parseYom(val: any): number | null {
  if (typeof val === "number") return Math.trunc(val);
  if (typeof val === "string") {
    const num = parseInt(val.trim(), 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

function cleanString(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

function rowIsSold(row: any[]): boolean {
  return row.some((c) => c != null && String(c).trim().toUpperCase() === "SOLD");
}

interface VehicleRecord {
  code: string;
  brand: string | null;
  typeLabel: string | null;
  model: string | null;
  regNo: string | null;
  capacity: string | null;
  yom: number | null;
  serialNo: string | null;
  chassisNo: string | null;
  engineNo: string | null;
  site: string | null;
  sold: boolean;
}

const CODE_RE = /^[A-Z]{1,4}-/;

async function main() {
  console.log(
    `Machine list import — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}` +
      `${SKIP_SOLD ? ", skipping SOLD" : ""}${UPDATE_EXISTING ? ", updating existing" : ""}`
  );

  // 1. Ensure categories exist (including TB Tractor Bowser).
  const categoryDbIds: Record<string, string> = {};
  for (const [code, d] of Object.entries(CATEGORY_MAP)) {
    const cat = await prisma.category.upsert({
      where: { code },
      update: { name: d.name, defaultMeterType: d.defaultMeterType, fleetGroup: d.fleetGroup },
      create: { code, name: d.name, defaultMeterType: d.defaultMeterType, fleetGroup: d.fleetGroup },
    });
    categoryDbIds[code] = cat.id;
  }
  const fallback = await prisma.category.upsert({
    where: { code: "OTHER" },
    update: {},
    create: { code: "OTHER", name: "Other Asset", defaultMeterType: "KM", fleetGroup: "ROAD_VEHICLE" },
  });
  categoryDbIds["OTHER"] = fallback.id;

  // 2. Parse the workbook.
  const excelPath = path.join(process.cwd(), "data", "MACHINE_LIST_2022.11.10.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.error(`Error: machine list not found at ${excelPath}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(excelPath);
  const records: Record<string, VehicleRecord> = {};

  const addRecord = (rec: VehicleRecord) => {
    const existing = records[rec.code];
    if (!existing) {
      records[rec.code] = rec;
    } else if (existing.sold && !rec.sold) {
      records[rec.code] = rec; // prefer the active listing over a sold duplicate
    }
  };

  // Sheet2 — main machinery list (data from row index 3).
  const s2 = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Sheet2"], { header: 1, blankrows: false });
  for (let i = 3; i < s2.length; i++) {
    const r = s2[i] || [];
    const code = cleanString(r[2]);
    if (!code || !CODE_RE.test(code.toUpperCase())) continue;
    const sold = rowIsSold(r);
    addRecord({
      code: code.toUpperCase(),
      brand: cleanString(r[3]),
      typeLabel: cleanString(r[4]),
      model: cleanString(r[5]),
      regNo: cleanString(r[6]),
      capacity: cleanString(r[7]),
      yom: parseYom(r[8]),
      serialNo: cleanString(r[9]),
      chassisNo: cleanString(r[10]),
      engineNo: cleanString(r[11]),
      site: sold ? null : cleanString(r[13]),
      sold,
    });
  }

  // Sheet4 — Badalgama motorcycles (data from row index 2).
  const s4 = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["Sheet4"], { header: 1, blankrows: false });
  for (let i = 2; i < s4.length; i++) {
    const r = s4[i] || [];
    const code = cleanString(r[1]);
    if (!code || !CODE_RE.test(code.toUpperCase())) continue;
    const sold = rowIsSold(r);
    addRecord({
      code: code.toUpperCase(),
      brand: cleanString(r[2]),
      typeLabel: cleanString(r[3]),
      model: cleanString(r[4]),
      regNo: cleanString(r[5]),
      capacity: cleanString(r[6]),
      yom: null,
      serialNo: cleanString(r[7]),
      chassisNo: null,
      engineNo: null,
      site: sold ? null : cleanString(r[8]),
      sold,
    });
  }

  const all = Object.values(records);
  console.log(
    `Parsed ${all.length} unique vehicles (${all.filter((r) => !r.sold).length} active, ${all.filter((r) => r.sold).length} sold).`
  );

  // 3. Import.
  let created = 0;
  let createdSold = 0;
  let updated = 0;
  let skippedExisting = 0;
  let skippedSold = 0;
  const unknownPrefixes = new Set<string>();

  for (const rec of all) {
    if (rec.sold && SKIP_SOLD) {
      skippedSold++;
      continue;
    }

    const prefix = rec.code.split("-")[0].toUpperCase();
    const categoryId = categoryDbIds[prefix] || categoryDbIds["OTHER"];
    if (!CATEGORY_MAP[prefix]) unknownPrefixes.add(prefix);
    const meterType = CATEGORY_MAP[prefix]?.defaultMeterType || "KM";
    const status = rec.sold ? "DISPOSED" : "ACTIVE";

    const data = {
      brand: rec.brand,
      typeLabel: rec.typeLabel,
      model: rec.model,
      regNo: rec.regNo,
      capacity: rec.capacity,
      yom: rec.yom,
      serialNo: rec.serialNo,
      chassisNo: rec.chassisNo,
      engineNo: rec.engineNo,
      site: rec.site,
      categoryId,
      meterType,
      status,
    };

    const existing = await prisma.asset.findUnique({ where: { code: rec.code } });
    if (existing) {
      if (UPDATE_EXISTING) {
        if (!DRY_RUN) await prisma.asset.update({ where: { code: rec.code }, data });
        updated++;
      } else {
        skippedExisting++;
      }
      continue;
    }

    if (!DRY_RUN) {
      await prisma.asset.create({ data: { code: rec.code, ...data } });
    }
    created++;
    if (rec.sold) createdSold++;
  }

  console.log("\n──────── Summary ────────");
  console.log(`Created:          ${created}${createdSold ? ` (incl. ${createdSold} disposed/sold)` : ""}`);
  console.log(`Updated existing: ${updated}`);
  console.log(`Skipped existing: ${skippedExisting}`);
  if (SKIP_SOLD) console.log(`Skipped sold:     ${skippedSold}`);
  if (unknownPrefixes.size) console.log(`Unknown prefixes (-> OTHER): ${[...unknownPrefixes].join(", ")}`);
  if (DRY_RUN) console.log("\nDRY RUN — no changes were written. Re-run without DRY_RUN to apply.");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
