import React from "react";
import { prisma } from "@/lib/db";
import { updateOpsSettingsAction } from "@/app/actions/admin";
import { Clock } from "lucide-react";

export default async function AdminSettingsPage() {
  const row = await prisma.setting.findUnique({ where: { key: "ops.timeLockEnabled" } });
  const enabled = (row?.value ?? "true") === "true";

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          Operating Hours
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Control whether fuel operations (requests, issues, meter readings and condition logs)
          are restricted to the 08:00&ndash;17:00 window.
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await updateOpsSettingsAction(formData);
        }}
        className="space-y-4 bg-white/5 border border-white/5 p-5 rounded-2xl"
      >
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Operating-hours lock
          </label>
          <select
            name="timeLockEnabled"
            defaultValue={enabled ? "true" : "false"}
            className="w-full bg-[#1b1e30] border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50"
          >
            <option value="true">Enabled — block operations outside 08:00–17:00</option>
            <option value="false">Disabled — allow operations at any time</option>
          </select>
          <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
            The after-hours exceptions (Vehicle Breakdown / Active Night Work for pump dispatches)
            and the backdating rules are unaffected by this toggle.
          </p>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-md"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}
